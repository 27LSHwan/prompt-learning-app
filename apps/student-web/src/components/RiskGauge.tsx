import type { RiskStage } from '../types';

interface Props { score: number; stage: RiskStage; size?: number; }

const STAGE_CONFIG: Record<RiskStage, { color: string; glow: string; label: string }> = {
  '안정':   { color: '#10b981', glow: 'rgba(16,185,129,0.3)',  label: '안전' },
  '경미':   { color: '#f59e0b', glow: 'rgba(245,158,11,0.3)',  label: '주의' },
  '주의':   { color: '#f97316', glow: 'rgba(249,115,22,0.3)',  label: '위험' },
  '고위험': { color: '#ef4444', glow: 'rgba(239,68,68,0.3)',   label: '고위험' },
  '심각':   { color: '#dc2626', glow: 'rgba(220,38,38,0.4)',   label: '심각' },
};

export default function RiskGauge({ score, stage, size = 160 }: Props) {
  const cfg = STAGE_CONFIG[stage] ?? STAGE_CONFIG['안정'];
  const r   = (size / 2) * 0.72;
  const cx  = size / 2;
  const cy  = size / 2 + 10;
  const strokeW = size * 0.09;
  const circumference = Math.PI * r;
  const pct = Math.min(100, Math.max(0, score)) / 100;
  const dashOffset = circumference * (1 - pct);
  const h = cy + strokeW / 2 + 4;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <svg width={size} height={h} viewBox={`0 0 ${size} ${h}`}>
        <defs>
          <filter id={`glow-${stage}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id={`grad-${stage}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={cfg.color} stopOpacity="0.6" />
            <stop offset="100%" stopColor={cfg.color} />
          </linearGradient>
        </defs>

        {/* Track */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="#e8eaf6" strokeWidth={strokeW} strokeLinecap="round"
        />

        {/* Fill arc */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={`url(#grad-${stage})`}
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          filter={`url(#glow-${stage})`}
          style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(0.4,0,0.2,1)' }}
        />

        {/* Center circle */}
        <circle cx={cx} cy={cy} r={r * 0.46} fill="white"
          style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.08))' }} />

        {/* Score */}
        <text x={cx} y={cy - 2} textAnchor="middle"
          fontSize={size * 0.195} fontWeight="800" fill={cfg.color}>
          {score.toFixed(0)}
        </text>
        <text x={cx} y={cy + size * 0.135} textAnchor="middle"
          fontSize={size * 0.1} fill="#9ca3af" fontWeight="500">
          / 100
        </text>

        {/* Left label */}
        <text x={cx - r - 4} y={cy + 16} textAnchor="middle"
          fontSize={size * 0.085} fill="#c7d2fe">0</text>
        {/* Right label */}
        <text x={cx + r + 4} y={cy + 16} textAnchor="middle"
          fontSize={size * 0.085} fill="#fca5a5">100</text>
      </svg>

      {/* Stage pill under gauge */}
      <div style={{
        textAlign: 'center', marginTop: -4,
        fontSize: size * 0.09, fontWeight: 700, color: cfg.color,
        letterSpacing: '0.05em',
      }}>
        {cfg.label} 단계
      </div>
    </div>
  );
}
