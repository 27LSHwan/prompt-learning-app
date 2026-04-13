# Frontend Contracts — 프론트엔드 계약 명세 (v2)

## 1. 공통 기술 스택

| 항목 | 선택 |
|------|------|
| 프레임워크 | React 18 + TypeScript (strict) |
| 번들러 | esbuild 기반 커스텀 스크립트 |
| 라우팅 | react-router-dom v6 |
| HTTP | Axios (인스턴스 생성, interceptor 적용) |
| 스타일 | CSS 변수 + 인라인 스타일 (외부 UI 라이브러리 사용 안 함) |
| 아이콘 | 유니코드 이모지 (외부 아이콘 라이브러리 금지) |

### 공통 환경 설정
- API baseURL: `http://localhost:8000/api/v1` 또는 `public/.env`의 `API_BASE_URL` 기반 런타임 로드
- 인증: `localStorage`에 `access_token`, `user_id`, `role` 저장
- 401 응답 시: localStorage 초기화 → `/login` 리다이렉트

---

## 2. 디자인 시스템

### 2-1. CSS 변수 (index.css에 `:root` 정의 필수)

#### student-web
```css
:root {
  --primary:       #4f46e5;
  --primary-light: #818cf8;
  --primary-pale:  #eef2ff;
  --success:       #10b981;
  --warning:       #f59e0b;
  --danger:        #ef4444;
  --text:          #1e1b4b;
  --text-sub:      #6b7280;
  --bg:            #f5f7ff;
  --card:          #ffffff;
  --border:        #e5e7eb;
  --radius:        14px;
  --shadow:        0 2px 16px rgba(79,70,229,0.09);
  --shadow-hover:  0 6px 28px rgba(79,70,229,0.16);
}
```

#### admin-web
```css
:root {
  --sidebar-bg:     #0f172a;
  --sidebar-hover:  rgba(255,255,255,0.07);
  --sidebar-active: rgba(255,255,255,0.12);
  --primary:        #0ea5e9;
  --primary-light:  #38bdf8;
  --primary-pale:   #e0f2fe;
  --success:        #10b981;
  --warning:        #f59e0b;
  --danger:         #ef4444;
  --text:           #0f172a;
  --text-sub:       #64748b;
  --bg:             #f1f5f9;
  --card:           #ffffff;
  --border:         #e2e8f0;
  --radius:         12px;
  --shadow:         0 1px 12px rgba(15,23,42,0.08);
  --shadow-hover:   0 4px 20px rgba(15,23,42,0.14);
}
```

### 2-2. 공통 CSS 클래스 (index.css 필수 정의)
```css
@keyframes fadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
@keyframes spin   { to { transform:rotate(360deg); } }
@keyframes pulse  { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
.animate-in { animation: fadeIn 0.4s ease both; }

.card { background:var(--card); border-radius:var(--radius);
        box-shadow:var(--shadow); transition:box-shadow 0.2s; }
.card:hover { box-shadow:var(--shadow-hover); }

.btn { display:inline-flex; align-items:center; gap:8px;
       padding:11px 24px; border-radius:10px; font-weight:700;
       border:none; transition:all 0.18s; cursor:pointer; }
.btn-primary { background:var(--primary); color:#fff; box-shadow:0 4px 14px rgba(79,70,229,0.35); }
.btn-primary:hover { filter:brightness(0.92); transform:translateY(-1px); }
.btn-ghost { background:var(--primary-pale); color:var(--primary); }
.btn-ghost:hover { filter:brightness(0.95); }

.form-input { width:100%; padding:11px 16px; border:2px solid var(--border);
              border-radius:10px; font-size:15px; background:#fff; outline:none;
              transition:border-color 0.2s, box-shadow 0.2s; }
.form-input:focus { border-color:var(--primary); box-shadow:0 0 0 3px rgba(79,70,229,0.12); }
```

### 2-3. 위험도 색상 매핑 (두 앱 공통)
```typescript
const STAGE_CONFIG: Record<RiskStage, { color: string; bg: string; border: string; icon: string }> = {
  '안정':   { color: '#065f46', bg: '#d1fae5', border: '#10b981', icon: '✅' },
  '경미':   { color: '#92400e', bg: '#fef3c7', border: '#f59e0b', icon: '⚠️' },
  '주의':   { color: '#9a3412', bg: '#ffedd5', border: '#f97316', icon: '🔶' },
  '고위험': { color: '#991b1b', bg: '#fee2e2', border: '#ef4444', icon: '🚨' },
  '심각':   { color: '#ffffff', bg: '#7f1d1d', border: '#dc2626', icon: '🆘' },
};
```

