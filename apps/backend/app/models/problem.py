import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime
from sqlalchemy import types as sa_types
from ..database import Base


class UUIDStr(sa_types.TypeDecorator):
    impl = sa_types.String(36)
    cache_ok = True
    def process_bind_param(self, v, _): return str(v) if v else None
    def process_result_value(self, v, _): return str(v) if v else None


class Problem(Base):
    __tablename__ = "problems"

    id          = Column(UUIDStr, primary_key=True, default=lambda: str(uuid.uuid4()))
    title       = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    difficulty  = Column(String(50), nullable=False, default="medium")
    category    = Column(String(100), nullable=False, default="general")
    steps_json  = Column(Text, nullable=True)   # JSON 배열: ["step1 prompt", "step2 prompt", ...]
    rubric_json = Column(Text, nullable=True)   # JSON 객체: {"criteria": [...], "evaluation_guidelines": "..."}
    core_concepts_json = Column(Text, nullable=True)  # JSON 배열: 개념 설명 확인용 핵심 개념
    methodology_json = Column(Text, nullable=True)    # JSON 배열: 문제별 프로세스/방법론
    concept_check_questions_json = Column(Text, nullable=True)  # JSON 배열: 마이크 설명 정적 질문
    created_at  = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
