# Step 06 — apps/student-web (학생용 React 프론트엔드)

## 개요

학생이 문제를 풀고, 자신의 학습 위험도를 확인하며, 추천 학습법을 제공받는 SPA.

- **디자인 컨셉**: 친숙하고 따뜻한 인디고 그라데이션 기반 UI. 버튼과 CTA는 크고 명확하게 배치.
- **포트**: 5173 (커스텀 dev server)
- **API 베이스**: `public/.env`의 `API_BASE_URL` → 기본값 `http://localhost:8000`

---

## 파일 생성 순서

```
01  package.json
02  tsconfig.json
03  index.html
04  src/main.tsx
06  src/index.css              ← CSS 변수 + 공통 클래스 전체 정의
07  src/types/index.ts
08  src/lib/api.ts
09  src/lib/auth.ts
10  src/components/Layout.tsx
11  src/components/RiskBadge.tsx
12  src/components/RiskGauge.tsx
13  src/components/Character.tsx       ← ★ 올빼미 마스코트 SVG (6가지 emotion)
14  src/components/CharacterMessage.tsx ← ★ 말풍선 + 캐릭터 조합
15  src/components/NotificationModal.tsx ← ★ 자동 개입 알림 모달
16  src/hooks/useNotifications.tsx     ← ★ 60초 폴링 + 자동 모달 트리거
17  src/pages/LoginPage.tsx
18  src/pages/SignupPage.tsx
19  src/pages/DashboardPage.tsx
20  src/pages/ProblemsPage.tsx
21  src/pages/ProblemWorkPage.tsx      ← ★ retry 모드 포함
22  src/pages/SubmissionResultPage.tsx ← ★ 루브릭 시각화 + 재도전 버튼
23  src/pages/RiskPage.tsx
24  src/pages/HistoryPage.tsx
25  src/pages/RecommendPage.tsx
26  src/App.tsx
```

---

## 01. package.json

```json
{
  "name": "student-web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "node ../../scripts/react-app.mjs dev --port 5173",
    "build": "tsc && node ../../scripts/react-app.mjs build",
    "preview": "node ../../scripts/react-app.mjs preview --port 4173"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "esbuild": "^0.21.5",
    "typescript": "^5.3.0"
  }
}
```

---

## 06. src/index.css — 핵심 CSS 변수 및 공통 클래스

```css
/* ── 색상 변수 ── */
:root {
  --primary: #4f46e5;
  --primary-dark: #3730a3;
  --primary-pale: #eef2ff;
  --primary-mid: #818cf8;
  --text: #1e293b;
  --text-sub: #64748b;
  --bg: #f8fafc;
  --card-bg: #ffffff;
  --border: #e2e8f0;
  --shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.10);
  --radius: 12px;
}

/* ── 기본 리셋 ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Pretendard', 'Apple SD Gothic Neo', sans-serif;
       background: var(--bg); color: var(--text); -webkit-font-smoothing: antialiased; }
a { text-decoration: none; color: inherit; }

/* ── 애니메이션 ── */
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes spin   { to { transform: rotate(360deg); } }
@keyframes pulse  { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

/* ── 공통 클래스 ── */
.animate-in  { animation: fadeIn 0.3s ease both; }
.card        { background: var(--card-bg); border-radius: var(--radius);
               border: 1px solid var(--border); box-shadow: var(--shadow); }
.btn         { display: inline-flex; align-items: center; justify-content: center;
               gap: 6px; border: none; border-radius: 8px; font-weight: 700;
               font-size: 14px; cursor: pointer; transition: all 0.15s; }
.btn-primary { background: var(--primary); color: #fff; }
.btn-primary:hover { background: var(--primary-dark); transform: translateY(-1px); }
.btn-ghost   { background: transparent; color: var(--text-sub);
               border: 1.5px solid var(--border); }
.btn-ghost:hover { border-color: var(--primary); color: var(--primary); }
.form-input  { width: 100%; padding: 10px 14px; border: 1.5px solid var(--border);
               border-radius: 8px; font-size: 14px; outline: none; transition: border 0.15s; }
.form-input:focus { border-color: var(--primary); }

/* ── 스크롤바 ── */
::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #f1f5f9; }
::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
```

