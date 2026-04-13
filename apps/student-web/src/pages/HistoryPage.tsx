import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { getUserId } from '../lib/auth';
import RiskBadge from '../components/RiskBadge';
import Pagination from '../components/Pagination';
import type { SubmissionHistoryResponse, SubmissionHistoryItem } from '../types';

const PAGE_SIZE = 10;

export default function HistoryPage() {
  const [items, setItems] = useState<SubmissionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const id = getUserId();
    if (!id) return;
    api.get<SubmissionHistoryResponse>('/student/submissions')
      .then(r => setItems(r.data.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const totalPages = Math.ceil(items.length / PAGE_SIZE);
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const endIdx = startIdx + PAGE_SIZE;
  const paginatedItems = items.slice(startIdx, endIdx);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="animate-in">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>
          <span aria-hidden="true">📋</span> 제출 이력
        </h1>
        <p style={{ color: 'var(--text-sub)', fontSize: 14 }}>이전에 제출한 문제들을 확인하세요</p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map(i => (
            <div
              key={i}
              style={{
                height: 88,
                borderRadius: 14,
                background: '#e8eaf6',
                animation: 'pulse 1.5s infinite',
              }}
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 40px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }} aria-hidden="true">📭</div>
          <p style={{ color: 'var(--text-sub)', marginBottom: 20 }}>아직 제출 이력이 없습니다.</p>
          <Link to="/problems" className="btn btn-primary" style={{ padding: '10px 24px' }}>
            <span aria-hidden="true">📝</span> 문제 풀러 가기
          </Link>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {paginatedItems.map((item, idx) => {
              const itemNumber = items.length - startIdx - idx;
              return (
                <div
                  key={item.submission_id ?? item.id}
                  className="card responsive-stack-card"
                  style={{
                    padding: '18px 22px',
                    border: '2px solid transparent',
                    transition: 'all 0.18s',
                  }}
                  role="listitem"
                  aria-label={`${itemNumber}번째 제출: ${item.problem_title || '자유 제출'}`}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = '#818cf8';
                    (e.currentTarget as HTMLElement).style.transform = 'translateX(4px)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
                    (e.currentTarget as HTMLElement).style.transform = 'translateX(0)';
                  }}
                >
                  {/* Index */}
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      flexShrink: 0,
                      background: 'var(--primary-pale)',
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 15,
                    }}
                    aria-label={`제출 순번: ${itemNumber}`}
                  >
                    {itemNumber}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>
                      {item.problem_title ?? '자유 제출'}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: '#4338ca', fontWeight: 800 }}>점수 {item.final_score ?? item.total_score ?? 0}</span>
                      <span style={{
                        fontSize: 11,
                        color: item.concept_reflection_passed ? '#047857' : '#9a3412',
                        fontWeight: 800,
                        background: item.concept_reflection_passed ? '#ecfdf5' : '#fff7ed',
                        border: `1px solid ${item.concept_reflection_passed ? '#86efac' : '#fed7aa'}`,
                        borderRadius: 20,
                        padding: '1px 8px',
                      }}>
                        {item.concept_reflection_passed ? '개념 설명 통과' : '개념 설명 필요'}
                      </span>
                      {typeof item.total_risk === 'number' && <span style={{ fontSize: 11, color: '#9a3412' }}>위험도 {item.total_risk.toFixed(1)}</span>}
                    </div>
                    {item.prompt_text && (
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--text-sub)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 400,
                        }}
                      >
                        {item.prompt_text}
                      </div>
                    )}
                  </div>

                  {/* Risk badge */}
                  {item.risk_stage && (
                    <div aria-label={`위험도: ${item.risk_stage}`}>
                      <RiskBadge stage={item.risk_stage} score={item.total_risk} size="sm" />
                    </div>
                  )}

                  {/* Date + 결과 보기 */}
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-sub)',
                      textAlign: 'right',
                      flexShrink: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: 6,
                    }}
                    aria-label={`제출 날짜: ${new Date(item.created_at).toLocaleString('ko-KR')}`}
                  >
                    <div>{new Date(item.created_at).toLocaleDateString('ko-KR')}</div>
                    <div>
                      {new Date(item.created_at).toLocaleTimeString('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    {(item.submission_id ?? item.id) && (
                      <Link
                        to={`/submissions/${item.submission_id ?? item.id}/result`}
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: 'var(--primary)',
                          background: 'var(--primary-pale)',
                          padding: '3px 10px',
                          borderRadius: 20,
                          textDecoration: 'none',
                          whiteSpace: 'nowrap',
                        }}
                        onClick={e => e.stopPropagation()}
                      >
                        {item.concept_reflection_passed ? '📊 결과 보기' : '🎙️ 설명하러 가기'}
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          )}
        </>
      )}
    </div>
  );
}
