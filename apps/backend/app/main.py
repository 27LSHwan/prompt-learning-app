from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from .api.routes import auth, student, admin
from .config import get_settings, setup_logging
from .database import apply_schema_updates, create_tables, init_db

# 로깅 초기화 (앱 기동 직후)
setup_logging()

# Rate limiter 전역 인스턴스
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    s = get_settings()
    init_db(s.database_url)
    await create_tables()
    await apply_schema_updates()
    yield


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan,
)

# Rate limit 초과 시 429 응답
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,    prefix="/api/v1")
app.include_router(student.router, prefix="/api/v1")
app.include_router(admin.router,   prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/")
async def root():
    return {"message": settings.app_name, "docs": "/docs"}
