# ── student-web Dockerfile ──────────────────────────────────
# 빌드 컨텍스트: 프로젝트 루트

# ─ 1단계: 빌드 ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# esbuild 빌드 스크립트 (../../scripts/react-app.mjs 경로 의존)
COPY scripts/ ./scripts/

# 의존성 설치 (레이어 캐시)
COPY apps/student-web/package.json ./apps/student-web/
WORKDIR /app/apps/student-web
RUN npm install

# 소스 전체 복사 후 빌드
COPY apps/student-web/ ./
RUN npm run build

# ─ 2단계: Nginx 서빙 ────────────────────────────────────────
FROM nginx:1.25-alpine

COPY --from=builder /app/apps/student-web/dist /usr/share/nginx/html
COPY apps/student-web/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/student-web/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
