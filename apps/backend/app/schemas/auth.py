from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class SignupRequest(BaseModel):
    username: str = Field(min_length=2, max_length=100)
    email: str
    password: str = Field(min_length=6)
    # 회원가입 시 admin 역할은 허용하지 않음 (관리자는 seed 또는 DB 직접 생성)
    role: Literal["student"] = "student"


class SignupResponse(BaseModel):
    id: str
    username: str
    email: str
    role: str
    created_at: datetime


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    user_id: str
    role: str


class RefreshRequest(BaseModel):
    refresh_token: str
