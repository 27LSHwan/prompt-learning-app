"""
FastAPI 의존성 — JWT 인증 / 권한 검사
"""

import logging

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..database import get_db
from ..models.user import User
from ..services.auth_service import decode_token

logger = logging.getLogger("app.deps")

_bearer = HTTPBearer(auto_error=True)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Bearer 토큰 검증 후 User 객체 반환."""
    token = credentials.credentials
    s = get_settings()
    try:
        payload = decode_token(token, s.secret_key)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않거나 만료된 토큰입니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="액세스 토큰이 필요합니다.")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="사용자를 찾을 수 없습니다.")
    return user


async def get_current_student(current_user: User = Depends(get_current_user)) -> User:
    """학생 역할 검증."""
    if current_user.role != "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="학생 계정만 접근 가능합니다.")
    return current_user


async def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    """관리자 역할 검증."""
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="관리자 계정만 접근 가능합니다.")
    return current_user
