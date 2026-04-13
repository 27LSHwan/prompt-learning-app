import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, Float, Integer, DateTime, ForeignKey
from sqlalchemy import types as sa_types
from ..database import Base


class UUIDStr(sa_types.TypeDecorator):
    impl = sa_types.String(36)
    cache_ok = True
    def process_bind_param(self, v, _): return str(v) if v else None
    def process_result_value(self, v, _): return str(v) if v else None


class LearningMetrics(Base):
    __tablename__ = "learning_metrics"

    id            = Column(UUIDStr, primary_key=True, default=lambda: str(uuid.uuid4()))
    submission_id = Column(UUIDStr, ForeignKey("submissions.id"), nullable=False)
    student_id    = Column(UUIDStr, ForeignKey("users.id"), nullable=False, index=True)

    # §4.1 행동 데이터 11개
    login_frequency        = Column(Float, nullable=False, default=0.5)
    session_duration       = Column(Float, nullable=False, default=0.5)
    submission_interval    = Column(Float, nullable=False, default=0.5)
    drop_midway_rate       = Column(Float, nullable=False, default=0.0)
    attempt_count          = Column(Integer, nullable=False, default=1)
    revision_count         = Column(Integer, nullable=False, default=0)
    retry_count            = Column(Integer, nullable=False, default=0)
    strategy_change_count  = Column(Integer, nullable=False, default=0)
    task_success_rate      = Column(Float, nullable=False, default=0.5)
    quiz_score_avg         = Column(Float, nullable=False, default=0.5)
    score_delta            = Column(Float, nullable=False, default=0.0)

    # §4.2 사고 점수 14개 (LLM 산출)
    problem_understanding_score    = Column(Float, nullable=False, default=0.5)
    problem_decomposition_score    = Column(Float, nullable=False, default=0.5)
    constraint_awareness_score     = Column(Float, nullable=False, default=0.5)
    validation_awareness_score     = Column(Float, nullable=False, default=0.5)
    improvement_prompt_score       = Column(Float, nullable=False, default=0.5)
    self_explanation_score         = Column(Float, nullable=False, default=0.5)
    reasoning_quality_score        = Column(Float, nullable=False, default=0.5)
    reflection_depth_score         = Column(Float, nullable=False, default=0.5)
    error_analysis_score           = Column(Float, nullable=False, default=0.5)
    debugging_quality_score        = Column(Float, nullable=False, default=0.5)
    decision_reasoning_score       = Column(Float, nullable=False, default=0.5)
    approach_selection_score       = Column(Float, nullable=False, default=0.5)
    improvement_consistency_score  = Column(Float, nullable=False, default=0.5)
    iteration_quality_score        = Column(Float, nullable=False, default=0.5)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
