import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from ...config import get_settings
from ...database import get_db
from ...schemas.auth import LoginRequest, LoginResponse, RefreshRequest, SignupRequest, SignupResponse
from ...services.auth_service import AuthService

logger = logging.getLogger("app.auth.route")

router = APIRouter(prefix="/auth", tags=["auth"])

_limiter = Limiter(key_func=get_remote_address)


@router.post("/signup", response_model=SignupResponse, status_code=201)
async def signup(data: SignupRequest, db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    try:
        user = await svc.signup(data)
    except Exception:
        raise HTTPException(status_code=400, detail="이미 사용 중인 이메일 또는 사용자명입니다.")
    return SignupResponse(
        id=str(user.id),
        username=user.username,
        email=user.email,
        role=user.role,
        created_at=user.created_at,
    )


@router.post("/login", response_model=LoginResponse)
@_limiter.limit("10/minute")
async def login(request: Request, data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """로그인 — IP당 분당 10회 제한."""
    s = get_settings()
    svc = AuthService(db)
    try:
        return await svc.login(
            data,
            secret=s.secret_key,
            access_expire=s.access_token_expire_minutes,
            refresh_expire=s.refresh_token_expire_minutes,
        )
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/refresh", response_model=LoginResponse)
@_limiter.limit("20/minute")
async def refresh_token(request: Request, data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """리프레시 토큰으로 새 액세스 토큰 발급."""
    s = get_settings()
    svc = AuthService(db)
    try:
        return await svc.refresh(
            data.refresh_token,
            secret=s.secret_key,
            access_expire=s.access_token_expire_minutes,
            refresh_expire=s.refresh_token_expire_minutes,
        )
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
