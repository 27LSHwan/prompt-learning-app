import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../lib/api';
import { useToast } from '../hooks/useToast';
import type { Problem, ProblemCreate } from '../types';

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: '쉬움', medium: '보통', hard: '어려움',
};
const DIFFICULTY_COLOR: Record<string, { bg: string; color: string }> = {
  easy:   { bg: '#d1fae5', color: '#065f46' },
  medium: { bg: '#fef3c7', color: '#92400e' },
  hard:   { bg: '#fee2e2', color: '#991b1b' },
};

const EMPTY_FORM: ProblemCreate = {
  title: '',
  description: '',
  difficulty: 'medium',
  category: '',
};

export default function ProblemsManagePage() {
  const { showToast }                 = useToast();
  const [problems, setProblems]       = useState<Problem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [editTarget, setEditTarget]   = useState<Problem | null>(null);
  const [form, setForm]               = useState<ProblemCreate>(EMPTY_FORM);
  const [submitting, setSubmitting]   = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [search, setSearch]           = useState('');
  const [filterDiff, setFilterDiff]   = useState('all');

  const fetchProblems = async () => {
    try {
      const res = await api.get<Problem[] | { items: Problem[]; total: number }>('/admin/problems');
      // Backend may return list directly or { items, total }
      setProblems(Array.isArray(res.data) ? res.data : (res.data as { items: Problem[] }).items ?? []);
    } catch {
      showToast('문제 목록을 불러올 수 없습니다', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProblems(); }, []);

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (p: Problem) => {
    setEditTarget(p);
    setForm({ title: p.title, description: p.description, difficulty: p.difficulty, category: p.category });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { showToast('제목을 입력하세요', 'error'); return; }
    if (!form.description.trim()) { showToast('설명을 입력하세요', 'error'); return; }
    if (!form.category.trim()) { showToast('카테고리를 입력하세요', 'error'); return; }

    setSubmitting(true);
    try {
      if (editTarget) {
        await api.put(`/admin/problems/${editTarget.id}`, form);
        showToast('문제가 수정되었습니다', 'success');
      } else {
        await api.post('/admin/problems', form);
        showToast('문제가 생성되었습니다', 'success');
      }
      setShowForm(false);
      fetchProblems();
    } catch {
      showToast(editTarget ? '문제 수정 실패' : '문제 생성 실패', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/admin/problems/${id}`);
      showToast('문제가 삭제되었습니다', 'success');
      setDeleteConfirm(null);
      fetchProblems();
    } catch {
      showToast('문제 삭제 실패', 'error');
    }
  };

  const filtered = problems.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    const matchDiff   = filterDiff === 'all' || p.difficulty === filterDiff;
    return matchSearch && matchDiff;
  });

  return (
    <div className="animate-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>문제 관리</h1>
          <p style={{ color: 'var(--text-sub)', fontSize: 13 }}>학습 문제를 생성·수정·삭제합니다</p>
        </div>
        <button onClick={openCreate} className="btn btn-primary" style={{ padding: '10px 22px' }}
          aria-label="문제 생성">
          + 문제 생성
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <input
          type="search"
          placeholder="제목·카테고리 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 200, padding: '8px 14px', borderRadius: 8,
            border: '1px solid var(--border)', fontSize: 13, outline: 'none',
          }}
          aria-label="문제 검색"
        />
        <select
          value={filterDiff}
          onChange={e => setFilterDiff(e.target.value)}
          style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
          aria-label="난이도 필터"
        >
          <option value="all">전체 난이도</option>
          <option value="easy">쉬움</option>
          <option value="medium">보통</option>
          <option value="hard">어려움</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2,3].map(i => <div key={i} style={{ height: 60, borderRadius: 10, background: '#e2e8f0', animation: 'pulse 1.5s infinite' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-sub)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }} aria-hidden="true">📝</div>
          <p style={{ fontSize: 14 }}>{problems.length === 0 ? '등록된 문제가 없습니다' : '검색 결과가 없습니다'}</p>
          {problems.length === 0 && (
            <button onClick={openCreate} className="btn btn-primary" style={{ marginTop: 16, padding: '8px 20px' }}>
              첫 문제 만들기
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(p => {
            const dc = DIFFICULTY_COLOR[p.difficulty] ?? DIFFICULTY_COLOR.medium;
            return (
              <div key={p.id} className="card" style={{
                padding: '16px 20px', display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 12, alignItems: 'center',
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.title}
                    </span>
                    <span style={{
                      padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: dc.bg, color: dc.color, flexShrink: 0,
                    }}>{DIFFICULTY_LABEL[p.difficulty]}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-sub)', display: 'flex', gap: 12 }}>
                    <span>📂 {p.category}</span>
                    <span>📅 {new Date(p.created_at).toLocaleDateString('ko-KR')}</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.description}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => openEdit(p)}
                    style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', fontSize: 12 }}
                    aria-label={`${p.title} 수정`}>
                    ✏️ 수정
                  </button>
                  <button onClick={() => setDeleteConfirm(p.id)}
                    style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #fca5a5', background: '#fff5f5', cursor: 'pointer', fontSize: 12, color: '#ef4444' }}
                    aria-label={`${p.title} 삭제`}>
                    🗑️ 삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && createPortal(
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={editTarget ? '문제 수정' : '문제 생성'}>
          <div className="card" style={{ width: '100%', maxWidth: 540, padding: '28px 28px 24px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 22 }}>
              {editTarget ? '문제 수정' : '새 문제 생성'}
            </h2>
            <form onSubmit={handleSubmit} noValidate>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-sub)', marginBottom: 6 }}>
                제목 *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="문제 제목"
                required
                maxLength={200}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, marginBottom: 14, boxSizing: 'border-box' }}
                aria-label="문제 제목"
              />

              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-sub)', marginBottom: 6 }}>
                설명 *
              </label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="문제 설명을 입력하세요"
                required
                rows={5}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, marginBottom: 14, resize: 'vertical', boxSizing: 'border-box' }}
                aria-label="문제 설명"
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-sub)', marginBottom: 6 }}>
                    난이도 *
                  </label>
                  <select
                    value={form.difficulty}
                    onChange={e => setForm(f => ({ ...f, difficulty: e.target.value as ProblemCreate['difficulty'] }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
                    aria-label="난이도"
                  >
                    <option value="easy">쉬움</option>
                    <option value="medium">보통</option>
                    <option value="hard">어려움</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-sub)', marginBottom: 6 }}>
                    카테고리 *
                  </label>
                  <input
                    type="text"
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    placeholder="예: 프롬프트 작성"
                    required
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, boxSizing: 'border-box' }}
                    aria-label="카테고리"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={() => setShowForm(false)}
                  className="btn btn-ghost" style={{ padding: '9px 20px' }}>
                  취소
                </button>
                <button type="submit" className="btn btn-primary" style={{ padding: '9px 22px' }}
                  disabled={submitting} aria-busy={submitting}>
                  {submitting ? '저장 중...' : (editTarget ? '수정 완료' : '생성')}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirm Dialog */}
      {deleteConfirm && createPortal(
        <div className="modal-overlay" role="alertdialog" aria-modal="true" aria-label="삭제 확인">
          <div className="card" style={{ width: '100%', maxWidth: 380, padding: '28px 28px 22px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 14 }} aria-hidden="true">⚠️</div>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>문제를 삭제하시겠습니까?</h3>
            <p style={{ color: 'var(--text-sub)', fontSize: 13, marginBottom: 20 }}>
              삭제된 문제는 복구할 수 없습니다.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setDeleteConfirm(null)} className="btn btn-ghost" style={{ padding: '9px 20px' }}>
                취소
              </button>
              <button onClick={() => handleDelete(deleteConfirm)}
                style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                삭제
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
