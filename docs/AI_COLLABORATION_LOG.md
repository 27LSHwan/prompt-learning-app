# AI 협업 개발 로그 — AI 학습 낙오 예측 시스템

> 본 문서는 **Claude Code(Anthropic)** 와 협업하여 본 프로젝트를 기획·설계·구현한 전 과정을 기록한 AI 협업 아티팩트입니다.
> 공모전 심사 기준 "AI와 효율적으로 협업하는 능력"에 해당하는 증거 문서입니다.

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 프로젝트명 | AI 학습 낙오 예측 시스템 |
| 개발 AI 도구 | Claude Code (Anthropic) |
| 런타임 AI | OpenAI GPT-4o-mini |
| 코드베이스 규모 | 10,000+ 줄 (백엔드 FastAPI + 학생/관리자 React + 공유 패키지 4개) |
| 검증 결과 | harness/verification 38/38 컨트랙트 통과 |

---

## 2. AI 협업 방식 개요

이 프로젝트는 처음부터 끝까지 **Claude Code와의 구조화된 협업**으로 구현되었습니다.
단순히 코드 생성 도구로 사용한 것이 아니라, AI가 명세를 이해하고 스스로 판단하며
일관된 품질의 코드를 생성할 수 있는 **AI-driven 개발 워크플로우**를 설계했습니다.

### 핵심 협업 아티팩트

| 파일 | 역할 |
|------|------|
| `harness/implementation/system_prompt.md` | AI 구현 에이전트 시스템 프롬프트 (16개 원칙 + 금지 사항 + 구현 순서) |
| `CLAUDE.md` | 세션 간 컨텍스트 지속성 메모 (현재 상태 + 최근 변경 + 검증 결과) |
| `harness/implementation/architecture_rules.md` | 아키텍처 설계 원칙 |
| `harness/implementation/api_contracts.md` | API 엔드포인트 계약 명세 |
| `harness/implementation/db_contracts.md` | DB 스키마 계약 명세 |
| `harness/implementation/frontend_contracts.md` | 프론트엔드 UX/디자인 계약 |
| `harness/implementation/coding_rules.md` | 코딩 규칙 + 웹앱 완성도 15개 필수 항목 |
| `harness/verification/` | 자동화 검증 하네스 (구조/API/DB/보안/UI 체크) |

---

## 3. AI 협업 단계별 기록

### Step 1: 요구사항 분석 및 시스템 설계 (AI와 함께 기획)

**인간의 역할:** 교육 현장 페인 포인트 정의, 핵심 차별점 아이디어 제시
**Claude Code의 역할:** 요구사항을 바탕으로 시스템 아키텍처 설계 제안

핵심 설계 결정 사항 (AI와 논의하여 확정):

```
① 마이크 구두 검증 도입
   - 기존 LMS: 텍스트 제출만으로 평가
   - 우리 시스템: 점수 통과 후 마이크 녹음/전사 → LLM 평가 → 이중 검증
   → AI 제안: "단순 텍스트 평가의 복사·모방 허점을 막으려면 음성 검증이 필요"

② 위험도 분석 3단계 파이프라인
   - LLMAnalyzer (사고 지표 14개) → ScoringEngine (5차원 가중합) → DecisionEngine (7유형)
   → AI 제안: "LLM과 룰 기반을 분리해야 재현성과 비용 효율을 동시에 달성 가능"

③ 5회 반복 평가 평균
   - AI 제안: "단일 LLM 응답은 편차가 크므로 5회 평균으로 신뢰도 향상"
   - 단, 미리보기는 1회로 제한 → 토큰 절약과 빠른 피드백 균형
```

### Step 2: 명세 문서 작성 (AI와 함께 작성)

Claude Code와 협업하여 다음 명세 문서들을 작성했습니다:

