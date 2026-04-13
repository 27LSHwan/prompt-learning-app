import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useDebounce } from '../hooks/useDebounce';
import Pagination from '../components/Pagination';
import type { StudentListResponse, StudentSummary, RiskStage } from '../types';

const STAGE_COLOR: Record<RiskStage, { text: string; bg: string }> = {
  '안정':   { text: '#065f46', bg: '#d1fae5' },
  '경미':   { text: '#92400e', bg: '#fef3c7' },
  '주의':   { text: '#9a3412', bg: '#ffedd5' },
  '고위험': { text: '#991b1b', bg: '#fee2e2' },
  '심각':   { text: '#fff',    bg: '#7f1d1d' },
};

const STAGES: (RiskStage | 'all')[] = ['all', '안정', '경미', '주의', '고위험', '심각'];
const PATTERN_GROUPS = ['all', '미제출군', '실행많음_저성취', '하락세', '고위험군', '일반'] as const;
const PAGE_SIZE = 20;

const safeNumber = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

export default function StudentsPage() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [stageFilter, setStageFilter] = useState<RiskStage | 'all'>('all');
  const [patternFilter, setPatternFilter] = useState<(typeof PATTERN_GROUPS)[number]>('all');
  const [sortBy, setSortBy]     = useState<'risk_desc' | 'risk_asc' | 'name'>('risk_desc');
  const [currentPage, setCurrentPage] = useState(1);

  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    api.get<StudentListResponse>('/admin/students')
      .then(r => {
        setStudents(r.data.items);
        setCurrentPage(1);
      })
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = students
    .filter(s => stageFilter === 'all' || s.risk_stage === stageFilter)
    .filter(s => patternFilter === 'all' || s.pattern_group === patternFilter)
    .filter(s =>
      s.username.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(debouncedSearch.toLowerCase())
    )
    .sort((a, b) =>
      sortBy === 'risk_desc' ? b.total_risk - a.total_risk :
      sortBy === 'risk_asc'  ? a.total_risk - b.total_risk :
      a.username.localeCompare(b.username)
    );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginatedData = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleExportCSV = () => {
    const headers = ['학생ID', '이름', '이메일', '위험점수', '단계', '탈락유형', '분석시각'];
    const rows = filtered.map(s => [
      s.student_id,
      s.username,
      s.email,
      safeNumber(s.total_risk).toFixed(1),
      s.risk_stage,
      s.dropout_type,
      new Date(s.calculated_at).toLocaleString('ko-KR'),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-in">
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>학생 목록</h1>
        <p style={{ color: 'var(--text-sub)', fontSize: 13 }}>
          전체 {students.length}명 · 필터된 결과: {filtered.length}명
        </p>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--text-sub)' }} aria-hidden="true">
            🔍
          </span>
          <input
            className="form-input"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="이름 또는 이메일 검색..."
            style={{ paddingLeft: 36 }}
            aria-label="학생 검색"
          />
        </div>

        {/* Stage filter chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STAGES.map(s => (
            <button
              key={s}
              onClick={() => {
                setStageFilter(s);
                setCurrentPage(1);
              }}
              style={{
                padding: '6px 12px', borderRadius: 8, border: '1.5px solid',
                borderColor: stageFilter === s ? 'var(--primary)' : 'var(--border)',
                background: stageFilter === s ? 'var(--primary-pale)' : '#fff',
                color: stageFilter === s ? 'var(--primary)' : 'var(--text-sub)',
                fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.12s',
              }}
              aria-pressed={stageFilter === s}
            >
              {s === 'all' ? '전체' : s}
            </button>
          ))}
        </div>

        <select
          className="form-input"
          value={patternFilter}
          onChange={e => {
            setPatternFilter(e.target.value as (typeof PATTERN_GROUPS)[number]);
            setCurrentPage(1);
          }}
          style={{ width: 'auto', paddingRight: 32 }}
          aria-label="학습 패턴 필터"
        >
          {PATTERN_GROUPS.map(item => <option key={item} value={item}>{item === 'all' ? '전체 패턴' : item}</option>)}
        </select>

        <select
          className="form-input"
          value={sortBy}
          onChange={e => {
            setSortBy(e.target.value as any);
            setCurrentPage(1);
          }}
          style={{ width: 'auto', paddingRight: 32 }}
          aria-label="정렬 순서"
        >
          <option value="risk_desc">위험도 높은순</option>
          <option value="risk_asc">위험도 낮은순</option>
          <option value="name">이름순</option>
        </select>

        <button
          onClick={handleExportCSV}
          className="btn btn-ghost"
          style={{ padding: '8px 14px', fontSize: 12 }}
          aria-label="CSV 내보내기"
        >
          📥 CSV 내보내기
        </button>
      </div>

      {/* Table */}
      <div className="card responsive-table-wrap" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-sub)' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', margin: '0 auto 12px',
              border: '3px solid #bae6fd', borderTopColor: 'var(--primary)',
              animation: 'spin 0.8s linear infinite',
            }} aria-hidden="true" />
            불러오는 중...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-sub)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }} aria-hidden="true">🔍</div>
            <p>해당 조건의 학생이 없습니다.</p>
          </div>
        ) : (
          <>
            <table className="data-table responsive-table" role="grid">
              <thead>
                <tr>
                  <th aria-sort={sortBy.startsWith('risk') ? (sortBy === 'risk_desc' ? 'descending' : 'ascending') : 'none'}>
                    학생
                  </th>
                  <th aria-sort={sortBy.startsWith('risk') ? (sortBy === 'risk_desc' ? 'descending' : 'ascending') : 'none'}>
                    위험도
                  </th>
                  <th>단계</th>
                  <th>패턴</th>
                  <th>탈락 유형</th>
                  <th>분석 시각</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map(s => {
                  const cfg = STAGE_COLOR[s.risk_stage] ?? { text: '#6b7280', bg: '#f3f4f6' };
                  return (
                    <tr
                      key={s.student_id}
                      onClick={() => navigate(`/students/${s.student_id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 8,
                            background: 'var(--primary-pale)', color: 'var(--primary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 800, fontSize: 13, flexShrink: 0,
                          }}>
                            {s.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{s.username}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-sub)' }}>{s.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 36, height: 6, borderRadius: 4, background: '#e2e8f0', overflow: 'hidden',
                          }}>
                            <div style={{
                              height: '100%', borderRadius: 4, background: cfg.bg === '#d1fae5' ? '#10b981' : cfg.bg === '#7f1d1d' ? '#dc2626' : '#ef4444',
                              width: `${safeNumber(s.total_risk)}%`,
                            }} />
                          </div>
                          <span style={{ fontWeight: 800, fontSize: 14, color: cfg.text === '#fff' ? '#dc2626' : cfg.text }}>
                            {safeNumber(s.total_risk).toFixed(1)}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span style={{
                          padding: '3px 10px', borderRadius: 20,
                          background: cfg.bg, color: cfg.text,
                          fontSize: 11, fontWeight: 700,
                        }}>{s.risk_stage}</span>
                      </td>
                      <td style={{ fontSize: 12, color: '#4338ca', fontWeight: 700 }}>{s.pattern_group}</td>
                      <td style={{ color: 'var(--text-sub)', fontSize: 12 }}>{s.dropout_type}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-sub)' }}>
                        {new Date(s.calculated_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
