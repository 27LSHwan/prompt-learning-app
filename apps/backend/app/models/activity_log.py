import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy import types as sa_types

from ..database import Base


class UUIDStr(sa_types.TypeDecorator):
    impl = sa_types.String(36)
    cache_ok = True

    def process_bind_param(self, v, _):
        return str(v) if v else None

    def process_result_value(self, v, _):
        return str(v) if v else None


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(UUIDStr, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(UUIDStr, ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String(20), nullable=False, default="student")
    action = Column(String(80), nullable=False, index=True)
    target_type = Column(String(50), nullable=False, default="system")
    target_id = Column(String(36), nullable=True, index=True)
    message = Column(Text, nullable=False)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
