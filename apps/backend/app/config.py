import logging
import logging.config
from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./dev.db"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"
    # 반드시 .env에서 강력한 랜덤 값으로 교체할 것 (openssl rand -hex 32)
    secret_key: str = "CHANGE-ME-use-openssl-rand-hex-32"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60              # 1시간
    refresh_token_expire_minutes: int = 60 * 24 * 30   # 30일
    app_name: str = "AI 학습 낙오 예측 시스템"
    debug: bool = True
    allowed_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:4173",
        "http://localhost:4174",
    ]

    @field_validator("debug", mode="before")
    @classmethod
    def normalize_debug(cls, value):
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"release", "prod", "production"}:
                return False
            if normalized in {"debug", "dev", "development"}:
                return True
        return value

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


# ── 로깅 설정 ────────────────────────────────────────────
LOGGING_CONFIG: dict = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "default",
        },
    },
    "root": {
        "level": "INFO",
        "handlers": ["console"],
    },
    "loggers": {
        "uvicorn":        {"propagate": True},
        "uvicorn.error":  {"propagate": True},
        "uvicorn.access": {"propagate": True},
        "app":            {"level": "DEBUG", "propagate": True},
    },
}


def setup_logging() -> None:
    logging.config.dictConfig(LOGGING_CONFIG)
