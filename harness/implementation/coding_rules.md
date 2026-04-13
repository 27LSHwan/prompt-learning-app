# Coding Rules — 코딩 규칙

## Python (Backend & Packages)

### 기본 규칙
- Python 3.11+
- 타입 힌트 필수 (모든 함수 인자 및 반환값)
- Pydantic v2 사용
- async/await 패턴 사용 (FastAPI 라우터)

### 네이밍 컨벤션
```python
# 파일명: snake_case
submission_service.py

# 클래스명: PascalCase
class SubmissionService:

# 함수명: snake_case
async def create_submission(...)

# 상수: UPPER_SNAKE_CASE
MAX_RISK_SCORE = 100
```

### 필수 패턴 — 서비스 레이어
```python
class SubmissionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: SubmissionCreate) -> Submission:
        # 로직 구현
        ...
```

### 필수 패턴 — 라우터
```python
@router.post("/submissions", response_model=SubmissionResponse)
async def create_submission(
    data: SubmissionCreate,
    db: AsyncSession = Depends(get_db),
):
    service = SubmissionService(db)
    return await service.create(data)
```

### 에러 처리
```python
from fastapi import HTTPException

raise HTTPException(status_code=404, detail="Submission not found")
```

## TypeScript (Frontend)

### 기본 규칙
- TypeScript strict 모드 활성화
- React Functional Component + Hooks
- Axios instance 사용 (baseURL 설정)

### 네이밍 컨벤션
```typescript
// 컴포넌트: PascalCase
const SubmissionForm: React.FC = () => { ... }

// 함수/변수: camelCase
const handleSubmit = async () => { ... }

// 타입/인터페이스: PascalCase
interface SubmissionPayload { ... }

// 상수: UPPER_SNAKE_CASE
const MAX_TEXT_LENGTH = 5000;
```

### API 호출 패턴
```typescript
import api from '@/lib/api';

const response = await api.post<SubmissionResponse>('/submissions', payload);
```

## 공통 규칙

- 모든 함수는 단일 책임 원칙 준수
- 함수 길이 50줄 초과 금지
- 매직 넘버 금지 (상수로 정의)
- 주석: 한국어 또는 영어 허용, 일관성 유지
- 테스트 커버리지: 서비스 레이어 70% 이상 목표

## 파일 길이 제한

| 파일 유형 | 최대 줄 수 |
|-----------|-----------|
| 라우터 | 100줄 |
| 서비스 | 200줄 |
| 모델 | 100줄 |
| 패키지 모듈 | 150줄 |
| React 컴포넌트 | 200줄 |

---

## React 컴포넌트 UX 패턴

### CSS 변수 사용 규칙

```typescript
// ✅ 올바른 사용 — CSS 변수 참조
style={{ color: 'var(--primary)', background: 'var(--card)' }}

// ✅ 허용 — 컴포넌트 내 상수 객체로 색상 관리
const STAGE_COLOR: Record<RiskStage, string> = {
  '안정': '#10b981', '경미': '#f59e0b', ...
};

// ❌ 금지 — 인라인에 하드코딩된 임의 색상
style={{ color: '#4f46e5' }}  // CSS 변수로 교체
```

### 인터랙션 패턴

```typescript
// 카드 hover 효과
onMouseEnter={e => {
  (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
  (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)';
  (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-hover)';
}}
onMouseLeave={e => {
  (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
  (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
  (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow)';
}}

// 사이드바 항목 hover
onMouseEnter={e => {
  if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.10)';
}}
onMouseLeave={e => {
  if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
}}
```

### 로딩·오류·빈 상태 필수 처리

모든 데이터 fetch 페이지는 세 가지 상태를 반드시 처리한다:

```typescript
// 1. 로딩
if (loading) return <Spinner />;

// 2. 빈 상태
if (items.length === 0) return <EmptyState />;

// 3. 정상 렌더링
return <DataView data={items} />;
```

### 페이지 진입 애니메이션

모든 보호된 페이지의 최상위 `<div>`에 `animate-in` 클래스 적용:

```typescript
return (
  <div className="animate-in">
    {/* 페이지 내용 */}
  </div>
);
```