---

## 07. src/types/index.ts — 주요 타입

```ts
export type RiskStage = '안정' | '경미' | '주의' | '고위험' | '심각';
export type DropoutType = '이탈_비참여형' | '이탈_지식격차형' | '이탈_번아웃형' |
  '이탈_메타인지부족형' | '이탈_사고력저하형' | '이탈_내용연결성약형' | '정상';

export interface LoginResponse  { access_token: string; token_type: string; student_id: string; }
export interface SignupResponse { student_id: string; username: string; email: string; }
export interface ProblemSummary { problem_id: string; title: string; subject: string;
  difficulty: string; description: string; }
export interface ProblemListResponse { items: ProblemSummary[]; total: number; }
export interface ProblemDetail extends ProblemSummary { steps: string[]; }
export interface SubmitRequest { student_id: string; problem_id: string;
  responses: string[]; time_taken: number; attempt_count: number; revision_count: number; }
export interface SubmitResponse { submission_id: string; }
export interface SubmissionResult {
  submission_id: string; student_id: string; problem_id: string;
  total_risk: number; base_risk: number; event_bonus: number; thinking_risk: number;
  risk_stage: RiskStage; dropout_type: DropoutType; calculated_at: string; }
export interface RiskStatusResponse {
  student_id: string; latest_risk: SubmissionResult | null; }
export interface SubmissionHistoryItem {
  submission_id: string; problem_id: string; problem_title: string;
  total_risk: number; risk_stage: RiskStage; dropout_type: DropoutType;
  created_at: string; responses: string[]; }
export interface SubmissionHistoryResponse { items: SubmissionHistoryItem[]; }
```

---

## 08-09. lib/api.ts + lib/auth.ts

### api.ts
```ts
import axios from 'axios';
import { getToken } from './auth';

const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use(cfg => {
  const token = getToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});
api.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('student_id');
    window.location.href = '/login';
  }
  return Promise.reject(err);
});
export default api;
```

### auth.ts
```ts
// localStorage 키: 'token', 'student_id', 'role'
export const getToken      = ()  => localStorage.getItem('token');
export const getStudentId  = ()  => localStorage.getItem('student_id') ?? '';
export const getRole       = ()  => localStorage.getItem('role');
export const isLoggedIn    = ()  => !!getToken();
export const setAuth = (token: string, studentId: string, role = 'student') => {
  localStorage.setItem('token', token);
  localStorage.setItem('student_id', studentId);
  localStorage.setItem('role', role);
};
export const clearAuth = () => {
  ['token','student_id','role'].forEach(k => localStorage.removeItem(k));
};
```

---

## 10. src/components/Layout.tsx — 사이드바 레이아웃

### 핵심 구조
```
┌─────────────────────────────────────────┐
│ SIDEBAR(220px fixed) │ CONTENT(flex:1)  │
│  linear-gradient     │  overflow-y:auto │
│  #4f46e5→#3730a3    │  padding:28px    │
│                      │                  │
│  🎓 학습 도우미       │  <Outlet/>       │
│  ─────────────────   │                  │
│  🏠 홈               │                  │
│  📝 문제풀기          │                  │
│  📋 제출이력          │                  │
│  📊 위험도            │                  │
│  💡 학습추천          │                  │
│  ─────────────────   │                  │
│  👤 사용자이름         │                  │
│  🚪 로그아웃          │                  │
└─────────────────────────────────────────┘
```

