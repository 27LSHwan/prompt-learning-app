# AI 협업 개발 로그 — 프롬프트 학습 평가 시스템

> 본 문서는 이 프로젝트의 기획·설계·구현·검증 전 과정에서 AI와 협업한 내용을 기록한 아티팩트입니다.
> 공모전 심사 기준 "AI와 효율적으로 협업하는 능력"에 해당하는 증거 문서입니다.

---

## 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 프로젝트명 | 프롬프트 학습 평가 시스템 |
| 개발 기간 | 2026년 |
| 주요 AI 개발 도구 | Claude Code (Anthropic) — 구현 에이전트 |
| 보조 AI 도구 | Cursor (인라인 편집), OpenAI Codex/ChatGPT (설계 검증) |
| 런타임 AI | OpenAI GPT-4o-mini (LLM 평가·코칭·분석) |
| 코드베이스 규모 | 3개 앱 + 4개 공유 패키지, 10,000+ 줄 |
| 자동화 검증 결과 | harness/verification 38/38 컨트랙트 통과 |

---

## 1. AI를 활용한 이유와 배경

이 프로젝트는 혼자 단기간에 백엔드(FastAPI) + 학생 프론트엔드(React) + 관리자 프론트엔드(React) + 공유 패키지(4개) 를 동시에 개발해야 하는 구조였습니다. 단순히 코드를 빨리 만드는 것이 목적이 아니라, 다음 두 가지 문제를 AI와 함께 해결하는 것이 핵심이었습니다.

**해결해야 했던 문제**

첫째, 3개 앱 간 API 계약 일관성 유지입니다. 백엔드가 바뀌면 두 프론트엔드도 함께 바뀌어야 하는데, 이를 사람이 일일이 추적하면 버그가 생깁니다. 명세 문서를 AI가 읽고 코드를 생성하면 계약 불일치를 원천 차단할 수 있습니다.

둘째, 세션 간 컨텍스트 유지입니다. AI는 대화가 끊기면 이전 내용을 잃어버립니다. `CLAUDE.md`를 프로젝트 루트에 두고 매 세션마다 읽히는 방식으로 이를 해결했습니다.

---

## 2. 사용한 AI 도구별 역할

### Claude Code — 주 구현 에이전트

`harness/implementation/system_prompt.md`에 정의된 16개 구현 원칙과 절대 금지 사항을 시스템 프롬프트로 주입해 코드 생성을 맡겼습니다. 단순 코드 생성기가 아니라, 명세를 읽고 스스로 판단해 일관된 품질의 코드를 생성하는 에이전트로 운용했습니다.

- 7단계 순서대로 패키지 → 백엔드 → 프론트엔드 순차 구현
- 보안 요건(bcrypt, JWT, rate limiting) 자동 적용
- 구현 후 `py_compile`, `npm run build` 자동 검증 및 CLAUDE.md 업데이트

### Cursor — 인라인 편집 보조

특정 함수나 컴포넌트를 빠르게 수정할 때 활용했습니다. Cmd+K 인라인 편집으로 파일 전체를 건드리지 않고 필요한 부분만 정밀하게 수정했습니다. TypeScript 타입 오류 즉각 감지와 멀티파일 컨텍스트 인식이 특히 유용했습니다.

### OpenAI Codex (ChatGPT) — 설계 검증 및 아이디어 탐색

Claude Code와 다른 관점에서 설계를 교차 검증하는 용도로 사용했습니다. 7유형 위험도 분류 로직과 루브릭 평가 기준 초안 작성 시 자연어 대화로 빠르게 시나리오를 시뮬레이션했습니다.

---

## 3. AI 협업 핵심 아티팩트

이 프로젝트에서 AI와 함께 만든 구조적 산출물들입니다. 단순히 AI에게 "코드 짜줘"가 아니라, AI가 일관된 판단을 내릴 수 있도록 체계적인 명세 문서 시스템을 설계했습니다.

| 파일 | 역할 | 비고 |
|------|------|------|
| `CLAUDE.md` | 세션 간 컨텍스트 지속성 메모 | 현재 구현 상태·금지사항·최근 변경 기록 |
| `harness/implementation/system_prompt.md` | AI 구현 에이전트 시스템 프롬프트 | 16개 구현 원칙 + 절대 금지 사항 |
| `harness/implementation/api_contracts.md` | REST API 엔드포인트 계약 명세 | 백엔드-프론트엔드 계약 |
| `harness/implementation/db_contracts.md` | DB 스키마 계약 명세 | SQLAlchemy 모델 컬럼 타입 |
| `harness/implementation/frontend_contracts.md` | 프론트엔드 UX·디자인 계약 | 페이지 구조 + 디자인 시스템 |
| `harness/implementation/coding_rules.md` | 코딩 규칙 + 완성도 17개 필수 항목 | 보안·React 패턴·접근성 |
| `harness/implementation/architecture_rules.md` | 아키텍처 계층 규칙 | 패키지 의존성 방향 |
| `harness/verification/` | 자동화 검증 하네스 | 38개 컨트랙트 체크 |

