# 배포 가이드 — CORS / nginx / 환경변수

## 1. 환경변수 설정

### student-web (public/.env)
```
백엔드 주소는 `public/.env` 에 `API_BASE_URL=` 로 선언하고 브라우저 런타임에 읽음
```

### admin-web (public/.env)
```
`public/.env`:
`API_BASE_URL=http://localhost:8000`
```

---

## 2. FastAPI CORS 설정

`backend/main.py` 또는 앱 진입점에서 반드시 origin 화이트리스트를 명시:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # student-web dev
        "http://localhost:5174",   # admin-web dev
        "https://student.example.com",  # student-web prod
        "https://admin.example.com",    # admin-web prod
    ],
    allow_credentials=True,   # JWT 쿠키/헤더 허용
    allow_methods=["*"],
    allow_headers=["*"],
)
```

> **주의**: `allow_origins=["*"]`는 프로덕션에서 절대 사용 금지 (JWT Bearer와 혼용 시 보안 취약점).

---

## 3. nginx 설정 (프로덕션)

```nginx
# /etc/nginx/sites-available/student-web.conf
server {
    listen 443 ssl;
    server_name student.example.com;

    ssl_certificate     /etc/letsencrypt/live/student.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/student.example.com/privkey.pem;

    # React SPA: 모든 경로를 index.html로 fallback
    root /var/www/student-web/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 정적 파일 캐싱
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# /etc/nginx/sites-available/admin-web.conf (포트만 다름)
server {
    listen 443 ssl;
    server_name admin.example.com;
    ssl_certificate     /etc/letsencrypt/live/admin.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.example.com/privkey.pem;
    root /var/www/admin-web/dist;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
    location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; }
}

# API 리버스 프록시
server {
    listen 443 ssl;
    server_name api.example.com;
    ssl_certificate     /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

    location / {
        proxy_pass         http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

---

## 4. JWT Refresh Token 흐름

```
클라이언트                           서버
   |                                  |
   |-- POST /auth/login ------------→ |
   |←-- { access_token,              |
   |      refresh_token } ----------- |
   |                                  |
   |-- GET /api/resource             |
   |   Authorization: Bearer {at} -→ |
   |←-- 401 Unauthorized ----------- | (access_token 만료)
   |                                  |
   |-- POST /auth/refresh            |
   |   { refresh_token: {rt} } ----→ |
   |←-- { access_token: {new_at} } -- |
   |                                  |
   |-- GET /api/resource (retry)     |
   |   Authorization: Bearer {new_at}→|
   |←-- 200 OK -------------------- |
```

- `access_token` 만료: 15분~1시간 권장
- `refresh_token` 만료: 7~30일 권장
- refresh 실패 시: clearAuth() + redirect to /login
- localStorage 키: `token` (student), `admin_token` (admin), `refresh_token` (공통)

---

## 5. 빌드 및 배포 명령

```bash
# student-web 빌드
cd apps/student-web
cp .env.example .env.production
# `public/.env` 수정 후:
npm run build   # dist/ 폴더 생성
rsync -avz dist/ user@server:/var/www/student-web/

# admin-web 빌드
cd apps/admin-web
cp .env.example .env.production
npm run build
rsync -avz dist/ user@server:/var/www/admin-web/

# nginx 재시작
sudo nginx -t && sudo systemctl reload nginx
```

---

## 6. 보안 체크리스트 (배포 전 필수)

- [ ] CORS allow_origins에 localhost 제거 (프로덕션)
- [ ] HTTPS 적용 (Let's Encrypt 또는 CA 인증서)
- [ ] `.env.production` git에 커밋 금지 (`.gitignore` 확인)
- [ ] JWT SECRET_KEY 환경변수로 관리 (코드에 하드코딩 금지)
- [ ] Rate limiting 설정 (FastAPI SlowAPI 또는 nginx limit_req)
- [ ] X-Frame-Options, X-Content-Type-Options 헤더 설정
- [ ] API 응답에 민감정보(비밀번호 해시 등) 미포함 확인

---

## 7. 초기 DB 시드 데이터

### 실행 방법

```bash
cd apps/backend

# 최초 실행 (이미 데이터 있으면 skip)
python seed.py

# 전체 초기화 후 재생성
python seed.py --reset
```

### 생성 데이터 구성

| 테이블 | 건수 | 내용 |
|--------|------|------|
| users | 10 | 관리자 2명 + 학생 8명 |
| problems | 12 | 4개 카테고리(알고리즘/자료구조/DB/네트워크) × 3 난이도 |
| submissions | 21 | 학생별 2~4개 제출 이력 |
| risk_scores | 21 | 위험도 5단계 분포 (안정6/경미5/주의4/고위험2/심각4) |
| interventions | 4 | 고위험/심각 학생 대상 개입 이력 |

### 기본 로그인 계정

**관리자** (관리자 웹 http://localhost:5174)
| 이름 | 이메일 | 비밀번호 |
|------|--------|----------|
| 관리자 | admin@example.com | admin1234 |
| 교수님 | professor@example.com | prof1234 |

**학생** (학생 웹 http://localhost:5173, 비밀번호 공통: `student123`)
| 이름 | 이메일 | 현재 위험 단계 |
|------|--------|----------------|
| 김민준 | minjun@example.com | 안정 |
| 이서연 | seoyeon@example.com | 안정 |
| 박도윤 | doyun@example.com | 고위험 |
| 최지우 | jiwoo@example.com | 주의 |
| 정하은 | haeun@example.com | 심각 |
| 강시우 | siwoo@example.com | 경미 |
| 윤아린 | arin@example.com | 안정 |
| 임주원 | juwon@example.com | 경미 |

### 중복 실행 방지 로직

`seed.py`는 관리자 계정이 이미 존재하면 자동으로 skip한다.
`--reset` 플래그를 사용할 경우 interactive 확인(y/N)을 요구한다.

### seed.py 구조 (신규 프로젝트 적용 시)

```python
# 필수 포함 항목:
# 1. ADMINS 리스트 — 최소 1개 관리자 계정
# 2. 비밀번호: passlib[bcrypt] CryptContext로 해싱
# 3. 중복 체크: select(User).where(User.role=="admin") 조회 후 skip
# 4. --reset 플래그: 외래키 순서 역순으로 DELETE 후 재생성
# 5. 완료 시 로그인 정보 출력
```
