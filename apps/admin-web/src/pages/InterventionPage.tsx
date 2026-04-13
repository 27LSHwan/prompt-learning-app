import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { useToast } from '../hooks/useToast';
import ConfirmDialog from '../components/ConfirmDialog';
import type { InterventionCreateRequest, InterventionResponse, InterventionType, StudentDetail, Problem } from '../types';

const TYPE_OPTIONS: { value: InterventionType; label: string; desc: string; icon: string; color: string }[] = [
  { value: 'message',               label: '메시지',    desc: '학생에게 직접 메시지를 전송합니다',    icon: '💬', color: '#0ea5e9' },
  { value: 'meeting',               label: '면담',      desc: '1:1 면담을 요청합니다',                icon: '📅', color: '#a855f7' },
  { value: 'resource',              label: '자료 제공', desc: '학습 자료를 공유합니다',               icon: '📚', color: '#10b981' },
  { value: 'alert',                 label: '긴급 알림', desc: '즉각적인 긴급 알림을 발송합니다',      icon: '🚨', color: '#ef4444' },
  { value: 'problem_recommendation', label: '문제 추천', desc: '풀어볼 문제를 직접 추천합니다',      icon: '🎯', color: '#f59e0b' },
];

interface DropoutTemplate {
  icon: string;
  label: string;
  desc: string;
  type: InterventionType;
  message: string;
  color: string;
}

