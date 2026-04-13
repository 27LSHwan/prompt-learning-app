# CLAUDE.md

이 문서는 다음 Claude Code/Codex 작업자가 바로 이어서 작업할 수 있도록 현재 프로젝트의 실제 구현 상태만 정리한 최신 메모다.

## 프로젝트

- 루트: `/Users/lsh/Desktop/prompt_edu_eval_student_prj`
- 백엔드: FastAPI + SQLAlchemy Async + SQLite (`apps/backend`)
- 학생 프론트: React 18 + TypeScript (`apps/student-web`)
- 관리자 프론트: React 18 + TypeScript (`apps/admin-web`)
- 빌드: Vite 제거됨. `scripts/react-app.mjs` 기반 esbuild 사용
- API 주소: 각 앱 `public/.env`를 런타임 fetch로 읽음. `getApiBaseUrl()` 사용
- DB 기본값: `sqlite+aiosqlite:////tmp/prompt_edu_dev.db`
- git repo가 아님. `git status` 사용 불가

## 실행

```bash
cd apps/backend && source .venv/bin/activate && python run.py
cd apps/student-web && npm run dev
cd apps/admin-web && npm run dev
```

## 계정

- 관리자: `admin@example.com / admin1234`
- 관리자: `professor@example.com / prof1234`
- 학생 공통 비밀번호: `student123`
- 주요 학생: `minjun@example.com`, `seoyeon@example.com`, `doyun@example.com`, `jiwoo@example.com`, `haeun@example.com`, `siwoo@example.com`, `arin@example.com`, `juwon@example.com`

## 최근 핵심 변경

### 결과 실행/최종 제출 평가

- `POST /api/v1/student/problems/{problem_id}/run-preview`
  - 기존 휴리스틱 점수 제거.
  - 실제 모델 응답 생성 후 문제 `rubric_json` 기준 LLM 루브릭 1회 평가.
  - 응답 호환을 위해 `scores.accuracy`, `scores.format`, `scores.consistency`는 모두 LLM 루브릭 점수로 채움.
  - `test_results`는 실제 테스트 케이스가 아니라 루브릭 항목별 결과를 `TestCaseResult` 형태로 매핑한 것.
- `POST /api/v1/student/submissions`
  - 최종 제출은 같은 루브릭 기준으로 5회 평균 평가.
  - 마이크 진입 기준은 최종 점수 `80점 이상`.
- 실제 “문제별 테스트 케이스” 데이터 모델은 아직 없음.
  - `Problem`에는 `steps_json`, `rubric_json`, `core_concepts_json`, `methodology_json`, `concept_check_questions_json`만 있음.
  - `test_cases_json` 같은 컬럼은 없음.

### 마이크 개념 설명 확인

- 위치:
  - 백엔드: `apps/backend/app/api/routes/student.py`
  - 스키마: `apps/backend/app/schemas/student.py`
  - 프론트: `apps/student-web/src/pages/SubmissionResultPage.tsx`
  - 타입: `apps/student-web/src/types/index.ts`
- 현재 구조:
  - 문제별 `concept_check_questions`가 여러 개 제공됨.
  - 학생은 각 확인 질문마다 별도로 마이크를 켜서 녹음/전사해야 함.
  - 프론트는 `answers[]` 형태로 백엔드에 제출함.
  - 백엔드는 각 문항을 개별 LLM 평가하고 `question_results[]`를 반환함.
  - 모든 확인 질문이 제출되고 각 문항이 `70점 이상`일 때만 `concept_reflection_passed=true`.
- 중요:
  - 일부 문항만 제출해서 일부가 통과해도 전체 통과로 저장하지 않도록 수정됨.
  - 과거 일부 문항만 통과 처리된 데이터도 `GET /student/submissions` 응답에서는 `_is_concept_reflection_complete()`로 재검증해 최종 통과로 보지 않음.
  - 기존 단일 `transcript` 요청은 하위 호환으로 남아 있지만, 현재 UI는 `answers[]`를 사용함.
