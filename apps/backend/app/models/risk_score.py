import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, Float, String, DateTime, ForeignKey
from sqlalchemy import types as sa_types
from ..database import Base


class UUIDStr(sa_types.TypeDecorator):
    impl = sa_types.String(36)
    cache_ok = True
    def process_bind_param(self, v, _): return str(v) if v else None
    def process_result_value(self, v, _): return str(v) if v else None


class RiskScore(Base):
    __tablename__ = "risk_scores"

    id            = Column(UUIDStr, primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id    = Column(UUIDStr, ForeignKey("users.id"), nullable=False, index=True)
    submission_id = Column(UUIDStr, ForeignKey("submissions.id"), nullable=True)
    total_risk    = Column(Float, nullable=False)
    base_risk     = Column(Float, nullable=False)
    event_bonus   = Column(Float, nullable=False, default=0.0)
    thinking_risk = Column(Float, nullable=False)
    risk_stage    = Column(String(20), nullable=False)
    dropout_type  = Column(String(30), nullable=False, default="none")
    calculated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
