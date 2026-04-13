# Step 07 — apps/admin-web (관리자용 React 프론트엔드)

## 개요

관리자가 전체 학생의 학습 위험도를 모니터링하고, 개입을 생성하는 대시보드 SPA.

- **디자인 컨셉**: 데이터 중심의 다크 사이드바 + 화이트 콘텐츠 영역. 위험도 현황이 한눈에 파악되도록 KPI 강조.
- **포트**: 5174 (커스텀 dev server)
- **API 베이스**: `public/.env`의 `API_BASE_URL` → 기본값 `http://localhost:8000`

---

## 파일 생성 순서

```
01  package.json
02  tsconfig.json
03  index.html
04  src/main.tsx
06  src/index.css              ← 관리자 전용 CSS 변수 + 공통 클래스
07  src/types/index.ts
08  src/lib/api.ts
09  src/lib/auth.ts
10  src/components/Layout.tsx
11  src/components/RiskDistributionChart.tsx
12  src/pages/LoginPage.tsx
13  src/pages/DashboardPage.tsx
14  src/pages/StudentsPage.tsx
15  src/pages/StudentDetailPage.tsx
16  src/pages/InterventionPage.tsx
17  src/App.tsx
```

---

## 01. package.json

```json
{
  "name": "admin-web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "node ../../scripts/react-app.mjs dev --port 5174",
    "build": "tsc && node ../../scripts/react-app.mjs build",
    "preview": "node ../../scripts/react-app.mjs preview --port 4174"
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

## 06. src/index.css — 관리자 CSS 변수 및 공통 클래스

```css
/* ── 관리자 색상 변수 ── */
:root {
  --sidebar-bg: #0f172a;
  --sidebar-hover: #1e293b;
  --primary: #0ea5e9;
  --primary-pale: #f0f9ff;
  --text: #1e293b;
  --text-sub: #64748b;
  --bg: #f8fafc;
  --card-bg: #ffffff;
  --border: #e2e8f0;
  --shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06);
  --radius: 12px;
}

/* ── 기본 리셋 ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Pretendard','Apple SD Gothic Neo',sans-serif;
       background: var(--bg); color: var(--text); -webkit-font-smoothing: antialiased; }
a { text-decoration: none; color: inherit; }

/* ── 애니메이션 ── */
@keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
@keyframes spin   { to { transform: rotate(360deg); } }
@keyframes pulse  { 0%,100% { opacity:1; } 50% { opacity:0.4; } }

/* ── 공통 클래스 ── */
.animate-in { animation: fadeIn 0.3s ease both; }
.card       { background: var(--card-bg); border-radius: var(--radius);
              border: 1px solid var(--border); box-shadow: var(--shadow); }
.btn        { display: inline-flex; align-items: center; justify-content: center;
              gap: 6px; border: none; border-radius: 8px; font-weight: 700;
              font-size: 14px; cursor: pointer; transition: all 0.15s; }