---

## 3. 레이아웃 구조

### 3-1. student-web — 인디고 사이드바 (220px fixed)
- 배경: `linear-gradient(180deg, #4f46e5 0%, #3730a3 100%)`
- 활성 항목: `background: rgba(255,255,255,0.18)`, `font-weight:700`, 우측 점(●)
- 비활성 hover: `background: rgba(255,255,255,0.10)`
- Main: `marginLeft:220px`, `padding:36px 36px 60px`

```
NAV_ITEMS = [
  { to: '/dashboard', icon: '🏠', label: '홈' },
  { to: '/problems',  icon: '📝', label: '문제 풀기' },
  { to: '/history',   icon: '📋', label: '제출 이력' },
  { to: '/risk',      icon: '📊', label: '위험도' },
  { to: '/recommend', icon: '💡', label: '학습 추천' },
]
```

### 3-2. admin-web — 다크 사이드바(230px) + 스티키 헤더(56px)
- 사이드바 배경: `#0f172a`
- 활성 항목: `border-left: 3px solid #0ea5e9`, `color: #fff`
- 비활성 hover: `color: #cbd5e1`
- 헤더: `height:56px, background:#fff, border-bottom:1px solid var(--border), position:sticky`
- Main: `padding:28px 32px 60px`

```
NAV = [
  { to: '/dashboard',     icon: '📊', label: '대시보드' },
  { to: '/students',      icon: '👥', label: '학생 목록' },
  { to: '/interventions', icon: '🛠️', label: '개입 관리' },
]
```

---

## 4. 공통 컴포넌트

### Character (student-web 전용)
```typescript
// src/components/Character.tsx
// SVG 기반 올빼미 마스코트 "프롬이"
type CharacterEmotion = 'happy' | 'excited' | 'encouraging' | 'thinking' | 'concerned' | 'neutral';
// Props: emotion: CharacterEmotion, size?: number (default 120)
// 필수 CSS 애니메이션: float (위아래 부유), bounce (튀기기), blink (눈 깜빡임)
// 감정별 눈 표정·날개 동작·색상 SVG 요소로 구현 (외부 이미지 금지)
```

### CharacterMessage (student-web 전용)
```typescript
// src/components/CharacterMessage.tsx
// 말풍선 + Character 조합 컴포넌트
// Props: emotion, message, tips?, onDismiss?
// 감정별 배경 테마:
const EMOTION_THEME = {
  excited:     { bg:'#f5f3ff', border:'#7c3aed', accent:'#7c3aed' },
  happy:       { bg:'#f0fdf4', border:'#10b981', accent:'#059669' },
  encouraging: { bg:'#eff6ff', border:'#3b82f6', accent:'#2563eb' },
  thinking:    { bg:'#fffbeb', border:'#f59e0b', accent:'#d97706' },
  concerned:   { bg:'#fff1f2', border:'#f43f5e', accent:'#e11d48' },
  neutral:     { bg:'#f8fafc', border:'#94a3b8', accent:'#64748b' },
};
// 슬라이드인 애니메이션 필수 (translateY 24px → 0)
```

### NotificationModal (student-web 전용)
```typescript
// src/components/NotificationModal.tsx
// 자동 개입 알림 모달
// API: GET /student/notifications?student_id={id}
// API: PATCH /student/notifications/{id}/read
// dropout_type → emotion 매핑:
const DROPOUT_EMOTION: Record<string, CharacterEmotion> = {
  cognitive: 'thinking', motivational: 'encouraging',
  sudden: 'concerned', compound: 'concerned',
};
// 오버레이: fixed inset:0, rgba(0,0,0,0.5), zIndex:800
// 여러 알림: 한 번에 하나씩 표시, "N개 중 M번째" 표시
// 읽음 처리: 확인 버튼 클릭 시 PATCH → 다음 알림 또는 모달 닫기
```

