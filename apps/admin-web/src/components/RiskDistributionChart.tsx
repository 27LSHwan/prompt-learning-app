import type { RiskDistribution, RiskStage } from '../types';

interface Props { data: RiskDistribution[]; compact?: boolean; }

const STAGE_CONFIG: Record<RiskStage, { color: string; bg: string; border: string }> = {
  '안정':   { color: '#065f46', bg: '#d1fae5', border: '#10b981' },
  '경미':   { color: '#92400e', bg: '#fef3c7', border: '#f59e0b' },
  '주의':   { color: '#9a3412', bg: '#ffedd5', border: '#f97316' },
  '고위험': { color: '#991b1b', bg: '#fee2e2', border: '#ef4444' },
  '심각':   { color: '#fff',    bg: '#7f1d1d', border: '#dc2626' },
};

const ALL_STAGES: RiskStage[] = ['안정', '경미', '주의', '고위험', '심각'];

export default function RiskDistributionChart({ data, compact = false }: Props) {
  const countMap = Object.fromEntries(data.map(d => [d.stage, d.count]));
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const maxCount = Math.max(...ALL_STAGES.map(s => countMap[s] ?? 0), 1);

  return (
    <div>
      {ALL_STAGES.map(stage => {
        const count = countMap[stage] ?? 0;
        const pct   = Math.round((count / total) * 100);
        const cfg   = STAGE_CONFIG[stage];
        return (
          <div key={stage} style={{ marginBottom: compact ? 10 : 14 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: compact ? 3 : 5,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}44`,
                }}>
                  {stage}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: cfg.border, minWidth: 24, textAlign: 'right' }}>
                  {count}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-sub)', minWidth: 32 }}>
                  {pct}%
                </span>
              </div>
            </div>
            <div style={{ background: '#f1f5f9', borderRadius: 6, height: compact ? 6 : 9, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 6,
                width: `${(count / maxCount) * 100}%`,
                background: `linear-gradient(90deg, ${cfg.border}88, ${cfg.border})`,
                transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)',
                minWidth: count > 0 ? 4 : 0,
              }} />
            </div>
          </div>
        );
      })}
      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-sub)', textAlign: 'right' }}>
        전체 {total}명
      </div>
    </div>
  );
}
