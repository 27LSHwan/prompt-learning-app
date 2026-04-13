import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { useToast } from '../hooks/useToast';
import type { InterventionListItem, InterventionStatus, InterventionType } from '../types';

const STATUS_STYLE: Record<InterventionStatus, { bg: string; color: string; label: string }> = {
  pending:   { bg: '#fef3c7', color: '#92400e', label: '대기 중' },
  completed: { bg: '#d1fae5', color: '#065f46', label: '완료' },
  cancelled: { bg: '#f1f5f9', color: '#64748b', label: '취소' },
};

const TYPE_ICONS: Record<InterventionType, string> = {
  message:               '💬',
  meeting:               '📅',
  resource:              '📚',
  alert:                 '🚨',
  problem_recommendation: '🎯',
};

const PAGE_SIZE = 15;

interface BulkForm {
  student_ids: string[];
  type: InterventionType;
  message: string;
}

export default function InterventionsListPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems]             = useState<InterventionListItem[]>([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [loading, setLoading]         = useState(true);
  const [filterStatus, setFilterStatus] = useState<InterventionStatus | 'all'>('all');
  const [filterType, setFilterType]   = useState<InterventionType | 'all'>('all');
  const [search, setSearch]           = useState('');
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [bulkModal, setBulkModal]     = useState(false);
  const [bulkForm, setBulkForm]       = useState<BulkForm>({ student_ids: [], type: 'message', message: '' });
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [detailItem, setDetailItem]   = useState<InterventionListItem | null>(null);
  const [detailMessage, setDetailMessage] = useState('');

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, page_size: PAGE_SIZE };
      if (filterStatus !== 'all') params.status = filterStatus;
      if (filterType !== 'all') params.type = filterType;
      const res = await api.get<{ items: InterventionListItem[]; total: number }>('/admin/interventions', { params });
      setItems(res.data.items ?? []);
      setTotal(res.data.total ?? 0);
    } catch {
      showToast('개입 목록을 불러올 수 없습니다', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterType, showToast]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleStatusChange = async (id: string, status: InterventionStatus, message?: string) => {
    setStatusUpdating(id);
    try {
      await api.patch(`/admin/interventions/${id}/status`, message !== undefined ? { status, message } : { status });
      showToast('상태가 업데이트되었습니다', 'success');
      await fetchItems();
      return true;
    } catch {
      showToast('상태 업데이트 실패', 'error');
      return false;
    } finally {
      setStatusUpdating(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      const filteredIds = filtered.map(i => i.id);
      const allVisibleSelected = filteredIds.length > 0 && filteredIds.every(id => next.has(id));
      if (allVisibleSelected) {
        filteredIds.forEach(id => next.delete(id));
      } else {
        filteredIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const openBulk = () => {
    const studentIds = Array.from(new Set(items.filter(i => selected.has(i.id)).map(i => i.student_id)));
    setBulkForm({ student_ids: studentIds, type: 'message', message: '' });
    setBulkModal(true);
  };

  const handleBulkSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkForm.message.trim()) { showToast('메시지를 입력하세요', 'error'); return; }
    setBulkSubmitting(true);
    try {
      await api.post('/admin/interventions/bulk', bulkForm);
      showToast(`${bulkForm.student_ids.length}명에게 개입이 생성되었습니다`, 'success');
      setBulkModal(false);
      setSelected(new Set());
      fetchItems();
    } catch {
      showToast('일괄 전송 실패', 'error');
    } finally {
      setBulkSubmitting(false);
    }
  };

  const filtered = search
    ? items.filter(i =>
        i.username.toLowerCase().includes(search.toLowerCase()) ||
        i.email.toLowerCase().includes(search.toLowerCase()) ||
        i.message.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const visibleSelectedCount = filtered.filter(item => selected.has(item.id)).length;
  const isAllVisibleSelected = filtered.length > 0 && visibleSelectedCount === filtered.length;
  const detailId = searchParams.get('detail');

  useEffect(() => {
    if (!detailId || detailItem?.id === detailId) return;
    const item = items.find(i => i.id === detailId);
    if (item) {
      setDetailItem(item);
      setDetailMessage(item.message);
      return;
    }
    let cancelled = false;
    api.get<InterventionListItem>(`/admin/interventions/${detailId}`)
      .then(res => {
        if (cancelled) return;
        setDetailItem(res.data);
        setDetailMessage(res.data.message);
      })
      .catch(() => {
        if (!cancelled) showToast('개입 상세를 불러올 수 없습니다', 'error');
      });
    return () => { cancelled = true; };
  }, [detailId, detailItem?.id, items, showToast]);

  const openDetail = (item: InterventionListItem) => {
    setDetailItem(item);
    setDetailMessage(item.message);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('detail', item.id);
      return next;
    });
  };

  const closeDetail = () => {
    setDetailItem(null);
    setDetailMessage('');
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('detail');
      return next;
    });
  };

  const completeDetailItem = async () => {
    if (!detailItem) return;
    if (detailItem.status !== 'pending') {
      closeDetail();
      return;
    }
    const message = detailMessage.trim();
    if (!message) {
      showToast('학생에게 보낼 메시지를 입력하세요', 'error');
      return;
    }
    const ok = await handleStatusChange(detailItem.id, 'completed', message);
    if (ok) closeDetail();
  };

  return (
    <div className="animate-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>개입 현황</h1>
          <p style={{ color: 'var(--text-sub)', fontSize: 13 }}>전체 개입 이력 조회 및 상태 관리 · 총 {total}건</p>
        </div>
        <div className="responsive-admin-actions" style={{ gap: 10 }}>
          {selected.size > 0 && (
            <button onClick={openBulk} className="btn btn-primary" style={{ padding: '9px 20px', fontSize: 13 }}>
              📢 선택 개입 학생 일괄 알림 ({selected.size}건)
            </button>
          )}
          <Link to="/interventions" className="btn btn-ghost" style={{ padding: '9px 18px', fontSize: 13 }}>
            + 개입 생성
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <input
          type="search"
          placeholder="학생 이름·이메일·메시지 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
          aria-label="개입 검색"
        />
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value as InterventionStatus | 'all'); setPage(1); }}
          style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
          aria-label="상태 필터">
          <option value="all">전체 상태</option>
          <option value="pending">대기 중</option>
          <option value="completed">완료</option>
          <option value="cancelled">취소</option>
        </select>
        <select value={filterType} onChange={e => { setFilterType(e.target.value as InterventionType | 'all'); setPage(1); }}
          style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
          aria-label="유형 필터">
          <option value="all">전체 유형</option>
          <option value="message">💬 메시지</option>
          <option value="meeting">📅 미팅</option>
          <option value="resource">📚 자료</option>
          <option value="alert">🚨 경고</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3,4,5].map(i => <div key={i} style={{ height: 64, borderRadius: 10, background: '#e2e8f0', animation: 'pulse 1.5s infinite' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-sub)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }} aria-hidden="true">📋</div>
          <p>개입 이력이 없습니다</p>
        </div>
      ) : (
        <>
          {/* Select all */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '0 4px' }}>
            <input type="checkbox" id="select-all" checked={isAllVisibleSelected}
              onChange={toggleAll} style={{ width: 16, height: 16, cursor: 'pointer' }}
              aria-label="전체 선택" />
            <label htmlFor="select-all" style={{ fontSize: 12, color: 'var(--text-sub)', cursor: 'pointer' }}>
              {visibleSelectedCount > 0 ? `${visibleSelectedCount}건 선택됨` : '현재 목록 전체 선택'}
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(item => {
              const ss = STATUS_STYLE[item.status];
              const isSelected = selected.has(item.id);
              return (
                <div key={item.id} className="card responsive-admin-row" style={{
                  padding: '14px 18px',
                  border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                }}>
                  <input
	                    type="checkbox"
	                    checked={isSelected}
	                    onChange={() => toggleSelect(item.id)}
	                    style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
	                    aria-label={`${item.username} ${item.id} 개입 선택`}
	                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 16 }} aria-hidden="true">{TYPE_ICONS[item.type]}</span>
                      <Link to={`/students/${item.student_id}`} style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary)' }}>
                        {item.username}
                      </Link>
                      <span style={{ fontSize: 11, color: 'var(--text-sub)' }}>{item.email}</span>
                    </div>
                    <p style={{
                      margin: 0, fontSize: 12, color: 'var(--text-sub)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
	                    }}>{item.message}</p>
	                    <button type="button" onClick={() => openDetail(item)}
	                      style={{ marginTop: 6, background: 'none', border: 'none', color: 'var(--primary)', fontSize: 11, fontWeight: 800, cursor: 'pointer', padding: 0 }}>
	                      상세 보기
	                    </button>
	                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: ss.bg, color: ss.color,
                    }}>{ss.label}</span>
                    <div style={{ fontSize: 10, color: 'var(--text-sub)', marginTop: 4 }}>
                      {new Date(item.created_at).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0 }}>
	                    <select
	                      value={item.status}
	                      onChange={e => handleStatusChange(item.id, e.target.value as InterventionStatus)}
                      disabled={statusUpdating === item.id}
                      style={{
                        padding: '5px 8px', borderRadius: 8, border: '1px solid var(--border)',
                        fontSize: 11, cursor: 'pointer', background: '#fff',
                      }}
                      aria-label={`${item.username} 개입 상태 변경`}
                    >
	                      <option value="pending">대기 중</option>
	                      <option value="completed">완료</option>
	                      <option value="cancelled">취소</option>
	                    </select>
	                    <div style={{ fontSize: 10, color: 'var(--text-sub)', marginTop: 4, maxWidth: 150, lineHeight: 1.35 }}>
	                      완료로 바꾸면 현재 메시지가 학생 알림으로 발송됩니다. 수정은 상세 보기에서 하세요.
	                    </div>
	                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }} role="navigation" aria-label="페이지 탐색">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', cursor: page === 1 ? 'default' : 'pointer', opacity: page === 1 ? 0.4 : 1, fontSize: 13 }}
                aria-label="이전 페이지">←</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    style={{
                      padding: '7px 14px', borderRadius: 8, border: page === p ? '2px solid var(--primary)' : '1px solid var(--border)',
                      background: page === p ? 'var(--primary)' : '#fff',
                      color: page === p ? '#fff' : 'var(--text)', cursor: 'pointer', fontSize: 13, fontWeight: page === p ? 700 : 400,
                    }}
                    aria-label={`${p}페이지`} aria-current={page === p ? 'page' : undefined}>
                    {p}
                  </button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', cursor: page === totalPages ? 'default' : 'pointer', opacity: page === totalPages ? 0.4 : 1, fontSize: 13 }}
                aria-label="다음 페이지">→</button>
            </div>
          )}
        </>
      )}

      {/* Bulk Message Modal */}
      {bulkModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }} role="dialog" aria-modal="true" aria-label="일괄 개입 전송">
          <div className="card" style={{ width: '100%', maxWidth: 500, padding: '28px 28px 24px' }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>📢 일괄 개입 생성</h2>
            <p style={{ color: 'var(--text-sub)', fontSize: 13, marginBottom: 20 }}>
              선택한 {bulkForm.student_ids.length}명의 학생에게 개입을 생성합니다.
            </p>
            <form onSubmit={handleBulkSend} noValidate>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-sub)', marginBottom: 6 }}>
                개입 유형
              </label>
              <select
                value={bulkForm.type}
                onChange={e => setBulkForm(f => ({ ...f, type: e.target.value as InterventionType }))}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, marginBottom: 14 }}
                aria-label="개입 유형"
              >
                <option value="message">💬 메시지</option>
                <option value="meeting">📅 미팅 요청</option>
                <option value="resource">📚 자료 공유</option>
                <option value="alert">🚨 경고</option>
              </select>

              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-sub)', marginBottom: 6 }}>
                메시지 *
              </label>
              <textarea
                value={bulkForm.message}
                onChange={e => setBulkForm(f => ({ ...f, message: e.target.value }))}
                placeholder="학생들에게 전달할 메시지를 입력하세요"
                required
                rows={4}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, resize: 'vertical', marginBottom: 20, boxSizing: 'border-box' }}
                aria-label="메시지"
              />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setBulkModal(false)} className="btn btn-ghost" style={{ padding: '9px 20px' }}>
                  취소
                </button>
                <button type="submit" className="btn btn-primary" style={{ padding: '9px 22px' }}
                  disabled={bulkSubmitting} aria-busy={bulkSubmitting}>
                  {bulkSubmitting ? '전송 중...' : '일괄 전송'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {detailItem && createPortal(
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 220,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          boxSizing: 'border-box',
        }} role="dialog" aria-modal="true" aria-label="개입 상세">
          <div className="card" style={{ width: '100%', maxWidth: 560, maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', padding: '28px 28px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>개입 상세</h2>
                <p style={{ color: 'var(--text-sub)', fontSize: 13, margin: 0 }}>
                  {detailItem.username} · {detailItem.email}
                </p>
              </div>
              <span style={{
                padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800,
                background: STATUS_STYLE[detailItem.status].bg, color: STATUS_STYLE[detailItem.status].color,
              }}>{STATUS_STYLE[detailItem.status].label}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-sub)', marginBottom: 4 }}>유형</div>
                <div style={{ fontSize: 13, fontWeight: 800 }}>{TYPE_ICONS[detailItem.type]} {detailItem.type}</div>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-sub)', marginBottom: 4 }}>생성 시각</div>
                <div style={{ fontSize: 13, fontWeight: 800 }}>{new Date(detailItem.created_at).toLocaleString('ko-KR')}</div>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="intervention-detail-message" style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--text-sub)', marginBottom: 6 }}>
                학생에게 전달되는 개입 메시지
              </label>
              <textarea
                id="intervention-detail-message"
                value={detailMessage}
                onChange={e => setDetailMessage(e.target.value)}
                readOnly={detailItem.status !== 'pending'}
                rows={8}
                style={{ width: '100%', boxSizing: 'border-box', background: detailItem.status === 'pending' ? '#fff' : '#f8fafc', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', fontSize: 13, lineHeight: 1.7, resize: detailItem.status === 'pending' ? 'vertical' : 'none' }}
                aria-label="학생에게 전달되는 개입 메시지"
              />
            </div>
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: '12px 14px', color: '#9a3412', fontSize: 12, lineHeight: 1.6, marginBottom: 18 }}>
              {detailItem.status === 'pending'
                ? '대기 중인 개입은 아직 학생에게 보이지 않습니다. 메시지를 확인하거나 수정한 뒤 완료 처리하면 학생 알림으로 발송되고 상태가 완료로 바뀝니다.'
                : '이미 처리된 개입입니다. 메시지는 기록 확인용으로만 표시됩니다.'}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {detailItem.status === 'pending' && (
                <button
                  type="button"
                  onClick={completeDetailItem}
                  disabled={statusUpdating === detailItem.id}
                  className="btn btn-primary"
                  style={{ padding: '9px 18px' }}
                >
                  {statusUpdating === detailItem.id ? '처리 중...' : '완료 처리'}
                </button>
              )}
              <button type="button" onClick={closeDetail} className="btn btn-ghost" style={{ padding: '9px 18px' }}>
                닫기
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
