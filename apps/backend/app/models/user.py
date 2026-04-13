import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Integer
from sqlalchemy import types as sa_types
from ..database import Base


class UUIDStr(sa_types.TypeDecorator):
    impl = sa_types.String(36)
    cache_ok = True
    def process_bind_param(self, v, _): return str(v) if v else None
    def process_result_value(self, v, _): return str(v) if v else None


class User(Base):
    __tablename__ = "users"

    id            = Column(UUIDStr, primary_key=True, default=lambda: str(uuid.uuid4()))
    username      = Column(String(100), nullable=False, unique=True)
    email         = Column(String(200), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    role          = Column(String(20), nullable=False, default="student")
    helper_points = Column(Integer, nullable=False, default=0)
    created_at    = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
