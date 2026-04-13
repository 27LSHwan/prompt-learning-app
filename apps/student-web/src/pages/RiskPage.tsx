import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { getUserId } from '../lib/auth';
import { unwrapRiskResponse } from '../lib/risk';
import RiskBadge from '../components/RiskBadge';
import RiskGauge from '../components/RiskGauge';
import type { RiskDetail, RiskStatusResponse } from '../types';

const STAGE_MSG: Record<string, { icon: string; title: string; desc: string; color: string }> = {
  '안정':   { icon: '🌱', title: '안정적인 상태예요',      desc: '지금처럼 꾸준히 학습을 이어가세요!',           color: '#10b981' },
  '경미':   { icon: '⚡', title: '가벼운 주의가 필요해요', desc: '학습 습관을 조금 점검해보세요.',               color: '#f59e0b' },
  '주의':   { icon: '🔶', title: '주의가 필요한 상태예요', desc: '학습 전략을 재검토하고 교수자에게 상담하세요.', color: '#f97316' },
  '고위험': { icon: '🚨', title: '즉각적인 도움이 필요해요', desc: '지금 바로 교수자와 상담하세요.',             color: '#ef4444' },
  '심각':   { icon: '🆘', title: '긴급 지원이 필요해요',    desc: '즉시 교수자에게 연락하세요.',                color: '#dc2626' },
};

const TYPE_LABEL: Record<string, string> = {
  cognitive: '인지적 어려움',
  motivational: '동기 저하',
  strategic: '전략 부재',
  sudden: '갑작스러운 변화',
  dependency: 'AI 과의존',
  compound: '복합 위험',
  none: '없음',
};

const safeNumber = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

export default function RiskPage() {
  const [risk, setRisk] = useState<RiskDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = getUserId();
    if (!id) return;
    api.get<RiskStatusResponse>('/student/risk')
      .then(r => setRisk(unwrapRiskResponse(r.data)))
      .catch(() => setRisk(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="animate-in">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>
          <span aria-hidden="true">📊</span> 위험도 상세
        </h1>
        <p style={{ color: 'var(--text-sub)', fontSize: 14 }}>
          나의 학습 위험도 분석 결과를 확인하세요
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-sub)' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              margin: '0 auto 16px',
              border: '4px solid #c7d2fe',
              borderTopColor: 'var(--primary)',
              animation: 'spin 0.8s linear infinite',
            }}
            aria-hidden="true"
          />
          분석 중...
        </div>
      ) : !risk ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 40px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }} aria-hidden="true">📭</div>
          <p style={{ color: 'var(--text-sub)', marginBottom: 20 }}>
            아직 위험도 분석 데이터가 없습니다.
          </p>
          <Link to="/problems" className="btn btn-primary" style={{ padding: '10px 24px' }}>
            <span aria-hidden="true">📝</span> 문제 풀러 가기
          </Link>
        </div>
      ) : (
        <>
          {/* Stage alert */}
          {(() => {
            const msg = STAGE_MSG[risk.risk_stage];
            return (
              <div
                style={{
                  borderRadius: 16,
                  padding: '20px 24px',
                  marginBottom: 24,
                  background: `${msg.color}12`,
                  border: `2px solid ${msg.color}40`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                }}
                aria-live="polite"
                role="status"
              >
                <span style={{ fontSize: 36 }} aria-hidden="true">{msg.icon}</span>
                <div>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 18,
                      color: msg.color,
                      marginBottom: 4,
                    }}
                  >
                    {msg.title}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text-sub)' }}>{msg.desc}</div>
                </div>
              </div>
            );
          })()}

          <div className="responsive-two-col" style={{ marginBottom: 20 }}>
            {/* Gauge */}
            <div
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '32px 24px',
                gap: 16,
              }}
            >
              <RiskGauge score={risk.total_risk} stage={risk.risk_stage} size={200} />
              <RiskBadge stage={risk.risk_stage} score={risk.total_risk} size="lg" />
            </div>

            {/* Breakdown bars */}
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>
                위험도 구성 요소
              </h3>
              {[
                {
                  label: '기본 위험도',
                  val: risk.base_risk,
                  max: 100,
                  color: '#4f46e5',
                  icon: '📊',
                },
                {
                  label: '이벤트 보너스',
                  val: risk.event_bonus,
                  max: 50,
                  color: '#f59e0b',
                  icon: '⚡',
                },
                {
                  label: '사고력 위험도',
                  val: risk.thinking_risk,
                  max: 100,
                  color: '#a855f7',
                  icon: '🧠',
                },
                {
                  label: '총 위험도',
                  val: risk.total_risk,
                  max: 100,
                  color: '#ef4444',
                  icon: '🎯',
                },
              ].map(({ label, val, max, color, icon }) => {
                const safeVal = safeNumber(val);
                return (
                <div key={label} style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span aria-hidden="true">{icon}</span>
                      <span style={{ color: 'var(--text-sub)' }}>{label}</span>
                    </span>
                    <span
                      style={{ fontWeight: 800, color, fontSize: 16 }}
                      aria-label={`${label}: ${safeVal.toFixed(1)}`}
                    >
                      {safeVal.toFixed(1)}
                    </span>
                  </div>
                  <div style={{ background: '#f0f0f8', borderRadius: 8, height: 10, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        borderRadius: 8,
                        width: `${Math.min(100, (safeVal / max) * 100)}%`,
                        background: `linear-gradient(90deg, ${color}66, ${color})`,
                        transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
                      }}
                      role="progressbar"
                      aria-valuenow={Math.round((safeVal / max) * 100)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={label}
                    />
                  </div>
                </div>
              );
              })}

              <div
                style={{
                  marginTop: 20,
                  padding: '14px 16px',
                  background: 'var(--primary-pale)',
                  borderRadius: 10,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 700 }}>
                  탈락 위험 유형
                </span>
                <span
                  style={{ fontWeight: 800, fontSize: 15, color: 'var(--primary)' }}
                  aria-label={`탈락 위험 유형: ${TYPE_LABEL[risk.dropout_type] ?? risk.dropout_type}`}
                >
                  {TYPE_LABEL[risk.dropout_type] ?? risk.dropout_type}
                </span>
              </div>
            </div>
          </div>

          <div
            className="card"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 20px',
              fontSize: 13,
            }}
          >
            <span style={{ color: 'var(--text-sub)' }}>
              <span aria-hidden="true">🕐</span> 마지막 분석: {new Date(risk.calculated_at).toLocaleString('ko-KR')}
            </span>
            <Link
              to="/recommend"
              className="btn btn-ghost"
              style={{ padding: '7px 16px', fontSize: 13 }}
            >
              <span aria-hidden="true">💡</span> 맞춤 추천 보기
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
