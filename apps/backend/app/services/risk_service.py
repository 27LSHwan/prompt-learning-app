import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[4]
for _p in [str(_ROOT), str(_ROOT / "packages")]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from packages.llm_analysis.analyzer import LLMAnalyzer
from packages.llm_analysis.schemas import LLMAnalysisInput, ThinkingScores
from packages.scoring.engine import ScoringEngine
from packages.scoring.schemas import BehavioralData
from packages.decision.engine import DecisionEngine
from packages.decision.schemas import DecisionInput

from ..models.risk_score import RiskScore
from ..models.learning_metrics import LearningMetrics
from ..models.intervention import Intervention
from ..models.user import User
from ..schemas.risk import RiskResponse


class RiskService:
    def __init__(self, db: AsyncSession, openai_api_key: str = ""):
        self.db = db
        self._analyzer = LLMAnalyzer(api_key=openai_api_key or None)
        self._scorer   = ScoringEngine()
        self._decider  = DecisionEngine()

    async def run_pipeline(
        self,
        student_id: str,
        submission_id: str,
        prompt_text: str,
        behavioral_data: BehavioralData,
        problem_title: str = "",
        problem_desc: str = "",
    ) -> RiskScore:
        """
        LLM 분석 → Scoring → Decision → DB 저장
        """
        # 1. LLM 분석 (사고 점수 14개)
        llm_out = await self._analyzer.analyze(
            LLMAnalysisInput(
                student_id=student_id,
                prompt_text=prompt_text,
                problem_title=problem_title,
                problem_description=problem_desc,
            )
        )
        thinking = llm_out.thinking_scores

        # 2. Scoring
        scoring_result = self._scorer.calculate(behavioral_data, thinking)

        # 3. Decision
        decision = self._decider.decide(
            DecisionInput(
                student_id=student_id,
                total_risk=scoring_result.total_risk,
                thinking_risk=scoring_result.thinking_risk,
                performance_risk=scoring_result.performance_risk,
                progress_risk=scoring_result.progress_risk,
                engagement_risk=scoring_result.engagement_risk,
                process_risk=scoring_result.process_risk,
                triggered_events=scoring_result.triggered_events,
            )
        )

        # 4. learning_metrics 저장
        metrics = LearningMetrics(
            submission_id=submission_id,
            student_id=student_id,
            **behavioral_data.model_dump(),
            **thinking.model_dump(),
        )
        self.db.add(metrics)

        # 5. risk_score 저장
        risk = RiskScore(
            student_id=student_id,
            submission_id=submission_id,
            total_risk=scoring_result.total_risk,
            base_risk=scoring_result.base_risk,
            event_bonus=scoring_result.event_bonus,
            thinking_risk=scoring_result.thinking_risk,
            risk_stage=decision.risk_stage,
            dropout_type=decision.dropout_type,
        )
        self.db.add(risk)

        # 6. Auto-save intervention if triggered
        if decision.should_intervene and decision.intervention_message:
            # UUID 대신 학생 이름으로 메시지 개인화
            user_res = await self.db.execute(select(User).where(User.id == student_id))
            user = user_res.scalar_one_or_none()
            display_name = user.username if user else "학생"
            personalized_msg = decision.intervention_message.replace(student_id, display_name)

            intervention = Intervention(
                student_id=student_id,
                type=decision.intervention_type or "message",
                message=personalized_msg,
                dropout_type=decision.dropout_type,
                status="pending",
            )
            self.db.add(intervention)

        await self.db.flush()
        return risk

    async def get_latest(self, student_id: str) -> Optional[RiskScore]:
        result = await self.db.execute(
            select(RiskScore)
            .where(RiskScore.student_id == student_id)
            .order_by(desc(RiskScore.calculated_at))
            .limit(1)
        )
        return result.scalar_one_or_none()

    def to_response(self, r: RiskScore) -> RiskResponse:
        return RiskResponse(
            student_id=r.student_id,
            total_risk=r.total_risk,
            risk_stage=r.risk_stage,
            dropout_type=r.dropout_type,
            base_risk=r.base_risk,
            event_bonus=r.event_bonus,
            thinking_risk=r.thinking_risk,
            calculated_at=r.calculated_at,
        )