### useNotifications (student-web 전용)
```typescript
// src/hooks/useNotifications.tsx
// 60초 폴링으로 미읽은 알림 수 확인
// 미읽은 알림 > 0 시 자동으로 showModal = true
// 반환: { count: number, showModal: boolean, setShowModal, refresh: () => void }
```

### RiskBadge
```typescript
// display: inline-flex, padding, border, borderRadius:20, fontWeight:700
// score 있으면 "{stage} {score}점" 표시
// size: sm(2px 9px/11px) | md(5px 13px/13px) | lg(8px 18px/15px)
```

### RiskGauge (student-web)
```typescript
// SVG 반원 게이지, 기본 size=160
// linearGradient + feGaussianBlur glow 효과
// 중앙: 점수(크게) + "/ 100"(작게)
// 하단: "{단계} 단계" 텍스트
// transition: stroke-dashoffset 0.7s cubic-bezier(0.4,0,0.2,1)
```

### RiskDistributionChart (admin-web)
```typescript
// 5개 단계 각각: 배지 + 가로 막대(상대 너비) + 건수 + 퍼센트
// maxCount 기준 상대 너비 계산 (total 아님)
// compact 옵션: 막대 높이 6px, 간격 축소
```

---

## 5. student-web 페이지 명세

### LoginPage
- 좌우 2분할: 왼쪽 그라데이션 브랜딩, 오른쪽 흰 폼
- 왼쪽: `linear-gradient(135deg, #4f46e5, #7c3aed, #a855f7)` + 🎓(72px) + 기능 카드 3개
- 오른쪽: width:440px, 폼 필드: **이메일**(type=email) + 비밀번호
- **로그인 요청**: `POST /api/v1/auth/login` — JSON body `{ email, password }` (form-urlencoded 절대 금지)
- **학생 role 검증 필수**: `res.data.role !== 'student'` 이면 토큰 저장 없이 오류 표시
- 로딩: 버튼 내 CSS spin 스피너

### SignupPage
- 중앙 카드, 흰 배경 (`linear-gradient(135deg, #f0f4ff, #e8eaf6)`)
- 🌱(48px) 로고, 4개 필드 (아이디/이메일/비밀번호/확인)

### DashboardPage
1. 히어로 배너: `linear-gradient(135deg, #4f46e5, #7c3aed)` + 인사 + 🚀(72px)
2. 2열 그리드: RiskGauge+RiskBadge 카드 / 구성요소 바 카드
3. 추가 카드: `개인 약점 리포트`, `다음 문제 큐`, `최근 활동`
3. 4열 퀵메뉴 카드 (hover: `borderColor`, `translateY(-3px)`, `box-shadow`)
4. 요약 바 (dropout_type + calculated_at)
5. 반응형: `desktop(≥1200)=2열+4열`, `tablet(768~1199)=1열+2열`, `mobile(<768)=1열 스택`

### ProblemsPage
- 검색인풋(paddingLeft:40, 🔍 absolute) + 난이도 필터 4버튼 + 건수
- 문제 카드: 카테고리 아이콘(52px 원형) + 제목 + 배지들 + `풀기 →` 버튼
- hover: `translateY(-2px)` + `borderColor:#818cf8`
- 반응형: `desktop=아이콘/내용/버튼 3열`, `tablet=버튼 다음 줄`, `mobile=세로 1열 + CTA 전체폭`
- 관리자 추천 문제가 있으면 `추천 문제` 태그 표시 + 추천 사유 표시 가능
- 추천 문제는 일반 문제보다 상단에 먼저 정렬

### ProblemWorkPage ★ 핵심
**4패널 반응형 실습 화면**:
```
[① 과제/목표] [③ 실행 결과]
[② 프롬프트 에디터] [④ 분석/정리]
하단 고정 액션 바: [▶ 결과 실행] [🚀 최종 제출]
```
- 반응형:
  - `desktop(≥1200)`: 2×2 카드형 4패널 + sticky 하단 액션 바
  - `tablet(768~1199)`: 2열 카드 유지, 여백 축소
  - `mobile(<768)`: 1열 스택 + 액션 바 static + 버튼 전체폭
- 패널 내부 레이블:
  - `초안 프롬프트`
  - `실행용 프롬프트`
  - `개선 포인트`
  - `제출용 답안`
  - `학습 회고`
