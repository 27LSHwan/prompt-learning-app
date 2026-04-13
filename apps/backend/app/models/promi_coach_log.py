import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import types as sa_types

from ..database import Base


class UUIDStr(sa_types.TypeDecorator):
    impl = sa_types.String(36)
    cache_ok = True

    def process_bind_param(self, v, _):
        return str(v) if v else None

    def process_result_value(self, v, _):
        return str(v) if v else None


class PromiCoachLog(Base):
    __tablename__ = "promi_coach_logs"

    id = Column(UUIDStr, primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(UUIDStr, ForeignKey("users.id"), nullable=False, index=True)
    problem_id = Column(UUIDStr, ForeignKey("problems.id"), nullable=False, index=True)
    mode = Column(String(20), nullable=False, default="run")
    run_version = Column(Integer, nullable=False, default=1)
    message = Column(Text, nullable=False)
    checkpoints_json = Column(Text, nullable=True)
    caution = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