const DROPOUT_TEMPLATES: Record<string, DropoutTemplate[]> = {
  cognitive: [
    {
      icon: '🎯', label: '난이도 조정 문제 추천', color: '#f59e0b', type: 'problem_recommendation',
      desc: '개념 이해를 다지는 쉬운 문제부터 단계별 추천',
      message: '최근 제출을 분석한 결과 기초 개념 이해가 필요해 보입니다. 부담 없이 접근할 수 있는 문제부터 단계별로 추천해드릴게요.',
    },
    {
      icon: '💬', label: '오답 패턴 분석 메시지', color: '#0ea5e9', type: 'message',
      desc: '반복 오류 패턴을 짚어주는 피드백 메시지',
      message: '최근 제출에서 반복되는 오류 패턴을 발견했습니다. 출력 형식·조건 처리 부분을 다시 한번 꼼꼼히 살펴보면 큰 도움이 될 것입니다. 언제든 질문해주세요!',
    },
  ],
  motivational: [
    {
      icon: '💬', label: '성취 가시화 메시지', color: '#0ea5e9', type: 'message',
      desc: '학생의 성장을 구체적으로 짚어주는 격려 메시지',
      message: '이번 주 제출 기록을 보면 분명한 성장이 느껴집니다! 처음보다 훨씬 정교하게 접근하고 있어요. 이 흐름을 유지하면 충분히 좋은 결과를 낼 수 있습니다. 화이팅!',
    },
    {
      icon: '📅', label: '동기 부여 면담', color: '#a855f7', type: 'meeting',
      desc: '학습 의욕 회복을 위한 1:1 면담 요청',
      message: '학습에 조금 지쳐 있는 것 같아 걱정이 됩니다. 짧게라도 이야기 나눠보면 좋을 것 같아 면담을 요청드립니다. 편하게 연락해주세요.',
    },
  ],
  strategic: [
    {
      icon: '📚', label: '학습 전략 자료 제공', color: '#10b981', type: 'resource',
      desc: '체계적 프롬프트 설계 방법론 자료 공유',
      message: '문제를 풀 때 "입력 → 처리 → 출력" 단계를 명확히 설계하는 전략이 중요합니다. 관련 학습 자료를 공유하니 참고해서 접근 방식을 구조화해보세요.',
    },
    {
      icon: '💬', label: '자기 검증 습관 메시지', color: '#0ea5e9', type: 'message',
      desc: '제출 전 스스로 테스트하는 습관 장려',
      message: '제출하기 전에 직접 예시 입력으로 결과를 확인해보는 습관이 점수를 크게 높여줍니다. "내 프롬프트가 이 케이스에 맞게 동작하는가?" 를 꼭 체크해보세요!',
    },
  ],
  sudden: [
    {
      icon: '📅', label: '상황 파악 면담', color: '#a855f7', type: 'meeting',
      desc: '갑작스러운 참여도 하락 원인 파악 면담',
      message: '최근 학습 참여도가 갑자기 낮아진 것이 걱정됩니다. 무슨 일이 있는지 편하게 이야기할 수 있도록 면담을 요청드립니다. 부담 없이 연락해주세요.',
    },
    {
      icon: '💬', label: '격려 및 안부 메시지', color: '#0ea5e9', type: 'message',
      desc: '학생에게 관심과 지지를 전하는 안부 메시지',
      message: '요즘 힘든 일이 있는 건 아닌지 걱정됩니다. 학습 외에도 도움이 필요한 게 있다면 언제든 말해주세요. 언제나 응원하고 있습니다.',
    },
  ],
  dependency: [
    {
      icon: '💬', label: 'AI 독립 훈련 메시지', color: '#0ea5e9', type: 'message',
      desc: 'AI 도움 없이 먼저 스스로 생각하는 단계 안내',
      message: 'AI 도구를 활용하기 전에 먼저 10분간 혼자 구조를 잡아보는 연습을 추천합니다. "문제를 읽고 → 내가 먼저 답 방향을 적어보고 → 그다음 AI를 활용" 하는 순서를 지켜보세요. 이 작은 습관이 실력 향상에 큰 차이를 만들어냅니다.',
    },
    {
      icon: '🎯', label: '자력 해결 문제 추천', color: '#f59e0b', type: 'problem_recommendation',
      desc: 'AI 없이도 혼자 풀 수 있는 난이도 문제 추천',
      message: 'AI 도구 없이 스스로 접근해볼 수 있는 수준의 문제를 추천합니다. 먼저 직접 구조를 짜보고, 막히는 부분만 AI에 물어보는 방식으로 시도해보세요.',
    },
  ],
  compound: [
    {
      icon: '🚨', label: '긴급 종합 면담 요청', color: '#ef4444', type: 'alert',
      desc: '복합 위험 요인에 대한 즉각적인 개입 알림',
      message: '여러 학습 영역에서 복합적인 어려움이 감지되어 긴급 면담을 요청합니다. 빠른 시일 내에 연락 주시면 함께 해결책을 찾아보겠습니다.',
    },
    {
      icon: '🎯', label: '쉬운 문제로 자신감 회복', color: '#f59e0b', type: 'problem_recommendation',
      desc: '부담을 줄이고 성취감을 되찾는 쉬운 문제 추천',
      message: '지금 상황에서 너무 어려운 문제에 집중하기보다, 확실히 풀 수 있는 문제부터 성취감을 쌓아가는 것이 좋습니다. 쉬운 문제를 먼저 추천해드릴게요.',
    },
  ],
  none: [
    {
      icon: '💬', label: '현상 유지 격려 메시지', color: '#10b981', type: 'message',
      desc: '안정적인 학습 상태를 칭찬하고 지속 격려',
      message: '꾸준히 학습에 참여하고 있어 정말 잘하고 있습니다! 이 흐름을 유지하면서 도전적인 문제에도 조금씩 시도해보면 더 큰 성장이 있을 것입니다. 계속 응원합니다!',
    },
  ],
};

const DIFF_LABEL: Record<string, string> = { easy: '쉬움', medium: '보통', hard: '어려움' };
const DIFF_COLOR: Record<string, string> = { easy: '#10b981', medium: '#f59e0b', hard: '#ef4444' };

