import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Text
from sqlalchemy import types as sa_types

from ..database import Base


class UUIDStr(sa_types.TypeDecorator):
    impl = sa_types.String(36)
    cache_ok = True

    def process_bind_param(self, v, _):
        return str(v) if v else None

    def process_result_value(self, v, _):
        return str(v) if v else None


class PeerHelpMessage(Base):
    __tablename__ = "peer_help_messages"

    id = Column(UUIDStr, primary_key=True, default=lambda: str(uuid.uuid4()))
    thread_id = Column(UUIDStr, ForeignKey("peer_help_threads.id"), nullable=False, index=True)
    sender_id = Column(UUIDStr, ForeignKey("users.id"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    is_helpful = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
