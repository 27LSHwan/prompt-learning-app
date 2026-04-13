"""
루브릭 기반 프롬프트 평가 서비스
"""
import json
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[4]
for _p in [str(_ROOT), str(_ROOT / "packages")]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from packages.llm_analysis.rubric_evaluator import RubricEvaluator
from ..models.problem import Problem
from ..models.submission import Submission
from ..schemas.student import EvaluationResultResponse, CriterionScoreResponse


class EvaluationService:
    def __init__(self, db: AsyncSession, openai_api_key: str = ""):
        self.db = db
        self._evaluator = RubricEvaluator(api_key=openai_api_key or None)

    async def evaluate_submission(
        self,
        submission_id: str,
        student_final_prompt: str,
    ) -> EvaluationResultResponse:
        """
        submission_id 기준으로 문제 rubric을 찾아 평가 실행
        """
        sub = (await self.db.execute(
            select(Submission).where(Submission.id == submission_id)
        )).scalar_one_or_none()
        
        problem_title = ""
        problem_desc = ""
        rubric = {"criteria": [], "evaluation_guidelines": ""}
        
        if sub and sub.problem_id:
            prob = (await self.db.execute(
                select(Problem).where(Problem.id == sub.problem_id)
            )).scalar_one_or_none()
            if prob:
                problem_title = prob.title
                problem_desc = prob.description
                if prob.rubric_json:
                    try:
                        rubric = json.loads(prob.rubric_json)
                    except Exception:
                        pass
        
        # rubric이 비어 있으면 기본 rubric 사용
        if not rubric.get("criteria"):
            rubric = _default_rubric()
        
        result = await self._evaluator.evaluate(
            student_prompt=student_final_prompt,
            problem_title=problem_title,
            problem_description=problem_desc,
            rubric=rubric,
        )
        
        return EvaluationResultResponse(
            submission_id=submission_id,
            total_score=result.total_score,
            overall_feedback=result.overall_feedback,
            criteria_scores=[
                CriterionScoreResponse(
                    name=cs.name, score=cs.score,
                    max_score=cs.max_score, feedback=cs.feedback,
                )
                for cs in result.criteria_scores
            ],
            strengths=result.strengths,
            improvements=result.improvements,
        )

    async def evaluate_prompt(
        self,
        problem_id: str,
        student_prompt: str,
        submission_id: str = "run-preview",
    ) -> EvaluationResultResponse:
        """
        제출 저장 없이 문제 rubric 기준으로 프롬프트를 1회 평가한다.
        결과 실행 미리보기에서 최종 제출과 같은 루브릭 기준을 쓰기 위한 경로다.
        """
        problem_title = ""
        problem_desc = ""
        rubric = {"criteria": [], "evaluation_guidelines": ""}

        prob = (await self.db.execute(
            select(Problem).where(Problem.id == problem_id)
        )).scalar_one_or_none()
        if prob:
            problem_title = prob.title
            problem_desc = prob.description
            if prob.rubric_json:
                try:
                    rubric = json.loads(prob.rubric_json)
                except Exception:
                    pass

        if not rubric.get("criteria"):
            rubric = _default_rubric()

        result = await self._evaluator.evaluate(
            student_prompt=student_prompt,
            problem_title=problem_title,
            problem_description=problem_desc,
            rubric=rubric,
        )

        return EvaluationResultResponse(
            submission_id=submission_id,
            total_score=result.total_score,
            overall_feedback=result.overall_feedback,
            criteria_scores=[
                CriterionScoreResponse(
                    name=cs.name,
                    score=cs.score,
                    max_score=cs.max_score,
                    feedback=cs.feedback,
                )
                for cs in result.criteria_scores
            ],
            strengths=result.strengths,
            improvements=result.improvements,
        )

    async def evaluate_submission_average(
        self,
        submission_id: str,
        student_final_prompt: str,
        runs: int = 5,
    ) -> EvaluationResultResponse:
        """
        같은 프롬프트도 모델 응답/평가 편차가 있을 수 있으므로 여러 번 평가해 평균 점수를 사용한다.
        """
        run_count = max(1, runs)
        results = [
            await self.evaluate_submission(submission_id, student_final_prompt)
            for _ in range(run_count)
        ]
        total_score = round(sum(item.total_score for item in results) / len(results), 1)

        criteria_by_name: dict[str, list[CriterionScoreResponse]] = {}
        for result in results:
            for criterion in result.criteria_scores:
                criteria_by_name.setdefault(criterion.name, []).append(criterion)

        criteria_scores = []
        for name, items in criteria_by_name.items():
            criteria_scores.append(CriterionScoreResponse(
                name=name,
                score=round(sum(item.score for item in items) / len(items), 1),
                max_score=items[0].max_score,
                feedback=items[0].feedback,
            ))

        strengths = []
        improvements = []
        for result in results:
            for item in result.strengths:
                if item not in strengths:
                    strengths.append(item)
            for item in result.improvements:
                if item not in improvements:
                    improvements.append(item)

        return EvaluationResultResponse(
            submission_id=submission_id,
            total_score=total_score,
            overall_feedback=f"{run_count}회 루브릭 평가 평균 점수입니다.",
            criteria_scores=criteria_scores,
            strengths=strengths[:5],
            improvements=improvements[:5],
        )


def _default_rubric() -> dict:
    """rubric_json이 없는 문제용 기본 루브릭"""
    return {
        "criteria": [
            {"name": "명확성",   "description": "태스크가 명확하게 정의되어 있는가", "weight": 0.25, "max_score": 10},
            {"name": "역할 정의", "description": "AI의 역할이 정의되어 있는가",      "weight": 0.25, "max_score": 10},
            {"name": "출력 형식", "description": "원하는 출력 형식이 명시되어 있는가","weight": 0.25, "max_score": 10},
            {"name": "맥락 제공", "description": "충분한 맥락이 제공되어 있는가",    "weight": 0.25, "max_score": 10},
        ],
        "evaluation_guidelines": "프롬프트 엔지니어링의 기본 원칙에 따라 평가합니다.",
    }