### 폼 제출 패턴

```typescript
const [loading, setLoading] = useState(false);
const [error, setError]     = useState('');

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setError('');
  try {
    const res = await api.post<ResponseType>(endpoint, payload);
    // 성공 처리
  } catch (err: any) {
    setError(err.response?.data?.detail ?? '처리 중 오류가 발생했습니다.');
  } finally {
    setLoading(false);
  }
};
```

### 인증 helpers 패턴 (lib/auth.ts)

```typescript
// student-web: TOKEN_KEY='auth_token', USER_ID_KEY='user_id', ROLE_KEY='role'
// admin-web:   TOKEN_KEY='admin_token', USER_ID_KEY='admin_user_id', ROLE_KEY='admin_role'

export function saveAuth(token: string, userId: string, role: string): void
export function clearAuth(): void
export function isLoggedIn(): boolean   // !!localStorage.getItem(TOKEN_KEY)
export function getToken(): string | null
export function getUserId(): string | null
export function getRole(): string | null
```

### Axios 인스턴스 패턴 (lib/api.ts)

```typescript
const api = axios.create({ baseURL: '/api/v1' });

// Request: 토큰 자동 첨부
api.interceptors.request.use(config => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response: 401 → 리다이렉트
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      clearAuth();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);
```

### 진행률 바 패턴

```typescript
// CSS transition으로 부드럽게
<div style={{ background: '#e8eaf6', borderRadius: 8, height: 8 }}>
  <div style={{
    height: '100%', borderRadius: 8,
    width: `${progress}%`,
    background: progress === 100
      ? 'linear-gradient(90deg, #10b981, #059669)'
      : 'linear-gradient(90deg, #818cf8, #4f46e5)',
    transition: 'width 0.4s ease',
  }} />
</div>
```

### 스켈레톤 컴포넌트

```typescript
function Skeleton({ height }: { height: number }) {
  return (
    <div style={{
      height, borderRadius: 8, width: '100%',
      background: '#e8eaf6',
      animation: 'pulse 1.5s infinite',
    }} />
  );
}
```

---

## admin-web 전용 패턴

### 데이터 테이블

```typescript
// index.css에 .data-table 정의 필수
<table className="data-table">
  <thead>
    <tr>
      <th>컬럼명</th>
    </tr>
  </thead>
  <tbody>
    {items.map(item => (
      <tr key={item.id}>
        <td>{item.value}</td>
      </tr>
    ))}
  </tbody>
</table>
```

### KPI 카드 패턴

```typescript
// borderLeft 4px solid {color} 액센트
<div className="card" style={{ padding:'18px 20px', borderLeft:`4px solid ${color}` }}>
  <div style={{ fontSize:11, color:'var(--text-sub)', fontWeight:700,
                textTransform:'uppercase', letterSpacing:'0.05em' }}>
    {label}
  </div>
  <div style={{ fontSize:32, fontWeight:800, color, lineHeight:1 }}>{value}</div>
  <div style={{ fontSize:11, marginTop:6, color: danger ? '#ef4444' : '#10b981', fontWeight:600 }}>
    {trend}
  </div>
</div>
```

### 상태 배지 패턴

```typescript
const STATUS_STYLE = {
  pending:   { bg: '#fef3c7', color: '#92400e' },
  completed: { bg: '#d1fae5', color: '#065f46' },
  cancelled: { bg: '#f1f5f9', color: '#64748b' },
};
const s = STATUS_STYLE[status] ?? STATUS_STYLE.cancelled;
<span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700,
               background:s.bg, color:s.color }}>{status}</span>
```

---

## 웹 애플리케이션 완성도 — 필수 구현 항목

> 아래 15개 항목은 **프론트엔드 구현 시 기본 요건**이다.
> 누락 시 웹 애플리케이션으로서 미완성 상태로 간주한다.

---

### 1. ErrorBoundary (글로벌 에러 경계)