---

## 4. 단계별 협업 과정

### 1단계 — 요구사항 정의 및 핵심 차별점 설계

AI와 함께 기존 LMS의 한계를 분석하고 차별화 포인트를 도출했습니다.

**도출한 핵심 차별점 5가지**

①  마이크 구두 검증: 텍스트 제출만으로는 학생이 ChatGPT 답변을 그대로 붙여넣어도 구분이 안 됩니다. 점수 통과 후 마이크로 직접 말하면 음성이 텍스트로 변환되어 LLM 평가에 제출되는 이중 검증 구조를 설계했습니다.

② LLM 루브릭 평가: 문제별 `rubric_json`을 동적으로 주입해 획일적 평가가 아닌 문제마다 다른 기준으로 평가합니다. 최종 제출은 5회 평균으로 LLM 편차를 흡수합니다.

③ 프롬이 3단계 코칭: 문제 접근 시(enter) → 결과 실행 후(run) → 최종 제출 전(final) 각 단계마다 맥락에 맞는 코칭을 제공합니다. 정답은 절대 주지 않는 원칙을 시스템 프롬프트 수준에서 강제합니다.

④ 7유형 위험도 분석: 인지형·동기형·전략형·급락형·의존형·복합형·없음 7가지로 탈락 위험을 분류합니다. 조기 감지 → 적시 개입으로 학습 이탈율 감소를 목표로 합니다.

⑤ 관리자 스마트 개입: 위험도 20점 이상 시 관리자에게 자동 알림이 가고, 탈락 유형별 맞춤 개입 메시지 템플릿으로 학생에게 직접 메시지를 보낼 수 있습니다.

### 2단계 — 명세 문서 작성 (AI와 공동 작성)

Claude Code와 협업하여 `harness/implementation/` 하위에 전체 명세를 작성했습니다. 이 명세가 이후 코드 생성의 기준이 됩니다. 특히 아래 사항들은 AI와 합의하여 명세에 명시적으로 포함시켰습니다.

- 마이크 통과 전 `/feedback` 호출 금지 — 불필요한 토큰 낭비 방지
- `hint_penalty`, `hint_used_count` 컬럼 추가 금지 — 힌트 시스템은 완전 제거
- Vite 사용 금지, esbuild 기반 `scripts/react-app.mjs` 사용
- `hashlib.sha256` 단독 비밀번호 해싱 금지 — `passlib[bcrypt]` 필수
- `student_id`를 Query Parameter로 받는 것 금지 — JWT 토큰에서 추출

### 3단계 — 7단계 순차 구현 (Claude Code 주도)

명세를 기반으로 Claude Code가 아래 순서로 코드를 생성했습니다.

```
Step 01  packages/shared         공통 타입·유틸
Step 02  packages/llm_analysis   LLM 분석 모듈 (루브릭 평가, 사고력 분석 14지표)
Step 03  packages/scoring        스코어링 엔진 (5차원 가중합)
Step 04  packages/decision       의사결정 엔진 (7가지 탈락 유형 분류)
Step 05  apps/backend            FastAPI (모델 → 스키마 → 서비스 → 라우터)
Step 06  apps/student-web        학생용 React 프론트엔드
Step 07  apps/admin-web          관리자용 React 프론트엔드
```

패키지를 먼저 구현하고 백엔드, 프론트엔드 순서로 가는 이유는 하위 레이어가 확정된 상태에서 상위 레이어를 만들어야 계약 불일치가 생기지 않기 때문입니다.

### 4단계 — 자동화 검증 및 반복 개선

구현 후 harness 검증을 실행하고, Claude Code가 결과를 해석해 수정하는 루프를 반복했습니다.

```bash
python3 -m py_compile apps/backend/app/api/routes/student.py  # 통과
python3 -m py_compile apps/backend/app/api/routes/admin.py    # 통과
npm run build  # apps/student-web                              # 통과
npm run build  # apps/admin-web                                # 통과
python3 harness/verification/contract_checks/check_feature_extensions.py  # 38/38 통과
python3 harness/verification/contract_checks/check_responsive_layout.py   # 통과
```

**주요 반복 개선 사례**

