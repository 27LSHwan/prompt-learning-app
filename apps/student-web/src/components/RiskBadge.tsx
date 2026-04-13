import type { RiskStage } from '../types';

interface Props { stage: RiskStage; score?: number; size?: 'sm' | 'md' | 'lg'; }

const STAGE_CONFIG: Record<RiskStage, { color: string; bg: string; border: string; icon: string }> = {
  '안정':   { color: '#065f46', bg: '#d1fae5', border: '#6ee7b7', icon: '✅' },
  '경미':   { color: '#92400e', bg: '#fef3c7', border: '#fcd34d', icon: '⚠️' },
  '주의':   { color: '#9a3412', bg: '#ffedd5', border: '#fdba74', icon: '🔶' },
  '고위험': { color: '#991b1b', bg: '#fee2e2', border: '#fca5a5', icon: '🚨' },
  '심각':   { color: '#fff',    bg: '#7f1d1d', border: '#991b1b', icon: '🆘' },
};

const SIZE = {
  sm: { padding: '2px 9px',  fontSize: 11 },
  md: { padding: '5px 13px', fontSize: 13 },
  lg: { padding: '8px 18px', fontSize: 15 },
};

export default function RiskBadge({ stage, score, size = 'md' }: Props) {
  const cfg = STAGE_CONFIG[stage] ?? STAGE_CONFIG['안정'];
  const sz  = SIZE[size];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: sz.padding,
      background: cfg.bg, color: cfg.color,
      border: `1.5px solid ${cfg.border}`,
      borderRadius: 20, fontWeight: 700, fontSize: sz.fontSize,
    }}>
      <span>{cfg.icon}</span>
      {stage}
      {score !== undefined && (
        <span style={{ opacity: 0.75, fontWeight: 500 }}>{score.toFixed(0)}점</span>
      )}
    </span>
  );
}