```tsx
// src/components/ErrorBoundary.tsx — React Class 컴포넌트
// App.tsx 최상단에서 BrowserRouter를 감싼다
export class ErrorBoundary extends Component<{children:ReactNode},{hasError:boolean,error?:Error}> {
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error(error, info); }
  render() {
    if (this.state.hasError) return <FallbackUI error={this.state.error} />;
    return this.props.children;
  }
}
// Fallback: 💥 아이콘 + "문제가 발생했습니다" + 새로고침 버튼
```

---

### 2. Toast 알림 시스템 (외부 라이브러리 금지)

```tsx
// src/hooks/useToast.ts + src/components/Toast.tsx
// Context 기반, 외부 라이브러리 없이 구현
type ToastType = 'success' | 'error' | 'info' | 'warning';
// 위치: fixed bottom-right (bottom:24px, right:24px), zIndex:1000
// 자동 소멸: 3500ms 후 dismiss
// 색상: success=#065f46, error=#991b1b, info=#1e40af, warning=#92400e (배경)
//       border-left: #10b981, #ef4444, #3b82f6, #f59e0b
// App.tsx에 <ToastProvider>로 감싸고 <Toast/>를 BrowserRouter 바깥에 배치
```

---

### 3. 페이지네이션 (목록 페이지 필수)

```tsx
// src/components/Pagination.tsx
interface PaginationProps {
  currentPage: number;   // 1-indexed
  totalPages: number;
  onPageChange: (page: number) => void;
}
// 표시: ← 1 2 [3] 4 5 → (최대 5개 페이지 번호, 나머지 ellipsis)
// 활성: background:var(--primary), color:#fff
// student-web 히스토리: 페이지당 10개
// admin-web 학생 목록: 페이지당 20개
```

---

### 4. 검색 디바운스 (useDebounce 훅)

```ts
// src/hooks/useDebounce.ts
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
// 검색 input: controlled value는 즉시 반영, API 호출은 debounced 값 기준
```

---

### 5. 반응형 레이아웃 (모바일 ≤ 768px)

```tsx
// Layout.tsx: isMobileOpen state + 햄버거 버튼(☰)
// 모바일: 56px 상단 헤더 + 오버레이 사이드바 (zIndex:101)
// 오버레이 배경: rgba(0,0,0,0.4), 클릭 시 닫힘
// index.css에 @media (max-width: 768px) 추가
// 2열 그리드 → 1열, 고정 사이드바 → overflow hidden
```

---

### 6. 폼 유효성 검사 (클라이언트 사이드)

```tsx
// 각 페이지에서 submit 전 필드별 validate 함수 실행
// 에러: 각 필드 아래 인라인 메시지 (color:#ef4444, fontSize:12px)
// 검사 항목:
//   - email: required + /^[^\s@]+@[^\s@]+\.[^\s@]+$/ 정규식
//   - password: required + 최소 6자
//   - username: required + 최소 2자
//   - password confirm: 비밀번호와 일치 여부
// submit 버튼: 로딩 중 disabled + opacity:0.7
```

---

### 7. 확인 다이얼로그 (삭제·생성 등 민감 액션)

```tsx
// src/components/ConfirmDialog.tsx
interface ConfirmDialogProps {
  isOpen: boolean; title: string; message: string;
  confirmLabel?: string;  // default '확인'
  cancelLabel?: string;   // default '취소'
  variant?: 'default' | 'danger';  // danger = background:#ef4444
  onConfirm: () => void; onCancel: () => void;
}
// 오버레이: fixed inset:0, rgba(0,0,0,0.5), zIndex:500
// 다이얼로그: width:400px, padding:28px, borderRadius:16px
```

---

### 8. 공통 EmptyState 컴포넌트

```tsx
// src/components/EmptyState.tsx
interface EmptyStateProps {
  icon?: string;       // emoji, default '📭'
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}
// 렌더: 가운데 정렬, icon(52px) + title(18px 700) + description + action 버튼
// 모든 빈 목록/검색 결과 없음 상태에 일관되게 사용
```

---

### 9. 환경변수 분리 (.env.example)

```
# .env.example (프로젝트 루트에 위치, git 커밋 가능)
브라우저 런타임에 `public/.env` 를 읽고 `API_BASE_URL=http://localhost:8000` 값을 사용