### 핵심 코드 패턴
```tsx
const NAV_ITEMS = [
  { path: '/dashboard', icon: '🏠', label: '홈' },
  { path: '/problems',  icon: '📝', label: '문제풀기' },
  { path: '/history',   icon: '📋', label: '제출이력' },
  { path: '/risk',      icon: '📊', label: '위험도' },
  { path: '/recommend', icon: '💡', label: '학습추천' },
];

// 활성 항목 스타일
const activeStyle = {
  background: 'rgba(255,255,255,0.18)',
  color: '#fff',
  position: 'relative',  // 오른쪽 점 표시기를 위해
};

// 비활성 hover: onMouseEnter/Leave로 background: 'rgba(255,255,255,0.08)' 토글
```

---

## 11. src/components/RiskBadge.tsx

```tsx
const STAGE_CONFIG = {
  '안정':   { color: '#065f46', bg: '#d1fae5', border: '#10b981', icon: '✅' },
  '경미':   { color: '#92400e', bg: '#fef3c7', border: '#f59e0b', icon: '⚠️' },
  '주의':   { color: '#9a3412', bg: '#ffedd5', border: '#f97316', icon: '🔶' },
  '고위험': { color: '#991b1b', bg: '#fee2e2', border: '#ef4444', icon: '🚨' },
  '심각':   { color: '#fff',    bg: '#7f1d1d', border: '#dc2626', icon: '🆘' },
};

// Props: stage, score(optional), size('sm'|'md'|'lg')
// score 있으면 "{score}점" 표시
```

---

## 12. src/components/RiskGauge.tsx — SVG 반원 게이지

```tsx
// 핵심 SVG 구조
<svg viewBox="0 0 200 120" width={size} height={size * 0.65}>
  <defs>
    <linearGradient id="riskGrad">  {/* 녹색→노란→빨강 3-stop */}
    <filter id="glow">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>
  {/* 배경 반원 */}
  <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#e2e8f0" strokeWidth={trackW}/>
  {/* 값 반원: strokeDashoffset으로 애니메이션 */}
  <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none"
    stroke="url(#riskGrad)" strokeWidth={w} strokeLinecap="round"
    filter="url(#glow)"
    style={{ strokeDasharray: circumference, strokeDashoffset: offset,
             transition: 'stroke-dashoffset 0.7s cubic-bezier(0.4,0,0.2,1)' }}/>
  {/* 중앙 원 */}
  <circle cx="100" cy="100" r={size===200?28:20} fill="#fff"
    style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.12))' }}/>
  {/* 점수 텍스트 */}
  <text x="100" y="105" textAnchor="middle" fontSize={size===200?22:16} fontWeight="800">
    {score}
  </text>
</svg>
// 하단: "{단계} 단계" 레이블
```

---

## 13. src/components/Character.tsx — 올빼미 마스코트 "프롬이"

```tsx
// SVG 기반, 외부 이미지 파일 금지
// Props: emotion: CharacterEmotion, size?: number

type CharacterEmotion = 'happy' | 'excited' | 'encouraging' | 'thinking' | 'concerned' | 'neutral';

// 필수 index.css 애니메이션 키프레임 추가:
// @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
// @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
// @keyframes blink { 0%,90%,100%{transform:scaleY(1)} 95%{transform:scaleY(0.1)} }

// 감정별 눈 표정 변화:
// happy/excited: 초승달 눈(scaleY), 볼 홍조
// thinking: 한쪽 눈 찡그림
// concerned: 눈썹 내려감
// encouraging/neutral: 기본 원형 눈

// 졸업모자, 날개 팔, 부리, 발 SVG 요소 필수
```

## 14. src/components/CharacterMessage.tsx — 말풍선 컴포넌트

