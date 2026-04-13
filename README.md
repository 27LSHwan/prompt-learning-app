# Prompt Edu Eval Student Project

## AI 협업 문서

이 프로젝트는 처음 기획부터 구현, 검증까지 AI와 협업해 개발했습니다. 아래 두 문서는 그 과정과 설계 근거를 기록한 아티팩트입니다.

| 문서 | 설명 |
|------|------|
| [AI 협업 개발 로그](docs/AI_COLLABORATION_LOG.md) | Claude Code·Cursor·Codex를 어떤 역할로 활용했는지, 단계별 협업 과정과 반복 개선 사례를 기록한 문서 |
| [AI 프롬프트 설계서](docs/PROMPT_ENGINEERING_DESIGN.md) | 시스템 내에서 실제로 동작하는 LLM 프롬프트 5종(루브릭 평가·사고력 분석·프롬이 코칭·피드백·마이크 검증)의 설계 근거와 엔지니어링 결정 문서 |

---

프롬프트 교육용 학생/관리자 웹 서비스입니다. 학생은 문제 풀이, LLM 기반 기준표 평가, 프롬이 코칭, 마이크 개념 설명 확인, 맞춤 학습 추천을 사용하고, 관리자는 학생 위험도, 제출 이력, 문제 추천, 개입 현황, 프롬이 코칭 품질 리뷰 큐를 운영합니다.

## 접속 URL

```text
학생 접속 URL:   http://34.47.85.162:3000/
관리자 접속 URL: http://34.47.85.162:3001/
```

## 로그인 계정

시드 데이터 기준 계정은 `apps/backend/seed.py`에서 관리합니다.

```text
[관리자]
admin@example.com / admin1234
professor@example.com / prof1234

[학생] 비밀번호 공통: student123
김민준: minjun@example.com (cognitive형)
이서연: seoyeon@example.com (none형)
박도윤: doyun@example.com (motivational형)
최지우: jiwoo@example.com (strategic형)
정하은: haeun@example.com (sudden형)
강시우: siwoo@example.com (dependency형)
윤아린: arin@example.com (compound형)
임주원: juwon@example.com (cognitive형)
```

## 주요 기능

- 학생 포털: 문제 목록, 문제 풀이, 결과 실행, 최종 제출, 제출 이력, 위험도 분석, 맞춤 학습 추천
- 관리자 포털: 대시보드, 학생 목록/상세, 문제 관리, 학생 개입, 문제 추천, 프롬이 코칭 품질 리뷰 큐
- 위험도 분석: 학생의 성과·진도·참여·프로세스·사고력 5개 차원을 분석해 인지형·동기형·전략형·급락형·의존형·복합형·안전 7가지 탈락 유형으로 분류하고, 유형별 맞춤 개입 메시지 템플릿으로 관리자가 위험 학생에게 직접 개입
- 평가: 문제별 평가 기준 기반 LLM 평가
- 개념 확인: 최종 점수 통과 후 문제별 마이크 개념 설명 평가
- 추천: 필요한 프롬프트 개념, 유튜브 강의 검색 링크, 바로 풀 문제 추천
- 배포: 단일 서버 Docker Compose + SQLite volume 구성 지원

## 프로젝트 구조

```text
apps/
  backend/       FastAPI 백엔드
  student-web/   학생 React SPA
  admin-web/     관리자 React SPA
packages/        평가/위험도/공통 로직 패키지
harness/         검증 하네스
docs/            배포/설계 문서
scripts/         프론트 빌드/개발 서버 스크립트
```

## 사용 버전

현재 개발 환경 기준입니다.

```text
Python 3.11.6
Node.js v24.13.0
npm 11.8.0
FastAPI 0.135.3
React 18.2.0
TypeScript 5.3.3
esbuild 0.21.5
SQLite + aiosqlite 0.22.1
```

Docker 배포 이미지는 다음 베이스 이미지를 사용합니다.

```text
backend: python:3.11-slim
frontend build: node:20-alpine
frontend serving: nginx:1.25-alpine
```

## 환경변수

루트 배포용:

```bash
cp .env.example .env
```

주요 값:

```env
SERVER_IP=1.2.3.4
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
SECRET_KEY=CHANGE-ME-use-openssl-rand-hex-32
```

백엔드 로컬 개발용:

```bash
cd apps/backend
cp .env.example .env
```

프론트는 런타임에 `/.env`를 fetch해서 `API_BASE_URL`을 읽습니다. 로컬 개발 또는 정적 빌드 테스트 시:

```bash
cp apps/student-web/.env.example apps/student-web/public/.env
cp apps/admin-web/.env.example apps/admin-web/public/.env
```

배포 시 Docker entrypoint가 컨테이너 환경변수 `API_BASE_URL`로 `/usr/share/nginx/html/.env`를 생성합니다.

## 백엔드 로컬 실행

```bash
cd apps/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python seed.py --reset
python run.py
```

백엔드 기본 주소:

```text
http://localhost:8000
http://localhost:8000/docs
```

## 학생 프론트 로컬 실행

```bash
cd apps/student-web
npm install
cp .env.example public/.env
npm run dev
```

기본 주소:

```text
http://localhost:5173
```

빌드:

```bash
npm run build
npm run preview
```

## 관리자 프론트 로컬 실행

```bash
cd apps/admin-web
npm install
cp .env.example public/.env
npm run dev
```

기본 주소:

```text
http://localhost:5174
```

빌드:

```bash
npm run build
npm run preview
```

## Docker Compose 배포

공모전 시연용 단일 서버 배포는 SQLite volume을 사용하는 Docker Compose 구성을 권장합니다.

```bash
cp .env.example .env
# .env에서 SERVER_IP, OPENAI_API_KEY, SECRET_KEY 수정
docker compose up -d --build
docker compose exec backend python seed.py --reset
```

서버에 Docker Compose v1만 설치되어 있다면 아래처럼 실행합니다.

```bash
docker-compose up -d --build
docker-compose exec backend python seed.py --reset
```

서비스 포트:

```text
학생 프론트: http://<SERVER_IP>:3000
관리자 프론트: http://<SERVER_IP>:3001
백엔드 API:   http://<SERVER_IP>:8000
API 문서:     http://<SERVER_IP>:8000/docs
```

SQLite DB는 Docker volume `db_data`에 저장됩니다. `docker compose down`은 DB를 유지하고, `docker compose down -v`는 DB까지 삭제합니다.

자세한 EC2 배포 절차는 [docs/DEPLOY.md](docs/DEPLOY.md)를 참고하세요.

## 검증 명령

```bash
# 백엔드 문법 확인
python3 -m py_compile apps/backend/app/api/routes/student.py apps/backend/app/api/routes/admin.py

# 프론트 빌드
cd apps/student-web && npm run build
cd ../admin-web && npm run build

# 하네스 검증
cd ../..
python3 harness/verification/contract_checks/check_feature_extensions.py
python3 harness/verification/contract_checks/check_responsive_layout.py
```

## Git 업로드 주의

다음 항목은 커밋하면 안 됩니다.

```text
.env
apps/*/public/.env
apps/*/dist/.env
apps/backend/.venv/
apps/*/node_modules/
apps/*/dist/
*.db
*.db-journal
harness/verification/reports/
```

OpenAI API 키가 노출된 적이 있다면 배포 전 반드시 새 키로 재발급하세요.
