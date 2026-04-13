import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, String, Text, DateTime, ForeignKey, Float, Integer
from sqlalchemy import types as sa_types
from ..database import Base


class UUIDStr(sa_types.TypeDecorator):
    impl = sa_types.String(36)
    cache_ok = True
    def process_bind_param(self, v, _): return str(v) if v else None
    def process_result_value(self, v, _): return str(v) if v else None


class Submission(Base):
    __tablename__ = "submissions"

    id              = Column(UUIDStr, primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id      = Column(UUIDStr, ForeignKey("users.id"), nullable=False, index=True)
    problem_id      = Column(UUIDStr, ForeignKey("problems.id"), nullable=True, index=True)
    prompt_text     = Column(Text, nullable=False)
    total_score     = Column(Float, nullable=True)
    final_score     = Column(Float, nullable=True)
    concept_reflection_text = Column(Text, nullable=True)
    concept_reflection_score = Column(Float, nullable=True)
    concept_reflection_passed = Column(Boolean, nullable=False, default=False)
    concept_reflection_feedback = Column(Text, nullable=True)
    rubric_evaluation_json = Column(Text, nullable=True)
    evaluation_runs_count = Column(Integer, nullable=False, default=0)
    created_at      = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
