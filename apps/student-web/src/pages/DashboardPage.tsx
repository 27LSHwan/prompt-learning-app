import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { unwrapRiskResponse } from '../lib/risk';
import RiskBadge from '../components/RiskBadge';
import RiskGauge from '../components/RiskGauge';
import type { ActivityLogItem, GrowthTimelineResponse, ProblemQueueResponse, RiskDetail, RiskStatusResponse, WeaknessReportResponse, WeeklyReportResponse } from '../types';

interface WeaknessPatternItem {
  criterion: string;
  miss_count: number;
  last_seen_days_ago: number;
}

interface WeaknessPatternResponse {
  patterns: WeaknessPatternItem[];
  total_submissions: number;
}

const safeNumber = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

function TimelineChart({ points }: { points: GrowthTimelineResponse['points'] }) {
  if (!points.length) {
    return <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>제출 이력이 쌓이면 성장 그래프가 표시됩니다.</div>;
  }

  const width = 420;
  const height = 140;
  const pad = 20;
  const maxScore = Math.max(...points.map(point => point.best_score), 1);
  const toX = (index: number) => pad + (index / Math.max(points.length - 1, 1)) * (width - pad * 2);
  const toY = (score: number) => height - pad - (score / maxScore) * (height - pad * 2);
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${toX(index)} ${toY(point.best_score)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', maxWidth: width }}>
      <path d={path} fill="none" stroke="#4f46e5" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((point, index) => (
        <circle key={point.date} cx={toX(index)} cy={toY(point.best_score)} r={4} fill="#4f46e5" />
      ))}
    </svg>
  );
}

