#!/bin/sh
# 컨테이너 시작 시 런타임 환경변수 파일 생성
# 프론트엔드가 fetch('/.env') 로 API 주소를 읽어감

if [ -z "$API_BASE_URL" ]; then
  echo "[entrypoint] ERROR: API_BASE_URL is required" >&2
  exit 1
fi

cat > /usr/share/nginx/html/.env << EOF
API_BASE_URL=${API_BASE_URL}
EOF

echo "[entrypoint] .env written: API_BASE_URL=${API_BASE_URL}"

exec nginx -g "daemon off;"
