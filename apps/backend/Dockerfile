# ── 백엔드 Dockerfile ────────────────────────────────────────
# 빌드 컨텍스트: 프로젝트 루트 (docker-compose.yml 위치)
# docker build -f apps/backend/Dockerfile .

FROM python:3.11-slim

# 시스템 패키지 (aiosqlite 빌드용)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 의존성 먼저 복사 (레이어 캐시 활용)
COPY apps/backend/requirements.txt ./apps/backend/requirements.txt
RUN pip install --no-cache-dir -r apps/backend/requirements.txt

# 소스 복사
COPY packages/ ./packages/
COPY apps/backend/ ./apps/backend/

# DB 저장용 디렉토리
RUN mkdir -p /data

WORKDIR /app/apps/backend

# PYTHONPATH에 프로젝트 루트 + packages 추가
ENV PYTHONPATH="/app:/app/packages"

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
