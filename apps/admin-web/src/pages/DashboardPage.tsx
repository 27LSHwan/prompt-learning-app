import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import RiskDistributionChart from '../components/RiskDistributionChart';
import type {
  DashboardResponse, RiskStage,
  DropoutTrendPoint, InterventionEffectItem, RecommendationEffectItem, ActivityLogListResponse, LearningPatternItem,
  InterventionPriorityItem, ProblemInsightItem, PromiReviewQueueItem,
} from '../types';

const STAGE_COLOR: Record<RiskStage, string> = {
  '안정': '#10b981', '경미': '#f59e0b', '주의': '#f97316', '고위험': '#ef4444', '심각': '#dc2626',
};

const DROPOUT_LABEL: Record<string, string> = {
  cognitive: '인지형', motivational: '동기형', strategic: '전략형',
  sudden: '급락형', dependency: '의존형', compound: '복합형', none: '없음',
};

const DROPOUT_COLORS = ['#0ea5e9', '#a855f7', '#f59e0b', '#ef4444', '#10b981', '#f97316'];

const safeNumber = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/* ── Mini Bar Chart for Dropout Trend ───────────────────────── */
function DropoutTrendChart({ points }: { points: DropoutTrendPoint[] }) {
  if (!points.length) return (
    <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-sub)' }}>
      <div style={{ fontSize: 24, marginBottom: 8 }} aria-hidden="true">📊</div>
      <p style={{ fontSize: 12 }}>데이터 없음</p>
    </div>
  );

  const byType: Record<string, number> = {
    cognitive: 0,
    motivational: 0,
    strategic: 0,
    sudden: 0,
    dependency: 0,
    compound: 0,
  };
  points.forEach(p => {
    byType.cognitive += p.cognitive;
    byType.motivational += p.motivational;
    byType.strategic += p.strategic;
    byType.sudden += p.sudden;
    byType.dependency += p.dependency;
    byType.compound += p.compound;
  });
  const entries = Object.entries(byType).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    return (
      <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-sub)' }}>
        <div style={{ fontSize: 24, marginBottom: 8 }} aria-hidden="true">📊</div>
        <p style={{ fontSize: 12 }}>데이터 없음</p>
      </div>
    );
  }
  const maxVal  = Math.max(...entries.map(e => e[1]), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {entries.map(([type, count], i) => (
        <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 70, fontSize: 11, color: 'var(--text-sub)', textAlign: 'right', flexShrink: 0 }}>
            {DROPOUT_LABEL[type] ?? type}
          </div>
          <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 4, height: 10 }}>
            <div style={{
              height: '100%', borderRadius: 4,
              width: `${(count / maxVal) * 100}%`,
              background: DROPOUT_COLORS[i % DROPOUT_COLORS.length],
              transition: 'width 0.7s ease',
            }} />
          </div>
          <div style={{ width: 28, fontSize: 11, fontWeight: 700, textAlign: 'right', flexShrink: 0,
            color: DROPOUT_COLORS[i % DROPOUT_COLORS.length] }}>
            {count}
          </div>
        </div>
      ))}
    </div>
  );
}
/* ── Intervention Effect Table ───────────────────────────────── */
function InterventionEffectChart({ items }: { items: InterventionEffectItem[] }) {
  if (!items.length) return (
    <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-sub)' }}>
      <p style={{ fontSize: 12 }}>데이터 없음</p>
    </div>
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            {['학생', '개입 유형', '위험도 변화', '점수 변화', '제출 변화', '시각'].map(h => (
              <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text-sub)', borderBottom: '1px solid var(--border)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map(item => {
            const riskDelta = typeof item.delta === 'number' && Number.isFinite(item.delta) ? item.delta : null;
            const scoreDelta = typeof item.score_delta === 'number' && Number.isFinite(item.score_delta) ? item.score_delta : null;
            return (
              <tr key={item.intervention_id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '9px 10px', fontWeight: 600 }}>{item.username}</td>
                <td style={{ padding: '9px 10px' }}>{item.intervention_type}</td>
                <td style={{ padding: '9px 10px' }}>
                  {riskDelta !== null ? <span style={{ color: riskDelta > 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>{riskDelta > 0 ? '▼' : '▲'} {Math.abs(riskDelta).toFixed(1)}</span> : <span style={{ color: 'var(--text-sub)' }}>—</span>}
                </td>
                <td style={{ padding: '9px 10px' }}>
                  {scoreDelta !== null ? <span style={{ color: scoreDelta >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>{scoreDelta >= 0 ? '+' : ''}{scoreDelta.toFixed(1)}</span> : <span style={{ color: 'var(--text-sub)' }}>—</span>}
                </td>
                <td style={{ padding: '9px 10px', color: 'var(--text-sub)' }}>
                  {item.submissions_before} → {item.submissions_after} ({item.tracking_days}일)
                </td>
                <td style={{ padding: '9px 10px', color: 'var(--text-sub)' }}>{new Date(item.created_at).toLocaleDateString('ko-KR')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
/* ── Main Component ──────────────────────────────────────────── */
export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData]         = useState<DashboardResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [dropoutTrend, setDropoutTrend]   = useState<DropoutTrendPoint[]>([]);
  const [effectItems, setEffectItems]     = useState<InterventionEffectItem[]>([]);
  const [recommendationEffectItems, setRecommendationEffectItems] = useState<RecommendationEffectItem[]>([]);
  const [activityItems, setActivityItems] = useState<ActivityLogListResponse['items']>([]);
  const [patternItems, setPatternItems] = useState<LearningPatternItem[]>([]);
  const [priorityItems, setPriorityItems] = useState<InterventionPriorityItem[]>([]);
  const [problemInsights, setProblemInsights] = useState<ProblemInsightItem[]>([]);
  const [promiReviewItems, setPromiReviewItems] = useState<PromiReviewQueueItem[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  const fetchDashboard = async () => {
    try {
      const res = await api.get<DashboardResponse>('/admin/dashboard');
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const [dropoutRes, effectRes, recommendationRes, activityRes, patternRes, priorityRes, insightRes, promiReviewRes] = await Promise.allSettled([
        api.get<{ points: DropoutTrendPoint[] }>('/admin/analytics/dropout-trend?days=30'),
        api.get<{ items: InterventionEffectItem[] }>('/admin/analytics/intervention-effect'),
        api.get<{ items: RecommendationEffectItem[] }>('/admin/analytics/recommendation-effect'),
        api.get<ActivityLogListResponse>('/admin/activity-logs'),
        api.get<{ items: LearningPatternItem[] }>('/admin/analytics/learning-patterns'),
        api.get<{ items: InterventionPriorityItem[] }>('/admin/intervention-priority-queue'),
        api.get<{ items: ProblemInsightItem[] }>('/admin/analytics/problem-insights'),
        api.get<{ items: PromiReviewQueueItem[] }>('/admin/promi-review-queue'),
      ]);
      if (dropoutRes.status === 'fulfilled') setDropoutTrend(dropoutRes.value.data.points ?? []);
      if (effectRes.status === 'fulfilled') setEffectItems(effectRes.value.data.items ?? []);
      if (recommendationRes.status === 'fulfilled') setRecommendationEffectItems(recommendationRes.value.data.items ?? []);
      if (activityRes.status === 'fulfilled') setActivityItems(activityRes.value.data.items ?? []);
      if (patternRes.status === 'fulfilled') setPatternItems(patternRes.value.data.items ?? []);
      if (priorityRes.status === 'fulfilled') setPriorityItems(priorityRes.value.data.items ?? []);
      if (insightRes.status === 'fulfilled') setProblemInsights(insightRes.value.data.items ?? []);
      if (promiReviewRes.status === 'fulfilled') setPromiReviewItems(promiReviewRes.value.data.items ?? []);
    } catch { /* silent */ }
    finally { setAnalyticsLoading(false); }
  };

  const reviewPromi = async (logId: string, status: 'approved' | 'needs_prompt_update' | 'follow_up_student') => {
    const res = await api.post<{ ok: boolean; status: string; intervention_id?: string | null; action: string }>(`/admin/promi-review-queue/${logId}/review`, { status });
    setPromiReviewItems(prev => prev.filter(item => item.log_id !== logId));
    if (status === 'follow_up_student' && res.data.intervention_id) {
      navigate(`/interventions-list?detail=${encodeURIComponent(res.data.intervention_id)}`);
    }
  };

  useEffect(() => {
    fetchDashboard();
    fetchAnalytics();
    const timer = setInterval(fetchDashboard, 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="animate-in">
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>대시보드</h1>
          <p style={{ color: 'var(--text-sub)', fontSize: 13 }}>
            학습자 현황을 한눈에 파악하세요 · {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-sub)', display: 'flex', alignItems: 'center', gap: 6 }} aria-live="polite">
          <span style={{ fontSize: 8 }}>●</span>
          🔄 자동 새로고침 중
        </div>
      </div>

      {loading ? (
        <div className="responsive-admin-grid-3" style={{ marginBottom: 20 }}>
          {[1,2,3].map(i => <div key={i} style={{ height: 100, borderRadius: 12, background: '#e2e8f0', animation: 'pulse 1.5s infinite' }} />)}
        </div>
      ) : data ? (
        <>
          {/* KPI Row */}
          <div className="responsive-admin-grid-3" style={{ marginBottom: 20 }}
            aria-live="polite" aria-label="주요 성과 지표">
            <KpiCard icon="👥" label="전체 학생"   value={data.total_students}       trend="+최신" color="#0ea5e9" />
            <KpiCard icon="🚨" label="고위험 이상" value={data.high_risk_count}       trend={data.high_risk_count > 0 ? '주의 필요' : '양호'} color="#ef4444" danger={data.high_risk_count > 0} />
            <KpiCard icon="📋" label="미처리 개입" value={data.pending_interventions} trend="처리 필요" color="#f59e0b" danger={data.pending_interventions > 0} />
          </div>

          <div className="responsive-admin-grid-2" style={{ marginBottom: 20 }}>
            <div className="card" style={{ padding: '20px 22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ fontSize: 14, fontWeight: 800 }}>개입 우선순위 큐</h3>
                <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 800 }}>오늘 볼 학생 {priorityItems.length}명</span>
              </div>
              {analyticsLoading ? <div style={{ height: 120, background: '#f1f5f9', borderRadius: 8 }} /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {priorityItems.slice(0, 5).map(item => (
                    <Link key={item.student_id} to={`/students/${item.student_id}`} style={{ textDecoration: 'none', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                        <strong style={{ fontSize: 13, color: 'var(--text)' }}>{item.username}</strong>
                        <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 900 }}>{item.priority_score}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                        {item.reasons.map((reason, index) => <span key={`${item.student_id}-${index}`} style={{ fontSize: 11, color: '#9a3412', background: '#fff7ed', borderRadius: 20, padding: '3px 8px' }}>{reason}</span>)}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>추천 액션: {item.recommended_action}</div>
                    </Link>
                  ))}
                  {!priorityItems.length && <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>우선 개입 대상이 없습니다.</div>}
                </div>
              )}
            </div>

            <div className="card" style={{ padding: '20px 22px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>프롬이 코칭 품질 리뷰 큐</h3>
              {analyticsLoading ? <div style={{ height: 120, background: '#f1f5f9', borderRadius: 8 }} /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {promiReviewItems.slice(0, 4).map(item => (
                    <div key={item.log_id} style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                        <strong style={{ fontSize: 13 }}>{item.username} · {item.problem_title}</strong>
                        <span style={{ fontSize: 11, color: '#9a3412', fontWeight: 800 }}>{item.flags[0]}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.55, marginBottom: 8 }}>{item.message}</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => reviewPromi(item.log_id, 'approved')} className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 11 }}>승인</button>
                        <button type="button" onClick={() => reviewPromi(item.log_id, 'needs_prompt_update')} className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 11 }}>프롬이 규칙 개선</button>
                        <button type="button" onClick={() => reviewPromi(item.log_id, 'follow_up_student')} className="btn btn-primary" style={{ padding: '5px 10px', fontSize: 11 }}>학생 개입</button>
                      </div>
                    </div>
                  ))}
                  {!promiReviewItems.length && <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>검토할 코칭이 없습니다.</div>}
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ padding: '20px 22px', marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>문제별 운영 인사이트</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
              {problemInsights.slice(0, 6).map(item => (
                <div key={item.problem_id} style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: '#4338ca', marginBottom: 8 }}>
                    평균 {item.average_score} · 제출 {item.submission_count} · 실행 {item.run_count}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.55 }}>{item.insight}</div>
                  <div style={{ marginTop: 8, fontSize: 12, color: '#166534', fontWeight: 700 }}>운영 액션: {item.recommended_action}</div>
                </div>
              ))}
              {!problemInsights.length && <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>문제 인사이트 데이터가 없습니다.</div>}
            </div>
          </div>

          {data.pattern_summary.length > 0 && (
            <div className="card" style={{ padding: '18px 22px', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>학습 패턴 요약</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {data.pattern_summary.map(item => (
                  <span key={item} style={{ padding: '6px 10px', borderRadius: 20, background: '#eef2ff', color: '#4338ca', fontSize: 12, fontWeight: 700 }}>{item}</span>
                ))}
              </div>
            </div>
          )}

          {/* Charts Row 1: Distribution + High Risk */}
          <div className="responsive-admin-grid-2" style={{ marginBottom: 16 }}>
            <div className="card" style={{ padding: '20px 22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>📊 위험도 분포</h3>
                <Link to="/students" style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>전체 보기 →</Link>
              </div>
              <RiskDistributionChart data={data.risk_distribution} />
            </div>

            <div className="card" style={{ padding: '20px 22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>🚨 고위험 학생</h3>
                <Link to="/students" style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>전체 →</Link>
              </div>
              {data.recent_high_risk.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-sub)' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }} aria-hidden="true">🌟</div>
                  <p style={{ fontSize: 13 }}>고위험 학생이 없습니다</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.recent_high_risk.slice(0, 5).map(s => (
                    <Link key={s.student_id} to={`/students/${s.student_id}`} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 12px', borderRadius: 8, background: '#f8fafc',
                      transition: 'all 0.12s', border: '1px solid transparent',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f0f9ff'; (e.currentTarget as HTMLElement).style.borderColor = '#bae6fd'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#f8fafc'; (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 10,
                        background: `${STAGE_COLOR[s.risk_stage] ?? '#9ca3af'}20`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: 13, color: STAGE_COLOR[s.risk_stage],
                      }}>
                        {safeNumber(s.total_risk).toFixed(0)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{s.username}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-sub)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.email}
                        </div>
                      </div>
                      <span style={{
                        padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: `${STAGE_COLOR[s.risk_stage]}20`,
                        color: STAGE_COLOR[s.risk_stage],
                      }}>{s.risk_stage}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Charts Row 2: Dropout Trend + Intervention Effect */}
          <div className="responsive-admin-grid-2" style={{ marginBottom: 20 }}>
            <div className="card" style={{ padding: '20px 22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>📈 탈락 유형 분포 (30일)</h3>
              </div>
              {analyticsLoading ? (
                <div style={{ height: 120, background: '#f1f5f9', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
              ) : (
                <DropoutTrendChart points={dropoutTrend} />
              )}
            </div>

            <div className="card" style={{ padding: '20px 22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>🛠️ 개입 효과 분석</h3>
                <Link to="/interventions-list" style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>상세 →</Link>
              </div>
              {analyticsLoading ? (
                <div style={{ height: 120, background: '#f1f5f9', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
              ) : (
                <InterventionEffectChart items={effectItems} />
              )}
            </div>
          </div>

          <div className="responsive-admin-grid-2" style={{ marginBottom: 20 }}>
            <div className="card" style={{ padding: '20px 22px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>추천 문제 효과</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recommendationEffectItems.length ? recommendationEffectItems.slice(0, 6).map(item => (
                  <div key={item.recommendation_id} style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <strong style={{ fontSize: 13 }}>{item.username}</strong>
                      <span style={{ fontSize: 11, color: item.attempted ? '#166534' : '#9a3412', fontWeight: 800 }}>{item.attempted ? '풂' : '미풀이'}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>{item.problem_title}</div>
                  </div>
                )) : <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>데이터 없음</div>}
              </div>
            </div>

            <div className="card" style={{ padding: '20px 22px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>최근 활동 로그</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {activityItems.length ? activityItems.slice(0, 8).map(item => (
                  <div key={item.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{item.username} · {item.action}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>{item.message}</div>
                  </div>
                )) : <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>데이터 없음</div>}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '20px 22px', marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>학생별 학습 패턴</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              {patternItems.slice(0, 6).map(item => (
                <div key={item.student_id} style={{ background: '#f8fafc', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{item.username}</div>
                  <div style={{ fontSize: 11, color: '#4338ca', margin: '4px 0' }}>{item.pattern_group}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.5 }}>{item.summary}</div>
                </div>
              ))}
            </div>
          </div>

        </>
      ) : (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-sub)' }}>
          데이터를 불러올 수 없습니다.
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, trend, color, danger = false }: {
  icon: string; label: string; value: number; trend: string; color: string; danger?: boolean;
}) {
  return (
    <div className="card" style={{ padding: '18px 20px', borderLeft: `4px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: 'var(--text-sub)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </span>
        <span style={{ fontSize: 20 }} aria-hidden="true">{icon}</span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, marginTop: 6, color: danger ? '#ef4444' : '#10b981', fontWeight: 600 }}>
        {trend}
      </div>
    </div>
  );
}
