import logging
import json
from datetime import datetime, timezone, timedelta
from typing import Optional
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...models.activity_log import ActivityLog
from ...models.intervention import Intervention
from ...models.problem import Problem
from ...models.problem_recommendation import ProblemRecommendation
from ...models.promi_coach_log import PromiCoachLog
from ...models.risk_score import RiskScore
from ...models.student_note import StudentNote
from ...models.submission import Submission
from ...models.user import User
from ...schemas.admin import (
    ActivityLogItem,
    ActivityLogListResponse,
    BulkInterventionCreate,
    DashboardResponse,
    DropoutTrendPoint,
    DropoutTrendResponse,
    InterventionCreate,
    InterventionEffectItem,
    InterventionEffectResponse,
    InterventionPriorityItem,
    InterventionPriorityQueueResponse,
    InterventionListItem,
    InterventionListResponse,
    InterventionResponse,
    InterventionStatusUpdate,
    InterventionSuggestionItem,
    LearningPatternItem,
    LearningPatternResponse,
    ProblemCreate,
    ProblemInsightItem,
    ProblemInsightResponse,
    ProblemRecommendationCreate,
    ProblemRecommendationResponse,
    ProblemResponse,
    ProblemUpdate,
    PromiReviewAction,
    PromiReviewActionResponse,
    PromiReviewQueueItem,
    PromiReviewQueueResponse,
    PromiRuleUpdateItem,
    PromiRuleUpdateQueueResponse,
    PromiRuleUpdateResolve,
    PromiRuleUpdateResolveResponse,
    RecommendationEffectItem,
    RecommendationEffectResponse,
    RecentHighRiskItem,
    RiskDistributionItem,
    RiskHistoryItem,
    RiskTrendPoint,
    RiskTrendResponse,
    StudentDetailExtended,
    StudentListResponse,
    StudentNoteCreate,
    StudentNoteResponse,
    StudentRiskItem,
    StudentTimelineItem,
    StudentTimelineResponse,
    SubmissionAdminItem,
    SubmissionAdminListResponse,
)
from ...services.intervention_service import InterventionService
from ..deps import get_current_admin

logger = logging.getLogger("app.admin")

router = APIRouter(prefix="/admin", tags=["admin"])


FAILURE_TAG_LABELS = {
    "role_missing": "역할 정의 부족",
    "goal_unclear": "목표 명확성 부족",
    "fewshot_missing": "예시 부족",
    "input_template_missing": "입력 템플릿 부족",
    "format_missing": "출력 형식 부족",
}


def _extract_failure_tags(prompt_text: str) -> list[str]:
    tags: list[str] = []
    lower = prompt_text.lower()
    if not any(w in prompt_text for w in ["역할", "당신", "너", "assistant", "전문가", "도우미"]):
        tags.append("role_missing")
    if len(prompt_text.strip()) < 80:
        tags.append("goal_unclear")
    if "few-shot" not in lower and "예시" not in prompt_text:
        tags.append("fewshot_missing")
    if "{{input}}" not in prompt_text:
        tags.append("input_template_missing")
    if not any(w in lower for w in ["형식", "format", "json", "markdown", "목록", "출력"]):
        tags.append("format_missing")
    return tags


def _summarize_pattern(submissions: list[Submission], risks: list[RiskScore]) -> tuple[str, str]:
    submission_count = len(submissions)
    avg_score = round(sum(float(s.final_score or s.total_score or 0.0) for s in submissions) / submission_count, 1) if submissions else 0.0
    latest_risk = risks[0].total_risk if risks else 0.0
    if submission_count == 0:
        return "미제출군", "최근 제출이 거의 없어 학습 신호가 부족합니다."
    if submission_count >= 4 and avg_score < 65:
        return "실행많음_저성취", "시도는 많지만 점수 개선이 더딘 흐름입니다."
    if len(submissions) >= 2 and float(submissions[0].final_score or submissions[0].total_score or 0.0) < float(submissions[1].final_score or submissions[1].total_score or 0.0):
        return "하락세", "최근 제출 점수가 직전보다 하락했습니다."
    if latest_risk >= 70:
        return "고위험군", "위험도가 높아 우선 개입이 필요한 상태입니다."
    return "일반", "학습 흐름은 대체로 안정적입니다."


def _safe_submission_score(submission: Submission, risk: RiskScore | None = None) -> float:
    if submission.final_score is not None:
        return float(submission.final_score)
    if submission.total_score is not None:
        return float(submission.total_score)
    if risk is not None:
        return max(0.0, round(100.0 - float(risk.total_risk), 1))
    return 0.0


def _review_flags_for_promi(log: PromiCoachLog) -> list[str]:
    text = " ".join([log.message or "", log.caution or "", log.checkpoints_json or ""]).lower()
    flags: list[str] = []
    direct_answer_markers = ["정답은", "답은", "아래처럼 작성", "그대로 쓰", "final answer", "the answer is"]
    generic_markers = ["더 구체적으로", "명확하게", "좋아요", "확인해보세요"]
    if any(marker in text for marker in direct_answer_markers):
        flags.append("정답 직접 제공 의심")
    if sum(1 for marker in generic_markers if marker in text) >= 2 and len(log.message or "") < 90:
        flags.append("너무 일반적")
    if log.caution:
        flags.append("주의 문구 포함")
    return flags


