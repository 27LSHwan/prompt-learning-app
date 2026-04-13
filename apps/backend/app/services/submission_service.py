import logging
import sys
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.scoring.schemas import BehavioralData

from ..models.problem import Problem
from ..models.submission import Submission
from ..schemas.student import SubmissionCreate
from .risk_service import RiskService

_ROOT = Path(__file__).resolve().parents[4]
for _p in [str(_ROOT), str(_ROOT / "packages")]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

logger = logging.getLogger("app.submission")


class SubmissionService:
    def __init__(self, db: AsyncSession, openai_api_key: str = ""):
        self.db = db
        self._risk_svc = RiskService(db, openai_api_key)

    async def save_submission(self, data: SubmissionCreate) -> Submission:
        sub = Submission(
            student_id=data.student_id,
            problem_id=data.problem_id,
            prompt_text=data.prompt_text,
            total_score=0.0,
            final_score=0.0,
        )
        self.db.add(sub)
        await self.db.flush()
        await self.db.commit()
        await self.db.refresh(sub)
        return sub

    async def run_risk_pipeline(self, sub: Submission, data: SubmissionCreate) -> None:
        try:
            problem_title = ""
            problem_desc = ""
            if data.problem_id:
                res = await self.db.execute(select(Problem).where(Problem.id == data.problem_id))
                problem = res.scalar_one_or_none()
                if problem:
                    problem_title = problem.title
                    problem_desc = problem.description

            behavioral = BehavioralData(**data.behavioral_data.model_dump())
            await self._risk_svc.run_pipeline(
                student_id=data.student_id,
                submission_id=str(sub.id),
                prompt_text=data.prompt_text,
                behavioral_data=behavioral,
                problem_title=problem_title,
                problem_desc=problem_desc,
            )
            await self.db.commit()
            logger.info("위험도 파이프라인 완료: submission=%s", sub.id)
        except Exception as exc:
            logger.error("위험도 파이프라인 실패: submission=%s error=%s", sub.id, exc)

    async def create(self, data: SubmissionCreate) -> tuple[Submission, bool]:
        sub = await self.save_submission(data)
        await self.run_risk_pipeline(sub, data)
        return sub, True
