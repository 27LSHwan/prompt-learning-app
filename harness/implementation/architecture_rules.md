# Architecture Rules — 아키텍처 규칙

## 전체 구조

```
project/
  apps/
    backend/          # FastAPI 기반 REST API 서버
    student-web/      # React 기반 학생 포털
    admin-web/        # React 기반 관리자 대시보드
  packages/
    llm_analysis/     # LLM 기반 텍스트 분석 모듈
    scoring/          # 위험도 점수 계산 모듈
    decision/         # 개입 결정 모듈
    shared/           # 공통 타입, 유틸리티
  harness/
    implementation/   # 구현 하네스 (생성 규칙)
    verification/     # 검증 하네스 (판정 기준)
  docs/               # 문서
```

## 레이어 규칙

### Backend (FastAPI)
- `app/api/routes/` — 라우터 레이어 (비즈니스 로직 없음)
- `app/services/` — 서비스 레이어 (비즈니스 로직)
- `app/models/` — DB 모델 (SQLAlchemy)
- `app/schemas/` — Pydantic 스키마 (요청/응답 직렬화)

### Packages
- `llm_analysis` → `scoring` → `decision` 순서로 의존
- 역방향 의존 금지 (decision → scoring 금지)
- `shared`는 모든 패키지에서 사용 가능

### Frontend
- `student-web`: 학생 전용 UI (로그인, 제출, 피드백 확인)
- `admin-web`: 관리자 전용 UI (위험 학생 목록, 개입 관리)

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| Backend API | FastAPI + SQLAlchemy + Pydantic |
| Database | PostgreSQL (SQLite 허용 for dev) |
| LLM | OpenAI API (gpt-4o) |
| Frontend | React + TypeScript + Axios |
| 패키지 관리 | uv (Python), npm (Node) |

## 환경 변수

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/dropout_db
OPENAI_API_KEY=sk-...
SECRET_KEY=your-secret-key
BACKEND_URL=http://localhost:8000
```

## 금지 패턴

- 라우터에서 직접 DB 쿼리 금지
- 서비스에서 HTTP 응답 객체 반환 금지
- 패키지 간 순환 의존 금지
