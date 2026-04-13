"""
FeedbackService — 제출 이력 조회 + FeedbackAgent 오케스트레이션
"""
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.problem import Problem
from ..models.risk_score import RiskScore
from ..models.submission import Submission
from ..schemas.student import EvaluationResultResponse
from packages.llm_analysis.feedback_agent import FeedbackAgent, SubmissionHistory


class FeedbackService:
    def __init__(self, db: AsyncSession, openai_api_key: str = ""):
        self.db = db
        self._agent = FeedbackAgent(api_key=openai_api_key or None)

    async def get_feedback(
        self,
        submission_id: str,
        evaluation_result: EvaluationResultResponse,
    ):

        # 현재 제출 조회
        sub_result = await self.db.execute(
            select(Submission).where(Submission.id == submission_id)
        )
        submission = sub_result.scalar_one_or_none()
        if not submission:
            return None

        # 문제 정보
        problem_title = ""
        problem_desc = ""
        if submission.problem_id:
            prob_result = await self.db.execute(
                select(Problem).where(Problem.id == submission.problem_id)
            )
            problem = prob_result.scalar_one_or_none()
            if problem:
                problem_title = problem.title
                problem_desc = problem.description

        # 이전 제출 이력 (같은 문제, 현재 제출 제외, 최신 3개)
        history = []
        if submission.problem_id:
            hist_result = await self.db.execute(
                select(Submission, RiskScore)
                .outerjoin(RiskScore, RiskScore.submission_id == Submission.id)
                .where(
                    Submission.student_id == submission.student_id,
                    Submission.problem_id == submission.problem_id,
                    Submission.id != submission_id,
                )
                .order_by(desc(Submission.created_at))
                .limit(3)
            )
            for s, r in hist_result.all():
                history.append(SubmissionHistory(
                    prompt_text=s.prompt_text,
                    total_score=r.total_risk if r else 50.0,
                    created_at=str(s.created_at),
                ))

        # 평가 결과의 criteria_scores를 dict 리스트로 변환
        criteria_list = [
            {
                "name": c.name,
                "score": c.score,
                "max_score": c.max_score,
                "feedback": c.feedback,
            }
            for c in evaluation_result.criteria_scores
        ]

        feedback = await self._agent.generate(
            problem_title=problem_title,
            problem_description=problem_desc,
            current_prompt=submission.prompt_text,
            total_score=evaluation_result.total_score,
            criteria_scores=criteria_list,
            history=history,
        )
        return feedback