export default function DashboardPage() {
  const [risk, setRisk] = useState<RiskDetail | null>(null);
  const [timeline, setTimeline] = useState<GrowthTimelineResponse | null>(null);
  const [weakness, setWeakness] = useState<WeaknessReportResponse | null>(null);
  const [queue, setQueue] = useState<ProblemQueueResponse | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([]);
  const [weaknessPattern, setWeaknessPattern] = useState<WeaknessPatternResponse | null>(null);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReportResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.get<RiskStatusResponse>('/student/risk'),
      api.get<GrowthTimelineResponse>('/student/growth-timeline'),
      api.get<WeaknessReportResponse>('/student/weakness-report'),
      api.get<ProblemQueueResponse>('/student/problem-queue'),
      api.get<ActivityLogItem[]>('/student/activity-logs?limit=6'),
      api.get<WeaknessPatternResponse>('/student/weakness-pattern'),
      api.get<WeeklyReportResponse>('/student/weekly-report'),
    ]).then(results => {
      if (results[0].status === 'fulfilled') setRisk(unwrapRiskResponse(results[0].value.data));
      if (results[1].status === 'fulfilled') setTimeline(results[1].value.data);
      if (results[2].status === 'fulfilled') setWeakness(results[2].value.data);
      if (results[3].status === 'fulfilled') setQueue(results[3].value.data);
      if (results[4].status === 'fulfilled') setActivityLogs(results[4].value.data);
      if (results[5].status === 'fulfilled') setWeaknessPattern(results[5].value.data);
      if (results[6].status === 'fulfilled') setWeeklyReport(results[6].value.data);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="animate-in">
      <div style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', borderRadius: 20, padding: '32px 36px', marginBottom: 28, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ opacity: 0.8, fontSize: 14, marginBottom: 6 }}>안녕하세요</p>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>오늘도 성장 흐름을 확인해보세요</h1>
          <p style={{ opacity: 0.75, fontSize: 14 }}>문제별 점수와 제출 추이를 같이 볼 수 있습니다</p>
        </div>
        <div style={{ fontSize: 72 }} aria-hidden="true">🚀</div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>자동 주간 학습 리포트</h3>
              <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 4 }}>{weeklyReport?.period_label ?? '최근 7일'} 기준</div>
            </div>
            <span style={{ padding: '5px 10px', borderRadius: 20, background: '#eef2ff', color: '#4338ca', fontSize: 12, fontWeight: 800 }}>
              평균 {safeNumber(weeklyReport?.average_score).toFixed(1)}
            </span>
          </div>
          {weeklyReport ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                <div style={{ background: '#f8faff', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px' }}><div style={{ fontSize: 11, color: 'var(--text-sub)' }}>제출</div><strong>{weeklyReport.submission_count}회</strong></div>
                <div style={{ background: '#f8faff', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px' }}><div style={{ fontSize: 11, color: 'var(--text-sub)' }}>최고점</div><strong>{weeklyReport.best_score}</strong></div>
                <div style={{ background: '#f8faff', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px' }}><div style={{ fontSize: 11, color: 'var(--text-sub)' }}>변화</div><strong>{weeklyReport.score_delta == null ? '—' : `${weeklyReport.score_delta > 0 ? '+' : ''}${weeklyReport.score_delta}`}</strong></div>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.7 }}><strong>좋아진 점:</strong> {weeklyReport.strength}</div>
              <div style={{ fontSize: 13, lineHeight: 1.7 }}><strong>반복 실수:</strong> {weeklyReport.repeated_mistake}</div>
              <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: '12px 14px', fontSize: 13, color: '#9a3412', lineHeight: 1.7 }}>
                다음 액션: {weeklyReport.next_action}
              </div>
            </div>
          ) : <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>리포트를 불러오는 중입니다.</div>}
        </div>
      </div>

      {/* 반복 실수 패턴 카드 */}
      <div className="card" style={{ padding: '24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>📌 자주 놓치는 항목</h3>
          {weaknessPattern && (
            <span style={{ fontSize: 11, color: 'var(--text-sub)' }}>
              최근 {weaknessPattern.total_submissions}개 제출 분석 기준
            </span>
          )}
        </div>
        {loading ? (
          <div style={{ display: 'flex', gap: 12 }}>
            {[1,2,3].map(i => <div key={i} style={{ height: 64, flex: '1 1 160px', borderRadius: 12, background: '#fef9ee' }} />)}
          </div>
        ) : weaknessPattern && weaknessPattern.patterns.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {weaknessPattern.patterns.map((p, idx) => {
              const severity = p.miss_count >= 3 ? '#ef4444' : p.miss_count >= 2 ? '#f59e0b' : '#f59e0b';
              const severityBg = p.miss_count >= 3 ? '#fef2f2' : '#fffbeb';
              const severityBorder = p.miss_count >= 3 ? '#fca5a5' : '#fcd34d';
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: severityBg, border: `1px solid ${severityBorder}`, borderRadius: 12, padding: '12px 16px', flex: '1 1 200px' }}>
                  <span style={{ background: severity, color: '#fff', borderRadius: 8, padding: '3px 9px', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {p.miss_count}회
                  </span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>{p.criterion}</div>
                    <div style={{ fontSize: 11, color: '#b45309', marginTop: 2 }}>
                      {p.last_seen_days_ago === 0 ? '⚠️ 오늘도 놓쳤어요' : `최근 ${p.last_seen_days_ago}일 전에도 누락`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : weaknessPattern ? (
          <div style={{ fontSize: 13, color: '#10b981', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>✅</span> 최근 제출에서 반복 실수가 없어요. 잘 하고 있어요!
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>아직 분석할 제출 이력이 부족해요.</div>
        )}
      </div>

      <div className="responsive-two-col" style={{ marginBottom: 24 }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '28px' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, alignSelf: 'flex-start' }}>현재 위험도</h3>
          {loading ? <div style={{ height: 160, width: '100%', borderRadius: 8, background: '#eef2ff' }} /> : risk ? (
            <>
              <RiskGauge score={risk.total_risk} stage={risk.risk_stage} size={180} />
              <RiskBadge stage={risk.risk_stage} score={risk.total_risk} size="lg" />
            </>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>문제를 제출하면 분석됩니다.</div>
          )}
        </div>

        <div className="card" style={{ padding: '28px' }}>
          <h3 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 700 }}>성장 타임라인</h3>
          <TimelineChart points={timeline?.points ?? []} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginTop: 16 }}>
            {[
              { label: '총 제출 수', value: timeline?.total_submissions ?? 0 },
              { label: '평균 점수', value: timeline?.average_score ?? 0 },
              { label: '최고 점수', value: timeline?.best_score ?? 0 },
            ].map(item => (
              <div key={item.label} style={{ background: '#f8faff', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-sub)' }}>{item.label}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#4338ca' }}>{safeNumber(item.value).toFixed(1).replace('.0', '')}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-sub)' }}>도움 포인트 {timeline?.helper_points ?? 0}점</div>
        </div>
      </div>

      <div className="responsive-two-col" style={{ marginBottom: 24 }}>
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>개인 약점 리포트</h3>
          {weakness?.items?.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {weakness.items.slice(0, 4).map(item => (
                <div key={item.tag} style={{ background: '#f8faff', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                    <strong style={{ fontSize: 13 }}>{item.label}</strong>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#4338ca' }}>{item.count}회</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.6 }}>{item.recommendation}</div>
                </div>
              ))}
              {weakness.strongest_area && <div style={{ fontSize: 12, color: '#166534' }}>강점: {weakness.strongest_area}</div>}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>제출이 쌓이면 개인 약점 패턴을 보여줍니다.</div>
          )}
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>다음 문제 큐</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(queue?.items ?? []).slice(0, 4).map(item => (
              <Link key={item.id} to={`/problems/${item.id}/work`} style={{ background: '#f8faff', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', textDecoration: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
                  <strong style={{ color: 'var(--text)', fontSize: 13 }}>{item.title}</strong>
                  <span style={{ fontSize: 11, color: '#4338ca', fontWeight: 800 }}>{item.priority_score.toFixed(0)}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>{item.queue_reason}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '24px', marginBottom: 28 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700 }}>최근 활동</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {activityLogs.length ? activityLogs.map(log => (
            <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
              <div style={{ fontSize: 13 }}>{log.message}</div>
              <div style={{ fontSize: 11, color: 'var(--text-sub)', whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleDateString('ko-KR')}</div>
            </div>
          )) : <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>아직 기록된 활동이 없습니다.</div>}
        </div>
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>빠른 메뉴</h2>
      <div className="responsive-four-col" style={{ marginBottom: 28 }}>
        {[
          { to: '/problems', icon: '📝', title: '문제 풀기', desc: '랭킹과 프롬이 코칭 확인', color: '#4f46e5' },
          { to: '/risk', icon: '📊', title: '위험도 상세', desc: '분석 결과 보기', color: '#a855f7' },
          { to: '/history', icon: '📋', title: '제출 이력', desc: '점수 변화 확인', color: '#0891b2' },
          { to: '/recommend', icon: '💡', title: '맞춤 추천', desc: '다음 학습 보기', color: '#059669' },
        ].map(({ to, icon, title, desc, color }) => (
          <Link key={to} to={to} style={{ background: '#fff', borderRadius: 14, padding: '20px', boxShadow: 'var(--shadow)', textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 8, border: '2px solid transparent' }}>
            <span style={{ fontSize: 28, background: `${color}15`, borderRadius: 10, width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 2 }}>{title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>{desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