```
harness/implementation/
├── system_prompt.md      ← AI 개발 에이전트 역할 + 16개 구현 원칙
├── architecture_rules.md ← 4개 계층 구조 + 패키지 의존성 규칙
├── api_contracts.md      ← 전체 REST API 엔드포인트 계약
├── db_contracts.md       ← SQLAlchemy 모델 + 컬럼 타입 계약
├── frontend_contracts.md ← 페이지 구조 + 디자인 시스템 + UX 원칙
├── coding_rules.md       ← React 패턴 + 보안 규칙 + 완성도 15개 항목
├── deployment.md         ← 환경변수 + CORS + 배포 체크리스트
└── generation_steps/     ← 7단계 구현 순서 가이드
```

**핵심 원칙 (AI와 합의하여 명세에 포함):**
- 마이크 통과 전 `/feedback` 호출 금지 (토큰 낭비 방지)
- 힌트 시스템 완전 제거 (단순화)
- Vite 대신 esbuild 사용 (빌드 속도 향상)
- `hashlib.sha256` 단독 해싱 금지 → passlib[bcrypt] 필수 (보안)

### Step 3: 구현 (AI 주도 코드 생성)

7단계 순서로 Claude Code가 코드를 생성했습니다:

```
Step 01: packages/shared         ← 공통 타입·유틸
Step 02: packages/llm_analysis   ← LLM 분석 모듈 (사고력 분석 14개 지표)
Step 03: packages/scoring        ← 스코어링 엔진 (5차원 가중합)
Step 04: packages/decision       ← 의사결정 엔진 (7가지 탈락 유형 분류)
Step 05: apps/backend            ← FastAPI (모델 → 스키마 → 서비스 → 라우터)
Step 06: apps/student-web        ← 학생 React 프론트
Step 07: apps/admin-web          ← 관리자 React 프론트
```

**각 단계에서 AI가 수행한 작업:**
- 계약 명세를 참조하여 API 스키마와 DB 모델 간 일관성 유지
- 보안 요건(JWT 인증, bcrypt, rate limiting, student_id 쿼리 파라미터 금지) 자동 적용
- 컴포넌트 재사용성을 고려한 React 구조 설계
- CSS 변수 기반 디자인 시스템 일관 적용

### Step 4: 검증 및 반복 개선 (AI + 자동화 하네스)

```bash
# 구현 후 자동 검증 (Claude Code가 검증을 해석하고 수정)
python harness/verification/run_all.py

# 최근 검증 결과
python3 -m py_compile apps/backend/app/api/routes/student.py  ✓
python3 -m py_compile apps/backend/app/api/routes/admin.py    ✓
npm run build  # apps/student-web                              ✓
npm run build  # apps/admin-web                                ✓
python3 harness/verification/contract_checks/check_feature_extensions.py  38/38 ✓
python3 harness/verification/contract_checks/check_responsive_layout.py   ✓
```

**반복 개선 사례 (CLAUDE.md에 기록):**

| 날짜 | 문제 | AI와 함께 해결한 방법 |
|------|------|-----------------------|
| 2026-04-13 | 마이크 미통과 상태에서 /feedback 선호출로 토큰 낭비 | 결과 페이지 진입 직후 /feedback 호출 조건을 `conceptPassed` 기준으로 게이트 설정 |
| 2026-04-13 | 관리자 모달이 사이드바 기준 중앙에 표시됨 | `createPortal(..., document.body)` 적용으로 뷰포트 기준 중앙 정렬 |
| 2026-04-13 | 일부 마이크 문항만 통과해도 전체 통과로 처리되는 버그 | `_is_concept_reflection_complete()` 재검증 로직 추가 |
| 2026-04-13 | 추천 페이지 하드코딩 추천 → 실제 도움 안 됨 | 약점 태그 기반 개념 매핑 + YouTube 검색 링크 + 맞춤 문제 연결로 개편 |
| 2026-04-13 | 개입 생성 후 개입 상세 모달이 자동으로 열리지 않음 | `GET /admin/interventions/{id}` 직접 조회 API 추가 + URL query 파라미터 기반 모달 자동 오픈 |

### Step 5: CLAUDE.md 컨텍스트 관리