def _parse_checkpoints(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        return [str(item) for item in parsed[:3]] if isinstance(parsed, list) else []
    except json.JSONDecodeError:
        return []


def _itv_resp(i: Intervention) -> InterventionResponse:
    return InterventionResponse(
        id=str(i.id), student_id=str(i.student_id), type=i.type,
        message=i.message, dropout_type=i.dropout_type,
        status=i.status, created_at=i.created_at,
    )


def _latest_risk_subq():
    return (
        select(RiskScore.student_id, func.max(RiskScore.calculated_at).label("max_at"))
        .group_by(RiskScore.student_id)
        .subquery()
    )


def _problem_recommendation_response(rec: ProblemRecommendation, problem: Problem) -> ProblemRecommendationResponse:
    return ProblemRecommendationResponse(
        id=str(rec.id),
        student_id=str(rec.student_id),
        problem_id=str(rec.problem_id),
        admin_id=str(rec.admin_id),
        reason=rec.reason,
        is_active=rec.is_active,
        created_at=rec.created_at,
        problem_title=problem.title,
        problem_description=problem.description,
        problem_difficulty=problem.difficulty,
        problem_category=problem.category,
    )


@router.get("/dashboard", response_model=DashboardResponse)
async def dashboard(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_admin)):
    total_students = (await db.execute(
        select(func.count()).select_from(User).where(User.role == "student")
    )).scalar() or 0

    subq = _latest_risk_subq()
    latest_risks = (await db.execute(
        select(RiskScore).join(
            subq,
            (RiskScore.student_id == subq.c.student_id) &
            (RiskScore.calculated_at == subq.c.max_at),
        )
    )).scalars().all()

    stage_order = ["안정", "경미", "주의", "고위험", "심각"]
    stage_count: dict[str, int] = {s: 0 for s in stage_order}
    for r in latest_risks:
        if r.risk_stage in stage_count:
            stage_count[r.risk_stage] += 1

    total_with_risk = len(latest_risks) or 1
    risk_distribution = [
        RiskDistributionItem(
            stage=stage,
            count=stage_count[stage],
            percentage=round(stage_count[stage] / total_with_risk * 100, 1),
        )
        for stage in stage_order
    ]

    high_risk_count = stage_count["고위험"] + stage_count["심각"]

    pending_count = (await db.execute(
        select(func.count()).select_from(Intervention).where(Intervention.status == "pending")
    )).scalar() or 0

    recent_q = (
        select(User, RiskScore)
        .join(RiskScore, User.id == RiskScore.student_id)
        .join(subq, (RiskScore.student_id == subq.c.student_id) &
                    (RiskScore.calculated_at == subq.c.max_at))
        .where(User.role == "student")
        .where(RiskScore.risk_stage.in_(["고위험", "심각"]))
        .order_by(desc(RiskScore.total_risk))
        .limit(5)
    )
    recent_rows = (await db.execute(recent_q)).all()
    recent_high_risk = [
        RecentHighRiskItem(
            student_id=str(u.id), username=u.username, email=u.email,
            total_risk=r.total_risk, risk_stage=r.risk_stage,
            dropout_type=r.dropout_type, calculated_at=r.calculated_at,
        )
        for u, r in recent_rows
    ]

    all_students = (await db.execute(select(User).where(User.role == "student"))).scalars().all()
    pattern_summary: list[str] = []
    for user in all_students[:20]:
        submissions = (await db.execute(
            select(Submission).where(Submission.student_id == str(user.id)).order_by(desc(Submission.created_at)).limit(5)
        )).scalars().all()
        risks = (await db.execute(
            select(RiskScore).where(RiskScore.student_id == str(user.id)).order_by(desc(RiskScore.calculated_at)).limit(2)
        )).scalars().all()
        group, _ = _summarize_pattern(submissions, risks)
        pattern_summary.append(group)
    pattern_count = defaultdict(int)
    for item in pattern_summary:
        pattern_count[item] += 1
    pattern_lines = [f"{label} {count}명" for label, count in sorted(pattern_count.items(), key=lambda item: (-item[1], item[0]))[:4]]

    return DashboardResponse(
        total_students=total_students,
        high_risk_count=high_risk_count,
        pending_interventions=pending_count,
        risk_distribution=risk_distribution,
        recent_high_risk=recent_high_risk,
        pattern_summary=pattern_lines,
    )