- LLM 평가 입력:
  - 기존 제출 프롬프트 `submission.prompt_text`
  - 해당 문제의 핵심 개념/확인 질문
  - 마이크 녹음 후 전사된 문항별 답변

### 결과 페이지 가드 및 토큰 절약

- 결과 페이지 진입 직후에는 `/student/submissions/{submissionId}/feedback`를 호출하지 않음.
- 마이크 개념 설명이 최종 통과된 뒤에만 `/feedback`를 호출해서 프롬이 피드백/루브릭 항목별 평가를 준비함.
- 마이크 미통과 상태에서 숨김:
  - `항목별 평가`
  - `프롬이의 피드백`
  - `학습 위험도 분석`
  - `분석 요약`
  - `위험도 보기`
- 상단 배지 구분:
  - 점수만 80점 이상: `점수 통과`
  - 점수 통과 + 모든 마이크 질문 통과: `최종 통과`
- 결과 페이지에서는 읽지 않은 알림 모달 자동 팝업을 억제함.
  - 이유: 알림 오버레이가 마이크 제출 버튼 클릭을 가로막는 문제가 있었음.

### 마이크 버튼 UX

- `모든 설명 제출하고 인정받기` 버튼은 문항 미완료 상태에서도 클릭 가능.
- 클릭 시 부족 문항 안내 표시:
  - 예: `1번 확인 질문을 마이크로 2문장 이상 설명해주세요.`
- 녹음 중이거나 평가 중일 때만 disabled.

### 시드 데이터

- `apps/backend/seed.py`
- 문제별 개념 설명 확인 질문은 현재:
  - 핵심 개념별 질문 최대 4개
  - 본인 프롬프트 반영 위치 질문 1개
  - 보통 총 5개 질문
- `--reset` 실행 시 최신 문제별 `concept_check_questions_json`이 반영됨.

## 주요 학생 프론트 파일

- `apps/student-web/src/pages/ProblemWorkPage.tsx`
  - 4패널 구조: 과제/목표, 분석/정리, 프롬프트 에디터, 실행 결과/갤러리.
  - 결과 실행은 LLM 루브릭 1회 평가.
  - 최종 제출은 백엔드 5회 평균 루브릭 평가.
  - 프롬이는 결과 실행 후 코칭.
- `apps/student-web/src/pages/SubmissionResultPage.tsx`
  - 저장 점수로 점수 통과 여부 표시.
  - 마이크 다중 문항 UI.
  - 마이크 최종 통과 뒤에만 `/feedback` 호출.
  - 최종 분석/피드백/위험도는 `recognized = scorePassed && conceptPassed`일 때만 표시.
- `apps/student-web/src/hooks/useNotifications.tsx`
  - `useNotifications(studentId, { autoOpen })` 옵션 있음.
- `apps/student-web/src/components/Layout.tsx`
  - `/submissions/:id/result` 경로에서는 알림 자동 팝업 억제.

## 주요 백엔드 파일

- `apps/backend/app/api/routes/student.py`
  - `run_preview`: LLM 루브릭 1회 평가.
  - `evaluate_concept_reflection`: `answers[]` 다중 문항 평가.
  - `_is_concept_reflection_complete`: 저장된 마이크 결과가 모든 문항을 통과했는지 재검증.
  - `list_submissions`: `concept_reflection_passed`를 재검증 결과로 반환.
- `apps/backend/app/services/evaluation_service.py`
  - `evaluate_prompt(problem_id, student_prompt, submission_id="run-preview")`
  - `evaluate_submission_average(submission_id, student_final_prompt, runs=5)`
- `apps/backend/app/models/problem.py`
  - `rubric_json`
  - `core_concepts_json`
  - `methodology_json`
  - `concept_check_questions_json`
- `apps/backend/app/models/submission.py`
  - `concept_reflection_text`
  - `concept_reflection_score`
  - `concept_reflection_passed`
  - `concept_reflection_feedback`
  - `rubric_evaluation_json`

## 금지/주의

