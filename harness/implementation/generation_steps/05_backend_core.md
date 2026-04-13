# Step 05 — apps/backend 핵심 구현

## 목표
FastAPI 앱의 DB 모델, 스키마, 서비스, 라우터를 순서대로 구현한다.

---

## 5-1. DB 모델

### apps/backend/app/models/submission.py
```python
from sqlalchemy import Column, String, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime, timezone
from ..database import Base

class Submission(Base):
    __tablename__ = "submissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(String(100), nullable=False, index=True)
    course_id = Column(String(100), nullable=False)
    content = Column(Text, nullable=False)
    submission_type = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
```

### apps/backend/app/models/risk_score.py
```python
from sqlalchemy import Column, String, Float, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
import uuid
from ..database import Base

class RiskScore(Base):
    __tablename__ = "risk_scores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(String(100), nullable=False, index=True)
    submission_id = Column(UUID(as_uuid=True), ForeignKey("submissions.id"))
    score = Column(Float, nullable=False)
    level = Column(String(20), nullable=False)
    engagement_score = Column(Float, nullable=False)
    performance_score = Column(Float, nullable=False)
    sentiment_score = Column(Float, nullable=False)
    calculated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
```

---

## 5-2. 서비스 레이어

### apps/backend/app/services/submission_service.py
```python
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.submission import Submission
from ..schemas.submission import SubmissionCreate

class SubmissionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: SubmissionCreate) -> Submission:
        submission = Submission(**data.model_dump())
        self.db.add(submission)
        await self.db.commit()
        await self.db.refresh(submission)
        return submission

    async def get_by_id(self, submission_id: str) -> Submission | None:
        return await self.db.get(Submission, submission_id)
```

---

## 5-3. 라우터

### apps/backend/app/api/routes/submissions.py
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from ...database import get_db
from ...services.submission_service import SubmissionService
from ...schemas.submission import SubmissionCreate, SubmissionResponse

router = APIRouter(prefix="/submissions", tags=["submissions"])

@router.post("", response_model=SubmissionResponse, status_code=201)
async def create_submission(
    data: SubmissionCreate,
    db: AsyncSession = Depends(get_db),
):
    service = SubmissionService(db)
    return await service.create(data)

@router.get("/{submission_id}", response_model=SubmissionResponse)
async def get_submission(
    submission_id: str,
    db: AsyncSession = Depends(get_db),
):
    service = SubmissionService(db)
    submission = await service.get_by_id(submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    return submission
```

## 검증 기준
- [ ] `POST /submissions` 201 응답
- [ ] `GET /submissions/{id}` 200 응답
- [ ] 존재하지 않는 id → 404
- [ ] DB에 레코드 생성 확인