.btn-primary { background: var(--primary); color: #fff; }
.btn-primary:hover { filter: brightness(1.1); transform: translateY(-1px); }
.btn-ghost  { background: transparent; color: var(--text-sub);
              border: 1.5px solid var(--border); }
.btn-ghost:hover { border-color: var(--primary); color: var(--primary); }
.btn-danger { background: #ef4444; color: #fff; }
.form-input { width: 100%; padding: 10px 14px; border: 1.5px solid var(--border);
              border-radius: 8px; font-size: 14px; outline: none; transition: border 0.15s; }
.form-input:focus { border-color: var(--primary); }

/* ── 데이터 테이블 ── */
.data-table { width: 100%; border-collapse: collapse; }
.data-table th {
  padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--text-sub); border-bottom: 2px solid var(--border); }
.data-table td {
  padding: 12px 14px; border-bottom: 1px solid var(--border); font-size: 13px; }
.data-table tbody tr:hover { background: #f8fafc; }
.data-table tbody tr:last-child td { border-bottom: none; }
```

---

## 07. src/types/index.ts — 관리자 타입

```ts
export type RiskStage = '안정' | '경미' | '주의' | '고위험' | '심각';
export type DropoutType = '이탈_비참여형' | '이탈_지식격차형' | '이탈_번아웃형' |
  '이탈_메타인지부족형' | '이탈_사고력저하형' | '이탈_내용연결성약형' | '정상';
export type InterventionType = 'message' | 'meeting' | 'resource' | 'alert';
export type InterventionStatus = 'pending' | 'completed' | 'cancelled';

export interface RiskDistribution {
  stage: RiskStage; count: number; percentage: number; }
export interface DashboardResponse {
  total_students: number; high_risk_count: number; pending_interventions: number;
  risk_distribution: RiskDistribution[];
  recent_high_risk: StudentSummary[]; }
export interface StudentSummary {
  student_id: string; username: string; email: string;
  total_risk: number; risk_stage: RiskStage; dropout_type: DropoutType;
  calculated_at: string; }
export interface StudentListResponse { items: StudentSummary[]; total: number; }
export interface RiskRecord {
  id: number; total_risk: number; base_risk: number; event_bonus: number;
  thinking_risk: number; risk_stage: RiskStage; dropout_type: DropoutType;
  calculated_at: string; }
export interface Intervention {
  id: number; student_id: string; type: InterventionType;
  status: InterventionStatus; message: string; dropout_type: DropoutType;
  created_at: string; }
export interface StudentDetail {
  student_id: string; username: string; email: string;
  latest_risk: RiskRecord | null; risk_history: RiskRecord[]; interventions: Intervention[]; }
export interface InterventionCreateRequest {
  student_id: string; type: InterventionType; message: string; }
export interface InterventionResponse {
  id: number; student_id: string; type: InterventionType;
  status: InterventionStatus; message: string; dropout_type: DropoutType; created_at: string; }
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
    ['admin_token','admin_user_id','admin_role'].forEach(k => localStorage.removeItem(k));
    window.location.href = '/login';
  }
  return Promise.reject(err);
});
export default api;
```

### auth.ts (관리자 전용 키 네이밍)
```ts
// localStorage 키: 'admin_token', 'admin_user_id', 'admin_role'
export const getToken   = () => localStorage.getItem('admin_token');
export const getAdminId = () => localStorage.getItem('admin_user_id') ?? '';
export const getRole    = () => localStorage.getItem('admin_role');
export const isLoggedIn = () => !!getToken();
export const setAuth    = (token: string, userId: string, role = 'admin') => {
  localStorage.setItem('admin_token', token);
  localStorage.setItem('admin_user_id', userId);
  localStorage.setItem('admin_role', role);
};
export const clearAuth  = () => {
  ['admin_token','admin_user_id','admin_role'].forEach(k => localStorage.removeItem(k));
};
```

---

## 10. src/components/Layout.tsx — 다크 사이드바 레이아웃

### 핵심 구조
```
┌──────────────────────────────────────────────────┐
│ SIDEBAR(230px fixed, #0f172a)  │  RIGHT AREA     │
│                                │                 │
│  [Admin] 학습관리               │  HEADER(56px)   │
│  ────────────────────          │  sticky, white  │
│  📊 대시보드                   │  페이지명 | 관리자 │
│  👥 학생 관리                   ├─────────────────┤
│  🛠️ 개입 생성                  │  CONTENT        │
│                                │  padding:28px   │
│  ──────────────────            │  <Outlet/>      │
│  🚪 로그아웃                   │                 │
└──────────────────────────────────────────────────┘
```

### 핵심 코드 패턴
```tsx
const NAV_ITEMS = [
  { path: '/dashboard',   icon: '📊', label: '대시보드' },
  { path: '/students',    icon: '👥', label: '학생 관리' },
  { path: '/interventions', icon: '🛠️', label: '개입 생성' },
];

// 활성 항목 스타일
const activeStyle = {
  borderLeft: '3px solid #0ea5e9',
  background: 'rgba(14,165,233,0.12)',
  color: '#fff',
};

// 비활성 hover: color: '#cbd5e1' (onMouseEnter) → '#94a3b8' (onMouseLeave)
// 헤더: 현재 pathname으로 페이지명 lookup + 관리자 이니셜 원형
```

---

## 11. src/components/RiskDistributionChart.tsx

```tsx
// RiskDistribution[] 배열을 시각적 막대 차트로 렌더링
// 핵심: maxCount 기준 상대적 너비 (전체 합계 아님!)
const maxCount = Math.max(...data.map(d => d.count), 1);

// 각 행: 단계 배지 + count + percentage + 상대 너비 막대
// compact prop: 작은 버전 (대시보드 위젯용)
const STAGE_COLORS = {
  '안정': '#10b981', '경미': '#f59e0b', '주의': '#f97316', '고위험': '#ef4444', '심각': '#dc2626',
};
```

---

## 12. src/pages/LoginPage.tsx — 다크 테마 2-패널 로그인

```
┌───────────────────────────────────────────────┐
│  배경: 전체 #0f172a                            │
│                                               │
│  ┌──────────────────┐  ┌──────────────────┐  │
│  │  LEFT PANEL      │  │  RIGHT PANEL     │  │
│  │  gradient        │  │  white card      │  │
│  │  #0f172a→#1e293b │  │  width: 420px    │  │
│  │  (또는 solid)    │  │                  │  │
│  │  📊 서비스명      │  │  🔑 관리자 로그인  │  │
│  │  3개 기능 목록    │  │  [이메일]         │  │
│  │                  │  │  [비밀번호]       │  │
│  │                  │  │  [로그인(full)]   │  │
│  └──────────────────┘  └──────────────────┘  │
└───────────────────────────────────────────────┘
```
- role 검증: `getRole() !== 'admin'` 이면 clearAuth + 에러 메시지
- 성공: `navigate('/dashboard')`

---

## 13. src/pages/DashboardPage.tsx — KPI + 차트 대시보드

```
┌──────────────────────────────────────────────────┐
│  Header: "대시보드" 제목 + 날짜                    │
├──────────────┬───────────────┬───────────────────┤
│  KPI: 전체   │  KPI: 고위험  │  KPI: 미처리개입   │
│  학생 수     │  이상 수       │  수                │
├──────────────────────┬───────────────────────────┤
│  위험도 분포 차트      │  고위험 학생 목록 (최대5명) │
│  RiskDistribution   │  각 항목: 위험점수원+이름+단계 │
│  Chart              │  hover: 배경+border 변화    │
├──────────────────────────────────────────────────┤
│  [👥 전체 학생 보기]  [🛠️ 개입 생성]              │
└──────────────────────────────────────────────────┘
```

### KPI 카드 패턴
```tsx
// borderLeft: `4px solid ${color}` 액센트가 핵심
<div className="card" style={{ padding:'18px 20px', borderLeft:`4px solid ${color}` }}>
  <span style={{fontSize:11, textTransform:'uppercase', letterSpacing:'0.05em'}}>{label}</span>
  <span style={{fontSize:20}}>{icon}</span>
  <div style={{fontSize:32, fontWeight:800, color}}>{value}</div>
  <div style={{fontSize:11, color: danger?'#ef4444':'#10b981'}}>{trend}</div>
</div>
```

---

## 14. src/pages/StudentsPage.tsx — 필터 + 정렬 + 테이블

```
┌──────────────────────────────────────────────────┐
│  Header: "학생 목록" + "전체 N명 · 필터된 결과 M명" │
├──────────────────────────────────────────────────┤
│  [🔍 이름/이메일 검색] [전체][안정][경미][주의]   │
│                        [고위험][심각] [정렬 select] │
├──────────────────────────────────────────────────┤
│  .data-table                                     │
│  학생 | 위험도 | 단계 | 탈락유형 | 분석시각 | 상세 │
│  (이니셜 원형 + 이름 + 이메일) (미니바 + 숫자)     │
└──────────────────────────────────────────────────┘
```

### 단계 필터 칩 패턴
```tsx
const STAGES: (RiskStage | 'all')[] = ['all', '안정', '경미', '주의', '고위험', '심각'];
// 활성: borderColor:'var(--primary)', background:'var(--primary-pale)', color:'var(--primary)'
// 비활성: borderColor:'var(--border)', background:'#fff', color:'var(--text-sub)'
```

### 이니셜 아바타
```tsx
<div style={{
  width:32, height:32, borderRadius:8,
  background:'var(--primary-pale)', color:'var(--primary)',
  display:'flex', alignItems:'center', justifyContent:'center',
  fontWeight:800, fontSize:13,
}}>
  {s.username.charAt(0).toUpperCase()}
</div>
```

---

## 15. src/pages/StudentDetailPage.tsx

```
┌──────────────────────────────────────────────────┐
│  [← 목록]  학생명 상세 정보          [+ 개입 생성] │
├──────────────────────────────────────────────────┤
│  다크 배너 (gradient #0f172a→#1e293b)             │
│  [위험점수 원형] 이름 + 이메일    [단계 배지]       │
├───────────────────────┬──────────────────────────┤
│  최신 위험도 (4개 바)  │  위험도 이력 (스크롤)      │
│  total/base/event/   │  maxHeight:240px          │
│  thinking 각 바        │  각 항목: 점수+단계+시각   │
├──────────────────────────────────────────────────┤
│  개입 이력                              [+ 추가]  │
│  각 항목: type + status배지 + message + 날짜      │
└──────────────────────────────────────────────────┘
```

### 상태 배지 색상
```tsx
const statusStyle = {
  pending:   { bg: '#fef3c7', color: '#92400e' },   // 노란색
  completed: { bg: '#d1fae5', color: '#065f46' },   // 녹색
  cancelled: { bg: '#f1f5f9', color: '#64748b' },   // 회색
}[iv.status];
```

---

## 16. src/pages/InterventionPage.tsx — 개입 생성 폼

```
┌──────────────────────────────────────────┐
│  "개입 생성" 제목                         │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ 👤 학생 ID                       │   │
│  │ [UUID input]                     │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ 🛠️ 개입 유형                     │   │
│  │  [💬 메시지] [📅 면담]           │   │
│  │  [📚 자료]   [🚨 긴급알림]       │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ ✍️ 메시지                        │   │
│  │ [textarea]              N자      │   │
│  └──────────────────────────────────┘   │
│                                          │
│  [취소]           [✅ 개입 생성]         │
└──────────────────────────────────────────┘
```

### 유형 선택 라디오 카드 패턴
```tsx
// TYPE_OPTIONS에 color 정의: message=#0ea5e9, meeting=#a855f7, resource=#10b981, alert=#ef4444
// 선택된 카드:
//   border: `2px solid ${color}`
//   background: `${color}10`  (투명도 10%)
// 아이콘 배경:
//   background: selected ? `${color}20` : '#f1f5f9'
```

### 성공 화면
```tsx
// 성공 시 별도 성공 뷰 렌더링
if (success) return (
  <div className="card" style={{padding:'48px 40px', textAlign:'center'}}>
    <div style={{fontSize:56}}>✅</div>
    <h2>개입이 생성되었습니다</h2>
    {/* 2×2 그리드: 유형/상태/탈락유형/생성시각 */}
    {/* 메시지 녹색 박스 */}
    {/* [추가 개입] [학생 상세 보기] 버튼 */}
  </div>
);
```

---

## 17. src/App.tsx — 라우팅 구조

```tsx
<BrowserRouter>
  <Routes>
    <Route path="/login" element={<LoginPage/>}/>
    <Route path="/" element={<ProtectedRoute><Layout/></ProtectedRoute>}>
      <Route index element={<Navigate to="/dashboard"/>}/>
      <Route path="dashboard"      element={<DashboardPage/>}/>
      <Route path="students"       element={<StudentsPage/>}/>
      <Route path="students/:studentId" element={<StudentDetailPage/>}/>
      <Route path="interventions"  element={<InterventionPage/>}/>
      <Route path="interventions/new" element={<InterventionPage/>}/>
    </Route>
    <Route path="*" element={<Navigate to="/dashboard"/>}/>
  </Routes>
</BrowserRouter>
```

---

## STAGE_COLOR 상수 (모든 페이지에서 공유)

```tsx
const STAGE_COLOR: Record<RiskStage, { text: string; bg: string; border: string }> = {
  '안정':   { text: '#065f46', bg: '#d1fae5', border: '#10b981' },
  '경미':   { text: '#92400e', bg: '#fef3c7', border: '#f59e0b' },
  '주의':   { text: '#9a3412', bg: '#ffedd5', border: '#f97316' },
  '고위험': { text: '#991b1b', bg: '#fee2e2', border: '#ef4444' },
  '심각':   { text: '#fff',    bg: '#7f1d1d', border: '#dc2626' },
};
```

---

## 디자인 일관성 체크리스트

- [ ] 사이드바 배경: `#0f172a` (CSS 변수 `--sidebar-bg`)
- [ ] 주요 강조색: `#0ea5e9` (CSS 변수 `--primary`)
- [ ] KPI 카드: `borderLeft: 4px solid {color}` 패턴
- [ ] 테이블: `.data-table` 클래스 사용 (직접 style 금지)
- [ ] 모든 페이지 루트: `className="animate-in"`
- [ ] 로딩: CSS spin div (border + borderTopColor + animation:spin)
- [ ] 에러 박스: `background:#fef2f2, color:#991b1b`
- [ ] 빈 상태: 이모지 + 안내 텍스트
- [ ] 하드코딩 색상 금지: `#fff`, `#000` 제외 모두 CSS 변수 또는 STAGE_COLOR 사용

---

## API 엔드포인트 요약

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /auth/login | 관리자 로그인 |
| GET | /admin/dashboard | 대시보드 KPI + 차트 데이터 |
| GET | /admin/students | 학생 목록 |
| GET | /admin/students/{id} | 학생 상세 (위험도 이력 + 개입 이력) |
| POST | /admin/intervention | 개입 생성 |

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

### src/hooks/useToast.ts + src/components/Toast.tsx
동일 패턴. admin 테마 primary:#0ea5e9 기준.

### src/components/ErrorBoundary.tsx
Fallback: 💥 + "관리자 화면에서 오류가 발생했습니다" + 새로고침

### src/components/EmptyState.tsx / ConfirmDialog.tsx / Pagination.tsx
student-web과 동일 구조. pageSize=20 (학생 목록).

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
// admin 키: 'admin_token', 'refresh_token'
api.interceptors.response.use(res => res, async err => {
  const original = err.config;
  if (err.response?.status === 401 && !original._retry) {
    original._retry = true;
    try {
      const rt = localStorage.getItem('refresh_token');
      const { data } = await axios.post('/api/auth/refresh', { refresh_token: rt });
      localStorage.setItem('admin_token', data.access_token);
      original.headers.Authorization = `Bearer ${data.access_token}`;
      return api(original);
    } catch { clearAuth(); window.location.href = '/login'; }
  }
  return Promise.reject(err);
});
```

---

## admin-web 전용 추가 기능

### StudentsPage — CSV 내보내기
```ts
const exportCSV = () => {
  const headers = ['학생ID','이름','이메일','위험점수','단계','탈락유형','분석시각'];
  const rows = filtered.map(s => [s.student_id, s.username, s.email,
    s.total_risk, s.risk_stage, s.dropout_type, s.calculated_at]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `students_${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
};
// 버튼: "📥 CSV 내보내기" (btn btn-ghost)
```

### DashboardPage — 30초 폴링
```ts
useEffect(() => {
  fetchDashboard();
  const timer = setInterval(fetchDashboard, 30_000);
  return () => clearInterval(timer);
}, []);
// 헤더에 "🔄 자동 새로고침 중" (fontSize:12px, color:var(--text-sub))
// KPI 영역: aria-live="polite"
```

### InterventionPage — 제출 전 ConfirmDialog
```ts
// onSubmit: setConfirmOpen(true)
// ConfirmDialog onConfirm: 실제 API 호출
// 성공: showToast('개입이 생성되었습니다', 'success')
// 실패: showToast(에러메시지, 'error')
```

---

## 완성도 체크리스트 (admin-web)

- [ ] src/hooks/useDebounce.ts 존재
- [ ] src/hooks/useToast.ts 존재
- [ ] src/components/Toast.tsx 존재
- [ ] src/components/ErrorBoundary.tsx 존재
- [ ] src/components/EmptyState.tsx 존재
- [ ] src/components/ConfirmDialog.tsx 존재
- [ ] src/components/Pagination.tsx 존재
- [ ] .env.example 존재
- [ ] App.tsx: ErrorBoundary + ToastProvider 래핑
- [ ] api.ts: refresh token 인터셉터 (admin_token 키)
- [ ] auth.ts: refresh_token 키 포함
- [ ] Layout.tsx: 모바일 햄버거 메뉴 (≤ 768px)
- [ ] LoginPage: 클라이언트 유효성 검사
- [ ] StudentsPage: useDebounce + Pagination + CSV 내보내기
- [ ] DashboardPage: 30초 폴링 + aria-live
- [ ] InterventionPage: ConfirmDialog + Toast
- [ ] StudentDetailPage: aria-hidden + aria-label + aria-live
- [ ] 모든 장식용 이모지: aria-hidden="true"
- [ ] index.css: :focus-visible, .sr-only, @media(max-width:768px), shimmer, prefers-reduced-motion