- `hint_penalty`, `hint_used_count` 컬럼/타입 추가 금지. 힌트 시스템은 제거된 상태.
- Vite 관련 파일/환경변수 재도입 금지.
- `VITE_API_BASE_URL` 사용 금지. 런타임 `.env`의 일반 변수 사용.
- 마이크 통과 전 `/feedback` 선호출 금지. 토큰 낭비 방지.
- 마이크 통과 전 항목별 평가/프롬이 피드백/위험도 분석 노출 금지.
- 단일 마이크 전사문으로 여러 질문을 한 번에 평가하는 UI로 되돌리지 말 것.

## 검증 결과

최근 통과한 검증:

```bash
python3 -m py_compile apps/backend/app/api/routes/student.py apps/backend/app/schemas/student.py apps/backend/seed.py
npm run build  # apps/student-web
python3 harness/verification/contract_checks/check_feature_extensions.py
python3 harness/verification/contract_checks/check_ui_prompt_work.py
```

Playwright로 확인한 내용:

- 마이크 미통과 결과 화면에서 `/feedback` 호출 0회.
- 마이크 미통과 상태에서 `항목별 평가`, `프롬이의 피드백`, `학습 위험도 분석`, `분석 요약`, `위험도 보기` 숨김.
- 점수만 통과한 상태에서는 `최종 통과`가 아니라 `점수 통과` 표시.
- 일부 문항만 제출하면 API가 `passed=false`와 누락 문항 메시지 반환.
- `모든 설명 제출하고 인정받기` 버튼은 오버레이에 막히지 않고 클릭 가능.

## 하네스

- `harness/implementation/system_prompt.md`
  - 마이크 확인은 문제별 확인 질문마다 별도 녹음/전사 입력.
  - 모든 확인 질문이 각각 70점 이상일 때만 통과.
- `harness/verification/contract_checks/check_feature_extensions.py`
  - 최근 실행 기준 38/38 통과.

## 기술 부채

- 문제별 “실제 테스트 케이스” 모델은 아직 없음. 현재 결과 실행의 `test_results`는 루브릭 항목 매핑임.
- 마이크 녹음 중 전사문은 페이지 로컬 상태라 제출 전 페이지를 나가면 저장되지 않음.

## 2026-04-13 관리자 개입/모달 후속 변경

### 프롬이 리뷰 큐 → 학생 개입 → 개입 상세 연결

- 관리자 대시보드 `프롬이 코칭 품질 리뷰 큐`의 `학생 개입` 버튼은 다음 흐름으로 동작한다.
  - `POST /api/v1/admin/promi-review-queue/{log_id}/review` with `status="follow_up_student"`
  - 백엔드가 `status="pending"`인 `Intervention` 생성
  - 프론트가 `/interventions-list?detail={intervention_id}`로 이동
  - 개입 현황 페이지가 해당 개입 상세 모달을 즉시 오픈
- 관련 파일:
  - `apps/admin-web/src/pages/DashboardPage.tsx`
  - `apps/admin-web/src/pages/InterventionsListPage.tsx`
  - `apps/backend/app/api/routes/admin.py`

### 개입 상세 직접 조회

- `GET /api/v1/admin/interventions/{intervention_id}` 추가.
- 이유:
  - `/interventions-list?detail=...`로 진입했을 때 해당 개입이 현재 목록 첫 페이지/필터 결과에 없더라도 상세 모달이 반드시 열려야 함.
- `InterventionsListPage.tsx`는 `detail` query가 있으면:
  - 현재 로드된 목록에서 먼저 찾음
  - 없으면 `/admin/interventions/{detailId}`로 직접 조회
  - 조회 성공 시 `개입 상세` 모달 오픈

### 개입 발송 상태 의미

- 현재 의미:
  - `pending`: 관리자 검토/수정 대기 상태. 학생에게 아직 보이지 않음.
  - `completed`: 학생에게 알림으로 노출되는 상태.
  - `cancelled`: 취소 상태.
- `GET /api/v1/student/notifications`는 `Intervention.status == "completed"`인 개입만 반환한다.
- `PATCH /api/v1/student/notifications/{notification_id}/read`도 `completed`가 아닌 개입은 알림으로 인정하지 않는다.
- 관련 파일:
  - `apps/backend/app/api/routes/student.py`