@router.get("/students", response_model=StudentListResponse)
async def list_students(
    risk_stage:   Optional[str] = Query(None),
    dropout_type: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    subq = _latest_risk_subq()
    q = (
        select(User, RiskScore)
        .join(RiskScore, User.id == RiskScore.student_id)
        .join(subq, (RiskScore.student_id == subq.c.student_id) &
                    (RiskScore.calculated_at == subq.c.max_at))
        .where(User.role == "student")
    )
    if risk_stage:
        q = q.where(RiskScore.risk_stage == risk_stage)
    if dropout_type:
        q = q.where(RiskScore.dropout_type == dropout_type)
    q = q.order_by(desc(RiskScore.total_risk)).limit(limit)

    rows = (await db.execute(q)).all()
    items = [
        StudentRiskItem(
            student_id=str(u.id), username=u.username, email=u.email,
            total_risk=r.total_risk, risk_stage=r.risk_stage,
            dropout_type=r.dropout_type, calculated_at=r.calculated_at,
            helper_points=int(u.helper_points or 0),
            submission_count=len(student_submissions),
            avg_score=avg_score,
            pattern_group=pattern_group,
            latest_failure_tags=failure_tags,
        )
        for u, r in rows
        for student_submissions in [(
            (await db.execute(select(Submission).where(Submission.student_id == str(u.id)).order_by(desc(Submission.created_at)).limit(5))).scalars().all()
        )]
        for avg_score in [round(sum(float(s.final_score or s.total_score or 0.0) for s in student_submissions) / len(student_submissions), 1) if student_submissions else 0.0]
        for pattern_group, _ in [_summarize_pattern(student_submissions, [r])]
        for failure_tags in [[tag for s in student_submissions[:2] for tag in _extract_failure_tags(s.prompt_text or "")][:4]]
    ]
    return StudentListResponse(items=items, total=len(items))


@router.get("/students/{student_id}/problem-recommendations", response_model=list[ProblemRecommendationResponse])
async def get_student_problem_recommendations(
    student_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    user = (await db.execute(
        select(User).where(User.id == student_id, User.role == "student")
    )).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="학생을 찾을 수 없습니다.")

    rows = (await db.execute(
        select(ProblemRecommendation, Problem)
        .join(Problem, Problem.id == ProblemRecommendation.problem_id)
        .where(ProblemRecommendation.student_id == student_id)
        .where(ProblemRecommendation.is_active.is_(True))
        .order_by(desc(ProblemRecommendation.created_at))
    )).all()

    return [_problem_recommendation_response(rec, problem) for rec, problem in rows]


@router.post("/students/{student_id}/problem-recommendations", response_model=ProblemRecommendationResponse, status_code=201)
async def create_student_problem_recommendation(
    student_id: str,
    data: ProblemRecommendationCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    user = (await db.execute(
        select(User).where(User.id == student_id, User.role == "student")
    )).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="학생을 찾을 수 없습니다.")

    problem = (await db.execute(
        select(Problem).where(Problem.id == data.problem_id)
    )).scalar_one_or_none()
    if not problem:
        raise HTTPException(status_code=404, detail="문제를 찾을 수 없습니다.")

    existing = (await db.execute(
        select(ProblemRecommendation)
        .where(ProblemRecommendation.student_id == student_id)
        .where(ProblemRecommendation.problem_id == data.problem_id)
        .where(ProblemRecommendation.is_active.is_(True))
        .order_by(desc(ProblemRecommendation.created_at))
    )).scalars().first()
    if existing:
        raise HTTPException(status_code=409, detail="이미 추천된 문제입니다.")

    recommendation = ProblemRecommendation(
        student_id=student_id,
        problem_id=data.problem_id,
        admin_id=str(admin.id),
        reason=data.reason,
        is_active=True,
    )
    db.add(recommendation)
    await db.commit()
    await db.refresh(recommendation)
    db.add(ActivityLog(
        user_id=str(admin.id),
        role="admin",
        action="problem_recommendation_created",
        target_type="student",
        target_id=str(student_id),
        message=f"{user.username} 학생에게 문제를 추천했습니다.",
        metadata_json=json.dumps({"problem_id": str(problem.id)}, ensure_ascii=False),
    ))
    await db.commit()
    return _problem_recommendation_response(recommendation, problem)


@router.delete("/problem-recommendations/{recommendation_id}", status_code=204)
async def delete_problem_recommendation(
    recommendation_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    recommendation = (await db.execute(
        select(ProblemRecommendation).where(ProblemRecommendation.id == recommendation_id)
    )).scalar_one_or_none()
    if not recommendation:
        raise HTTPException(status_code=404, detail="추천 정보를 찾을 수 없습니다.")

    recommendation.is_active = False
    await db.commit()
    return None


@router.post("/intervention", response_model=InterventionResponse, status_code=201)
async def create_intervention(
    data: InterventionCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    svc = InterventionService(db)
    i = await svc.create(data)
    return _itv_resp(i)


# ── 문제 관리 CRUD ────────────────────────────────────
@router.get("/problems", response_model=list[ProblemResponse])
async def list_problems(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    problems = (await db.execute(
        select(Problem).order_by(Problem.created_at.desc())
    )).scalars().all()

    return [
        ProblemResponse(
            id=str(p.id),
            title=p.title,
            description=p.description,
            difficulty=p.difficulty,
            category=p.category,
            steps=json.loads(p.steps_json) if p.steps_json else [],
            created_at=p.created_at,
        )
        for p in problems
    ]


@router.post("/problems", response_model=ProblemResponse, status_code=201)
async def create_problem(
    data: ProblemCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    problem = Problem(
        title=data.title,
        description=data.description,
        difficulty=data.difficulty,
        category=data.category,
        steps_json=json.dumps(data.steps),
        rubric_json=json.dumps(data.rubric_criteria),
    )
    db.add(problem)
    await db.commit()
    await db.refresh(problem)

    logger.info(f"문제 생성: {problem.id}")
    return ProblemResponse(
        id=str(problem.id),
        title=problem.title,
        description=problem.description,
        difficulty=problem.difficulty,
        category=problem.category,
        steps=json.loads(problem.steps_json) if problem.steps_json else [],
        created_at=problem.created_at,
    )


@router.put("/problems/{problem_id}", response_model=ProblemResponse)
async def update_problem(
    problem_id: str,
    data: ProblemUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    problem = (await db.execute(
        select(Problem).where(Problem.id == problem_id)
    )).scalar_one_or_none()

    if not problem:
        raise HTTPException(status_code=404, detail="문제를 찾을 수 없습니다.")

    if data.title is not None:
        problem.title = data.title
    if data.description is not None:
        problem.description = data.description
    if data.difficulty is not None:
        problem.difficulty = data.difficulty
    if data.category is not None:
        problem.category = data.category
    if data.steps is not None:
        problem.steps_json = json.dumps(data.steps)
    if data.rubric_criteria is not None:
        problem.rubric_json = json.dumps(data.rubric_criteria)

    await db.commit()
    await db.refresh(problem)

    logger.info(f"문제 수정: {problem.id}")
    return ProblemResponse(
        id=str(problem.id),
        title=problem.title,
        description=problem.description,
        difficulty=problem.difficulty,
        category=problem.category,
        steps=json.loads(problem.steps_json) if problem.steps_json else [],
        created_at=problem.created_at,
    )


@router.delete("/problems/{problem_id}", status_code=204)
async def delete_problem(
    problem_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    problem = (await db.execute(
        select(Problem).where(Problem.id == problem_id)
    )).scalar_one_or_none()

    if not problem:
        raise HTTPException(status_code=404, detail="문제를 찾을 수 없습니다.")

    await db.delete(problem)
    await db.commit()

    logger.info(f"문제 삭제: {problem_id}")
    return None


# ── 개입 관리 확장 ────────────────────────────────────
@router.get("/interventions", response_model=InterventionListResponse)
async def list_interventions(
    status:      Optional[str] = Query(None),
    type:        Optional[str] = Query(None),
    student_id:  Optional[str] = Query(None),
    limit:       int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    q = select(Intervention, User).join(
        User, Intervention.student_id == User.id
    )

    if status:
        q = q.where(Intervention.status == status)
    if type:
        q = q.where(Intervention.type == type)
    if student_id:
        q = q.where(Intervention.student_id == student_id)

    cq = select(func.count()).select_from(Intervention)
    if status:
        cq = cq.where(Intervention.status == status)
    if type:
        cq = cq.where(Intervention.type == type)
    if student_id:
        cq = cq.where(Intervention.student_id == student_id)

    q = q.order_by(Intervention.created_at.desc()).limit(limit)
    rows = (await db.execute(q)).all()
    total = (await db.execute(cq)).scalar() or 0

    items = [
        InterventionListItem(
            id=str(i.id),
            student_id=str(i.student_id),
            type=i.type,
            message=i.message,
            dropout_type=i.dropout_type,
            status=i.status,
            created_at=i.created_at,
            username=u.username,
            email=u.email,
        )
        for i, u in rows
    ]

    return InterventionListResponse(items=items, total=total)


@router.get("/interventions/{intervention_id}", response_model=InterventionListItem)
async def get_intervention_detail(
    intervention_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    row = (await db.execute(
        select(Intervention, User)
        .join(User, Intervention.student_id == User.id)
        .where(Intervention.id == intervention_id)
    )).first()
    if not row:
        raise HTTPException(status_code=404, detail="개입을 찾을 수 없습니다.")
    intervention, user = row
    return InterventionListItem(
        id=str(intervention.id),
        student_id=str(intervention.student_id),
        type=intervention.type,
        message=intervention.message,
        dropout_type=intervention.dropout_type,
        status=intervention.status,
        created_at=intervention.created_at,
        username=user.username,
        email=user.email,
    )


@router.patch("/interventions/{intervention_id}/status")
async def update_intervention_status(
    intervention_id: str,
    body: InterventionStatusUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    intervention = (await db.execute(
        select(Intervention).where(Intervention.id == intervention_id)
    )).scalar_one_or_none()

    if not intervention:
        raise HTTPException(status_code=404, detail="개입을 찾을 수 없습니다.")

    new_status = body.status
    if body.message is not None:
        if not body.message.strip():
            raise HTTPException(status_code=400, detail="메시지를 입력해야 합니다.")
        intervention.message = body.message.strip()
    if new_status == "completed" and not (intervention.message or "").strip():
        raise HTTPException(status_code=400, detail="발송할 메시지가 없습니다.")
    intervention.status = new_status
    if new_status == "completed":
        intervention.student_read_at = None
        db.add(ActivityLog(
            user_id=str(admin.id),
            role="admin",
            action="intervention_message_sent",
            target_type="intervention",
            target_id=intervention_id,
            message="학생에게 개입 메시지를 발송했습니다.",
            metadata_json=json.dumps({
                "student_id": str(intervention.student_id),
                "intervention_id": intervention_id,
                "type": intervention.type,
            }, ensure_ascii=False),
        ))
    await db.commit()

    logger.info(f"개입 상태 변경: {intervention_id} -> {new_status}")
    return {"status": new_status, "message": intervention.message}


@router.post("/interventions/bulk", status_code=201)
async def bulk_create_interventions(
    data: BulkInterventionCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    svc = InterventionService(db)
    created = []

    for student_id in data.student_ids:
        intervention_data = InterventionCreate(
            student_id=student_id,
            type=data.type,
            message=data.message,
            dropout_type=data.dropout_type,
        )
        i = await svc.create(intervention_data)
        created.append(_itv_resp(i))

    logger.info(f"일괄 개입 생성: {len(created)}개")
    return {"created": len(created), "interventions": created}


# ── 학생 제출 열람 ────────────────────────────────────
@router.get("/students/{student_id}/submissions", response_model=SubmissionAdminListResponse)
async def get_student_submissions(
    student_id: str,
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    user = (await db.execute(
        select(User).where(User.id == student_id, User.role == "student")
    )).scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="학생을 찾을 수 없습니다.")

    rows = (await db.execute(
        select(Submission, Problem, RiskScore)
        .outerjoin(Problem, Submission.problem_id == Problem.id)
        .outerjoin(RiskScore, Submission.id == RiskScore.submission_id)
        .where(Submission.student_id == student_id)
        .order_by(Submission.created_at.desc())
        .limit(limit)
    )).all()

    items = [
        SubmissionAdminItem(
            submission_id=str(sub.id),
            problem_id=str(prob.id) if prob else None,
            problem_title=prob.title if prob else None,
            prompt_text=sub.prompt_text,
            total_score=float(sub.total_score or 0.0),
            final_score=float(sub.final_score or 0.0),
            total_risk=risk.total_risk if risk else 0.0,
            risk_stage=risk.risk_stage if risk else "unknown",
            created_at=sub.created_at,
        )
        for sub, prob, risk in rows
    ]

    total = (await db.execute(
        select(func.count()).select_from(Submission).where(Submission.student_id == student_id)
    )).scalar() or 0

    return SubmissionAdminListResponse(items=items, total=total)


# ── 메모 관리 ────────────────────────────────────────
@router.get("/students/{student_id}/notes", response_model=list[StudentNoteResponse])
async def get_student_notes(
    student_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    user = (await db.execute(
        select(User).where(User.id == student_id, User.role == "student")
    )).scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="학생을 찾을 수 없습니다.")

    notes = (await db.execute(
        select(StudentNote)
        .where(StudentNote.student_id == student_id)
        .order_by(StudentNote.created_at.desc())
    )).scalars().all()

    return [
        StudentNoteResponse(
            id=str(n.id),
            student_id=str(n.student_id),
            admin_id=str(n.admin_id),
            content=n.content,
            created_at=n.created_at,
        )
        for n in notes
    ]


@router.post("/students/{student_id}/notes", response_model=StudentNoteResponse, status_code=201)
async def create_student_note(
    student_id: str,
    data: StudentNoteCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    user = (await db.execute(
        select(User).where(User.id == student_id, User.role == "student")
    )).scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="학생을 찾을 수 없습니다.")

    note = StudentNote(
        student_id=student_id,
        admin_id=admin.id,
        content=data.content,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    db.add(ActivityLog(
        user_id=str(admin.id),
        role="admin",
        action="note_created",
        target_type="student",
        target_id=str(student_id),
        message=f"{user.username} 학생 메모를 작성했습니다.",
    ))
    await db.commit()

    logger.info(f"메모 생성: {note.id} (학생: {student_id})")
    return StudentNoteResponse(
        id=str(note.id),
        student_id=str(note.student_id),
        admin_id=str(note.admin_id),
        content=note.content,
        created_at=note.created_at,
    )


@router.delete("/notes/{note_id}", status_code=204)
async def delete_note(
    note_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    note = (await db.execute(
        select(StudentNote).where(StudentNote.id == note_id)
    )).scalar_one_or_none()

    if not note:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다.")

    await db.delete(note)
    await db.commit()

    logger.info(f"메모 삭제: {note_id}")
    return None


# ── 분석 ──────────────────────────────────────────────
@router.get("/analytics/risk-trend", response_model=RiskTrendResponse)
async def get_risk_trend(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)

    risks = (await db.execute(
        select(RiskScore)
        .where(RiskScore.calculated_at >= thirty_days_ago)
        .order_by(RiskScore.calculated_at)
    )).scalars().all()

    daily_data: dict[str, tuple[list[float], int]] = defaultdict(lambda: ([], 0))

    for risk in risks:
        date_str = risk.calculated_at.strftime("%Y-%m-%d")
        risk_values, count = daily_data[date_str]
        risk_values.append(risk.total_risk)
        daily_data[date_str] = (risk_values, count + 1)

    points = []
    for date_str in sorted(daily_data.keys())[-30:]:
        risk_values, _ = daily_data[date_str]
        avg_risk = sum(risk_values) / len(risk_values) if risk_values else 0.0
        high_risk_count = sum(1 for r in risk_values if r >= 0.7)
        points.append(RiskTrendPoint(
            date=date_str,
            avg_risk=round(avg_risk, 3),
            high_risk_count=high_risk_count,
        ))

    return RiskTrendResponse(points=points)


@router.get("/analytics/dropout-trend", response_model=DropoutTrendResponse)
async def get_dropout_trend(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)

    risks = (await db.execute(
        select(RiskScore)
        .where(RiskScore.calculated_at >= thirty_days_ago)
        .order_by(RiskScore.calculated_at)
    )).scalars().all()

    daily_data: dict[str, dict[str, int]] = defaultdict(
        lambda: {
            "cognitive": 0,
            "motivational": 0,
            "strategic": 0,
            "sudden": 0,
            "dependency": 0,
            "compound": 0,
        }
    )

    for risk in risks:
        date_str = risk.calculated_at.strftime("%Y-%m-%d")
        dropout_type = risk.dropout_type or "none"
        if dropout_type != "none" and dropout_type in daily_data[date_str]:
            daily_data[date_str][dropout_type] += 1

    points = []
    for date_str in sorted(daily_data.keys())[-30:]:
        data = daily_data[date_str]
        points.append(DropoutTrendPoint(
            date=date_str,
            cognitive=data["cognitive"],
            motivational=data["motivational"],
            strategic=data["strategic"],
            sudden=data["sudden"],
            dependency=data["dependency"],
            compound=data["compound"],
        ))

    return DropoutTrendResponse(points=points)


@router.get("/analytics/intervention-effect", response_model=InterventionEffectResponse)
async def get_intervention_effect(
    limit: int = Query(20, ge=1, le=100),
    days: int = Query(7, ge=1, le=30),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    completed_interventions = (await db.execute(
        select(Intervention)
        .where(Intervention.status == "completed")
        .order_by(Intervention.created_at.desc())
        .limit(limit)
    )).scalars().all()

    items = []

    for intervention in completed_interventions:
        user = (await db.execute(
            select(User).where(User.id == intervention.student_id)
        )).scalar_one_or_none()

        if not user:
            continue

        before_risk = (await db.execute(
            select(RiskScore)
            .where(RiskScore.student_id == intervention.student_id)
            .where(RiskScore.calculated_at < intervention.created_at)
            .order_by(RiskScore.calculated_at.desc())
            .limit(1)
        )).scalar_one_or_none()

        after_risk = (await db.execute(
            select(RiskScore)
            .where(RiskScore.student_id == intervention.student_id)
            .where(RiskScore.calculated_at >= intervention.created_at)
            .order_by(RiskScore.calculated_at)
            .limit(1)
        )).scalar_one_or_none()

        before_window_start = intervention.created_at - timedelta(days=days)
        after_window_end = intervention.created_at + timedelta(days=days)

        before_submissions = (await db.execute(
            select(Submission)
            .where(Submission.student_id == intervention.student_id)
            .where(Submission.created_at >= before_window_start)
            .where(Submission.created_at < intervention.created_at)
        )).scalars().all()

        after_submissions = (await db.execute(
            select(Submission)
            .where(Submission.student_id == intervention.student_id)
            .where(Submission.created_at >= intervention.created_at)
            .where(Submission.created_at <= after_window_end)
        )).scalars().all()

        risk_before = before_risk.total_risk if before_risk else 0.0
        risk_after = after_risk.total_risk if after_risk else None
        delta = round(risk_before - risk_after, 3) if risk_after is not None else None

        avg_score_before = round(sum(float(sub.final_score or sub.total_score or 0.0) for sub in before_submissions) / len(before_submissions), 1) if before_submissions else None
        avg_score_after = round(sum(float(sub.final_score or sub.total_score or 0.0) for sub in after_submissions) / len(after_submissions), 1) if after_submissions else None
        score_delta = round((avg_score_after or 0.0) - (avg_score_before or 0.0), 1) if avg_score_before is not None and avg_score_after is not None else None

        items.append(InterventionEffectItem(
            intervention_id=str(intervention.id),
            student_id=str(intervention.student_id),
            username=user.username,
            risk_before=risk_before,
            risk_after=risk_after,
            delta=delta,
            submissions_before=len(before_submissions),
            submissions_after=len(after_submissions),
            avg_score_before=avg_score_before,
            avg_score_after=avg_score_after,
            score_delta=score_delta,
            intervention_type=intervention.type,
            tracking_days=days,
            created_at=intervention.created_at,
        ))

    return InterventionEffectResponse(items=items)


@router.get("/analytics/learning-patterns", response_model=LearningPatternResponse)
async def get_learning_patterns(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    students = (await db.execute(select(User).where(User.role == "student"))).scalars().all()
    items: list[LearningPatternItem] = []
    for student in students:
        submissions = (await db.execute(
            select(Submission).where(Submission.student_id == str(student.id)).order_by(desc(Submission.created_at)).limit(5)
        )).scalars().all()
        risks = (await db.execute(
            select(RiskScore).where(RiskScore.student_id == str(student.id)).order_by(desc(RiskScore.calculated_at)).limit(2)
        )).scalars().all()
        group, summary = _summarize_pattern(submissions, risks)
        avg_score = round(sum(float(s.final_score or s.total_score or 0.0) for s in submissions) / len(submissions), 1) if submissions else 0.0
        items.append(LearningPatternItem(
            student_id=str(student.id),
            username=student.username,
            pattern_group=group,
            summary=summary,
            avg_score=avg_score,
            submission_count=len(submissions),
        ))
    items.sort(key=lambda item: (item.pattern_group != "고위험군", item.pattern_group != "하락세", item.username))
    return LearningPatternResponse(items=items[:limit])


@router.get("/analytics/recommendation-effect", response_model=RecommendationEffectResponse)
async def get_recommendation_effect(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    rows = (await db.execute(
        select(ProblemRecommendation, User, Problem)
        .join(User, User.id == ProblemRecommendation.student_id)
        .join(Problem, Problem.id == ProblemRecommendation.problem_id)
        .where(ProblemRecommendation.is_active.is_(True))
        .order_by(desc(ProblemRecommendation.created_at))
        .limit(limit)
    )).all()
    items: list[RecommendationEffectItem] = []
    for rec, user, problem in rows:
        submissions = (await db.execute(
            select(Submission)
            .where(Submission.student_id == str(user.id))
            .where(Submission.problem_id == str(problem.id))
            .where(Submission.created_at >= rec.created_at)
            .order_by(desc(Submission.created_at))
        )).scalars().all()
        items.append(RecommendationEffectItem(
            recommendation_id=str(rec.id),
            student_id=str(user.id),
            username=user.username,
            problem_title=problem.title,
            created_at=rec.created_at,
            attempted=bool(submissions),
            submission_count=len(submissions),
            avg_score=round(sum(float(s.final_score or s.total_score or 0.0) for s in submissions) / len(submissions), 1) if submissions else None,
            latest_score=float(submissions[0].final_score or submissions[0].total_score or 0.0) if submissions else None,
        ))
    return RecommendationEffectResponse(items=items)


@router.get("/intervention-priority-queue", response_model=InterventionPriorityQueueResponse)
async def get_intervention_priority_queue(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    students = (await db.execute(select(User).where(User.role == "student"))).scalars().all()
    items: list[InterventionPriorityItem] = []
    now = datetime.now(timezone.utc)
    for student in students:
        risks = (await db.execute(
            select(RiskScore)
            .where(RiskScore.student_id == str(student.id))
            .order_by(desc(RiskScore.calculated_at))
            .limit(2)
        )).scalars().all()
        submissions = (await db.execute(
            select(Submission)
            .where(Submission.student_id == str(student.id))
            .order_by(desc(Submission.created_at))
            .limit(5)
        )).scalars().all()
        latest_risk = risks[0] if risks else None
        latest_submission = submissions[0] if submissions else None
        active_recs = (await db.execute(
            select(ProblemRecommendation)
            .where(ProblemRecommendation.student_id == str(student.id))
            .where(ProblemRecommendation.is_active.is_(True))
            .order_by(desc(ProblemRecommendation.created_at))
            .limit(5)
        )).scalars().all()

        priority = 0.0
        reasons: list[str] = []
        if latest_risk:
            priority += min(60.0, float(latest_risk.total_risk) * 0.6)
            if latest_risk.risk_stage in {"고위험", "심각"}:
                priority += 25
                reasons.append(f"{latest_risk.risk_stage} 위험")
            if len(risks) > 1 and latest_risk.total_risk - risks[1].total_risk >= 8:
                priority += 20
                reasons.append("위험도 급상승")
        else:
            priority += 15
            reasons.append("위험도 데이터 부족")

        if latest_submission:
            last_dt = latest_submission.created_at
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)
            days_since = (now - last_dt).days
            if days_since >= 3:
                priority += min(25, days_since * 4)
                reasons.append(f"{days_since}일간 미제출")
            latest_score = _safe_submission_score(latest_submission)
            if latest_score < 65:
                priority += 15
                reasons.append("최근 점수 낮음")
        else:
            priority += 35
            reasons.append("제출 이력 없음")

        unresolved_recs = 0
        for rec in active_recs:
            attempted = (await db.execute(
                select(func.count()).select_from(Submission)
                .where(Submission.student_id == str(student.id))
                .where(Submission.problem_id == str(rec.problem_id))
                .where(Submission.created_at >= rec.created_at)
            )).scalar() or 0
            if attempted == 0:
                unresolved_recs += 1
        if unresolved_recs:
            priority += min(20, unresolved_recs * 8)
            reasons.append(f"추천 문제 {unresolved_recs}개 미풀이")

        if not reasons:
            reasons.append("정기 확인")
        action = "문제 추천" if "추천 문제" in " ".join(reasons) or (latest_submission and _safe_submission_score(latest_submission) < 65) else "짧은 메시지"
        if latest_risk and latest_risk.risk_stage in {"심각", "고위험"}:
            action = "개별 점검"

        items.append(InterventionPriorityItem(
            student_id=str(student.id),
            username=student.username,
            email=student.email,
            priority_score=round(priority, 1),
            risk_stage=latest_risk.risk_stage if latest_risk else "미분석",
            total_risk=round(float(latest_risk.total_risk), 1) if latest_risk else 0.0,
            reasons=reasons[:4],
            recommended_action=action,
            last_submission_at=latest_submission.created_at if latest_submission else None,
        ))
    items.sort(key=lambda item: (-item.priority_score, item.username))
    return InterventionPriorityQueueResponse(items=items[:limit])


@router.get("/analytics/problem-insights", response_model=ProblemInsightResponse)
async def get_problem_insights(
    limit: int = Query(12, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    problems = (await db.execute(select(Problem).order_by(desc(Problem.created_at)).limit(limit))).scalars().all()
    items: list[ProblemInsightItem] = []
    for problem in problems:
        submission_rows = (await db.execute(
            select(Submission, RiskScore)
            .outerjoin(RiskScore, Submission.id == RiskScore.submission_id)
            .where(Submission.problem_id == str(problem.id))
        )).all()
        submissions = [sub for sub, _ in submission_rows]
        scores = [_safe_submission_score(sub, risk) for sub, risk in submission_rows]
        participants = len({str(sub.student_id) for sub in submissions})
        run_count = (await db.execute(
            select(func.count()).select_from(ActivityLog)
            .where(ActivityLog.action == "run_preview")
            .where(ActivityLog.target_id == str(problem.id))
        )).scalar() or 0
        promi_count = (await db.execute(
            select(func.count()).select_from(PromiCoachLog)
            .where(PromiCoachLog.problem_id == str(problem.id))
        )).scalar() or 0
        tag_counts: dict[str, int] = defaultdict(int)
        for sub in submissions:
            for tag in _extract_failure_tags(sub.prompt_text or ""):
                tag_counts[FAILURE_TAG_LABELS.get(tag, tag)] += 1
        top_tags = [tag for tag, _ in sorted(tag_counts.items(), key=lambda item: (-item[1], item[0]))[:3]]
        avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0
        if not submissions:
            insight = "아직 제출이 없어 문제 난이도 판단이 어렵습니다."
            action = "학생에게 첫 시도 유도"
        elif avg_score < 60 and run_count > len(submissions) * 2:
            insight = "실행은 많지만 제출 점수가 낮아 문제 설명이나 루브릭이 어려울 수 있습니다."
            action = "예시 또는 요구사항 보강"
        elif top_tags:
            insight = f"반복 누락: {', '.join(top_tags)}"
            action = "해당 항목을 문제 설명에 명시"
        else:
            insight = "현재 문제 흐름은 안정적입니다."
            action = "유지"
        items.append(ProblemInsightItem(
            problem_id=str(problem.id),
            title=problem.title,
            difficulty=problem.difficulty,
            category=problem.category,
            submission_count=len(submissions),
            participant_count=participants,
            average_score=avg_score,
            run_count=int(run_count),
            promi_feedback_count=int(promi_count),
            top_failure_tags=top_tags,
            insight=insight,
            recommended_action=action,
        ))
    items.sort(key=lambda item: (item.submission_count == 0, item.average_score))
    return ProblemInsightResponse(items=items)


@router.get("/promi-review-queue", response_model=PromiReviewQueueResponse)
async def get_promi_review_queue(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    reviewed_ids = {
        str(row[0]) for row in (await db.execute(
            select(ActivityLog.target_id)
            .where(ActivityLog.action == "promi_reviewed")
            .where(ActivityLog.target_id.is_not(None))
        )).all()
    }
    rows = (await db.execute(
        select(PromiCoachLog, User, Problem)
        .join(User, User.id == PromiCoachLog.student_id)
        .join(Problem, Problem.id == PromiCoachLog.problem_id)
        .order_by(desc(PromiCoachLog.created_at))
        .limit(100)
    )).all()
    items: list[PromiReviewQueueItem] = []
    for log, user, problem in rows:
        if str(log.id) in reviewed_ids:
            continue
        flags = _review_flags_for_promi(log)
        repeated_count = (await db.execute(
            select(func.count()).select_from(PromiCoachLog)
            .where(PromiCoachLog.student_id == str(log.student_id))
            .where(PromiCoachLog.problem_id == str(log.problem_id))
        )).scalar() or 0
        if repeated_count >= 3:
            flags.append("학생이 여러 번 받은 코칭")
        if not flags:
            continue
        items.append(PromiReviewQueueItem(
            log_id=str(log.id),
            student_id=str(user.id),
            username=user.username,
            problem_id=str(problem.id),
            problem_title=problem.title,
            message=log.message,
            checkpoints=_parse_checkpoints(log.checkpoints_json),
            caution=log.caution,
            flags=list(dict.fromkeys(flags)),
            review_reason=" · ".join(list(dict.fromkeys(flags))),
            created_at=log.created_at,
        ))
        if len(items) >= limit:
            break
    return PromiReviewQueueResponse(items=items)


@router.post("/promi-review-queue/{log_id}/review", response_model=PromiReviewActionResponse, status_code=201)
async def review_promi_feedback(
    log_id: str,
    data: PromiReviewAction,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    log = (await db.execute(select(PromiCoachLog).where(PromiCoachLog.id == log_id))).scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="프롬이 로그를 찾을 수 없습니다.")
    problem = (await db.execute(select(Problem).where(Problem.id == log.problem_id))).scalar_one_or_none()
    intervention_id: str | None = None
    rule_update_id: str | None = None
    follow_up_action = "review_recorded"

    if data.status == "follow_up_student":
        message = (
            "[프롬이 코칭 품질 리뷰 후속 개입]\n"
            f"문제: {problem.title if problem else log.problem_id}\n"
            f"리뷰 사유: 관리자 후속 개입 필요\n"
            f"프롬이 메시지: {(log.message or '')[:500]}\n\n"
            "위 코칭을 받은 뒤 학생이 혼란을 겪었는지 확인하고, 답을 대신 제공하기보다 어떤 개념을 스스로 설명해야 하는지 짧게 안내해주세요."
        )
        intervention = Intervention(
            student_id=str(log.student_id),
            type="message",
            message=message,
            dropout_type="none",
            status="pending",
        )
        db.add(intervention)
        await db.flush()
        intervention_id = str(intervention.id)
        follow_up_action = "student_intervention_created"
    elif data.status == "needs_prompt_update":
        rule_update = ActivityLog(
            user_id=str(admin.id),
            role="admin",
            action="promi_rule_update_needed",
            target_type="promi_coach_log",
            target_id=log_id,
            message="프롬이 코칭 규칙 개선 필요 항목이 등록되었습니다.",
            metadata_json=json.dumps({
                "log_id": log_id,
                "student_id": str(log.student_id),
                "problem_id": str(log.problem_id),
                "message": log.message,
                "caution": log.caution,
                "note": data.note,
            }, ensure_ascii=False),
        )
        db.add(rule_update)
        await db.flush()
        rule_update_id = str(rule_update.id)
        follow_up_action = "rule_update_logged"

    db.add(ActivityLog(
        user_id=str(admin.id),
        role="admin",
        action="promi_reviewed",
        target_type="promi_coach_log",
        target_id=log_id,
        message=f"프롬이 코칭 리뷰 처리: {data.status}",
        metadata_json=json.dumps({
            "status": data.status,
            "note": data.note,
            "intervention_id": intervention_id,
            "rule_update_id": rule_update_id,
            "follow_up_action": follow_up_action,
        }, ensure_ascii=False),
    ))
    await db.commit()
    return PromiReviewActionResponse(ok=True, status=data.status, intervention_id=intervention_id, rule_update_id=rule_update_id, action=follow_up_action)


@router.get("/promi-rule-updates", response_model=PromiRuleUpdateQueueResponse)
async def get_promi_rule_updates(
    status: str = Query("pending", pattern="^(pending|reflected|held|all)$"),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    resolved_logs = (await db.execute(
        select(ActivityLog)
        .where(ActivityLog.action == "promi_rule_update_resolved")
        .where(ActivityLog.target_id.is_not(None))
        .order_by(desc(ActivityLog.created_at))
    )).scalars().all()
    resolved_by_item_id: dict[str, ActivityLog] = {}
    for resolved_log in resolved_logs:
        resolved_by_item_id.setdefault(str(resolved_log.target_id), resolved_log)

    logs = (await db.execute(
        select(ActivityLog)
        .where(ActivityLog.action == "promi_rule_update_needed")
        .order_by(desc(ActivityLog.created_at))
        .limit(limit * 2)
    )).scalars().all()

    items: list[PromiRuleUpdateItem] = []
    for log in logs:
        resolved_log = resolved_by_item_id.get(str(log.id))
        resolved_metadata: dict = {}
        resolved_status = "pending"
        if resolved_log and resolved_log.metadata_json:
            try:
                resolved_metadata = json.loads(resolved_log.metadata_json)
            except json.JSONDecodeError:
                resolved_metadata = {}
            resolved_status = str(resolved_metadata.get("status") or "reflected")

        if status != "all" and status != resolved_status:
            continue
        metadata: dict = {}
        if log.metadata_json:
            try:
                metadata = json.loads(log.metadata_json)
            except json.JSONDecodeError:
                metadata = {}

        student_id = metadata.get("student_id")
        problem_id = metadata.get("problem_id")
        student = None
        problem = None
        if student_id:
            student = (await db.execute(select(User).where(User.id == student_id))).scalar_one_or_none()
        if problem_id:
            problem = (await db.execute(select(Problem).where(Problem.id == problem_id))).scalar_one_or_none()

        items.append(PromiRuleUpdateItem(
            id=str(log.id),
            promi_log_id=str(log.target_id) if log.target_id else metadata.get("log_id"),
            student_id=str(student_id) if student_id else None,
            username=student.username if student else "알 수 없음",
            problem_id=str(problem_id) if problem_id else None,
            problem_title=problem.title if problem else "알 수 없는 문제",
            original_message=str(metadata.get("message") or ""),
            caution=metadata.get("caution"),
            review_note=metadata.get("note"),
            admin_message=log.message,
            status=resolved_status,
            resolved_note=resolved_metadata.get("note"),
            rule_patch=resolved_metadata.get("rule_patch"),
            resolved_at=resolved_log.created_at if resolved_log else None,
            created_at=log.created_at,
        ))
        if len(items) >= limit:
            break

    return PromiRuleUpdateQueueResponse(items=items)


@router.post("/promi-rule-updates/{item_id}/resolve", response_model=PromiRuleUpdateResolveResponse)
async def resolve_promi_rule_update(
    item_id: str,
    data: PromiRuleUpdateResolve,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    rule_update = (await db.execute(
        select(ActivityLog)
        .where(ActivityLog.id == item_id)
        .where(ActivityLog.action == "promi_rule_update_needed")
    )).scalar_one_or_none()
    if not rule_update:
        raise HTTPException(status_code=404, detail="프롬이 규칙 개선 항목을 찾을 수 없습니다.")

    db.add(ActivityLog(
        user_id=str(admin.id),
        role="admin",
        action="promi_rule_update_resolved",
        target_type="promi_rule_update",
        target_id=item_id,
        message="프롬이 규칙 개선 항목이 처리되었습니다.",
        metadata_json=json.dumps({
            "status": data.status,
            "note": data.note,
            "rule_patch": data.rule_patch,
            "promi_log_id": rule_update.target_id,
        }, ensure_ascii=False),
    ))
    await db.commit()
    return PromiRuleUpdateResolveResponse(ok=True, status=data.status)


@router.get("/students/{student_id}/intervention-recommendations", response_model=list[InterventionSuggestionItem])
async def get_intervention_suggestions(
    student_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    user = (await db.execute(select(User).where(User.id == student_id, User.role == "student"))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="학생을 찾을 수 없습니다.")
    latest_risk = (await db.execute(
        select(RiskScore).where(RiskScore.student_id == student_id).order_by(desc(RiskScore.calculated_at)).limit(1)
    )).scalar_one_or_none()
    submissions = (await db.execute(
        select(Submission).where(Submission.student_id == student_id).order_by(desc(Submission.created_at)).limit(5)
    )).scalars().all()
    tags = [tag for s in submissions[:2] for tag in _extract_failure_tags(s.prompt_text or "")]
    suggestions = [
        InterventionSuggestionItem(
            type="message",
            title="격려 메시지",
            message=f"{user.username} 학생에게 최근 흐름을 짚어주는 짧은 격려 메시지를 보내세요.",
        ),
        InterventionSuggestionItem(
            type="problem_recommendation",
            title="문제 추천",
            message="최근 약점을 보완할 쉬운 문제를 1개 추천하세요.",
        ),
    ]
    if latest_risk and latest_risk.risk_stage in {"고위험", "심각"}:
        suggestions.insert(0, InterventionSuggestionItem(
            type="meeting",
            title="짧은 점검 미팅",
            message="위험도가 높으므로 짧은 점검 미팅 개입을 우선 검토하세요.",
        ))
    if "format_missing" in tags:
        suggestions.append(InterventionSuggestionItem(
            type="resource",
            title="형식 템플릿 제공",
            message="출력 형식 예시가 있는 자료를 먼저 제공하세요.",
        ))
    return suggestions


@router.get("/students/{student_id}/timeline", response_model=StudentTimelineResponse)
async def get_student_timeline(
    student_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    user = (await db.execute(select(User).where(User.id == student_id, User.role == "student"))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="학생을 찾을 수 없습니다.")
    submissions = (await db.execute(select(Submission).where(Submission.student_id == student_id).order_by(desc(Submission.created_at)).limit(10))).scalars().all()
    interventions = (await db.execute(select(Intervention).where(Intervention.student_id == student_id).order_by(desc(Intervention.created_at)).limit(10))).scalars().all()
    notes = (await db.execute(select(StudentNote).where(StudentNote.student_id == student_id).order_by(desc(StudentNote.created_at)).limit(10))).scalars().all()
    recommendations = (await db.execute(select(ProblemRecommendation).where(ProblemRecommendation.student_id == student_id).order_by(desc(ProblemRecommendation.created_at)).limit(10))).scalars().all()
    items: list[StudentTimelineItem] = []
    for sub in submissions:
        items.append(StudentTimelineItem(kind="submission", title="제출", description=f"점수 {float(sub.final_score or sub.total_score or 0.0):.1f}", created_at=sub.created_at))
    for intervention in interventions:
        items.append(StudentTimelineItem(kind="intervention", title="개입", description=intervention.message[:120], created_at=intervention.created_at))
    for note in notes:
        items.append(StudentTimelineItem(kind="note", title="메모", description=note.content[:120], created_at=note.created_at))
    for rec in recommendations:
        items.append(StudentTimelineItem(kind="recommendation", title="문제 추천", description=rec.reason or "추천 문제 등록", created_at=rec.created_at))
    items.sort(key=lambda item: item.created_at, reverse=True)
    return StudentTimelineResponse(items=items[:20])


@router.get("/activity-logs", response_model=ActivityLogListResponse)
async def get_activity_logs(
    limit: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    rows = (await db.execute(
        select(ActivityLog, User)
        .join(User, User.id == ActivityLog.user_id)
        .order_by(desc(ActivityLog.created_at))
        .limit(limit)
    )).all()
    return ActivityLogListResponse(items=[
        ActivityLogItem(
            id=str(log.id),
            role=log.role,
            username=user.username,
            action=log.action,
            target_type=log.target_type,
            message=log.message,
            created_at=log.created_at,
        )
        for log, user in rows
    ])


# ── 학생 상세 정보 확장 ───────────────────────────────
@router.get("/students/{student_id}", response_model=StudentDetailExtended)
async def get_student_detail_extended(
    student_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    user = (await db.execute(
        select(User).where(User.id == student_id, User.role == "student")
    )).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="학생을 찾을 수 없습니다.")

    risks = (await db.execute(
        select(RiskScore).where(RiskScore.student_id == student_id)
        .order_by(desc(RiskScore.calculated_at)).limit(20)
    )).scalars().all()

    risk_history = [
        RiskHistoryItem(
            id=str(r.id), total_risk=r.total_risk, base_risk=r.base_risk,
            event_bonus=r.event_bonus, thinking_risk=r.thinking_risk,
            risk_stage=r.risk_stage, dropout_type=r.dropout_type,
            calculated_at=r.calculated_at,
        )
        for r in risks
    ]

    interventions = (await db.execute(
        select(Intervention).where(Intervention.student_id == student_id)
        .order_by(desc(Intervention.created_at)).limit(20)
    )).scalars().all()

    submission_rows = (await db.execute(
        select(Submission, Problem, RiskScore)
        .outerjoin(Problem, Submission.problem_id == Problem.id)
        .outerjoin(RiskScore, Submission.id == RiskScore.submission_id)
        .where(Submission.student_id == student_id)
        .order_by(Submission.created_at.desc())
        .limit(5)
    )).all()

    submissions = [
        SubmissionAdminItem(
            submission_id=str(sub.id),
            problem_id=str(prob.id) if prob else None,
            problem_title=prob.title if prob else None,
            prompt_text=sub.prompt_text,
            total_score=float(sub.total_score or 0.0),
            final_score=float(sub.final_score or 0.0),
            total_risk=risk.total_risk if risk else 0.0,
            risk_stage=risk.risk_stage if risk else "unknown",
            created_at=sub.created_at,
        )
        for sub, prob, risk in submission_rows
    ]

    notes = (await db.execute(
        select(StudentNote)
        .where(StudentNote.student_id == student_id)
        .order_by(StudentNote.created_at.desc())
    )).scalars().all()

    notes_resp = [
        StudentNoteResponse(
            id=str(n.id),
            student_id=str(n.student_id),
            admin_id=str(n.admin_id),
            content=n.content,
            created_at=n.created_at,
        )
        for n in notes
    ]
    pattern_group, pattern_summary_text = _summarize_pattern(
        [row[0] for row in submission_rows],
        risks,
    )
    avg_score = round(sum(float(sub.final_score or sub.total_score or 0.0) for sub, _, _ in submission_rows) / len(submission_rows), 1) if submission_rows else 0.0

    return StudentDetailExtended(
        student_id=str(user.id), username=user.username, email=user.email,
        latest_risk=risk_history[0] if risk_history else None,
        risk_history=risk_history,
        interventions=[_itv_resp(i) for i in interventions],
        helper_points=int(user.helper_points or 0),
        submission_count=len(submission_rows),
        avg_score=avg_score,
        latest_failure_tags=[tag for sub, _, _ in submission_rows[:2] for tag in _extract_failure_tags(sub.prompt_text or "")][:4],
        pattern_summary=[pattern_group, pattern_summary_text],
        submissions=submissions,
        notes=notes_resp,
    )
