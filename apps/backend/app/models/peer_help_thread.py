import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import types as sa_types

from ..database import Base


class UUIDStr(sa_types.TypeDecorator):
    impl = sa_types.String(36)
    cache_ok = True

    def process_bind_param(self, v, _):
        return str(v) if v else None

    def process_result_value(self, v, _):
        return str(v) if v else None


class PeerHelpThread(Base):
    __tablename__ = "peer_help_threads"

    id = Column(UUIDStr, primary_key=True, default=lambda: str(uuid.uuid4()))
    problem_id = Column(UUIDStr, ForeignKey("problems.id"), nullable=False, index=True)
    requester_id = Column(UUIDStr, ForeignKey("users.id"), nullable=False, index=True)
    helper_id = Column(UUIDStr, ForeignKey("users.id"), nullable=False, index=True)
    request_message = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="open")
    helpful_marked = Column(Boolean, nullable=False, default=False)
    awarded_points = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