```tsx
// Props: emotion, message, tips?, growth_note?, encouragement?, onDismiss?

const EMOTION_THEME: Record<CharacterEmotion, { bg: string; border: string; accent: string }> = {
  excited:     { bg: '#f5f3ff', border: '#7c3aed', accent: '#7c3aed' },
  happy:       { bg: '#f0fdf4', border: '#10b981', accent: '#059669' },
  encouraging: { bg: '#eff6ff', border: '#3b82f6', accent: '#2563eb' },
  thinking:    { bg: '#fffbeb', border: '#f59e0b', accent: '#d97706' },
  concerned:   { bg: '#fff1f2', border: '#f43f5e', accent: '#e11d48' },
  neutral:     { bg: '#f8fafc', border: '#94a3b8', accent: '#64748b' },
};

// 레이아웃: Character(왼쪽) + 말풍선(오른쪽)
// 말풍선 꼬리: ::before 삼각형 또는 SVG path
// 슬라이드인 애니메이션: @keyframes slideIn { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:none} }
// Tips 존재 시: "💡 팁" 섹션으로 목록 표시
// growth_note 존재 시: "📈 성장 기록" 섹션으로 표시
// onDismiss prop: 우상단 × 버튼으로 닫기
```

## 15. src/components/NotificationModal.tsx — 개입 알림 모달

```tsx
// Props: studentId, onClose

// 마운트 시 GET /student/notifications?student_id={id} 호출
// unread_count > 0인 항목만 표시 (student_read_at === null)
// 여러 알림: currentIndex 상태로 하나씩 표시
//   → 헤더: "📬 새 알림 {currentIndex+1} / {total}"

// dropout_type → emotion 매핑
const DROPOUT_EMOTION: Record<string, CharacterEmotion> = {
  cognitive:     'thinking',
  motivational:  'encouraging',
  sudden:        'concerned',
  compound:      'concerned',
};
// 없는 타입: 'happy' 기본값

// 확인 버튼 클릭:
//   PATCH /student/notifications/{id}/read → 다음 알림 또는 모달 닫기

// 오버레이: position fixed, inset:0, background: rgba(0,0,0,0.5), zIndex:800
// 다이얼로그: maxWidth:480px, borderRadius:20px, padding:32px
```

## 16. src/hooks/useNotifications.tsx

```tsx
export function useNotifications(studentId: string) {
  const [count, setCount] = useState(0);
  const [showModal, setShowModal] = useState(false);

  const refresh = async () => {
    const res = await api.get(`/student/notifications?student_id=${studentId}`);
    const unread = res.data.unread_count ?? 0;
    setCount(unread);
    if (unread > 0) setShowModal(true);
  };

  useEffect(() => {
    if (!studentId) return;
    refresh();
    const timer = setInterval(refresh, 60_000);
    return () => clearInterval(timer);
  }, [studentId]);

  return { count, showModal, setShowModal, refresh };
}
```

## Layout.tsx — 알림 벨 버튼 추가

```tsx
// useNotifications(studentId) 훅 연결
const { count, showModal, setShowModal, refresh } = useNotifications(studentId);

// 사이드바 상단(또는 헤더)에 🔔 벨 버튼:
<button onClick={() => setShowModal(true)} style={{ position:'relative', ... }}>
  <span aria-hidden="true">🔔</span>
  {count > 0 && (
    <span style={{
      position:'absolute', top:-4, right:-4,
      background:'#ef4444', color:'#fff',
      borderRadius:'50%', width:18, height:18,
      fontSize:10, fontWeight:700,
      display:'flex', alignItems:'center', justifyContent:'center',
    }}>
      {count > 9 ? '9+' : count}
    </span>
  )}
</button>

// NotificationModal 렌더링
{showModal && (
  <NotificationModal studentId={studentId} onClose={() => { setShowModal(false); refresh(); }} />
)}
```

---

## 17. src/pages/LoginPage.tsx — 2-패널 로그인

```
┌──────────────────────────────────────────────────────┐
│  LEFT PANEL (flex:1)         │  RIGHT PANEL (440px)  │
│  gradient(135deg,            │  white, rounded        │
│  #4f46e5,#7c3aed,#a855f7)  │                        │
│                              │  🎓 로그인             │
│  🎓 (72px)                  │                        │
│  학습 도우미                  │  [이메일 입력]         │
│                              │  [비밀번호 입력]        │
│  ✅ 개인화 학습 피드백        │                        │
│  📊 실시간 위험도 분석        │  [로그인 버튼(full)]   │
│  💡 맞춤형 학습 추천          │                        │
│                              │  회원가입 링크          │
└──────────────────────────────────────────────────────┘
```
- 로그인 요청: `POST /api/v1/auth/login` JSON body `{ email, password }`
- 로딩 시: CSS spin 인디케이터 표시
- 학생 role 검증: `res.data.role !== 'student'` 이면 저장하지 않고 오류 표시
- 성공: `setAuth(token, student_id, role)` → `navigate('/dashboard')`