- 자동 수집: `useRef`로 startTime/attemptCount/revisionCount 추적
- **제출 바디**: `{ problem_id, prompt_text, behavioral_data }`
- `prompt_text`는 위 5개 필드를 라벨 섹션으로 합쳐 전송
- **재도전 모드** (`?retry={submissionId}`): 이전 제출 이력 사전 로드 → 신라벨/구라벨 모두 파싱해서 채워넣기
- 실행 버튼과 제출 버튼은 4분할 패널 안이 아니라 하단 액션 바로 분리되어야 함
- 모바일에서 가로 스크롤 없이 주요 버튼이 화면 안에 보여야 함
- 추가 패널/블록:
  - `제출 전 체크리스트`
  - `프롬프트 버전 비교`
  - `프롬이 최근 로그`
- 실행 후 우측 `프롬이` 카드가 최신 코칭으로 갱신되어야 함

### SubmissionResultPage ★ 루브릭 결과 필수
- API: `POST /student/submissions/{id}/feedback` → `CharacterFeedbackResponse`
- 상단: 합격 여부 배너 (합격: 초록 그라데이션 + 🎉 / 불합격: 호박색 + 🔥)
- **원형 점수 게이지**: conic-gradient, 합격≥70 → #10b981, 불합격 → #f59e0b
- **합격 배지**: `PASS_THRESHOLD = 80` 상수 기준, 합격=초록/불합격=호박색
- **평가 기준별 바**: `criteria_scores[]` 순회, 색상 코딩 (≥70%=초록, 40~70%=주황, <40%=빨강)
- **캐릭터 피드백**: `<CharacterMessage>` — emotion, main_message, tips, growth_note, encouragement
- **재도전 버튼** (조건부): `!passed && problemId` → 호박색 버튼 → `/problems/{problemId}/work?retry={submissionId}`
- 합격 시: 재도전 버튼 대신 "🎊 훌륭해요!" 축하 메시지
- 하단: 대시보드 이동 버튼 항상 표시

```typescript
// 필수 타입
interface CriterionScore {
  criterion: string;
  score: number;
  max_score: number;
  feedback: string;
}
interface CharacterFeedback {
  submission_id: string;
  character_name: string;
  emotion: string;
  main_message: string;
  tips: string[];
  encouragement: string;
  growth_note?: string;
  score_delta?: number;
  total_score: number;        // 루브릭 총점 (0~100)
  criteria_scores: CriterionScore[];
  pass_threshold: number;     // 마이크 진입 기준선 (기본 80)
}

const PASS_THRESHOLD = 80;   // 매직 넘버 금지 — 상수로 정의
```

### RiskPage
- 단계별 알림 배너 (icon + title + desc, 단계별 bg/color)
- 2열: RiskGauge(size=200)+RiskBadge / 구성요소 바 4개 + dropout_type 칩
- 반응형: tablet/mobile 에서는 1열 스택

### HistoryPage
- API: `GET /student/submissions?student_id=`
- 리스트 아이템: 순번원형 + 문제명 + 프롬프트미리보기(ellipsis) + RiskBadge + 날짜
- 점수와 위험도 요약 텍스트를 같이 표시
- hover: `translateX(4px)` + indigoish border
- 반응형: tablet/mobile 에서는 카드 내부 정보가 세로로 재배치되고 CTA/배지는 아래 줄로 이동

### RecommendPage
- 상단: 단계별 상태 배너
- RECOMMENDATIONS 상수 객체 (7가지 타입별 카드 3개씩)
- 카드: 52px 아이콘 원형 + 제목 + 설명 + 선택적 Link 버튼
- 반응형: 배너는 세로 스택, 추천 카드는 좁아질 때 1열 카드 구성

---

## 6. admin-web 페이지 명세

### LoginPage
- 전체화면 `background:#0f172a`, 2분할
- 좌: 그라데이션 로고(🛡️) + 서비스명 + 특징 3개
- 우: 흰 폼(width:420px), 폼 필드: **이메일**(type=email) + 비밀번호, role 검증 (non-admin 오류)
- **로그인 요청**: `POST /api/v1/auth/login` — JSON body `{ email, password }` (form-urlencoded 절대 금지)
- **관리자 role 검증 필수**: `res.data.role !== 'admin'` 이면 토큰 저장 없이 오류 표시

