import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { useToast } from '../hooks/useToast';
import type { PromiRuleUpdateItem, PromiRuleUpdateQueueResponse } from '../types';

type RuleUpdateStatus = 'pending' | 'reflected' | 'held';

const STATUS_LABEL: Record<RuleUpdateStatus, string> = {
  pending: '대기',
  held: '보류',
  reflected: '반영 완료',
};

const STATUS_ORDER: RuleUpdateStatus[] = ['pending', 'held', 'reflected'];

export default function PromiRuleUpdatesPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<PromiRuleUpdateItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('item'));
  const [statusFilter, setStatusFilter] = useState<RuleUpdateStatus>((searchParams.get('status') as RuleUpdateStatus) || 'pending');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState('');
  const [rulePatch, setRulePatch] = useState('');

  const selected = useMemo(
    () => items.find(item => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId]
  );

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await api.get<PromiRuleUpdateQueueResponse>(`/admin/promi-rule-updates?status=${statusFilter}`);
      const nextItems = res.data.items ?? [];
      setItems(nextItems);
      const requestedItem = searchParams.get('item');
      if (requestedItem && nextItems.some(item => item.id === requestedItem)) {
        setSelectedId(requestedItem);
      } else {
        setSelectedId(nextItems[0]?.id ?? null);
      }
    } catch {
      showToast('프롬이 규칙 개선 큐를 불러올 수 없습니다', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [statusFilter]);

  useEffect(() => {
    if (!selected) {
      setNote('');
      setRulePatch('');
      return;
    }
    setNote(selected.status === 'pending' ? (selected.review_note ?? '') : (selected.resolved_note ?? ''));
    setRulePatch(selected.status === 'pending' ? '' : (selected.rule_patch ?? ''));
    setSearchParams({ status: statusFilter, item: selected.id }, { replace: true });
  }, [selected?.id, selected?.status, statusFilter]);

  const resolveItem = async (status: 'reflected' | 'held') => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await api.post(`/admin/promi-rule-updates/${selected.id}/resolve`, {
        status,
        note: note.trim() || null,
        rule_patch: rulePatch.trim() || null,
      });
      showToast(status === 'reflected' ? '규칙 개선 반영 완료 처리했습니다' : '규칙 개선 항목을 보류 처리했습니다', 'success');
      setStatusFilter(status);
    } catch {
      showToast('규칙 개선 처리에 실패했습니다', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-in">
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>프롬이 규칙 개선 큐</h1>
        <p style={{ color: 'var(--text-sub)', fontSize: 13, lineHeight: 1.6 }}>
          코칭 품질 리뷰에서 규칙 개선이 필요하다고 표시한 프롬이 답변을 모아 봅니다. 보류 항목은 나중에 다시 열어 반영 완료로 바꿀 수 있고, 반영 완료 항목은 처리 이력으로 남습니다.
        </p>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 24, color: 'var(--text-sub)' }}>불러오는 중...</div>
      ) : !items.length ? (
        <div className="card" style={{ padding: 28, textAlign: 'center' }}>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
            {STATUS_ORDER.map(status => (
              <button key={status} type="button" className={statusFilter === status ? 'btn btn-primary' : 'btn btn-ghost'} onClick={() => setStatusFilter(status)}>{STATUS_LABEL[status]}</button>
            ))}
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>{STATUS_LABEL[statusFilter]} 규칙 개선 항목이 없습니다.</h3>
          <p style={{ color: 'var(--text-sub)', fontSize: 13 }}>프롬이 코칭 품질 리뷰 큐에서 `프롬이 규칙 개선`을 누르면 대기 항목으로 등록됩니다.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 0.9fr) minmax(360px, 1.4fr)', gap: 16, alignItems: 'start' }}>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 15, fontWeight: 800 }}>{STATUS_LABEL[statusFilter]} 항목 {items.length}개</h2>
              <button type="button" className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={fetchItems}>새로고침</button>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {STATUS_ORDER.map(status => (
                <button
                  key={status}
                  type="button"
                  className={statusFilter === status ? 'btn btn-primary' : 'btn btn-ghost'}
                  style={{ padding: '6px 10px', fontSize: 12 }}
                  onClick={() => setStatusFilter(status)}
                >
                  {STATUS_LABEL[status]}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map(item => {
                const active = selected?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    style={{
                      textAlign: 'left',
                      border: `1px solid ${active ? '#0ea5e9' : 'var(--border)'}`,
                      background: active ? '#f0f9ff' : '#fff',
                      borderRadius: 12,
                      padding: '12px 14px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                      <strong style={{ fontSize: 13, color: 'var(--text)' }}>{item.username}</strong>
                      <span style={{ fontSize: 11, color: item.status === 'pending' ? '#9a3412' : 'var(--text-sub)', fontWeight: 800 }}>{STATUS_LABEL[item.status]}</span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{item.problem_title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.45 }}>
                      {(item.original_message || item.admin_message).slice(0, 90)}{(item.original_message || item.admin_message).length > 90 ? '...' : ''}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {selected && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 900, marginBottom: 4 }}>{selected.problem_title}</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-sub)' }}>{selected.username} · {new Date(selected.created_at).toLocaleString('ko-KR')}</p>
                  <p style={{ fontSize: 12, color: selected.status === 'pending' ? '#9a3412' : 'var(--text-sub)', fontWeight: 800, marginTop: 4 }}>
                    상태: {STATUS_LABEL[selected.status]}{selected.resolved_at ? ` · 처리일 ${new Date(selected.resolved_at).toLocaleString('ko-KR')}` : ''}
                  </p>
                </div>
                {selected.student_id && (
                  <Link className="btn btn-ghost" style={{ padding: '7px 12px', fontSize: 12 }} to={`/students/${selected.student_id}`}>학생 상세</Link>
                )}
              </div>

              <section style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>원본 프롬이 답변</h3>
                <div style={{ whiteSpace: 'pre-wrap', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 12, padding: 14, fontSize: 13, lineHeight: 1.6 }}>
                  {selected.original_message || '원본 메시지가 없습니다.'}
                </div>
              </section>

              <section style={{ marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>리뷰 사유</h3>
                  <div style={{ background: '#fff7ed', color: '#9a3412', borderRadius: 12, padding: 12, fontSize: 13, lineHeight: 1.6 }}>
                    {selected.caution || '자동 플래그 사유가 없습니다.'}
                  </div>
                </div>
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>등록 메모</h3>
                  <div style={{ background: '#f8fafc', borderRadius: 12, padding: 12, fontSize: 13, lineHeight: 1.6, color: 'var(--text-sub)' }}>
                    {selected.review_note || '관리자 메모가 없습니다.'}
                  </div>
                </div>
              </section>

              <section style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>{selected.status === 'reflected' ? '처리 메모 이력' : '처리 메모'}</h3>
                <textarea
                  value={note}
                  onChange={event => setNote(event.target.value)}
                  disabled={selected.status === 'reflected'}
                  rows={3}
                  placeholder="왜 반영/보류했는지 남기세요."
                  style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 12, padding: 12, resize: 'vertical' }}
                />
              </section>

              <section style={{ marginBottom: 18 }}>
                <h3 style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>{selected.status === 'reflected' ? '개선 규칙 이력' : '개선 규칙 초안'}</h3>
                <textarea
                  value={rulePatch}
                  onChange={event => setRulePatch(event.target.value)}
                  disabled={selected.status === 'reflected'}
                  rows={5}
                  placeholder="예: 답을 직접 말하지 말고, 학생의 현재 프롬프트에서 빠진 역할/조건/평가 기준을 질문 형태로 안내한다."
                  style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 12, padding: 12, resize: 'vertical' }}
                />
              </section>

              {selected.status === 'pending' ? (
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button type="button" disabled={submitting} className="btn btn-ghost" onClick={() => resolveItem('held')}>
                    {submitting ? '처리 중' : '보류'}
                  </button>
                  <button type="button" disabled={submitting} className="btn btn-primary" onClick={() => resolveItem('reflected')}>
                    {submitting ? '처리 중' : '반영 완료'}
                  </button>
                </div>
              ) : selected.status === 'held' ? (
                <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: 12, fontSize: 13, color: '#9a3412', flex: '1 1 260px' }}>
                    보류된 항목입니다. 필요하면 메모와 개선 규칙을 보완한 뒤 반영 완료로 변경할 수 있습니다.
                  </div>
                  <button type="button" disabled={submitting} className="btn btn-primary" onClick={() => resolveItem('reflected')}>
                    {submitting ? '처리 중' : '반영 완료로 변경'}
                  </button>
                </div>
              ) : (
                <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 12, padding: 12, fontSize: 13, color: 'var(--text-sub)' }}>
                  이 항목은 반영 완료 처리된 이력입니다.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