---

## 15. src/pages/DashboardPage.tsx

```
┌─────────────────────────────────────────────────────┐
│  Hero banner (gradient #4f46e5→#7c3aed)              │
│  👋 환영합니다, {username}! 🚀                       │
│  오늘도 함께 학습해 봐요                              │
├─────────────────────┬───────────────────────────────┤
│  RiskGauge(size=180) │  위험도 구성 막대 차트          │
│  + RiskBadge         │  base_risk / event_bonus /    │
│                      │  thinking_risk 각 바          │
├──────────┬──────────┬──────────┬────────────────────┤
│  📝 문제풀기  │  📋 제출이력  │  📊 위험도  │  💡학습추천   │
│  빠른메뉴카드  │              │            │               │
└──────────────────────────────────────────────────────┘
```
- API: `GET /student/risk?student_id={id}` → 위험도 표시
- 빠른 메뉴 hover: `borderColor`, `translateY(-3px)`, `boxShadow` 변화
- Skeleton 컴포넌트로 로딩 상태 처리

---

## 16. src/pages/ProblemsPage.tsx

- 상단: 검색 input (🔍 아이콘 absolute 배치, paddingLeft: 40)
- 난이도 필터 버튼 4개: 전체 / 🟢 쉬움 / 🟡 보통 / 🔴 어려움
- 문제 카드: 52px 원형 카테고리 아이콘 + 제목 + 난이도 배지 + "풀기 →" 버튼
- 카드 hover: `translateY(-2px)`, `borderColor: '#818cf8'`
- API: `GET /student/problems`

---

## 17. src/pages/ProblemWorkPage.tsx — 5단계 탭 인터페이스

```
┌────────────────────────────────────────────┐
│  [재도전 배너 - ?retry= 파라미터 있을 때만]  │  ← 호박색 배너
│  진행률 바 (0~100%, 100%시 green)            │
│  [단계1] [단계2] [단계3] [단계4] [단계5]     │
│   미완   완료    활성    미완   미완          │
├────────────────────────────────────────────┤
│  현재 단계 프롬프트 텍스트                    │
│                                            │
│  [textarea - resize:vertical]              │
│                                            │
│  [이전] 단계 X / Y  [다음 / 제출]           │
└────────────────────────────────────────────┘
```
- 탭 상태 색상:
  - 완료: `background: '#d1fae5'`, `color: '#065f46'`, `border: '2px solid #10b981'`
  - 활성: `background: 'var(--primary)'`, `color: '#fff'`
  - 미완: `background: '#fff'`, `border: '1.5px solid var(--border)'`
- useRef로 자동 수집: `startTime`, `attemptCount`, `revisionCount`
- **제출 바디** (`POST /student/submissions`):
  ```typescript
  const fsSummary = fewShots
    .filter(f => f.input.trim())
    .map((f, i) => `예시${i + 1}: ${f.input} -> ${f.output}`)
    .join('; ');
  const failedCases = bestRun.testResults.filter(result => !result.passed);
  const prompt_text = [
    `[초안 프롬프트]\n${systemPrompt}`,
    `[실행용 프롬프트]\n${userTemplate}${fsSummary ? ` | Few-shot: ${fsSummary}` : ''}`,
    `[실행 미리보기 최고 점수]\n실행점수 ${finalBestScore}`,
    `[현재 채택 버전]\n버전 ${bestRun.version}\n${bestRun.assembledPrompt}`,
    `[실패 케이스 요약]\n${failedCases.length ? failedCases.map(item => `${item.label}: ${item.actual}`).join('\n') : '실패 케이스 없음'}`,
    `[추천 수정 액션]\n${bestRun.improvementTips.join('\n')}`,
    `[자동 채택 응답]\n${bestRun.modelResponse}`,
  ].join('\n\n');
  const behavioral_data = {
    login_frequency: Math.min(1, attemptCount / 10),
    session_duration: Math.min(1, sessionSec / 3600),
    assignment_completion: 0.5,
    recent_performance: 0.5,
    help_seeking: 0,
  };
  await api.post('/student/submissions', { student_id, problem_id, prompt_text, behavioral_data });
  ```