세션이 끊겨도 프로젝트 상태를 잃지 않도록 `CLAUDE.md`를 지속 업데이트했습니다.

**CLAUDE.md에 포함된 정보:**
- 현재 구현 상태 (최신 API 명세, 주요 파일 경로)
- 금지 사항 목록 (힌트 시스템, Vite, 마이크 전 /feedback 호출 등)
- 최근 변경 사항 (날짜별 변경 내역)
- 검증 결과 (통과한 명령어 목록)
- 기술 부채 (미구현 항목 명시)

이를 통해 새로운 Claude 세션에서도 CLAUDE.md만 읽으면 즉시 이어서 작업 가능한
**AI-friendly 프로젝트 구조**를 유지했습니다.

---

## 4. AI 협업의 구체적 효과

### 코드 품질 향상
- 보안 취약점(bcrypt 미사용, JWT 누락, rate limiting 부재) 자동 감지 및 수정
- API 계약과 실제 구현 간 불일치 자동 탐지
- 컴포넌트 패턴 일관성 유지 (ErrorBoundary, Toast, Pagination 등 17개 항목)

### 개발 속도
- 명세 문서 기반 코드 생성으로 반복 수정 최소화
- harness/verification/ 자동 검증으로 회귀 버그 즉시 감지
- CLAUDE.md 컨텍스트로 세션 재시작 비용 제거

### 설계 품질
- 토큰 낭비 방지 패턴 (조건부 API 호출, DB 캐싱, 1회/5회 분리) 설계 제안
- 7가지 탈락 유형 분류 알고리즘 공동 설계
- 마이크 구두 검증 플로우 UX 설계 제안

---

## 5. AI 협업 시 사용한 주요 프롬프트 패턴

### 패턴 1: 계약 우선 구현 지시
```
harness/implementation/api_contracts.md의 엔드포인트 계약을 정확히 구현하되,
계약에 없는 엔드포인트는 추가하지 마세요.
DB 컬럼은 db_contracts.md에 정의된 것만 사용하세요.
```

### 패턴 2: 금지 사항 명시
```
CLAUDE.md의 "금지/주의" 섹션을 반드시 준수하세요.
특히:
- hint_penalty, hint_used_count 컬럼 추가 절대 금지
- 마이크 통과 전 /feedback 선호출 금지
- Vite 재도입 금지
```

### 패턴 3: 단계별 검증 요청
```
구현 후 반드시 python3 -m py_compile로 컴파일 검사를 실행하고,
npm run build로 빌드 확인 후 CLAUDE.md를 업데이트하세요.
```

### 패턴 4: 차별점 강조 설계
```
마이크 개념 확인 기능은 이 시스템의 핵심 차별점입니다.
단일 전사문으로 여러 질문을 한 번에 평가하는 방식으로 되돌리지 마세요.
각 문항을 독립적으로 LLM 평가해야 합니다.
```

---

## 6. 프로젝트 내 AI 관련 파일 목록

```
프로젝트 루트/
├── CLAUDE.md                           ← AI 세션 간 컨텍스트 메모 (핵심 협업 문서)
├── harness/
│   └── implementation/
│       ├── system_prompt.md            ← AI 개발 에이전트 시스템 프롬프트
│       ├── architecture_rules.md       ← AI와 합의한 아키텍처 규칙
│       ├── api_contracts.md            ← API 계약 명세
│       ├── db_contracts.md             ← DB 스키마 계약
│       ├── frontend_contracts.md       ← 프론트엔드 UX 계약
│       ├── coding_rules.md             ← 코딩 규칙
│       └── deployment.md               ← 배포 체크리스트
├── docs/
│   ├── AI_COLLABORATION_LOG.md         ← 본 문서 (AI 협업 로그)
│   └── PROMPT_ENGINEERING_DESIGN.md    ← 시스템 내 AI 프롬프트 설계서
└── packages/
    └── llm_analysis/
        └── prompts.py                  ← 실제 사용되는 AI 프롬프트 코드
```