### 개입 상세 메시지 수정/완료 처리

- `InterventionsListPage.tsx`의 `개입 상세` 모달:
  - `pending` 상태일 때만 메시지 textarea 수정 가능.
  - `completed`/`cancelled` 상태에서는 메시지가 read-only 기록 확인용으로 표시됨.
  - `완료 처리` 버튼은 `pending` 상태에서만 노출됨.
  - `완료 처리` 클릭 시 수정된 메시지를 포함해 `PATCH /api/v1/admin/interventions/{intervention_id}/status` 호출.
- 백엔드 `PATCH /api/v1/admin/interventions/{intervention_id}/status`:
  - request schema: `InterventionStatusUpdate`
  - `status`: `pending | completed | cancelled`
  - optional `message`
  - `completed` 처리 시 메시지가 비어 있으면 400 반환
  - `completed` 처리 시 `student_read_at = None`으로 unread 알림 상태가 되게 함
  - `ActivityLog(action="intervention_message_sent")` 기록
- 관련 파일:
  - `apps/backend/app/schemas/admin.py`
  - `apps/backend/app/api/routes/admin.py`

### 개입 생성 화면 연결

- `apps/admin-web/src/pages/InterventionPage.tsx`
- 개입 생성 성공 후 별도 성공 카드로 머물지 않음.
- 생성된 개입 ID로 `/interventions-list?detail={created_intervention_id}` 이동.
- 결과적으로 일반 개입 생성 화면에서도 생성 후 바로 개입 상세 모달이 열림.

### 모달 중앙 정렬

- 요구사항: “지금 사용자가 보는 화면 기준 중앙”에 떠야 함.
- 변경:
  - `apps/admin-web/src/components/ConfirmDialog.tsx`
    - `createPortal(..., document.body)` 적용.
  - `apps/admin-web/src/pages/InterventionsListPage.tsx`
    - 개입 상세 모달 `createPortal(..., document.body)` 적용.
  - `apps/admin-web/src/pages/ProblemsManagePage.tsx`
    - 문제 생성/수정 모달 `createPortal(..., document.body)` 적용.
    - 문제 삭제 확인 모달 `createPortal(..., document.body)` 적용.
  - `apps/admin-web/src/index.css`
    - `.modal-overlay`에서 desktop 사이드바 보정용 `padding-left: calc(230px + 20px)` 제거.
- 주의:
  - 이후 새 관리자 모달을 만들 때는 가능하면 `createPortal(..., document.body)`를 사용해 부모 `transform`/레이아웃 영향을 피할 것.
  - 사이드바 기준 중앙이 아니라 뷰포트 기준 중앙이 요구사항임.

### 최근 검증

통과한 명령:

```bash
python3 -m py_compile apps/backend/app/api/routes/admin.py apps/backend/app/api/routes/student.py apps/backend/app/schemas/admin.py
npm run build  # apps/admin-web
npm run build  # apps/student-web
python3 harness/verification/contract_checks/check_feature_extensions.py
python3 harness/verification/contract_checks/check_responsive_layout.py
```

Playwright로 확인한 내용:

- 대시보드 `학생 개입` 클릭 후 `/interventions-list?detail=...` 이동.
- 개입 상세 모달 자동 오픈.
- 개입 상세 모달은 현재 뷰포트 중앙에 표시.
- `pending` 개입의 메시지는 상세 모달에서 수정 가능.
- `completed` 후 학생 알림에 수정된 메시지 노출.
- 개입 생성 화면에서 생성 확인 모달이 중앙에 표시.
- 개입 생성 성공 후 개입 현황 상세 모달 자동 오픈.
- 문제 관리 `문제 생성`, `문제 수정`, `삭제 확인` 팝업 모두 현재 뷰포트 중앙에 표시.

## 2026-04-13 학생 맞춤 학습 추천 개편

### 배경

- 기존 `apps/student-web/src/pages/RecommendPage.tsx`는 `기초부터 다시 시작`, `오답 노트 작성`, `단계별 풀이 연습`처럼 추상적이고 실제 행동으로 이어지기 어려운 하드코딩 추천을 보여줬음.
- 요구사항: 학생에게 실제로 필요한 프롬프트 개념을 알려주고, 관련 유튜브 영상 링크와 바로 풀 문제 추천을 제공해야 함.

