import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Index
from sqlalchemy import types as sa_types
from ..database import Base


class UUIDStr(sa_types.TypeDecorator):
    impl = sa_types.String(36)
    cache_ok = True
    def process_bind_param(self, v, _): return str(v) if v else None
    def process_result_value(self, v, _): return str(v) if v else None


class StudentNote(Base):
    __tablename__ = "student_notes"

    id         = Column(UUIDStr, primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(UUIDStr, ForeignKey("users.id"), nullable=False, index=True)
    admin_id   = Column(UUIDStr, ForeignKey("users.id"), nullable=False)
    content    = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    __table_args__ = (
        Index("ix_student_notes_student_id_created_at", "student_id", "created_at"),
    )
