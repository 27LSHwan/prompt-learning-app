import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../lib/api';
import { useToast } from '../hooks/useToast';
import type {
  StudentDetail, RiskStage,
  SubmissionAdminItem, StudentNote, RiskTrendPoint, ProblemRecommendation, InterventionSuggestionItem, StudentTimelineItem, RecommendationEffectItem,
} from '../types';

const STAGE_COLOR: Record<RiskStage, { text: string; bg: string; border: string }> = {
  '안정':   { text: '#065f46', bg: '#d1fae5', border: '#10b981' },
  '경미':   { text: '#92400e', bg: '#fef3c7', border: '#f59e0b' },
  '주의':   { text: '#9a3412', bg: '#ffedd5', border: '#f97316' },
  '고위험': { text: '#991b1b', bg: '#fee2e2', border: '#ef4444' },
  '심각':   { text: '#fff',    bg: '#7f1d1d', border: '#dc2626' },
};

type Tab = 'risk' | 'submissions' | 'interventions' | 'notes';

const safeNumber = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/* ── Mini Line Chart ─────────────────────────────────────────── */
function RiskTrendMini({ points }: { points: RiskTrendPoint[] }) {
  if (points.length < 2) return (
    <p style={{ color: 'var(--text-sub)', fontSize: 13 }}>데이터 부족</p>
  );

  const W = 440, H = 120, PAD = 20;
  const minV = Math.min(...points.map(p => p.avg_risk));
  const maxV = Math.max(...points.map(p => p.avg_risk));
  const range = maxV - minV || 1;

  const toX = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  const toY = (v: number) => H - PAD - ((v - minV) / range) * (H - PAD * 2);

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p.avg_risk).toFixed(1)}`).join(' ');

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 280, maxWidth: W }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <line key={t}
            x1={PAD} y1={toY(minV + t * range)}
            x2={W - PAD} y2={toY(minV + t * range)}
            stroke="#e2e8f0" strokeWidth={1} />
        ))}
        {/* Area fill */}
        <path
          d={`${pathD} L ${toX(points.length - 1)} ${H - PAD} L ${PAD} ${H - PAD} Z`}
          fill="url(#grad)" opacity={0.2}
        />
        {/* Line */}
        <path d={pathD} fill="none" stroke="#ef4444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots */}
        {points.map((p, i) => (
          <circle key={i} cx={toX(i)} cy={toY(p.avg_risk)} r={3} fill="#ef4444" />
        ))}
        {/* Gradient */}
        <defs>
          <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#fff" />
          </linearGradient>
        </defs>
        {/* Labels */}
        {points.map((p, i) => i % Math.ceil(points.length / 5) === 0 && (
          <text key={i} x={toX(i)} y={H} fontSize={8} textAnchor="middle" fill="#94a3b8">
            {new Date(p.date).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
          </text>
        ))}
      </svg>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────── */
export default function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate      = useNavigate();
  const { showToast } = useToast();

  const [detail, setDetail]       = useState<StudentDetail | null>(null);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('risk');

  // Submissions
  const [submissions, setSubmissions]   = useState<SubmissionAdminItem[]>([]);
  const [subLoading, setSubLoading]     = useState(false);

  // Notes
  const [notes, setNotes]             = useState<StudentNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteText, setNoteText]       = useState('');
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);

  // Risk trend
  const [riskTrend, setRiskTrend]     = useState<RiskTrendPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<ProblemRecommendation[]>([]);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<InterventionSuggestionItem[]>([]);
  const [timelineItems, setTimelineItems] = useState<StudentTimelineItem[]>([]);
  const [recommendEffectItems, setRecommendEffectItems] = useState<RecommendationEffectItem[]>([]);

  useEffect(() => {
    if (!studentId) return;
    api.get<StudentDetail>(`/admin/students/${studentId}`)
      .then(r => setDetail(r.data))
      .catch(() => { setDetail(null); showToast('학생 정보를 불러올 수 없습니다', 'error'); })
      .finally(() => setLoading(false));
  }, [studentId, showToast]);

  const fetchSubmissions = useCallback(async () => {
    if (!studentId) return;
    setSubLoading(true);
    try {
      const res = await api.get<{ items: SubmissionAdminItem[] }>(`/admin/students/${studentId}/submissions`);
      setSubmissions(res.data.items ?? []);
    } catch { showToast('제출 이력을 불러올 수 없습니다', 'error'); }
    finally { setSubLoading(false); }
  }, [studentId, showToast]);

  const fetchNotes = useCallback(async () => {
    if (!studentId) return;
    setNotesLoading(true);
    try {
      const res = await api.get<StudentNote[]>(`/admin/students/${studentId}/notes`);
      setNotes(res.data ?? []);
    } catch { showToast('메모를 불러올 수 없습니다', 'error'); }
    finally { setNotesLoading(false); }
  }, [studentId, showToast]);

  const fetchRiskTrend = useCallback(async () => {
    if (!studentId) return;
    setTrendLoading(true);
    try {
      // Use student's risk history for trend visualization
      const res = await api.get<StudentDetail>(`/admin/students/${studentId}`);
      const pts: RiskTrendPoint[] = (res.data.risk_history ?? []).slice().reverse().map(r => ({
        date: r.calculated_at,
        avg_risk: r.total_risk,
        high_risk_count: r.total_risk >= 60 ? 1 : 0,
      }));
      setRiskTrend(pts);
    } catch { /* silent */ }
    finally { setTrendLoading(false); }
  }, [studentId]);

  const fetchRecommendations = useCallback(async () => {
    if (!studentId) return;
    setRecommendLoading(true);
    try {
      const res = await api.get<ProblemRecommendation[]>(`/admin/students/${studentId}/problem-recommendations`);
      setRecommendations(res.data ?? []);
    } catch {
      showToast('추천 문제 데이터를 불러올 수 없습니다', 'error');
    } finally {
      setRecommendLoading(false);
    }
  }, [showToast, studentId]);

  const fetchExtras = useCallback(async () => {
    if (!studentId) return;
    try {
      const [suggestRes, timelineRes, effectRes] = await Promise.allSettled([
        api.get<InterventionSuggestionItem[]>(`/admin/students/${studentId}/intervention-recommendations`),
        api.get<{ items: StudentTimelineItem[] }>(`/admin/students/${studentId}/timeline`),
        api.get<{ items: RecommendationEffectItem[] }>(`/admin/analytics/recommendation-effect`),
      ]);
      if (suggestRes.status === 'fulfilled') setSuggestions(suggestRes.value.data);
      if (timelineRes.status === 'fulfilled') setTimelineItems(timelineRes.value.data.items ?? []);
      if (effectRes.status === 'fulfilled') setRecommendEffectItems((effectRes.value.data.items ?? []).filter(item => item.student_id === studentId));
    } catch { /* silent */ }
  }, [studentId]);

  useEffect(() => {
    if (activeTab === 'submissions') fetchSubmissions();
    if (activeTab === 'notes') fetchNotes();
    if (activeTab === 'risk') {
      fetchRiskTrend();
      fetchRecommendations();
      fetchExtras();
    }
  }, [activeTab, fetchSubmissions, fetchNotes, fetchRiskTrend, fetchRecommendations, fetchExtras]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) { showToast('메모 내용을 입력하세요', 'error'); return; }
    setNoteSubmitting(true);
    try {
      await api.post(`/admin/students/${studentId}/notes`, { content: noteText.trim() });
      setNoteText('');
      showToast('메모가 추가되었습니다', 'success');
      fetchNotes();
    } catch { showToast('메모 추가 실패', 'error'); }
    finally { setNoteSubmitting(false); }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await api.delete(`/admin/notes/${noteId}`);
      showToast('메모가 삭제되었습니다', 'success');
      setDeleteNoteId(null);
      fetchNotes();
    } catch { showToast('메모 삭제 실패', 'error'); }
  };

  const handleDeleteRecommendation = async (recommendationId: string) => {
    try {
      await api.delete(`/admin/problem-recommendations/${recommendationId}`);
      showToast('추천 문제가 해제되었습니다', 'success');
      fetchRecommendations();
    } catch {
      showToast('추천 문제 해제 실패', 'error');
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #bae6fd', borderTopColor: 'var(--primary)', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  if (!detail) return (
    <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-sub)' }}>
      학생 정보를 찾을 수 없습니다.
    </div>
  );

  const r   = detail.latest_risk;
  const cfg = r ? (STAGE_COLOR[r.risk_stage] ?? STAGE_COLOR['안정']) : null;

  return (
    <div className="animate-in">
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
        <button onClick={() => navigate(-1)} style={{
          background: '#f1f5f9', border: 'none', borderRadius: 8,
          padding: '6px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--text-sub)',
          display: 'flex', alignItems: 'center', gap: 6,
        }} aria-label="뒤로 가기">← 목록</button>
        <h1 style={{ fontSize: 20, fontWeight: 800, flex: 1 }}>
          {detail.username} 상세 정보
        </h1>
        <Link to={`/interventions/new?student_id=${studentId}`} className="btn btn-primary"
          style={{ padding: '8px 18px', fontSize: 13 }} aria-label="개입 생성">
          + 개입 생성
        </Link>
      </div>

      {/* Profile Banner */}
      {r && cfg && (
        <div className="responsive-banner" style={{
          background: 'linear-gradient(90deg, #0f172a, #1e293b)',
          borderRadius: 14, padding: '20px 24px', marginBottom: 20,
          color: '#fff',
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: `${cfg.border}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 20, color: cfg.border,
          }}>
            {safeNumber(r.total_risk).toFixed(0)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 3 }}>{detail.username}</div>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>{detail.email}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ padding: '4px 14px', borderRadius: 20, fontWeight: 700, fontSize: 13, background: cfg.bg, color: cfg.text }}>
              {r.risk_stage}
            </span>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
              탈락 유형: {r.dropout_type}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--border)', marginBottom: 20 }} role="tablist">
        {([
          { id: 'risk', label: '📊 위험도', ariaLabel: '위험도 탭' },
          { id: 'submissions', label: '📝 제출 이력', ariaLabel: '제출 이력 탭' },
          { id: 'interventions', label: '🛠️ 개입 이력', ariaLabel: '개입 이력 탭' },
          { id: 'notes', label: '🗒️ 메모', ariaLabel: '메모 탭' },
        ] as const).map(tab => (
          <button key={tab.id} role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 18px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 400,
              background: 'transparent',
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-sub)',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -2, transition: 'all 0.12s',
            }}
            aria-label={tab.ariaLabel}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Risk */}
      {activeTab === 'risk' && (
        <div id="tabpanel-risk" role="tabpanel" className="responsive-admin-grid-2">
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>최신 위험도 분석</h3>
            {r ? (
              <>
                {[
                  { label: '총 위험도',     val: r.total_risk,    max: 100, color: '#ef4444' },
                  { label: '기본 위험도',   val: r.base_risk,     max: 100, color: '#0ea5e9' },
                  { label: '이벤트 보너스', val: r.event_bonus,   max: 50,  color: '#f59e0b' },
                  { label: '사고력',        val: r.thinking_risk, max: 100, color: '#a855f7' },
                ].map(({ label, val, max, color }) => (
                  <div key={label} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                      <span style={{ color: 'var(--text-sub)' }}>{label}</span>
                      <span style={{ fontWeight: 700, color }}>{safeNumber(val).toFixed(1)}</span>
                    </div>
                    <div style={{ background: '#f1f5f9', borderRadius: 4, height: 6 }}>
                      <div style={{ height: '100%', borderRadius: 4, width: `${Math.min(100, (val / max) * 100)}%`, background: color, transition: 'width 0.7s ease' }} />
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-sub)' }}>
                  분석 시각: {new Date(r.calculated_at).toLocaleString('ko-KR')}
                </div>
              </>
            ) : <p style={{ color: 'var(--text-sub)', fontSize: 13 }}>분석 데이터 없음</p>}
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>위험도 추이</h3>
            {trendLoading ? (
              <div style={{ height: 120, background: '#f1f5f9', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
            ) : (
              <RiskTrendMini points={riskTrend} />
            )}
            <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 20, marginBottom: 12 }}>위험도 이력</h3>
            {detail.risk_history.length === 0 ? (
              <p style={{ color: 'var(--text-sub)', fontSize: 13 }}>이력 없음</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 200, overflowY: 'auto' }}>
                {detail.risk_history.map(rh => {
                  const c = STAGE_COLOR[rh.risk_stage] ?? STAGE_COLOR['안정'];
                  return (
                    <div key={rh.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 12,
                    }}>
                      <span style={{ fontWeight: 700, color: c.border }}>{safeNumber(rh.total_risk).toFixed(1)}</span>
                      <span style={{ padding: '1px 8px', borderRadius: 20, background: c.bg, color: c.text, fontSize: 11, fontWeight: 700 }}>
                        {rh.risk_stage}
                      </span>
                      <span style={{ color: 'var(--text-sub)', fontSize: 11 }}>
                        {new Date(rh.calculated_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>학습 패턴 요약</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
              {detail.pattern_summary.map((item, index) => (
                <div key={index} style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px', fontSize: 12 }}>{item}</div>
              ))}
              {detail.latest_failure_tags.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {detail.latest_failure_tags.map((tag, index) => (
                    <span key={`${tag}-${index}`} style={{ padding: '4px 8px', borderRadius: 20, background: '#fff7ed', color: '#9a3412', fontSize: 11, fontWeight: 700 }}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>추천 문제</h3>
              <Link
                to={`/interventions/new?student_id=${studentId}`}
                className="btn btn-ghost"
                style={{ padding: '5px 12px', fontSize: 12 }}
                aria-label="문제 추천 개입 생성"
              >
                + 문제 추천
              </Link>
            </div>
            {recommendLoading ? (
              <div style={{ height: 120, background: '#f1f5f9', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
            ) : recommendations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-sub)' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }} aria-hidden="true">🎯</div>
                <p style={{ fontSize: 13, marginBottom: 12 }}>아직 추천된 문제가 없습니다.</p>
                <Link
                  to={`/interventions/new?student_id=${studentId}`}
                  className="btn btn-primary"
                  style={{ padding: '7px 18px', fontSize: 13 }}
                >
                  문제 추천하기
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recommendations.map(rec => (
                  <div key={rec.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: 13 }}>{rec.problem_title}</span>
                      <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: '#fffbeb', color: '#92400e' }}>
                        🎯 추천
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-sub)' }}>
                        {new Date(rec.created_at).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.55, marginBottom: 8 }}>
                      {rec.problem_description}
                    </div>
                    {rec.reason && (
                      <div style={{ fontSize: 12, color: '#92400e', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
                        추천 사유: {rec.reason}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteRecommendation(rec.id)}
                      className="btn btn-ghost"
                      style={{ padding: '6px 12px', fontSize: 12 }}
                    >
                      추천 해제
                    </button>
                  </div>
                ))}
              </div>
            )}

            <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 20, marginBottom: 12 }}>자동 개입 추천</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {suggestions.length ? suggestions.map((item, index) => (
                <div key={index} className="card" style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 4 }}>{item.message}</div>
                </div>
              )) : <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>추천할 개입이 없습니다.</div>}
            </div>

            <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 20, marginBottom: 12 }}>추천 문제 효과</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recommendEffectItems.length ? recommendEffectItems.map(item => (
                <div key={item.recommendation_id} className="card" style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <strong style={{ fontSize: 13 }}>{item.problem_title}</strong>
                    <span style={{ fontSize: 11, color: item.attempted ? '#166534' : '#9a3412', fontWeight: 700 }}>{item.attempted ? '풂' : '미풀이'}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>시도 {item.submission_count}회 · 최근 점수 {item.latest_score ?? '—'}</div>
                </div>
              )) : <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>추천 효과 데이터가 없습니다.</div>}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Submissions */}
      {activeTab === 'submissions' && (
        <div id="tabpanel-submissions" role="tabpanel">
          {subLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1,2,3].map(i => <div key={i} style={{ height: 64, borderRadius: 10, background: '#e2e8f0', animation: 'pulse 1.5s infinite' }} />)}
            </div>
          ) : submissions.length === 0 ? (
            <div className="card" style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-sub)' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }} aria-hidden="true">📝</div>
              <p>제출 이력이 없습니다</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {submissions.map(sub => (
                <div key={sub.submission_id} className="card responsive-admin-row" style={{ padding: '14px 18px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{sub.problem_title ?? '자유 제출'}</div>
                    <p style={{
                      margin: 0, fontSize: 12, color: 'var(--text-sub)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{sub.prompt_text}</p>
                  </div>
                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: STAGE_COLOR[sub.risk_stage]?.border ?? '#ef4444' }}>
                      {safeNumber(sub.total_risk).toFixed(0)}점
                    </div>
                    <span style={{
                      padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: STAGE_COLOR[sub.risk_stage]?.bg ?? '#fee2e2',
                      color: STAGE_COLOR[sub.risk_stage]?.text ?? '#991b1b',
                    }}>{sub.risk_stage}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-sub)', textAlign: 'right', flexShrink: 0 }}>
                    {new Date(sub.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Interventions */}
      {activeTab === 'interventions' && (
        <div id="tabpanel-interventions" role="tabpanel" className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>개입 이력</h3>
            <Link to={`/interventions/new?student_id=${studentId}`} className="btn btn-ghost"
              style={{ padding: '5px 12px', fontSize: 12 }} aria-label="개입 추가">+ 추가</Link>
          </div>
          {detail.interventions.length === 0 ? (
            <p style={{ color: 'var(--text-sub)', fontSize: 13 }}>개입 이력 없음</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {detail.interventions.map(iv => {
                const ss = { pending: { bg: '#fef3c7', color: '#92400e' }, completed: { bg: '#d1fae5', color: '#065f46' }, cancelled: { bg: '#f1f5f9', color: '#64748b' } }[iv.status] ?? { bg: '#f1f5f9', color: '#64748b' };
                return (
                  <div key={iv.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{iv.type}</span>
                        <span style={{ padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: ss.bg, color: ss.color }}>{iv.status}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.5 }}>{iv.message}</p>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-sub)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {new Date(iv.created_at).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Notes */}
      {activeTab === 'notes' && (
        <div id="tabpanel-notes" role="tabpanel">
          {/* Add note form */}
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>메모 추가</h3>
            <form onSubmit={handleAddNote} noValidate>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="이 학생에 대한 메모를 입력하세요..."
                rows={3}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, resize: 'vertical', marginBottom: 10, boxSizing: 'border-box' }}
                aria-label="메모 내용"
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '8px 20px', fontSize: 13 }}
                disabled={noteSubmitting} aria-busy={noteSubmitting}>
                {noteSubmitting ? '저장 중...' : '메모 저장'}
              </button>
            </form>
          </div>

          {/* Notes list */}
          {notesLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1,2].map(i => <div key={i} style={{ height: 80, borderRadius: 10, background: '#e2e8f0', animation: 'pulse 1.5s infinite' }} />)}
            </div>
          ) : notes.length === 0 ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-sub)' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }} aria-hidden="true">🗒️</div>
              <p style={{ fontSize: 13 }}>메모가 없습니다. 위에서 첫 메모를 추가하세요.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {notes.map(note => (
                <div key={note.id} className="card" style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{note.content}</p>
                    <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 8 }}>
                      {new Date(note.created_at).toLocaleString('ko-KR')}
                    </div>
                  </div>
                  <button onClick={() => setDeleteNoteId(note.id)}
                    style={{ alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 16, padding: 4 }}
                    aria-label="메모 삭제">🗑️</button>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>활동 타임라인</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {timelineItems.length ? timelineItems.map((item, index) => (
                <div key={`${item.kind}-${index}-${item.created_at}`} className="card" style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <strong style={{ fontSize: 13 }}>{item.title}</strong>
                    <span style={{ fontSize: 11, color: 'var(--text-sub)' }}>{new Date(item.created_at).toLocaleDateString('ko-KR')}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 4 }}>{item.description}</div>
                </div>
              )) : <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>활동 타임라인이 없습니다.</div>}
            </div>
          </div>
        </div>
      )}

      {/* Delete Note Confirm */}
      {deleteNoteId && (
        <div className="modal-overlay" role="alertdialog" aria-modal="true" aria-label="메모 삭제 확인">
          <div className="card" style={{ width: '100%', maxWidth: 360, padding: '28px 28px 22px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }} aria-hidden="true">⚠️</div>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>메모를 삭제하시겠습니까?</h3>
            <p style={{ color: 'var(--text-sub)', fontSize: 13, marginBottom: 18 }}>삭제된 메모는 복구할 수 없습니다.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setDeleteNoteId(null)} className="btn btn-ghost" style={{ padding: '8px 20px' }}>취소</button>
              <button onClick={() => handleDeleteNote(deleteNoteId)}
                style={{ padding: '8px 22px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