### 변경된 추천 UX

- 추천 페이지는 이제 다음 요소를 카드 단위로 보여준다.
  - `필요한 개념`
  - 왜 이 개념이 필요한지 설명
  - `유튜브 강의 검색` 링크
  - `이 개념으로 바로 풀 문제` 목록
- `전체 문제 보기` 버튼은 제거함.
  - 이유: 카드 안에 이미 해당 개념으로 바로 풀 문제 링크가 있어 중복이었음.
- 유튜브는 특정 영상 URL을 하드코딩하지 않고 개념별 YouTube 검색 링크로 연결한다.
  - 이유: 특정 영상은 삭제/품질/언어/접근성 문제가 생길 수 있어 검색 링크가 더 안전함.
  - 예: `Few-shot prompting 프롬프트 엔지니어링 예시`, `프롬프트 엔지니어링 출력 형식 JSON markdown`

### 추천 데이터 구성

- `RecommendPage.tsx`는 다음 API를 함께 불러와 추천 카드를 만든다.
  - `/student/risk`
  - `/student/weakness-report`
  - `/student/problem-queue`
- 약점 태그 기반 개념 매핑:
  - `role_missing` → `역할 프롬프팅`
  - `goal_unclear` → `목표와 성공 기준 명시`
  - `fewshot_missing` → `Few-shot 예시 설계`
  - `input_template_missing` → `입력 템플릿`
  - `format_missing` → `출력 형식 지정`
- 약점 리포트가 부족할 때는 위험 유형별 fallback 개념을 사용한다.
  - `cognitive`: 핵심 개념 분해, 자기 검증 기준
  - `motivational`: 작은 성공 단위 설계, 명확한 과제 목표
  - `strategic`: 프롬프트 구조화, 테스트 입력 검증
  - `sudden`: 문제 요구사항 재정렬
  - `dependency`: 자기 설명 기반 학습, 코칭 피드백 반영
  - `compound`: 기본 프롬프트 구성요소
  - `none`: 고급 프롬프트 패턴

### 백엔드 응답 확장

- `apps/backend/app/schemas/student.py`
  - `ProblemResponse`에 `core_concepts: list[str]`, `methodology: list[str]` 추가.
- `apps/backend/app/api/routes/student.py`
  - `/student/problems` 응답에 문제별 `core_concepts`, `methodology` 포함.
  - `/student/problem-queue` 응답에 문제별 `core_concepts`, `methodology` 포함.
  - 기존 `_problem_reflection_mapping(problem)`을 사용해 문제별 핵심 개념을 채움.

### 프론트 구현 위치

- `apps/student-web/src/pages/RecommendPage.tsx`
  - `WEAKNESS_CONCEPTS`: 약점 태그 → 학습 개념/설명/유튜브 검색어 매핑.
  - `DROPOUT_FALLBACK_CONCEPTS`: 위험 유형별 fallback 개념.
  - `buildConceptRecommendations(...)`: 위험도, 약점 리포트, 문제 큐를 조합해 추천 카드 생성.
  - 문제 추천은 `ProblemQueueItem.core_concepts`와 카드 개념을 비교해 우선 매칭하고, 부족하면 문제 큐 상위 항목을 fallback으로 채움.

### 최근 검증

통과한 명령:

```bash
python3 -m py_compile apps/backend/app/api/routes/student.py apps/backend/app/schemas/student.py
npm run build  # apps/student-web
python3 harness/verification/contract_checks/check_responsive_layout.py
```

API/Playwright 확인:

- `/student/problem-queue` 응답에 `core_concepts` 포함 확인.
- 추천 페이지에서 `필요한 개념`, `유튜브 강의 검색`, `이 개념으로 바로 풀 문제` 렌더링 확인.
- 추천 문제 링크가 `/problems/{problem_id}/work`로 연결되는 것 확인.
- `전체 문제 보기` 버튼 제거 후 `apps/student-web` 빌드 통과.