export default function InterventionPage() {
  const [searchParams]    = useSearchParams();
  const navigate          = useNavigate();
  const { showToast }     = useToast();
  const preStudentId      = searchParams.get('student_id') ?? '';

  const [form, setForm]   = useState<InterventionCreateRequest>({
    student_id: preStudentId, type: 'message', message: '',
  });
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  // 학생 정보
  const [studentName, setStudentName]       = useState('');
  const [studentEmail, setStudentEmail]     = useState('');
  const [dropoutType, setDropoutType]       = useState('');
  const [studentLoading, setStudentLoading] = useState(Boolean(preStudentId));
  const [templateOpen, setTemplateOpen]     = useState(true);

  // 문제 추천 상태
  const [problems, setProblems]                 = useState<Problem[]>([]);
  const [problemsLoading, setProblemsLoading]   = useState(false);
  const [selectedProblemId, setSelectedProblemId] = useState('');
  const [recommendReason, setRecommendReason]   = useState('');

  // 학생 정보 로드
  useEffect(() => {
    let cancelled = false;
    if (!preStudentId) {
      setStudentName('');
      setStudentEmail('');
      setDropoutType('');
      setStudentLoading(false);
      return;
    }
    setStudentLoading(true);
    api.get<StudentDetail>(`/admin/students/${preStudentId}`)
      .then((res) => {
        if (cancelled) return;
        setStudentName(res.data.username);
        setStudentEmail(res.data.email);
        setDropoutType(res.data.latest_risk?.dropout_type ?? '');
      })
      .catch(() => {
        if (cancelled) return;
        setStudentName('');
        setStudentEmail('');
        setDropoutType('');
      })
      .finally(() => { if (!cancelled) setStudentLoading(false); });
    return () => { cancelled = true; };
  }, [preStudentId]);

  // 문제 추천 유형 선택 시 문제 목록 로드
  useEffect(() => {
    if (form.type !== 'problem_recommendation') return;
    setProblemsLoading(true);
    api.get<Problem[]>('/admin/problems')
      .then((res) => {
        const list = res.data ?? [];
        setProblems(list);
        if (!selectedProblemId && list[0]?.id) setSelectedProblemId(list[0].id);
      })
      .catch(() => showToast('문제 목록을 불러올 수 없습니다', 'error'))
      .finally(() => setProblemsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.type]);

  const isProblemRec = form.type === 'problem_recommendation';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.student_id.trim()) { setError('대상 학생이 선택되지 않았습니다.'); return; }
    if (isProblemRec && !selectedProblemId) { setError('추천할 문제를 선택하세요.'); return; }
    if (!isProblemRec && !form.message.trim()) { setError('메시지를 작성해주세요.'); return; }
    setError('');
    setShowConfirm(true);
  };

  const handleConfirmCreate = async () => {
    setShowConfirm(false);
    setLoading(true);
    setError('');

    const selectedProblem = problems.find(p => p.id === selectedProblemId);
    const messageToSend   = isProblemRec
      ? (recommendReason.trim() || `문제 추천: ${selectedProblem?.title ?? ''}`)
      : form.message;

    try {
      // 1) 개입 생성
      const res = await api.post<InterventionResponse>('/admin/intervention', {
        ...form,
        message: messageToSend,
      });

      // 2) 문제 추천 유형이면 추천 API도 호출
      if (isProblemRec && selectedProblemId) {
        try {
          await api.post(`/admin/students/${form.student_id}/problem-recommendations`, {
            problem_id: selectedProblemId,
            reason: recommendReason.trim() || null,
          });
        } catch {
          showToast('개입은 생성됐지만 문제 추천 등록에 실패했습니다', 'error');
        }
      }

      showToast('개입이 성공적으로 생성되었습니다', 'success');
      navigate(`/interventions-list?detail=${encodeURIComponent(res.data.id)}`);
    } catch (err: any) {
      const msg = err.response?.data?.detail ?? '개입 생성에 실패했습니다.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const applyTemplate = (tpl: DropoutTemplate) => {
    setForm(f => ({ ...f, type: tpl.type, message: tpl.type !== 'problem_recommendation' ? tpl.message : f.message }));
    if (tpl.type === 'problem_recommendation') setRecommendReason(tpl.message);
    setTemplateOpen(false);
  };

  /* ── 메인 폼 ─────────────────────────────────────────────────── */
  return (
    <div className="animate-in" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>개입 생성</h1>
        <p style={{ color: 'var(--text-sub)', fontSize: 13 }}>학생에게 개입을 생성하고 지원하세요</p>
      </div>

      <div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* 대상 학생 */}
          <div className="card" style={{ padding: '20px 22px' }}>
            <div style={{ display: 'block', fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
              👤 대상 학생
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', background: '#f8fafc' }}>
              {studentLoading ? (
                <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>학생 정보를 불러오는 중...</div>
              ) : studentName ? (
                <>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{studentName}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>{studentEmail}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 8 }}>
                    학생 상세에서 선택된 학생으로 고정되며 이 화면에서 수정할 수 없습니다.
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: '#991b1b' }}>
                  대상 학생 정보를 확인할 수 없습니다. 학생 상세 페이지에서 다시 진입해주세요.
                </div>
              )}
            </div>
          </div>

          {/* 탈락 유형별 맞춤 개입 템플릿 */}
          {(() => {
            const templates = DROPOUT_TEMPLATES[dropoutType] ?? [];
            const DROPOUT_KO: Record<string, string> = {
              cognitive: '인지형', motivational: '동기형', strategic: '전략형',
              sudden: '급락형', dependency: '의존형', compound: '복합형', none: '없음',
            };
            if (!dropoutType || !templates.length) return null;
            return (
              <div className="card" style={{ padding: '16px 22px', border: '2px solid #e0f2fe' }}>
                <button
                  type="button"
                  onClick={() => setTemplateOpen(o => !o)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left',
                  }}
                  aria-expanded={templateOpen}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      background: '#0ea5e920', color: '#0ea5e9', fontSize: 11, fontWeight: 700,
                      padding: '2px 8px', borderRadius: 20,
                    }}>
                      {DROPOUT_KO[dropoutType] ?? dropoutType}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
                      ✨ 탈락 유형 맞춤 개입 템플릿
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-sub)' }}>— 클릭하면 자동 적용됩니다</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-sub)', transform: templateOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                    ▼
                  </span>
                </button>

                {templateOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                    {templates.map((tpl, i) => {
                      const typeInfo = TYPE_OPTIONS.find(t => t.value === tpl.type);
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => applyTemplate(tpl)}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px',
                            borderRadius: 10, border: `1.5px solid ${tpl.color}30`,
                            background: `${tpl.color}08`, cursor: 'pointer', textAlign: 'left',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${tpl.color}18`; (e.currentTarget as HTMLElement).style.borderColor = `${tpl.color}80`; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${tpl.color}08`; (e.currentTarget as HTMLElement).style.borderColor = `${tpl.color}30`; }}
                        >
                          <span style={{
                            width: 38, height: 38, borderRadius: 9, fontSize: 20, flexShrink: 0,
                            background: `${tpl.color}20`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }} aria-hidden="true">{tpl.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{tpl.label}</span>
                              <span style={{
                                fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 20,
                                background: `${tpl.color}20`, color: tpl.color,
                              }}>{typeInfo?.label ?? tpl.type}</span>
                            </div>
                            <p style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.6, margin: 0 }}>{tpl.desc}</p>
                            <p style={{
                              fontSize: 12, color: '#475569', marginTop: 6, lineHeight: 1.6,
                              background: '#f8fafc', borderRadius: 6, padding: '6px 10px',
                              borderLeft: `3px solid ${tpl.color}`,
                              whiteSpace: 'pre-wrap',
                            }}>
                              {tpl.message.length > 100 ? tpl.message.slice(0, 100) + '…' : tpl.message}
                            </p>
                          </div>
                          <span style={{
                            fontSize: 11, fontWeight: 700, color: tpl.color, whiteSpace: 'nowrap',
                            flexShrink: 0, paddingTop: 2,
                          }}>적용 →</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* 개입 유형 */}
          <div className="card" style={{ padding: '20px 22px' }}>
            <label style={{ display: 'block', fontWeight: 700, fontSize: 13, marginBottom: 12 }}>
              🛠️ 개입 유형
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {TYPE_OPTIONS.map(({ value, label, desc, icon, color }) => {
                const selected = form.type === value;
                return (
                  <label key={value} style={{
                    display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 10,
                    border: `2px solid ${selected ? color : 'var(--border)'}`,
                    background: selected ? `${color}10` : '#fff',
                    cursor: 'pointer', transition: 'all 0.12s',
                  }}>
                    <input
                      type="radio" name="type" value={value} checked={selected}
                      onChange={() => setForm(f => ({ ...f, type: value }))}
                      style={{ display: 'none' }}
                    />
                    <span style={{
                      width: 36, height: 36, borderRadius: 8, fontSize: 18, flexShrink: 0,
                      background: selected ? `${color}20` : '#f1f5f9',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }} aria-hidden="true">{icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: selected ? color : 'var(--text)' }}>{label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 2 }}>{desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 문제 추천 전용 UI */}
          {isProblemRec && (
            <div className="card" style={{ padding: '20px 22px' }}>
              <label style={{ display: 'block', fontWeight: 700, fontSize: 13, marginBottom: 12 }}>
                🎯 추천할 문제
              </label>
              {problemsLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ height: 56, background: '#f1f5f9', borderRadius: 10, animation: 'pulse 1.5s infinite' }} />
                  ))}
                </div>
              ) : problems.length === 0 ? (
                <div style={{ fontSize: 13, color: '#991b1b' }}>등록된 문제가 없습니다.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
                  {problems.map(p => {
                    const sel = selectedProblemId === p.id;
                    const dc  = DIFF_COLOR[p.difficulty] ?? '#64748b';
                    return (
                      <label key={p.id} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px',
                        borderRadius: 10, border: `2px solid ${sel ? '#f59e0b' : 'var(--border)'}`,
                        background: sel ? '#fffbeb' : '#fff', cursor: 'pointer', transition: 'all 0.12s',
                      }}>
                        <input
                          type="radio" name="problem" value={p.id} checked={sel}
                          onChange={() => setSelectedProblemId(p.id)}
                          style={{ marginTop: 3, accentColor: '#f59e0b' }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{p.title}</div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: dc }}>
                              {DIFF_LABEL[p.difficulty] ?? p.difficulty}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--text-sub)' }}>{p.category}</span>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              <div style={{ marginTop: 16 }}>
                <label style={{ display: 'block', fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
                  ✍️ 추천 사유 <span style={{ fontWeight: 400, color: 'var(--text-sub)', fontSize: 12 }}>(선택 — 학생에게 전달할 메시지로도 사용됩니다)</span>
                </label>
                <textarea
                  className="form-input"
                  value={recommendReason}
                  onChange={e => setRecommendReason(e.target.value)}
                  placeholder="예: 출력 형식 훈련이 필요해서 추천합니다. 천천히 접근해보세요."
                  rows={3}
                  style={{ resize: 'vertical', lineHeight: 1.7 }}
                  aria-label="추천 사유"
                />
              </div>
            </div>
          )}

          {/* 일반 메시지 (문제 추천 아닐 때) */}
          {!isProblemRec && (
            <div className="card" style={{ padding: '20px 22px' }}>
              <label style={{ display: 'block', fontWeight: 700, fontSize: 13, marginBottom: 8 }} htmlFor="message">
                ✍️ 메시지
              </label>
              <textarea
                id="message"
                className="form-input"
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                required
                placeholder="학생에게 전달할 메시지를 작성하세요..."
                rows={5}
                style={{ resize: 'vertical', lineHeight: 1.7 }}
                aria-label="메시지"
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 11, color: 'var(--text-sub)', marginTop: 4 }}>
                {form.message.length}자
              </div>
            </div>
          )}

          {error && (
            <div style={{
              background: '#fef2f2', color: '#991b1b', padding: '10px 14px',
              borderRadius: 8, fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 8,
            }} role="alert">❌ {error}</div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => navigate(-1)} className="btn btn-ghost" style={{ padding: '10px 22px' }}>
              취소
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ padding: '10px 28px', flex: 1 }}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff',
                    animation: 'spin 0.7s linear infinite', display: 'inline-block',
                  }} aria-hidden="true" />
                  처리 중...
                </span>
              ) : '✅ 개입 생성'}
            </button>
          </div>
        </form>
      </div>

      <ConfirmDialog
        isOpen={showConfirm}
        title="개입 생성 확인"
        message={
          isProblemRec
            ? `'${studentName || '선택된 학생'}' 학생에게 문제 추천 개입을 생성하시겠습니까?\n추천 문제: ${problems.find(p => p.id === selectedProblemId)?.title ?? ''}`
            : `'${studentName || '선택된 학생'}' 학생에게 ${TYPE_OPTIONS.find(t => t.value === form.type)?.label} 개입을 생성하시겠습니까?`
        }
        confirmLabel="생성"
        cancelLabel="취소"
        variant="default"
        onConfirm={handleConfirmCreate}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
