import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from sqlalchemy import types as sa_types

from ..database import Base


class UUIDStr(sa_types.TypeDecorator):
    impl = sa_types.String(36)
    cache_ok = True

    def process_bind_param(self, v, _):
        return str(v) if v else None

    def process_result_value(self, v, _):
        return str(v) if v else None


class ProblemRecommendation(Base):
    __tablename__ = "problem_recommendations"

    id = Column(UUIDStr, primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(UUIDStr, ForeignKey("users.id"), nullable=False, index=True)
    problem_id = Column(UUIDStr, ForeignKey("problems.id"), nullable=False, index=True)
    admin_id = Column(UUIDStr, ForeignKey("users.id"), nullable=False)
    reason = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
