from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..models.intervention import Intervention
from ..schemas.admin import InterventionCreate


class InterventionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: InterventionCreate) -> Intervention:
        item = Intervention(
            student_id=data.student_id,
            type=data.type,
            message=data.message,
            dropout_type=data.dropout_type,
            status="pending",
        )
        self.db.add(item)
        await self.db.commit()
        await self.db.refresh(item)
        return item

    async def list_all(
        self,
        student_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 20,
    ) -> tuple[list[Intervention], int]:
        q = select(Intervention)
        cq = select(func.count()).select_from(Intervention)
        if student_id:
            q = q.where(Intervention.student_id == student_id)
            cq = cq.where(Intervention.student_id == student_id)
        if status:
            q = q.where(Intervention.status == status)
            cq = cq.where(Intervention.status == status)
        q = q.order_by(Intervention.created_at.desc()).limit(limit)
        items = (await self.db.execute(q)).scalars().all()
        total = (await self.db.execute(cq)).scalar()
        return list(items), total