### DashboardPage
1. KPI 3개 (3열): `borderLeft:4px solid {color}` + icon + 숫자 + 트렌드
2. 2열: RiskDistributionChart / 고위험 학생 빠른 목록
3. 추가 카드: `학습 패턴 요약`, `추천 문제 효과`, `최근 활동 로그`, `학생별 학습 패턴`
4. 반응형: desktop=3열/2열, tablet/mobile=1열 스택 + 액션 버튼 전체폭

### StudentsPage
- 툴바: 검색(paddingLeft:36) + 단계 칩 6개 + 정렬 셀렉트 + 건수
- `학습 패턴 필터` 셀렉트 추가
- `.data-table`: th uppercase+letterSpacing / td 13px / hover 행 bg
- 아바타: `username.charAt(0).toUpperCase()` 원형
- 반응형: 테이블 래퍼는 `overflow-x:auto`, 모바일에서 컨트롤은 wrap

### StudentDetailPage
- 다크 헤더 배너: `linear-gradient(90deg, #0f172a, #1e293b)`
- 2열: 구성요소 바 카드 / 이력 리스트(maxHeight:240px 스크롤)
- 개입 이력: status별 배지 색상 (pending=yellow/completed=green/cancelled=gray)
- 반응형: 헤더 배너와 제출 이력 행은 모바일에서 세로 스택
- 위험도 탭 내 `문제 추천` 카드:
  - 관리자 문제 목록에서 문제 선택
  - 추천 사유 입력 후 학생별 추천 등록
  - 기존 추천 목록 조회 및 추천 해제 가능
- 위험도 탭 추가 섹션:
  - `학습 패턴 요약`
  - `자동 개입 추천`
  - `추천 문제 효과`
- 메모 탭 하단:
  - `활동 타임라인`

### InterventionPage
- 3개 섹션 카드: 학생ID / 유형 라디오 2×2 / 메시지
- 유형 선택: 선택시 `border:2px solid {color}` + `background:{color}10`
- 성공 화면: ✅ + 요약 그리드 + 다음 액션 버튼

### InterventionsListPage
- 헤더 액션 버튼은 wrap 가능해야 함
- 목록 행은 `checkbox / 내용 / 상태 / 상태변경` 구조
- 반응형: 모바일에서 1열 스택, 선택/상태 제어가 화면 안에 모두 보여야 함

---

## 7. 타입 정의

### student-web `src/types/index.ts`
```typescript
export type RiskStage   = '안정' | '경미' | '주의' | '고위험' | '심각';
export type DropoutType = 'cognitive' | 'motivational' | 'strategic' | 'sudden' | 'dependency' | 'compound' | 'none';
export interface LoginResponse             { access_token:string; token_type:string; user_id:string; role:string; }
export interface SignupResponse            { id:string; username:string; email:string; role:string; created_at:string; }
export interface Problem                   { id:string; title:string; description:string; difficulty:string; category:string; }
export interface ProblemListResponse       { items:Problem[]; total:number; }
export interface AutoCollected             { session_duration_sec:number; attempt_count:number; revision_count:number; drop_midway:boolean; }
export interface SubmissionResponse        { id:string; student_id:string; problem_id:string|null; prompt_text:string; risk_triggered:boolean; created_at:string; }
export interface SubmissionHistoryItem     { id:string; student_id:string; problem_id:string|null; problem_title:string|null; prompt_text:string; created_at:string; risk_stage?:RiskStage; total_risk?:number; }
export interface SubmissionHistoryResponse { items:SubmissionHistoryItem[]; total:number; }
export interface RiskResponse              { student_id:string; total_risk:number; risk_stage:RiskStage; dropout_type:DropoutType; base_risk:number; event_bonus:number; thinking_risk:number; calculated_at:string; }
export interface CriterionScoreResponse   { criterion:string; score:number; max_score:number; feedback:string; }
export interface CharacterFeedbackResponse {
  submission_id:string; character_name:string; emotion:string;
  main_message:string; tips:string[]; encouragement:string;
  growth_note?:string; score_delta?:number;
  total_score:number;                       // 루브릭 총점 (0~100)
  criteria_scores:CriterionScoreResponse[]; // 기준별 점수 배열
  pass_threshold:number;                    // 마이크 진입 기준선 (기본 80)
}
export interface NotificationItem         { id:string; message:string; dropout_type:string; created_at:string; student_read_at:string|null; }
export interface NotificationListResponse { items:NotificationItem[]; unread_count:number; }
```