- **재도전 모드** (`?retry={submissionId}`):
  - `useSearchParams()`로 `retry` 파라미터 감지
  - `GET /student/submissions?student_id=` 이력 조회 → 해당 submission 찾기
  - `prompt_text`를 레이블 섹션 `[초안 프롬프트]`, `[실행용 프롬프트]` 등으로 파싱해 에디터 필드 복원
  - 호박색 배너: "🔥 이전 답안을 불러왔어요! 부족한 부분을 개선해서 다시 도전해보세요."
  - 제출 성공 → 새 submission ID로 결과 페이지 이동
- 하단 info 배너: 자동 수집 항목 안내

---

## 18. src/pages/SubmissionResultPage.tsx ★ 루브릭 시각화 필수

```
┌──────────────────────────────────────────────────┐
│  상단 배너: 합격=초록 / 불합격=호박색 그라데이션     │
│  🎉 합격! / 🔥 아직 조금 더 노력해봐요!            │
├───────────────────┬──────────────────────────────┤
│  원형 점수 게이지  │  합격/불합격 배지               │
│  (conic-gradient) │  총점 X / 100점               │
│  합격=초록        │  PASS_THRESHOLD = 80           │
│  불합격=호박색    │                               │
├──────────────────────────────────────────────────┤
│  📊 평가 기준별 결과                               │
│  기준명 ────────────────── 점수/최대              │
│  ████████░░░░  (색상코딩: ≥70%=초록/40~70%=주황/<40%=빨강) │
│  기준별 피드백 텍스트                              │
├──────────────────────────────────────────────────┤
│  캐릭터 "프롬이" 피드백 (CharacterMessage)         │
│  main_message, tips, growth_note, encouragement  │
├──────────────────────────────────────────────────┤
│  [🔥 이전 답안으로 다시 도전] ← 불합격 + problemId  │
│  [🎊 훌륭해요!] ← 합격 시 텍스트 표시              │
│  [🏠 대시보드로] ← 항상 표시                       │
└──────────────────────────────────────────────────┘
```

구현 핵심:
```typescript
const PASS_THRESHOLD = 80;  // 상수 정의 필수

// 1. 마운트 시 피드백 API 호출
useEffect(() => {
  api.post(`/student/submissions/${submissionId}/feedback`)
    .then(res => setFeedback(res.data));
}, [submissionId]);

// 2. problem_id 확보 (히스토리에서)
useEffect(() => {
  api.get(`/student/submissions?student_id=${studentId}`)
    .then(res => {
      const item = res.data.items.find(i => i.id === submissionId);
      if (item?.problem_id) setProblemId(item.problem_id);
    });
}, [submissionId]);

// 3. 합격 판정
const passed = (feedback?.total_score ?? 0) >= PASS_THRESHOLD;

// 4. 재도전 버튼 (조건부)
{!passed && problemId && (
  <button onClick={() => navigate(`/problems/${problemId}/work?retry=${submissionId}`)}>
    🔥 이전 답안으로 다시 도전하기
  </button>
)}
```

---

## 19. src/pages/RiskPage.tsx

- 상단: 단계별 색상 alert 배너 (bg/icon/제목/설명 모두 단계에 따라 변경)
- 2열: 왼쪽 RiskGauge + RiskBadge / 오른쪽 막대 차트 + dropout_type 칩
- API: `GET /student/risk?student_id={id}`