# .env.production (git 제외, .gitignore에 추가)
브라우저 런타임에 `public/.env` 를 읽고 `API_BASE_URL=https://api.example.com` 값을 사용
```
- 프론트 API 클라이언트는 `public/.env` 에 선언된 `API_BASE_URL` 을 런타임 로더로 읽어서 사용
- 민감한 값은 브라우저에 노출되지 않도록 서버 전용 환경변수로 분리

---

### 10. JWT Refresh Token 자동 재발급

```ts
// src/lib/api.ts 응답 인터셉터
api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const rt = localStorage.getItem('refresh_token');
        const { data } = await axios.post('/api/auth/refresh', { refresh_token: rt });
        localStorage.setItem('token', data.access_token); // admin: 'admin_token'
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return api(original);  // 원본 요청 재시도
      } catch {
        clearAuth(); window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);
// auth.ts: setAuth에 refreshToken 파라미터 추가, clearAuth에 'refresh_token' 키 포함
```

---

### 11. HTTPS + CORS + 배포 설정 문서화

`harness/implementation/deployment.md` 반드시 포함:
- FastAPI CORSMiddleware allow_origins 화이트리스트
- nginx SPA fallback (try_files → index.html)
- nginx 정적 파일 캐싱 (assets/ 1년)
- nginx API 리버스 프록시 설정
- 배포 전 보안 체크리스트 6개 항목

---

### 12. CSV 데이터 내보내기 (admin-web)

```ts
// admin-web StudentsPage에 "📥 CSV 내보내기" 버튼 추가
const exportCSV = () => {
  const headers = ['학생ID','이름','이메일','위험점수','단계','탈락유형','분석시각'];
  const rows = filtered.map(s => [s.student_id, s.username, s.email,
    s.total_risk, s.risk_stage, s.dropout_type, s.calculated_at]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for 한글
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `students_${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
};
```

---

### 13. 실시간 폴링 (admin-web 대시보드)

```ts
// DashboardPage: 30초마다 자동 새로고침
useEffect(() => {
  fetchDashboard();
  const timer = setInterval(fetchDashboard, 30_000);
  return () => clearInterval(timer);
}, []);
// 헤더에 "🔄 자동 새로고침 중" 표시 (fontSize:12px, color:var(--text-sub))
// KPI 영역에 aria-live="polite" 추가
```

---

### 14. 접근성 (WCAG 2.1 기본 준수)

```tsx
// 장식용 이모지: aria-hidden="true"
<span aria-hidden="true">🎓</span>

// 의미 있는 버튼: aria-label 명시
<button aria-label="학생 목록으로 돌아가기">← 목록</button>

// 동적 콘텐츠 영역: aria-live
<div aria-live="polite">{riskDisplay}</div>

// 포커스 가시성: index.css에 필수 추가
// :focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }

// 스크린리더 전용 텍스트: .sr-only 클래스
// .sr-only { position:absolute; width:1px; height:1px; ... }

// 테이블 정렬: aria-sort="ascending|descending|none"
// 입력 필드 에러: aria-invalid="true", aria-describedby="{id}-error"
```

---

### 15. index.css 필수 추가 섹션

모든 프론트엔드의 index.css에 반드시 포함해야 하는 섹션:

```css
/* ── 접근성 ── */
:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px;
           overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }

/* ── 반응형 ── */
@media (max-width: 768px) {
  /* 사이드바 숨김, 모바일 헤더 표시, 그리드 1열 전환 */
}

/* ── 스켈레톤 shimmer ── */
.skeleton { background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
            background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius:6px; }
@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

/* ── 모션 감소 (접근성) ── */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important;
                            transition-duration: 0.01ms !important; }
}
```

---

### 16. 루브릭 평가 결과 페이지 (SubmissionResultPage) — 필수 구현 항목

프롬프트 제출 후 결과 페이지(`/submissions/:id/result`)는 단순 "성공/실패" 텍스트가 아닌
**루브릭 시각화 + 합격 판정 + 재도전 UX** 를 필수로 포함해야 한다.

#### 16-1. 원형 점수 게이지 (conic-gradient)

```tsx
// 총점 0~100 → 원형 진행률 표시
const score = feedbackData?.total_score ?? 0;
const passed = score >= PASS_THRESHOLD;  // PASS_THRESHOLD = 80

<div style={{
  width: 120, height: 120, borderRadius: '50%',
  background: `conic-gradient(${passed ? '#10b981' : '#f59e0b'} ${score}%, #e5e7eb ${score}%)`,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}}>
  <div style={{ width: 90, height: 90, borderRadius: '50%', background: '#fff',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
    <span style={{ fontSize: 28, fontWeight: 800, color: passed ? '#10b981' : '#f59e0b' }}>
      {Math.round(score)}
    </span>
    <span style={{ fontSize: 11, color: 'var(--text-sub)' }}>/ 100</span>
  </div>
</div>
```

#### 16-2. 합격/불합격 배지

```tsx
// PASS_THRESHOLD = 80 (절대 상수로 정의, 매직넘버 금지)
const PASS_THRESHOLD = 80;

<div style={{
  padding: '6px 20px', borderRadius: 20, fontWeight: 700, fontSize: 14,
  background: passed ? '#d1fae5' : '#fef3c7',
  color: passed ? '#065f46' : '#92400e',
}}>
  {passed ? '✅ 합격' : '🔥 재도전 권장'}
</div>
```

#### 16-3. 평가 기준별 바 (criteria_scores)

```tsx
// CharacterFeedbackResponse.criteria_scores 배열 순회
{feedbackData.criteria_scores.map(c => {
  const pct = c.max_score > 0 ? (c.score / c.max_score) * 100 : 0;
  const barColor = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div key={c.criterion} style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{c.criterion}</span>
        <span style={{ fontSize: 12, color: 'var(--text-sub)' }}>
          {c.score} / {c.max_score}
        </span>
      </div>
      <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4 }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4,
                      background: barColor, transition: 'width 0.5s ease' }} />
      </div>
      {c.feedback && (
        <p style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 3 }}>{c.feedback}</p>
      )}
    </div>
  );
})}
```

#### 16-4. 재도전 버튼 (실패 시 조건부 렌더링)

```tsx
// 불합격 AND problem_id가 있는 경우에만 재도전 버튼 표시
{!passed && problemId && (
  <button
    className="btn"
    style={{ background: '#f59e0b', color: '#fff', padding: '12px 28px',
             borderRadius: 12, fontWeight: 700, fontSize: 15 }}
    onClick={() => navigate(`/problems/${problemId}/work?retry=${submissionId}`)}
  >
    🔥 이전 답안으로 다시 도전하기
  </button>
)}

