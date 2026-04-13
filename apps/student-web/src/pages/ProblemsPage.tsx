import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useDebounce } from '../hooks/useDebounce';
import type { Problem, ProblemListResponse, ProblemQueueResponse } from '../types';

const DIFF_CONFIG: Record<string, { color: string; bg: string; label: string; icon: string }> = {
  easy:   { color: '#065f46', bg: '#d1fae5', label: '쉬움',  icon: '🟢' },
  medium: { color: '#92400e', bg: '#fef3c7', label: '보통',  icon: '🟡' },
  hard:   { color: '#991b1b', bg: '#fee2e2', label: '어려움', icon: '🔴' },
};

const CAT_ICONS: Record<string, string> = {
  algorithm: '⚙️', math: '📐', science: '🔬', programming: '💻',
  ai: '🤖', writing: '✍️', logic: '🧠',
};

export default function ProblemsPage() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [queueMap, setQueueMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [diffFilter, setDiffFilter] = useState<string>('all');

  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    api.get<ProblemListResponse>('/student/problems')
      .then(r => setProblems(r.data.items))
      .finally(() => setLoading(false));
    api.get<ProblemQueueResponse>('/student/problem-queue')
      .then(r => setQueueMap(Object.fromEntries(r.data.items.map(item => [item.id, item.queue_reason]))))
      .catch(() => setQueueMap({}));
  }, []);

  const filtered = problems.filter(p =>
    (diffFilter === 'all' || p.difficulty === diffFilter) &&
    (p.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
     p.category.toLowerCase().includes(debouncedSearch.toLowerCase()))
  );
  const sortedProblems = [...filtered].sort((a, b) => {
    if (a.recommended && !b.recommended) return -1;
    if (!a.recommended && b.recommended) return 1;
    const aTime = a.recommended_at ? new Date(a.recommended_at).getTime() : 0;
    const bTime = b.recommended_at ? new Date(b.recommended_at).getTime() : 0;
    return bTime - aTime;
  });

  return (
    <div className="animate-in">
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
          <span aria-hidden="true">📝</span> 문제 목록
        </h1>
        <p style={{ color: 'var(--text-sub)', fontSize: 14 }}>
          문제를 선택하고 AI와 함께 풀어보세요
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: 240 }}>
          <span
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 16,
              pointerEvents: 'none',
            }}
            aria-hidden="true"
          >
            🔍
          </span>
          <input
            className="form-input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="제목 또는 카테고리 검색..."
            style={{ paddingLeft: 40 }}
            aria-label="문제 검색"
          />
        </div>
        <div className="responsive-actions" style={{ gap: 8 }}>
          {[
            { val: 'all', label: '전체' },
            { val: 'easy', label: '🟢 쉬움' },
            { val: 'medium', label: '🟡 보통' },
            { val: 'hard', label: '🔴 어려움' },
          ].map(({ val, label }) => (
            <button
              key={val}
              onClick={() => setDiffFilter(val)}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                border: '2px solid',
                borderColor: diffFilter === val ? 'var(--primary)' : 'var(--border)',
                background: diffFilter === val ? 'var(--primary-pale)' : '#fff',
                color: diffFilter === val ? 'var(--primary)' : 'var(--text-sub)',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              aria-pressed={diffFilter === val}
            >
              {label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 13, color: 'var(--text-sub)', whiteSpace: 'nowrap' }}>
          {sortedProblems.length}개
        </span>
      </div>

      {/* Problem cards */}
      {loading ? (
        <div style={{ display: 'grid', gap: 14 }}>
          {[1, 2, 3].map(i => (
            <div
              key={i}
              style={{
                height: 100,
                borderRadius: 14,
                background: '#e8eaf6',
                animation: 'pulse 1.5s infinite',
              }}
            />
          ))}
        </div>
      ) : sortedProblems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-sub)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }} aria-hidden="true">🔍</div>
          <p>해당 조건의 문제가 없습니다.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {sortedProblems.map((p) => {
            const diff = DIFF_CONFIG[p.difficulty] ?? { color: '#6b7280', bg: '#f3f4f6', label: p.difficulty, icon: '⬜' };
            const catIcon = CAT_ICONS[p.category] ?? '📚';
            return (
              <div
                key={p.id}
                style={{
                  background: '#fff',
                  borderRadius: 14,
                  boxShadow: 'var(--shadow)',
                  display: 'grid',
                  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
                  alignItems: 'center',
                  gap: 16,
                  padding: '20px 24px',
                  transition: 'all 0.18s',
                  border: '2px solid transparent',
                }}
                className="problem-card"
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                  (e.currentTarget as HTMLElement).style.borderColor = '#818cf8';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-hover)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow)';
                }}
              >
                {/* Category icon */}
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    fontSize: 24,
                    background: 'var(--primary-pale)',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  aria-hidden="true"
                >
                  {catIcon}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      marginBottom: 5,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 16 }}>{p.title}</span>
                    {p.recommended && (
                      <span
                        style={{
                          padding: '2px 10px',
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 800,
                          background: '#fff7ed',
                          color: '#c2410c',
                        }}
                      >
                        추천 문제
                      </span>
                    )}
                    <span
                      style={{
                        padding: '2px 10px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        background: diff.bg,
                        color: diff.color,
                      }}
                      aria-label={`난이도: ${diff.label}`}
                    >
                      <span aria-hidden="true">{diff.icon}</span> {diff.label}
                    </span>
                    <span
                      style={{
                        padding: '2px 10px',
                        borderRadius: 20,
                        fontSize: 11,
                        background: '#f0f0f8',
                        color: '#6b7280',
                      }}
                      aria-label={`카테고리: ${p.category}`}
                    >
                      {p.category}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: 'var(--text-sub)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {p.description}
                  </p>
                  {p.recommended && p.recommendation_reason && (
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: '#c2410c' }}>
                      추천 사유: {p.recommendation_reason}
                    </p>
                  )}
                  {queueMap[p.id] && (
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: '#4338ca' }}>
                      큐 이유: {queueMap[p.id]}
                    </p>
                  )}
                </div>

                {/* CTA */}
                <Link
                  to={`/problems/${p.id}/work`}
                  className="btn btn-primary"
                  style={{ padding: '9px 22px', fontSize: 14, flexShrink: 0 }}
                  aria-label={`${p.title} 문제 풀기`}
                >
                  풀기 →
                </Link>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          .problem-card {
            grid-template-columns: auto minmax(0, 1fr) !important;
            align-items: start !important;
          }

          .problem-card .btn {
            grid-column: 1 / -1;
            width: 100%;
            margin-top: 4px;
          }
        }

        @media (max-width: 560px) {
          .problem-card {
            grid-template-columns: 1fr !important;
            padding: 16px !important;
          }
        }
      `}</style>
    </div>
  );
}
