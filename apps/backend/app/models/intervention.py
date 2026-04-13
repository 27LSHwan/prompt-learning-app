import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy import types as sa_types
from ..database import Base


class UUIDStr(sa_types.TypeDecorator):
    impl = sa_types.String(36)
    cache_ok = True
    def process_bind_param(self, v, _): return str(v) if v else None
    def process_result_value(self, v, _): return str(v) if v else None


class Intervention(Base):
    __tablename__ = "interventions"

    id           = Column(UUIDStr, primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id   = Column(UUIDStr, ForeignKey("users.id"), nullable=False, index=True)
    type         = Column(String(50), nullable=False)
    message      = Column(Text, nullable=False)
    dropout_type = Column(String(30), nullable=False, default="none")
    status       = Column(String(50), nullable=False, default="pending")
    student_read_at = Column(DateTime(timezone=True), nullable=True, default=None)
    created_at   = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    updated_at   = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                          onupdate=lambda: datetime.now(timezone.utc))