{passed && (
  <p style={{ color: '#10b981', fontWeight: 600, textAlign: 'center' }}>
    🎊 훌륭해요! 이 문제를 성공적으로 통과했습니다!
  </p>
)}
```

#### 16-5. 재도전 모드 (ProblemWorkPage retry param)

```tsx
// URL ?retry={submissionId} 파라미터로 이전 답안 사전 로드
const [searchParams] = useSearchParams();
const retrySubmissionId = searchParams.get('retry');

useEffect(() => {
  if (retrySubmissionId) {
    // GET /student/submissions?student_id= 로 이전 제출 이력 조회
    // 라벨 섹션 파싱: "[초안 프롬프트]\n", "[실행용 프롬프트]\n" 우선, 기존 제출 호환용 legacy 라벨은 fallback
    loadRetryData(retrySubmissionId);
  }
}, [retrySubmissionId]);

// 재도전 배너 표시 (retrySubmissionId 있을 때)
{retrySubmissionId && (
  <div style={{ background: '#fef3c7', border: '1px solid #f59e0b',
                borderRadius: 8, padding: '10px 16px', marginBottom: 16,
                color: '#92400e', fontWeight: 600, fontSize: 13 }}>
    🔥 이전 답안을 불러왔어요! 부족한 부분을 개선해서 다시 도전해보세요.
  </div>
)}
```

#### 16-6. 백엔드 CharacterFeedbackResponse 계약

`POST /student/submissions/{id}/feedback` 응답에는 반드시 다음 필드가 포함되어야 한다:

```python
class CharacterFeedbackResponse(BaseModel):
    submission_id: str
    character_name: str         # 예: "프롬이"
    emotion: str                # happy / excited / encouraging / thinking / concerned / neutral
    main_message: str
    tips: list[str]
    encouragement: str
    growth_note: Optional[str] = None
    score_delta: Optional[float] = None
    total_score: float = 0.0          # ← 루브릭 총점 (0~100)
    criteria_scores: list[CriterionScoreResponse] = []  # ← 기준별 점수
    pass_threshold: float = 80.0      # ← 마이크 진입 기준선
