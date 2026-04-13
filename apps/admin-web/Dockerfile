# ── admin-web Dockerfile ─────────────────────────────────────
# 빌드 컨텍스트: 프로젝트 루트

# ─ 1단계: 빌드 ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY scripts/ ./scripts/

COPY apps/admin-web/package.json ./apps/admin-web/
WORKDIR /app/apps/admin-web
RUN npm install

COPY apps/admin-web/ ./
RUN npm run build

# ─ 2단계: Nginx 서빙 ────────────────────────────────────────
FROM nginx:1.25-alpine

COPY --from=builder /app/apps/admin-web/dist /usr/share/nginx/html
COPY apps/admin-web/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/admin-web/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