---

## 20. src/pages/HistoryPage.tsx

- 번호 원형 배지 (32px) + 문제명 + 프롬프트 미리보기 (ellipsis)
- 항목 hover: `translateX(4px)`, `borderColor: 'var(--primary)'`
- API: `GET /student/submissions?student_id={id}`

---

## 21. src/pages/RecommendPage.tsx

```tsx
// 7가지 탈락 유형별 추천 카드 (RECOMMENDATIONS 상수 객체)
const RECOMMENDATIONS: Record<DropoutType, Array<{icon:string; title:string; desc:string}>> = {
  '이탈_비참여형':      [...3개 카드...],
  '이탈_지식격차형':    [...],
  // ... 7가지
};
```
- 상단: 현재 단계 배너 (RiskBadge 포함)
- 카드: 52px 원형 아이콘 + 제목 + 설명
- 카드 hover: `translateY(-2px)`, border 강조

---

## 22. src/App.tsx — 라우팅 구조

```tsx
<BrowserRouter>
  <Routes>
    {/* Public */}
    <Route path="/login"  element={<LoginPage/>}/>
    <Route path="/signup" element={<SignupPage/>}/>
    {/* Protected (Layout 포함) */}
    <Route path="/" element={<ProtectedRoute><Layout/></ProtectedRoute>}>
      <Route index element={<Navigate to="/dashboard"/>}/>
      <Route path="dashboard"               element={<DashboardPage/>}/>
      <Route path="problems"                element={<ProblemsPage/>}/>
      <Route path="problems/:problemId/work" element={<ProblemWorkPage/>}/>
      <Route path="submissions/:id/result"   element={<SubmissionResultPage/>}/>
      <Route path="risk"                     element={<RiskPage/>}/>
      <Route path="history"                  element={<HistoryPage/>}/>
      <Route path="recommend"               element={<RecommendPage/>}/>
    </Route>
    <Route path="*" element={<Navigate to="/dashboard"/>}/>
  </Routes>
</BrowserRouter>
```

---

## 디자인 일관성 체크리스트

- [ ] 모든 색상은 CSS 변수(`--primary`, `--text-sub` 등) 사용
- [ ] 페이지 진입 시 `className="animate-in"` 루트 div에 적용
- [ ] 로딩 상태: Skeleton 또는 CSS spin div
- [ ] 에러 상태: `background:#fef2f2, color:#991b1b` 박스
- [ ] 빈 상태: 이모지 + 안내 텍스트
- [ ] 모든 카드: `className="card"` + padding
- [ ] 모든 버튼: `className="btn btn-primary"` 또는 `"btn btn-ghost"`

---

## 추가 필수 파일 (웹 앱 완성도)

> 아래 파일들이 없으면 구현 미완성이다.

### src/hooks/useDebounce.ts
```ts
import { useState, useEffect } from 'react';
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
```

### src/hooks/useToast.ts
Context 기반 toast 상태 관리. `ToastProvider`, `useToast` export.
`useToast()`는 `{ showToast(message, type?), removeToast(id) }` 반환.

### src/components/Toast.tsx
- position: fixed, bottom:24px, right:24px, zIndex:1000
- 4가지 타입 색상 + 자동 소멸 3500ms
- 외부 라이브러리 금지

### src/components/ErrorBoundary.tsx
- React Class 컴포넌트
- Fallback: 💥 + 에러 메시지 + 새로고침 버튼

### src/components/EmptyState.tsx
- props: icon, title, description, action?
- 모든 빈 목록 상태에 통일 사용

### src/components/ConfirmDialog.tsx
- 오버레이 모달, variant: 'default' | 'danger'
- 민감 액션 전 반드시 사용

### src/components/Pagination.tsx
- 1-indexed, max 5 visible, ellipsis
- 히스토리 페이지: pageSize=10