| 날짜 | 발견된 문제 | AI와 함께 해결한 방법 |
|------|-------------|----------------------|
| 2026-04-13 | 마이크 미통과 상태에서 `/feedback` 선호출로 토큰 낭비 | 결과 페이지 진입 직후 `/feedback` 호출 조건을 `conceptPassed` 기준으로 게이트 설정 |
| 2026-04-13 | 관리자 모달이 사이드바 기준으로 치우쳐 표시됨 | `createPortal(..., document.body)` 적용으로 뷰포트 기준 중앙 정렬 |
| 2026-04-13 | 일부 마이크 문항만 통과해도 전체 통과로 저장되는 버그 | `_is_concept_reflection_complete()` 재검증 로직 추가, 조회 시마다 엄격 재검증 |
| 2026-04-13 | 추천 페이지 하드코딩 추천이 실제 학습에 도움 안 됨 | 약점 태그 기반 개념 매핑 + YouTube 검색 링크 + 맞춤 문제 연결로 개편 |
| 2026-04-13 | 개입 생성 후 상세 모달이 자동으로 열리지 않음 | `GET /admin/interventions/{id}` 직접 조회 API 추가 + URL query 파라미터 기반 모달 자동 오픈 |
| 2026-04-13 | 알림 오버레이가 마이크 제출 버튼 클릭 차단 | 결과 페이지에서 알림 모달 자동 팝업 억제 옵션 추가 |

### 5단계 — CLAUDE.md 기반 컨텍스트 관리

세션이 끊겨도 프로젝트 상태를 잃지 않도록 매 작업 후 `CLAUDE.md`를 업데이트했습니다. 새 세션을 시작할 때 Claude Code가 이 파일만 읽으면 즉시 이어서 작업할 수 있습니다.

CLAUDE.md에 포함된 정보는 현재 구현 상태(최신 API 명세, 주요 파일 경로), 금지 사항 목록, 날짜별 최근 변경 내역, 통과한 검증 명령어, 기술 부채 목록입니다. 이 방식 덕분에 컨텍스트 재구성 없이 어떤 Claude 세션에서도 즉시 작업을 이어갈 수 있었습니다.

---

## 5. AI 협업에서 사용한 핵심 프롬프트 패턴

### 패턴 1 — 계약 우선 구현 지시

```
harness/implementation/api_contracts.md의 엔드포인트 계약을 정확히 구현하되,
계약에 없는 엔드포인트는 추가하지 마세요.
DB 컬럼은 db_contracts.md에 정의된 것만 사용하세요.
```

### 패턴 2 — 금지 사항 명시적 주입

```
CLAUDE.md의 "금지/주의" 섹션을 반드시 준수하세요.
특히 hint_penalty/hint_used_count 컬럼 추가 절대 금지,
마이크 통과 전 /feedback 선호출 금지,
단일 전사문으로 여러 질문을 한 번에 평가하는 방식으로 되돌리지 말 것.
```

### 패턴 3 — 검증 후 상태 기록 강제

```
구현 후 반드시 py_compile + npm run build로 검증을 실행하고,
결과를 CLAUDE.md에 업데이트하세요.
```

### 패턴 4 — 차별점 훼손 방지

```
마이크 개념 확인 기능은 이 시스템의 핵심 차별점입니다.
각 확인 질문마다 별도 녹음·변환 입력을 받고 독립적으로 LLM 평가해야 합니다.
하나의 답변으로 여러 질문을 한 번에 처리하는 방식은 절대 사용하지 마세요.
```

---

## 6. 프로젝트 내 AI 관련 파일 전체 목록

```
프로젝트 루트/
├── CLAUDE.md                                  ← AI 세션 간 컨텍스트 메모 (핵심)
├── harness/
│   └── implementation/
│       ├── system_prompt.md                   ← AI 구현 에이전트 시스템 프롬프트
│       ├── architecture_rules.md              ← AI와 합의한 아키텍처 규칙
│       ├── api_contracts.md                   ← REST API 계약
│       ├── db_contracts.md                    ← DB 스키마 계약
│       ├── frontend_contracts.md              ← 프론트엔드 UX 계약
│       ├── coding_rules.md                    ← 코딩 규칙 + 완성도 17개 항목
│       ├── deployment.md                      ← 배포 체크리스트
│       └── generation_steps/                  ← 7단계 구현 순서 가이드
│           ├── 01_shared.md
│           ├── 02_llm_analysis.md
│           ├── 03_scoring.md
│           ├── 04_decision.md
│           ├── 05_backend.md
│           ├── 06_student_web.md
│           └── 07_admin_web.md
├── harness/
│   └── verification/
│       └── contract_checks/                   ← 38개 자동화 검증 스크립트
├── packages/
│   └── llm_analysis/
│       ├── prompts.py                         ← 실제 LLM 프롬프트 상수
│       ├── analyzer.py                        ← 사고력 분석 LLM 호출
│       ├── rubric_evaluator.py                ← 루브릭 평가 LLM 호출
│       └── feedback_agent.py                  ← 피드백 생성 LLM 호출
├── apps/backend/app/services/
│   └── promi_coach_service.py                 ← 프롬이 코칭 LLM 호출
└── docs/
    ├── AI_COLLABORATION_LOG.md                ← 본 문서
    └── PROMPT_ENGINEERING_DESIGN.md           ← 시스템 내 AI 프롬프트 설계서
```