### admin-web `src/types/index.ts`
```typescript
export type RiskStage          = '안정' | '경미' | '주의' | '고위험' | '심각';
export type DropoutType        = 'cognitive'|'motivational'|'strategic'|'sudden'|'dependency'|'compound'|'none';
export type InterventionType   = 'message' | 'meeting' | 'resource' | 'alert';
export type InterventionStatus = 'pending' | 'completed' | 'cancelled';
export interface LoginResponse             { access_token:string; token_type:string; user_id:string; role:string; }
export interface RiskDistribution          { stage:RiskStage; count:number; }
export interface DashboardResponse         { total_students:number; high_risk_count:number; pending_interventions:number; risk_distribution:RiskDistribution[]; recent_high_risk:StudentSummary[]; }
export interface StudentSummary            { student_id:string; username:string; email:string; total_risk:number; risk_stage:RiskStage; dropout_type:DropoutType; calculated_at:string; }
export interface StudentListResponse       { items:StudentSummary[]; total:number; }
export interface RiskScore                 { id:string; total_risk:number; base_risk:number; event_bonus:number; thinking_risk:number; risk_stage:RiskStage; dropout_type:DropoutType; calculated_at:string; }
export interface StudentDetail             { student_id:string; username:string; email:string; latest_risk:RiskScore|null; risk_history:RiskScore[]; interventions:Intervention[]; }
export interface Intervention              { id:string; student_id:string; type:InterventionType; message:string; dropout_type:DropoutType; status:InterventionStatus; created_at:string; updated_at:string; }
export interface InterventionCreateRequest { student_id:string; type:InterventionType; message:string; }
export interface InterventionResponse      { id:string; student_id:string; type:InterventionType; message:string; dropout_type:DropoutType; status:InterventionStatus; created_at:string; }
```

---

## 8. UX 원칙

### 8-1. 학생 화면 — 친근하고 명확한 UX

| 원칙 | 구현 방법 |
|------|----------|
| 버튼 가시성 | `.btn-primary`, 충분한 padding, 그림자 |
| 진행 인식 | 스텝 탭 + 진행률 바 + 색상 구분 |
| 즉각 피드백 | 스피너, 오류 박스, 성공 배너 |
| 친근한 톤 | 이모지 적극 사용, 인사 문구, 격려 메시지 |
| 빈 상태 | 이모지 + 안내 문구 + CTA 버튼 항상 |
| 호버 효과 | `translateY(-2~3px)` + border 강조 |
| 페이지 진입 | 최상위 div `className="animate-in"` |

### 8-1-1. 캐릭터 마스코트 UX 원칙

| 원칙 | 구현 방법 |
|------|----------|
| 감정 표현 일관성 | 6가지 emotion 상태(happy/excited/encouraging/thinking/concerned/neutral)만 사용 |
| 피드백 전달 | 점수 결과·개입 메시지 모두 CharacterMessage 컴포넌트 통해 표시 |
| 비차단 알림 | NotificationModal 자동 표시, 사용자가 확인 후 닫을 수 있음 |
| 재도전 유도 | 불합격 시 피드백 → 어떤 기준이 부족한지 구체적으로 표시 → 재도전 버튼 노출 |
| 성장 추적 | growth_note(이번 vs 이전 비교), score_delta 표시로 학습 진전 확인 가능 |

### 8-2. 관리자 화면 — 데이터 중심 UX

| 원칙 | 구현 방법 |
|------|----------|
| 현황 우선 | KPI → 차트 → 상세 목록 |
| 정보 밀도 | 컴팩트 테이블 (font-size:13px) |
| 빠른 탐색 | 검색 + 필터 + 정렬 상시 노출 |
| 상태 시각화 | 배지 + 미니 바 + 색상 코딩 |

### 8-3. 재사용 패턴