```

```python
class CriterionScoreResponse(BaseModel):
    criterion: str      # 기준명
    score: float        # 획득 점수
    max_score: float    # 최대 점수
    feedback: str       # 기준별 피드백
```

#### 16-7. 필수 구현 체크리스트

- [ ] `PASS_THRESHOLD = 80` 상수 정의 (매직 넘버 금지)
- [ ] 원형 conic-gradient 점수 게이지 구현
- [ ] 합격(녹색) / 불합격(호박색) 배지 표시
- [ ] criteria_scores 배열 → 색상 코딩 바 렌더링 (녹≥70%, 주황40~70%, 빨강<40%)
- [ ] 불합격 + problem_id 존재 시 재도전 버튼 표시
- [ ] 재도전 버튼 → `/problems/{problemId}/work?retry={submissionId}` 네비게이션
- [ ] ProblemWorkPage: `?retry=` 파라미터 감지 → 이전 답안 사전 로드
- [ ] 재도전 시 amber 배너 표시
- [ ] 합격 시 축하 메시지 표시 (재도전 버튼 대신)

---

### 17. 캐릭터 마스코트 개입 시스템 — 필수 구현 항목

자동 개입 및 피드백은 반드시 **캐릭터 "프롬이"** 를 통해 전달되어야 한다.

#### 17-1. Character.tsx (SVG 올빼미 캐릭터)

```tsx
// src/components/Character.tsx
type CharacterEmotion = 'happy' | 'excited' | 'encouraging' | 'thinking' | 'concerned' | 'neutral';

// 감정별 눈 표정·날개 동작·색상 변화를 SVG + CSS 애니메이션으로 구현
// 필수 animation: float(위아래), bounce(튀기기), blink(깜빡임)
// Props: emotion, size (default 120)
```

#### 17-2. CharacterMessage.tsx (말풍선 + 캐릭터)

```tsx
// src/components/CharacterMessage.tsx
// - 감정별 배경색 테마 (excited: 보라, happy: 초록, encouraging: 파랑, ...)
// - 슬라이드인 애니메이션 (slide-in from bottom)
// - 선택적 dismiss 버튼 (onDismiss prop)
// - Tips 배열 → 인라인 목록 렌더링
```

#### 17-3. NotificationModal.tsx (개입 알림 모달)

```tsx
// src/components/NotificationModal.tsx
// - API: GET /student/notifications?student_id={id}
// - PATCH /student/notifications/{id}/read (읽음 처리)
// - dropout_type → emotion 매핑:
//   { cognitive: 'thinking', motivational: 'encouraging',
//     sudden: 'concerned', compound: 'concerned', default: 'happy' }
// - 하나씩 표시, 여러 건이면 "N개 알림 중 M번째" 표시
// - 오버레이 모달 (fixed inset:0, zIndex:800)
```

#### 17-4. useNotifications.tsx (폴링 훅)

```tsx
// src/hooks/useNotifications.tsx
// - 60초마다 미읽은 알림 폴링
// - 미읽은 알림 > 0 → showModal=true 자동 설정
// - 반환: { count, showModal, setShowModal, refresh }
```

#### 17-5. Layout.tsx — 알림 벨 버튼

```tsx
// 사이드바 상단 또는 헤더에 🔔 벨 버튼 추가
// - 미읽은 알림 수 > 0 → 빨간 배지 표시 (count, "9+" 초과시 캡)
// - 클릭 → NotificationModal 표시
// - useNotifications(studentId) 훅 연결
```
