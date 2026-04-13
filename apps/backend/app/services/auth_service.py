import hashlib
import logging
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import bcrypt
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.user import User
from ..schemas.auth import LoginRequest, LoginResponse, SignupRequest

_ROOT = Path(__file__).resolve().parents[4]
for _p in [str(_ROOT), str(_ROOT / "packages")]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

logger = logging.getLogger("app.auth")

# bcrypt 해싱 컨텍스트 (SHA-256 단순 해시 대체)
_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    # 기존 SHA-256 해시 마이그레이션 지원
    sha_hash = hashlib.sha256(plain.encode()).hexdigest()
    if hashed == sha_hash:
        return True
    if hashed.startswith(("$2a$", "$2b$", "$2y$")):
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    return _pwd_ctx.verify(plain, hashed)


def create_access_token(user_id: str, role: str, secret: str, expire_minutes: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=expire_minutes)
    payload = {"sub": user_id, "role": role, "type": "access", "exp": expire}
    return jwt.encode(payload, secret, algorithm="HS256")


def create_refresh_token(user_id: str, role: str, secret: str, expire_minutes: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=expire_minutes)
    payload = {"sub": user_id, "role": role, "type": "refresh", "exp": expire}
    return jwt.encode(payload, secret, algorithm="HS256")


def decode_token(token: str, secret: str) -> dict:
    """토큰 검증 후 payload 반환. 실패 시 JWTError raise."""
    return jwt.decode(token, secret, algorithms=["HS256"])


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def signup(self, data: SignupRequest) -> User:
        user = User(
            username=data.username,
            email=data.email,
            password_hash=hash_password(data.password),
            role=data.role,
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        logger.info("신규 가입: %s (%s)", user.email, user.role)
        return user

    async def login(
        self,
        data: LoginRequest,
        secret: str,
        access_expire: int,
        refresh_expire: int,
    ) -> LoginResponse:
        result = await self.db.execute(select(User).where(User.email == data.email))
        user = result.scalar_one_or_none()
        if not user or not verify_password(data.password, user.password_hash):
            logger.warning("로그인 실패: %s", data.email)
            raise ValueError("이메일 또는 비밀번호가 올바르지 않습니다.")
        access_token = create_access_token(str(user.id), user.role, secret, access_expire)
        refresh_token = create_refresh_token(str(user.id), user.role, secret, refresh_expire)
        logger.info("로그인 성공: %s (%s)", user.email, user.role)
        return LoginResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user_id=str(user.id),
            role=user.role,
        )

    async def refresh(
        self,
        refresh_token: str,
        secret: str,
        access_expire: int,
        refresh_expire: int,
    ) -> LoginResponse:
        try:
            payload = decode_token(refresh_token, secret)
        except JWTError as exc:
            raise ValueError("유효하지 않은 리프레시 토큰입니다.") from exc
        if payload.get("type") != "refresh":
            raise ValueError("리프레시 토큰 타입이 올바르지 않습니다.")
        user_id = payload["sub"]
        role = payload["role"]
        new_access = create_access_token(user_id, role, secret, access_expire)
        new_refresh = create_refresh_token(user_id, role, secret, refresh_expire)
        return LoginResponse(
            access_token=new_access,
            refresh_token=new_refresh,
            user_id=user_id,
            role=role,
        )