```typescript
// 로딩 스피너
<div style={{ width:36, height:36, borderRadius:'50%',
  border:'3px solid #bae6fd', borderTopColor:'var(--primary)',
  animation:'spin 0.8s linear infinite' }} />

// 스켈레톤 (student)
<div style={{ height:80, borderRadius:14, background:'#e8eaf6',
  animation:'pulse 1.5s infinite' }} />

// 오류 박스
<div style={{ background:'#fee2e2', color:'#991b1b',
  padding:'10px 14px', borderRadius:8, fontSize:13, fontWeight:600 }}>
  ❌ {error}
</div>

// 빈 상태
<div style={{ textAlign:'center', padding:'60px 0', color:'var(--text-sub)' }}>
  <div style={{ fontSize:48, marginBottom:16 }}>📭</div>
  <p>안내 문구</p>
  <Link to="..." className="btn btn-primary">CTA</Link>
</div>
```

---

## 9. 웹 애플리케이션 완성도 요구사항

### 9.1 필수 파일 트리 (두 앱 공통)

```
src/
├── hooks/
│   ├── useDebounce.ts      ← 검색 디바운스 (300ms)
│   └── useToast.ts         ← Context 기반 toast 상태 관리
├── components/
│   ├── ErrorBoundary.tsx   ← React Class 에러 경계
│   ├── Toast.tsx           ← 고정 위치 toast UI (bottom-right)
│   ├── EmptyState.tsx      ← 빈 목록 공통 컴포넌트
│   ├── ConfirmDialog.tsx   ← 모달 확인 다이얼로그
│   └── Pagination.tsx      ← 페이지네이션 (최대 5개 번호)
└── .env.example            ← 환경변수 템플릿
```

### 9.2 App.tsx 필수 래핑 구조

```tsx
<ErrorBoundary>          // 전체 앱 에러 포착
  <ToastProvider>        // toast 상태 공유
    <BrowserRouter>
      <Routes>...</Routes>
    </BrowserRouter>
    <Toast />            // BrowserRouter 밖에 위치 (라우팅 영향 없음)
  </ToastProvider>
</ErrorBoundary>
```

### 9.3 반응형 브레이크포인트

| 구간 | 처리 |
|------|------|
| ≥ 1200px | 데스크톱 레이아웃. 2~4열 카드 허용, 사이드바 고정 |
| 768px ~ 1199px | 태블릿 레이아웃. 2열 이하로 축소, 액션 버튼 wrap |
| ≤ 767px | 모바일 레이아웃. 사이드바 숨김 + 상단 56px 헤더 + 햄버거(☰) 버튼 + 주요 버튼 전체폭 |

모바일 사이드바 오버레이:
- position: fixed, inset: 0, background: rgba(0,0,0,0.4), zIndex: 100
- 사이드바: zIndex: 101, 클릭 외부 영역 시 닫힘

반응형 공통 원칙:
- 가로 스크롤 없이 주요 CTA가 1 screen 내에 보여야 함
- 좁은 화면에서는 "축소"가 아니라 "재배치"를 사용
- 목록/대시보드 카드에서 우측 액션 버튼은 모바일에서 하단 전체폭 버튼으로 이동 가능

### 9.4 접근성 최소 요구사항

| 항목 | 구현 방법 |
|------|-----------|
| 장식 이모지 | `<span aria-hidden="true">🎓</span>` |
| 의미 있는 아이콘 버튼 | `<button aria-label="설명">` |
| 동적 콘텐츠 | `<div aria-live="polite">` |
| 포커스 표시 | `:focus-visible { outline: 2px solid var(--primary); }` |
| 스크린리더 전용 | `.sr-only` 클래스 |
| 폼 에러 | `aria-invalid="true"` + `aria-describedby="{id}-error"` |
| 정렬 가능 테이블 | `aria-sort="ascending|descending|none"` |

### 9.5 admin-web 전용 기능

| 기능 | 위치 | 구현 |
|------|------|------|
| CSV 내보내기 | StudentsPage 헤더 | Blob + URL.createObjectURL, BOM 포함 |
| 자동 폴링 | DashboardPage | setInterval 30s + cleanup |
| 제출 확인 | InterventionPage | ConfirmDialog → API 호출 순서 |
| 에러/성공 피드백 | 모든 폼 | useToast().showToast() |

### 9.6 JWT Refresh Token 흐름

```
401 응답 → refresh_token으로 POST /auth/refresh
         → 성공: 새 token 저장 + 원본 요청 재시도
         → 실패: clearAuth() + /login 리다이렉트
```

localStorage 키 규칙:
- student-web: `token`, `student_id`, `role`, `refresh_token`
- admin-web: `admin_token`, `admin_user_id`, `admin_role`, `refresh_token`