### .env.example
```
`public/.env` 에 `API_BASE_URL=http://localhost:8000` 선언 후 `src/lib/runtime-env.ts` 에서 런타임 로드
```

---

## App.tsx 래핑 구조

```tsx
<ErrorBoundary>
  <ToastProvider>
    <BrowserRouter>
      <Routes>...</Routes>
    </BrowserRouter>
    <Toast />
  </ToastProvider>
</ErrorBoundary>
```

---

## src/lib/api.ts — refresh token 인터셉터 (필수)

```ts
api.interceptors.response.use(res => res, async err => {
  const original = err.config;
  if (err.response?.status === 401 && !original._retry) {
    original._retry = true;
    try {
      const rt = localStorage.getItem('refresh_token');
      const { data } = await axios.post('/api/auth/refresh', { refresh_token: rt });
      localStorage.setItem('token', data.access_token);
      original.headers.Authorization = `Bearer ${data.access_token}`;
      return api(original);
    } catch { clearAuth(); window.location.href = '/login'; }
  }
  return Promise.reject(err);
});
```

---

## 완성도 체크리스트 (student-web)

### 기본 완성도
- [ ] src/hooks/useDebounce.ts 존재
- [ ] src/hooks/useToast.ts 존재
- [ ] src/components/Toast.tsx 존재
- [ ] src/components/ErrorBoundary.tsx 존재
- [ ] src/components/EmptyState.tsx 존재
- [ ] src/components/ConfirmDialog.tsx 존재
- [ ] src/components/Pagination.tsx 존재
- [ ] .env.example 존재
- [ ] App.tsx: ErrorBoundary + ToastProvider 래핑
- [ ] api.ts: refresh token 인터셉터
- [ ] auth.ts: refresh_token 키 포함
- [ ] Layout.tsx: 모바일 햄버거 메뉴 (≤ 768px)
- [ ] LoginPage/SignupPage: 클라이언트 유효성 검사
- [ ] ProblemsPage: useDebounce 적용
- [ ] HistoryPage: Pagination 컴포넌트 적용
- [ ] 모든 장식용 이모지: aria-hidden="true"
- [ ] index.css: :focus-visible, .sr-only, @media(max-width:768px), shimmer, prefers-reduced-motion

### 캐릭터 마스코트 시스템
- [ ] src/components/Character.tsx: SVG 올빼미 6가지 emotion 상태 구현
- [ ] src/components/CharacterMessage.tsx: 말풍선 + 캐릭터 + 감정별 색상 테마
- [ ] src/components/NotificationModal.tsx: 개입 알림 모달 (오버레이 + 읽음 처리)
- [ ] src/hooks/useNotifications.tsx: 60초 폴링 + 자동 모달 트리거
- [ ] Layout.tsx: 🔔 벨 버튼 + 빨간 배지 (count, "9+" 캡)
- [ ] index.css: @keyframes float, bounce, blink, slideIn 추가

### 루브릭 결과 + 재도전 시스템
- [ ] SubmissionResultPage: `PASS_THRESHOLD = 80` 상수 정의
- [ ] SubmissionResultPage: conic-gradient 원형 점수 게이지
- [ ] SubmissionResultPage: 합격(초록)/불합격(호박색) 배지
- [ ] SubmissionResultPage: criteria_scores[] → 색상 코딩 바 렌더링
- [ ] SubmissionResultPage: 기준별 피드백 텍스트 표시
- [ ] SubmissionResultPage: CharacterMessage 컴포넌트로 피드백 표시
- [ ] SubmissionResultPage: 불합격 + problemId 존재 시 재도전 버튼
- [ ] SubmissionResultPage: 합격 시 축하 메시지 (버튼 대신)
- [ ] ProblemWorkPage: `?retry=` 파라미터 감지 → 이전 답안 사전 로드
- [ ] ProblemWorkPage: 재도전 시 호박색 배너 표시
- [ ] ProblemWorkPage: 제출 바디 `{ prompt_text, behavioral_data }` 형식 준수
