import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import type {
  PromptComparisonResponse,
  PeerHelpThread,
  Problem,
  ProblemLeaderboardResponse,
  PromiCoachResponse,
  PromiCoachLog,
  SubmissionHistoryResponse,
  SubmissionResponse,
} from '../types';

interface FewShotExample {
  input: string;
  output: string;
}

interface TestCaseResult {
  id: number;
  label: string;
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
}

interface ScoreResult {
  accuracy: number;
  format: number;
  consistency: number;
}

interface RunPreviewResponse {
  assembled_prompt: string;
  model_response: string;
  test_input: string;
  test_results: TestCaseResult[];
  scores: ScoreResult;
  improvement_tips: string[];
  status: string;
}

interface RunSnapshot {
  version: number;
  assembledPrompt: string;
  modelResponse: string;
  testResults: TestCaseResult[];
  scores: ScoreResult;
  improvementTips: string[];
}

interface GallerySubmissionItem {
  score: number;
  prompt_preview: string;
  submitted_days_ago: number;
}

interface ProblemGalleryResponse {
  top_submissions: GallerySubmissionItem[];
  score_distribution: Record<string, number>;
  my_best_score: number | null;
}

interface MySubmissionItem {
  id: string;
  final_score: number;
  prompt_text: string;
  created_at: string;
}

interface MySubmissionsResponse {
  submissions: MySubmissionItem[];
}

const LEGACY_SECTION_LABELS = {
  initial: '초기 프롬프트',
  revision: '수정 프롬프트',
} as const;

const SECTION_LABELS = {
  initial: '초안 프롬프트',
  revision: '실행용 프롬프트',
} as const;

function PanelHeader({ icon, title, badge }: { icon: string; title: string; badge?: string }) {
  return (
    <div
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: '#f8faff',
      }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontWeight: 800, fontSize: 13, flex: 1 }}>{title}</span>
      {badge && (
        <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 8px', borderRadius: 20, background: '#eef2ff', color: '#4338ca' }}>
          {badge}
        </span>
      )}
    </div>
  );
}

function FieldHelp({ title, description }: { title: string; description: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </div>
        <button
          type="button"
          onClick={() => setOpen(prev => !prev)}
          style={{ width: 18, height: 18, borderRadius: '50%', border: '1px solid #c7d2fe', background: '#fff', color: 'var(--primary)', fontWeight: 800, cursor: 'pointer', padding: 0 }}
        >
          ?
        </button>
      </div>
      {open && (
        <div style={{ marginTop: 6, background: '#eef2ff', border: '1px solid #c7d2fe', color: '#4338ca', borderRadius: 10, padding: '8px 10px', fontSize: 12, lineHeight: 1.55 }}>
          {description}
        </div>
      )}
    </div>
  );
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
        <span style={{ fontWeight: 700 }}>{label}</span>
        <span style={{ color, fontWeight: 800 }}>{value}%</span>
      </div>
      <div style={{ background: '#e5e7eb', borderRadius: 6, height: 8 }}>
        <div style={{ height: '100%', borderRadius: 6, width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

const safeSectionExtract = (text: string, labels: string[], nextLabels: string[]) => {
  for (const label of labels) {
    const start = text.indexOf(`[${label}]\n`);
    if (start === -1) continue;
    const content = text.slice(start + label.length + 3);
    const endIndexes = nextLabels.map(next => content.indexOf(`\n\n[${next}]`)).filter(index => index >= 0);
    const end = endIndexes.length > 0 ? Math.min(...endIndexes) : content.length;
    return content.slice(0, end).trim();
  }
  return '';
};

const errorMessage = (err: any, fallback: string) => {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map(item => item?.msg || item?.message || JSON.stringify(item))
      .join('\n');
  }
  if (detail && typeof detail === 'object') {
    return detail.msg || detail.message || JSON.stringify(detail);
  }
  return fallback;
};

export default function ProblemWorkPage() {
  const { problemId } = useParams<{ problemId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const retrySubmissionId = searchParams.get('retry');

  const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1440));
  const isMobile = viewportWidth < 768;

  const [problem, setProblem] = useState<Problem | null>(null);
  const [leaderboard, setLeaderboard] = useState<ProblemLeaderboardResponse | null>(null);
  const [threads, setThreads] = useState<PeerHelpThread[]>([]);
  const [threadDrafts, setThreadDrafts] = useState<Record<string, string>>({});
  const [promi, setPromi] = useState<PromiCoachResponse | null>(null);
  const [promiLoading, setPromiLoading] = useState(false);
  const [comparison, setComparison] = useState<PromptComparisonResponse | null>(null);
  const [promiLogs, setPromiLogs] = useState<PromiCoachLog[]>([]);

  const [systemPrompt, setSystemPrompt] = useState('');
  const [userTemplate, setUserTemplate] = useState('{{input}}');
  const [fewShots, setFewShots] = useState<FewShotExample[]>([]);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(500);
  const [testInput, setTestInput] = useState('');

  const [modelResponse, setModelResponse] = useState('');
  const [testResults, setTestResults] = useState<TestCaseResult[]>([]);
  const [scores, setScores] = useState<ScoreResult | null>(null);
  const [assembledPrompt, setAssembledPrompt] = useState('');
  const [improvementTips, setImprovementTips] = useState<string[]>([]);
  const [bestRun, setBestRun] = useState<RunSnapshot | null>(null);

  const [gallery, setGallery] = useState<ProblemGalleryResponse | null>(null);
  const [mySubmissions, setMySubmissions] = useState<MySubmissionItem[]>([]);
  const [resultTab, setResultTab] = useState<'result' | 'gallery'>('result');
  const [showPrevComparison, setShowPrevComparison] = useState(false);
  const [selectedPrevIdx, setSelectedPrevIdx] = useState(0);

  const [loading, setLoading] = useState(false);
  const [outputLoading, setOutputLoading] = useState(false);
  const [runError, setRunError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [isRetry, setIsRetry] = useState(false);

  const startTime = useRef<number>(Date.now());
  const attemptCount = useRef<number>(0);
  const revisionCount = useRef<number>(0);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!problemId) return;
    api.get<{ items: Problem[] }>('/student/problems').then(res => {
      const found = res.data.items.find(item => item.id === problemId) ?? null;
      setProblem(found);
      if (found) setTestInput(found.title.slice(0, 50));
    });
    startTime.current = Date.now();
  }, [problemId]);

  useEffect(() => {
    if (!problemId) return;
    Promise.allSettled([
      api.get<ProblemLeaderboardResponse>('/student/problems/' + problemId + '/leaderboard'),
      api.get<PeerHelpThread[]>('/student/help-threads', { params: { problem_id: problemId } }),
      api.get<PromptComparisonResponse>('/student/prompt-comparisons', { params: { problem_id: problemId } }),
      api.get<PromiCoachLog[]>('/student/promi-coach-logs', { params: { problem_id: problemId, limit: 5 } }),
      api.get<ProblemGalleryResponse>('/student/problems/' + problemId + '/gallery'),
      api.get<MySubmissionsResponse>('/student/problems/' + problemId + '/my-submissions'),
    ]).then(results => {
      if (results[0].status === 'fulfilled') setLeaderboard(results[0].value.data);
      if (results[1].status === 'fulfilled') setThreads(results[1].value.data);
      if (results[2].status === 'fulfilled') setComparison(results[2].value.data);
      if (results[3].status === 'fulfilled') setPromiLogs(results[3].value.data);
      if (results[4].status === 'fulfilled') setGallery(results[4].value.data);
      if (results[5].status === 'fulfilled') setMySubmissions(results[5].value.data.submissions);
    });
  }, [problemId]);

  useEffect(() => {
    if (!retrySubmissionId) return;
    api.get<SubmissionHistoryResponse>('/student/submissions').then(res => {
      const prev = res.data.items.find(item => item.id === retrySubmissionId || item.submission_id === retrySubmissionId);
      if (!prev?.prompt_text) return;
      const text = prev.prompt_text;
      setSystemPrompt(safeSectionExtract(text, [SECTION_LABELS.initial, LEGACY_SECTION_LABELS.initial], [SECTION_LABELS.revision, LEGACY_SECTION_LABELS.revision]));
      setUserTemplate(safeSectionExtract(text, [SECTION_LABELS.revision, LEGACY_SECTION_LABELS.revision], ['실행 미리보기 최고 점수', '최고 점수']) || '{{input}}');
      setIsRetry(true);
    }).catch(() => {});
  }, [retrySubmissionId]);

  const normalizedBestScore = bestRun ? Math.round((bestRun.scores.accuracy + bestRun.scores.format + bestRun.scores.consistency) / 3) : 0;
  const finalBestScore = normalizedBestScore;
  const promiCheckpoints = promi?.checkpoints?.length ? promi.checkpoints : [
    '역할과 목표가 충분히 구체적인지 보기',
    '출력 형식과 제약 조건이 빠지지 않았는지 보기',
    '실행 결과 기준으로 다음에 한 가지씩만 수정하기',
  ];
  const promiPrimaryAction = promiCheckpoints[0];
  const promiStatus = promiLoading ? 'thinking' : (promi ? 'active' : 'idle');

  const fetchPromiCoach = async (latestResponseOverride?: string) => {
    if (!problemId) return;
    setPromiLoading(true);
    try {
      const res = await api.post<PromiCoachResponse>('/student/problems/' + problemId + '/promi-coach', {
        system_prompt: systemPrompt,
        user_template: userTemplate,
        few_shots: fewShots,
        test_input: testInput,
        latest_response: latestResponseOverride ?? modelResponse,
        mode: 'run',
      });
      setPromi(res.data);
      const [comparisonRes, logRes] = await Promise.allSettled([
        api.get<PromptComparisonResponse>('/student/prompt-comparisons', { params: { problem_id: problemId } }),
        api.get<PromiCoachLog[]>('/student/promi-coach-logs', { params: { problem_id: problemId, limit: 5 } }),
      ]);
      if (comparisonRes.status === 'fulfilled') setComparison(comparisonRes.value.data);
      if (logRes.status === 'fulfilled') setPromiLogs(logRes.value.data);
    } catch {
      setPromi({
        name: '프롬이',
        persona: '강아지 코치',
        mode: 'run',
        message: '방금 실행 결과를 기준으로 다음 수정 방향을 같이 볼게요. 답을 고치기보다 지시를 더 선명하게 만드는 쪽이 좋아요.',
        checkpoints: [
          '역할과 목표가 한 문장으로 분명한지 확인하기',
          '출력 형식이나 제약 조건이 빠지지 않았는지 보기',
          'few-shot 또는 테스트 입력을 바꿔 결과 차이를 비교하기',
        ],
        encouragement: '한 번에 전부 바꾸지 말고 한 요소씩 고치면 어떤 수정이 먹히는지 더 잘 보여요.',
        caution: null,
      });
    } finally {
      setPromiLoading(false);
    }
  };

  const refreshThreads = async () => {
    if (!problemId) return;
    const res = await api.get<PeerHelpThread[]>('/student/help-threads', { params: { problem_id: problemId } });
    setThreads(res.data);
  };

  const handleRun = async () => {
    if (!problemId || !systemPrompt.trim()) {
      setRunError('초안 프롬프트를 먼저 작성해주세요.');
      return;
    }
    attemptCount.current += 1;
    setRunError('');
    setOutputLoading(true);
    try {
      const res = await api.post<RunPreviewResponse>('/student/problems/' + problemId + '/run-preview', {
        system_prompt: systemPrompt,
        user_template: userTemplate,
        few_shots: fewShots,
        test_input: testInput,
        temperature,
        max_tokens: maxTokens,
      });
      const data = res.data;
      setModelResponse(data.model_response);
      setTestResults(data.test_results);
      setScores(data.scores);
      setAssembledPrompt(data.assembled_prompt);
      setImprovementTips(data.improvement_tips);
      revisionCount.current += 1;
      const snapshot: RunSnapshot = {
        version: revisionCount.current,
        assembledPrompt: data.assembled_prompt,
        modelResponse: data.model_response,
        testResults: data.test_results,
        scores: data.scores,
        improvementTips: data.improvement_tips,
      };
      const snapshotScore = Math.round((snapshot.scores.accuracy + snapshot.scores.format + snapshot.scores.consistency) / 3);
      const prevScore = bestRun ? Math.round((bestRun.scores.accuracy + bestRun.scores.format + bestRun.scores.consistency) / 3) : -1;
      setBestRun(!bestRun || snapshotScore >= prevScore ? snapshot : bestRun);
      await fetchPromiCoach(data.model_response);
    } catch (err: any) {
      setRunError(errorMessage(err, 'Run 실행 중 오류가 발생했습니다.'));
    } finally {
      setOutputLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!problemId || !systemPrompt.trim()) {
      setSubmitError('초안 프롬프트를 작성해주세요.');
      return;
    }
    if (!bestRun) {
      setSubmitError('먼저 실행해서 자동 채택 버전을 만들어주세요.');
      return;
    }

    const fsSummary = fewShots.filter(f => f.input.trim()).map((f, i) => `예시${i + 1}: ${f.input} -> ${f.output}`).join('; ');
    const failedCases = bestRun.testResults.filter(result => !result.passed);
    const promptText = [
      `[초안 프롬프트]\n${systemPrompt}`,
      `[실행용 프롬프트]\n${userTemplate}${fsSummary ? ` | Few-shot: ${fsSummary}` : ''}`,
      `[실행 미리보기 최고 점수]\n실행점수 ${finalBestScore}`,
      `[현재 채택 버전]\n버전 ${bestRun.version}\n${bestRun.assembledPrompt}`,
      `[실패 케이스 요약]\n${failedCases.length ? failedCases.map(item => `${item.label}: ${item.actual}`).join('\n') : '실패 케이스 없음'}`,
      `[추천 수정 액션]\n${bestRun.improvementTips.join('\n')}`,
      `[자동 채택 응답]\n${bestRun.modelResponse}`,
    ].join('\n\n');

    const sessionSec = Math.floor((Date.now() - startTime.current) / 1000);
    const behavioralData = {
      login_frequency: Math.min(1, attemptCount.current / 10),
      session_duration: Math.min(1, sessionSec / 3600),
      submission_interval: 0.5,
      drop_midway_rate: 0,
      attempt_count: attemptCount.current,
      revision_count: revisionCount.current,
      retry_count: isRetry ? 1 : 0,
      strategy_change_count: 0,
      task_success_rate: normalizedBestScore / 100,
      quiz_score_avg: 0.7,
      score_delta: 0,
    };

    setLoading(true);
    setSubmitError('');
    try {
      const res = await api.post<SubmissionResponse>('/student/submissions', {
        problem_id: problemId,
        prompt_text: promptText,
        raw_score: normalizedBestScore,
        behavioral_data: behavioralData,
      });
      setShowSuccess(true);
      setTimeout(() => navigate('/submissions/' + res.data.id + '/result'), 1500);
    } catch (err: any) {
      setSubmitError(errorMessage(err, '제출에 실패했습니다.'));
    } finally {
      setLoading(false);
    }
  };

  const requestHelp = async (helperStudentId: string) => {
    if (!problemId) return;
    const message = window.prompt('상위권 학생에게 보낼 질문을 입력하세요. 생성되면 아래 또래 도움 스레드에서 둘만 댓글형으로 이어집니다.');
    if (!message?.trim()) return;
    await api.post('/student/problems/' + problemId + '/help-threads', { helper_student_id: helperStudentId, message });
    await refreshThreads();
  };

  const sendThreadMessage = async (threadId: string) => {
    const message = (threadDrafts[threadId] ?? '').trim();
    if (!message) return;
    const res = await api.post<PeerHelpThread>('/student/help-threads/' + threadId + '/messages', { message });
    setThreads(prev => prev.map(thread => (thread.id === threadId ? res.data : thread)));
    setThreadDrafts(prev => ({ ...prev, [threadId]: '' }));
  };

  const markHelpful = async (threadId: string, messageId: string) => {
    const res = await api.post<PeerHelpThread>('/student/help-threads/' + threadId + '/messages/' + messageId + '/helpful');
    setThreads(prev => prev.map(thread => (thread.id === threadId ? res.data : thread)));
  };

  const addFewShot = () => setFewShots(prev => [...prev, { input: '', output: '' }]);
  const removeFewShot = (index: number) => setFewShots(prev => prev.filter((_, idx) => idx !== index));
  const updateFewShot = (index: number, field: 'input' | 'output', value: string) => setFewShots(prev => prev.map((shot, idx) => (idx === index ? { ...shot, [field]: value } : shot)));

  const panelStyle: React.CSSProperties = {
    background: 'var(--card)',
    borderRadius: 18,
    border: '1px solid rgba(148, 163, 184, 0.18)',
    boxShadow: '0 10px 28px rgba(15, 23, 42, 0.07)',
    overflow: 'hidden',
  };

  const textAreaStyle: React.CSSProperties = {
    width: '100%',
    borderRadius: 10,
    border: '1px solid var(--border)',
    padding: '10px 12px',
    fontSize: 13,
    lineHeight: 1.6,
    background: '#fafbff',
    color: 'var(--text)',
    boxSizing: 'border-box',
  };
  const submitChecklist = [
    { label: '역할/목표가 분명한가', ok: systemPrompt.trim().length >= 40 },
    { label: '실행용 프롬프트에 {{input}} 가 있는가', ok: userTemplate.includes('{{input}}') },
    { label: '출력 형식 또는 제약을 적었는가', ok: /형식|format|json|markdown|목록|출력/i.test(systemPrompt) },
    { label: '최소 1회 이상 실행해봤는가', ok: attemptCount.current > 0 },
  ];

  return (
    <div className="animate-in" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 320px', gap: 16, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
        <div style={{ background: 'linear-gradient(135deg, #312e81 0%, #4f46e5 52%, #7c3aed 100%)', borderRadius: 22, padding: isMobile ? '18px 16px' : '18px 22px', color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', gap: 12, flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/problems')} style={{ background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff', borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>← 목록</button>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)', fontWeight: 700, marginBottom: 4 }}>프롬프트 엔지니어링 실습</div>
              <div style={{ fontSize: isMobile ? 18 : 20, fontWeight: 900 }}>{problem ? problem.title : '문제를 불러오는 중입니다'}</div>
            </div>
            {isRetry && <span style={{ background: '#fbbf24', color: '#78350f', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>재도전</span>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
          <div style={panelStyle}>
            <PanelHeader icon="📋" title="① 과제 / 목표" badge={problem?.difficulty ?? ''} />
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: '#f8faff', borderRadius: 12, padding: '12px 14px', fontSize: 13, lineHeight: 1.7, border: '1px solid #e8edff' }}>{problem?.description ?? '문제 정보를 불러오는 중...'}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['정확도 80% 이상', '출력 형식 유지', '응답 일관성 확보'].map(goal => (
                <span key={goal} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: 'var(--primary-pale)', color: 'var(--primary)', fontWeight: 700 }}>{goal}</span>
              ))}
            </div>
            <div style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px', fontSize: 12, lineHeight: 1.7, color: 'var(--text-sub)' }}>
              막히는 지점이 있으면 오른쪽의 `프롬이` 코칭을 참고해 실행 결과 기준으로 한 단계씩 수정해보세요.
            </div>
            </div>
          </div>

          <div style={panelStyle}>
            <PanelHeader icon="📊" title="② 분석 / 정리" />
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: '#f8faff', borderRadius: 12, padding: '12px 14px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-sub)', marginBottom: 4 }}>실행 미리보기 최고 점수</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#4338ca' }}>{finalBestScore}</div>
                <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 4 }}>LLM 루브릭 1회 평가 점수입니다. 최종 제출 점수는 같은 기준의 5회 평균이라 약간 다를 수 있습니다.</div>
              </div>
              <div style={{ background: '#f8faff', borderRadius: 12, padding: '12px 14px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-sub)', marginBottom: 4 }}>현재 채택 버전</div>
                <div style={{ fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{bestRun ? `버전 ${bestRun.version}\n${bestRun.assembledPrompt}` : '아직 채택된 버전이 없습니다.'}</div>
              </div>
              <div style={{ background: '#f8faff', borderRadius: 12, padding: '12px 14px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-sub)', marginBottom: 8 }}>실패 케이스 요약</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {bestRun?.testResults.filter(item => !item.passed).length ? bestRun.testResults.filter(item => !item.passed).map(item => (
                    <div key={item.id} style={{ fontSize: 12, color: '#9a3412' }}>{item.label}: {item.actual}</div>
                  )) : <div style={{ fontSize: 12, color: '#166534' }}>실패 케이스 없음</div>}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {(bestRun?.improvementTips ?? improvementTips).map((tip, index) => (
                  <div key={index} style={{ fontSize: 12, padding: '9px 12px', background: tip.startsWith('🌟') ? '#f0fdf4' : '#fff7ed', border: `1px solid ${tip.startsWith('🌟') ? '#86efac' : '#fed7aa'}`, borderRadius: 10 }}>{tip}</div>
                ))}
              </div>
            </div>
          </div>

          <div style={panelStyle}>
            <PanelHeader icon="✏️" title="③ 프롬프트 에디터" />
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Feature 3: 이전 제출 비교 토글 */}
            {mySubmissions.length > 0 && (
              <div style={{ borderRadius: 10, border: showPrevComparison ? '1px solid #86efac' : '1px dashed #a5b4fc', overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => setShowPrevComparison(prev => !prev)}
                  style={{
                    width: '100%', textAlign: 'left', fontSize: 12, padding: '9px 14px',
                    border: 'none', background: showPrevComparison ? '#dcfce7' : '#f5f3ff',
                    color: showPrevComparison ? '#166534' : '#4338ca', fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}
                >
                  <span>📋 이전 제출 참고하기 <span style={{ fontWeight: 400, opacity: 0.75 }}>({mySubmissions.length}개 이력)</span></span>
                  <span style={{ fontSize: 10 }}>{showPrevComparison ? '▲ 닫기' : '▼ 펼치기'}</span>
                </button>
                {showPrevComparison && (
                  <div style={{ background: '#f0fdf4', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#166534', whiteSpace: 'nowrap' }}>제출 선택</label>
                      <select
                        value={selectedPrevIdx}
                        onChange={e => setSelectedPrevIdx(Number(e.target.value))}
                        style={{ fontSize: 12, padding: '4px 8px', borderRadius: 8, border: '1px solid #86efac', background: '#fff', flex: 1 }}
                      >
                        {mySubmissions.map((sub, idx) => (
                          <option key={sub.id} value={idx}>
                            {new Date(sub.created_at).toLocaleDateString('ko-KR')} · {Math.round(sub.final_score)}점
                            {idx === 0 ? ' (최신)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ fontSize: 11, color: '#166534', marginBottom: -4 }}>
                      선택한 제출의 프롬프트 (읽기 전용) — 참고해서 개선해보세요
                    </div>
                    <textarea
                      readOnly
                      value={mySubmissions[selectedPrevIdx]?.prompt_text ?? ''}
                      style={{ ...textAreaStyle, minHeight: 100, background: '#fff', color: '#166534', fontSize: 11, border: '1px solid #86efac' }}
                      rows={5}
                    />
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const prev = mySubmissions[selectedPrevIdx];
                          if (prev) {
                            const extracted = safeSectionExtract(prev.prompt_text, [SECTION_LABELS.initial, LEGACY_SECTION_LABELS.initial], [SECTION_LABELS.revision, LEGACY_SECTION_LABELS.revision]);
                            setSystemPrompt(extracted || prev.prompt_text);
                          }
                        }}
                        style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                      >
                        에디터에 불러오기
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPrevComparison(false)}
                        style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: '1px solid #86efac', background: '#fff', color: '#166534', fontWeight: 700, cursor: 'pointer' }}
                      >
                        닫기
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div>
              <FieldHelp title="초안 프롬프트" description="모델의 역할, 목표, 제약을 먼저 정의하는 영역입니다." />
              <textarea style={{ ...textAreaStyle, minHeight: 120 }} value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} rows={6} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <div>
                <FieldHelp title="실행용 프롬프트" description="{{input}} 자리에 테스트 입력이 치환됩니다." />
                <textarea style={{ ...textAreaStyle, minHeight: 88, fontFamily: 'monospace' }} value={userTemplate} onChange={e => setUserTemplate(e.target.value)} rows={4} />
              </div>
              <div>
                <FieldHelp title="테스트 입력" description="현재 프롬프트를 시험해볼 예시 입력입니다." />
                <textarea style={{ ...textAreaStyle, minHeight: 88, fontFamily: 'monospace' }} value={testInput} onChange={e => setTestInput(e.target.value)} rows={4} />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <FieldHelp title="Few-shot 예시" description="입력과 원하는 출력 예시를 함께 주어 응답 패턴을 고정합니다." />
                <button type="button" onClick={addFewShot} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, background: 'var(--primary-pale)', color: 'var(--primary)', border: 'none', fontWeight: 800, cursor: 'pointer' }}>+ 예시 추가</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {fewShots.map((shot, index) => (
                  <div key={index} style={{ background: '#f8faff', borderRadius: 12, padding: 12, border: '1px solid #e8edff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--primary)' }}>예시 {index + 1}</span>
                      <button type="button" onClick={() => removeFewShot(index)} style={{ fontSize: 11, background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 800 }}>삭제</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                      <textarea style={{ ...textAreaStyle, minHeight: 78, fontSize: 12 }} value={shot.input} onChange={e => updateFewShot(index, 'input', e.target.value)} placeholder="입력 예시" rows={4} />
                      <textarea style={{ ...textAreaStyle, minHeight: 78, fontSize: 12 }} value={shot.output} onChange={e => updateFewShot(index, 'output', e.target.value)} placeholder="출력 예시" rows={4} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 10, background: '#f8faff', borderRadius: 14, padding: '12px 14px', border: '1px solid var(--border)' }}>
              <div>
                <FieldHelp title="Temperature" description="낮을수록 안정적이고, 높을수록 더 다양한 답을 냅니다." />
                <input type="range" min={0} max={1} step={0.1} value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} style={{ width: '100%' }} />
              </div>
              <div>
                <FieldHelp title="Max Tokens" description="모델이 출력할 최대 길이입니다." />
                <input type="range" min={100} max={2000} step={100} value={maxTokens} onChange={e => setMaxTokens(parseInt(e.target.value, 10))} style={{ width: '100%' }} />
              </div>
            </div>
          </div>
          </div>

          <div style={panelStyle}>
            {/* Tab header */}
            <div style={{ borderBottom: '1px solid var(--border)', background: '#f8faff', display: 'flex', gap: 0 }}>
              {(['result', 'gallery'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setResultTab(tab)}
                  style={{
                    padding: '10px 16px',
                    fontSize: 12,
                    fontWeight: 800,
                    border: 'none',
                    background: resultTab === tab ? '#fff' : 'transparent',
                    borderBottom: resultTab === tab ? '2px solid #4f46e5' : '2px solid transparent',
                    color: resultTab === tab ? '#4338ca' : 'var(--text-sub)',
                    cursor: 'pointer',
                  }}
                >
                  {tab === 'result' ? '④ 실행 결과' : '🏆 갤러리'}
                </button>
              ))}
              {testResults.length > 0 && resultTab === 'result' && (
                <span style={{ marginLeft: 'auto', padding: '10px 12px', fontSize: 11, color: '#4338ca', fontWeight: 800 }}>
                  {testResults.filter(item => item.passed).length}/{testResults.length} 통과
                </span>
              )}
            </div>

            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {resultTab === 'result' ? (
                <>
                  {runError && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700 }}>❌ {runError}</div>}
                  {outputLoading ? (
                    <div style={{ minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--primary)' }}>분석 중...</div>
                  ) : (
                    <>
                      <div style={{ background: '#0f172a', color: '#e2e8f0', borderRadius: 12, padding: '12px 14px', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                        {modelResponse || '실행 결과가 여기에 표시됩니다.'}
                      </div>
                      {scores && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <ScoreBar label="LLM 루브릭 점수" value={scores.accuracy} color={scores.accuracy >= 80 ? '#10b981' : '#ef4444'} />
                          <ScoreBar label="최종 기준 일치도" value={scores.format} color={scores.format >= 80 ? '#10b981' : '#f59e0b'} />
                          <ScoreBar label="1회 평가 점수" value={scores.consistency} color={scores.consistency >= 80 ? '#10b981' : '#f59e0b'} />
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {testResults.map(result => (
                          <div key={result.id} style={{ padding: '10px 12px', borderRadius: 12, background: result.passed ? '#f0fdf4' : '#fef2f2', border: `1px solid ${result.passed ? '#86efac' : '#fca5a5'}` }}>
                            <div style={{ fontWeight: 800, fontSize: 12 }}>{result.label}</div>
                            <div style={{ fontSize: 12, marginTop: 4 }}>{result.actual}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                /* Gallery tab */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {!gallery ? (
                    /* 로딩 중 스켈레톤 */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[80, 60, 40].map(w => (
                        <div key={w} style={{ height: 14, borderRadius: 6, background: '#e5e7eb', width: `${w}%` }} />
                      ))}
                    </div>
                  ) : (
                    <>
                      {/* 내 최고 점수 배지 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        {gallery.my_best_score != null ? (
                          <div style={{ background: '#eef2ff', border: '1px solid #a5b4fc', borderRadius: 10, padding: '7px 14px', fontSize: 13, fontWeight: 800, color: '#4338ca' }}>
                            🏅 나의 최고 점수: {Math.round(gallery.my_best_score)}점
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: 'var(--text-sub)', fontStyle: 'italic' }}>아직 이 문제를 제출하지 않았어요.</div>
                        )}
                        {/* 전체 제출 수 */}
                        {(() => {
                          const total = Object.values(gallery.score_distribution).reduce((a, b) => a + b, 0);
                          return total > 0 ? (
                            <span style={{ fontSize: 11, color: 'var(--text-sub)' }}>총 {total}명 참여</span>
                          ) : null;
                        })()}
                      </div>

                      {/* 문제별 점수 대시보드 + 도움 요청 */}
                      <div style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--text-main)' }}>문제별 점수 대시보드</div>
                            <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 3, lineHeight: 1.5 }}>
                              개념 설명까지 통과한 상위권 학생에게 바로 도움 스레드를 신청할 수 있습니다.
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, padding: '4px 9px', borderRadius: 20, background: '#eef2ff', color: '#4338ca', fontWeight: 800 }}>내 최고점 {leaderboard?.my_best_score ?? 0}</span>
                            <span style={{ fontSize: 11, padding: '4px 9px', borderRadius: 20, background: '#ecfdf5', color: '#047857', fontWeight: 800 }}>익명 백분위 {leaderboard?.my_percentile ?? 0}%</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {(leaderboard?.top_students ?? []).length > 0 ? (leaderboard?.top_students ?? []).map(entry => (
                            <div key={entry.rank} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'auto minmax(0, 1fr) auto', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 12, background: '#f8faff', border: '1px solid var(--border)' }}>
                              <div style={{ width: 30, height: 30, borderRadius: 10, background: '#eef2ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 12 }}>{entry.rank}</div>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 800 }}>{entry.display_name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-sub)' }}>점수 {entry.best_score} · 도움 포인트 {entry.helper_points}</div>
                              </div>
                              <button type="button" onClick={() => requestHelp(entry.student_id)} className="btn btn-ghost" style={{ padding: '7px 10px', fontSize: 11 }}>도움 요청</button>
                            </div>
                          )) : (
                            <div style={{ fontSize: 12, color: 'var(--text-sub)', background: '#f8faff', border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
                              아직 개념 설명까지 통과한 랭킹 데이터가 없습니다.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 점수 분포 */}
                      {(() => {
                        const total = Object.values(gallery.score_distribution).reduce((a, b) => a + b, 0);
                        return total > 0 ? (
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-sub)', marginBottom: 8 }}>점수 분포</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {(['85-100', '70-84', '50-69', '0-49'] as const).map(range => {
                                const count = gallery.score_distribution[range] ?? 0;
                                const pct = Math.round((count / total) * 100);
                                const color = range === '85-100' ? '#10b981' : range === '70-84' ? '#3b82f6' : range === '50-69' ? '#f59e0b' : '#ef4444';
                                const label = range === '85-100' ? '상위 (85-100점)' : range === '70-84' ? '합격 (70-84점)' : range === '50-69' ? '경계 (50-69점)' : '미달 (0-49점)';
                                return (
                                  <div key={range} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, width: 80, color, flexShrink: 0 }}>{label}</span>
                                    <div style={{ flex: 1, background: '#e5e7eb', borderRadius: 6, height: 10 }}>
                                      <div style={{ height: '100%', borderRadius: 6, width: `${pct}%`, background: color, transition: 'width 0.5s ease' }} />
                                    </div>
                                    <span style={{ fontSize: 11, color: 'var(--text-sub)', width: 32, textAlign: 'right', flexShrink: 0 }}>{count}명</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : null;
                      })()}

                      {/* 상위 제출 목록 */}
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-sub)', marginBottom: 8 }}>상위 제출 미리보기 (익명)</div>
                        {gallery.top_submissions.length ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {gallery.top_submissions.map((sub, idx) => (
                              <div key={idx} style={{ background: '#f8faff', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                  <span style={{ fontSize: 12, fontWeight: 800, color: '#4338ca' }}>
                                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '▪'} 익명 학생 · {Math.round(sub.score)}점
                                  </span>
                                  <span style={{ fontSize: 11, color: 'var(--text-sub)' }}>{sub.submitted_days_ago === 0 ? '오늘' : `${sub.submitted_days_ago}일 전`}</span>
                                </div>
                                <div style={{ background: '#e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 11, fontFamily: 'monospace', color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                  {sub.prompt_preview}{sub.prompt_preview.length >= 100 ? '…' : ''}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: 'var(--text-sub)', textAlign: 'center', padding: '20px 0' }}>
                            아직 80점 이상 제출이 없어요.<br />
                            <span style={{ fontSize: 11 }}>첫 번째 상위 제출자가 되어보세요! 🚀</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="responsive-two-col" style={{ gap: 14 }}>
          <div className="card" style={{ padding: 18 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>또래 도움 스레드</div>
            <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>신청은 갤러리 탭의 `문제별 점수 대시보드`에서 합니다. 생성된 스레드는 요청자와 도움 제공자만 댓글형으로 볼 수 있고, 도움된 답변에 포인트를 줄 수 있습니다.</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {threads.length > 0 ? threads.map(thread => (
              <div key={thread.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: '#f8faff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>{thread.helper_name} 스레드</div>
                  <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: thread.status === 'resolved' ? '#dcfce7' : '#eef2ff', color: thread.status === 'resolved' ? '#166534' : '#4338ca', fontWeight: 800 }}>{thread.status}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                  {thread.messages.map(message => (
                    <div key={message.id} style={{ background: '#fff', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 800 }}>{message.sender_name}</span>
                        {!thread.helpful_marked && message.sender_role === 'helper' && (
                          <button type="button" onClick={() => markHelpful(thread.id, message.id)} style={{ fontSize: 11, border: 'none', background: '#fef3c7', color: '#92400e', borderRadius: 8, padding: '5px 8px', fontWeight: 800, cursor: 'pointer' }}>
                            도움됐어요 +5점
                          </button>
                        )}
                      </div>
                      <div style={{ fontSize: 12, lineHeight: 1.6 }}>{message.content}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input value={threadDrafts[thread.id] ?? ''} onChange={e => setThreadDrafts(prev => ({ ...prev, [thread.id]: e.target.value }))} placeholder="댓글을 입력하세요" className="form-input" style={{ flex: 1, minWidth: 180 }} />
              <button type="button" onClick={() => sendThreadMessage(thread.id)} className="btn btn-primary" style={{ padding: '8px 12px', fontSize: 12 }}>댓글 등록</button>
                </div>
              </div>
            )) : <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>아직 생성된 도움 스레드가 없습니다.</div>}
          </div>
        </div>

        <div className="responsive-two-col" style={{ gap: 14 }}>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>제출 전 체크리스트</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {submitChecklist.map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: 12, background: item.ok ? '#f0fdf4' : '#fff7ed', border: `1px solid ${item.ok ? '#86efac' : '#fed7aa'}` }}>
                  <span style={{ fontSize: 12 }}>{item.label}</span>
                  <strong style={{ fontSize: 12, color: item.ok ? '#166534' : '#9a3412' }}>{item.ok ? '완료' : '점검 필요'}</strong>
                </div>
              ))}
            </div>
          </div>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>프롬프트 버전 비교</div>
            {comparison?.current ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>
                  최근 점수 변화 {comparison.score_delta !== null && comparison.score_delta !== undefined ? `${comparison.score_delta >= 0 ? '+' : ''}${comparison.score_delta}` : '—'}
                </div>
                <div style={{ background: '#f8faff', borderRadius: 12, padding: '12px 14px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-sub)', marginBottom: 4 }}>현재 제출본</div>
                  <div style={{ fontSize: 12, lineHeight: 1.6 }}>{comparison.current.summary}</div>
                </div>
                {comparison.previous && (
                  <div style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-sub)', marginBottom: 4 }}>이전 제출본</div>
                    <div style={{ fontSize: 12, lineHeight: 1.6 }}>{comparison.previous.summary}</div>
                  </div>
                )}
                {comparison.summary_delta.map((line, index) => <div key={index} style={{ fontSize: 12, color: '#4338ca' }}>{line}</div>)}
              </div>
            ) : <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>제출 후 이전 버전과 비교 정보가 여기에 쌓입니다.</div>}
          </div>
        </div>
      </div>

        <div style={{ position: isMobile ? 'static' : 'sticky', bottom: 18, zIndex: 20, background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(10px)', border: '1px solid rgba(148, 163, 184, 0.22)', borderRadius: 18, padding: isMobile ? 14 : 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) auto', gap: 14, alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {[`시도 ${attemptCount.current}회`, `수정 ${revisionCount.current}회`, `실행점수 ${finalBestScore}`].map(item => (
                  <span key={item} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#eef2ff', color: '#4338ca' }}>{item}</span>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.5 }}>결과 실행 점수는 LLM 루브릭 1회 평가이고, 최종 제출 점수는 같은 프롬프트를 루브릭으로 5회 평가한 평균입니다. 실행 후에는 오른쪽 `프롬이`가 다음 수정 방향을 바로 안내합니다.</div>
              {submitError && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700 }}>❌ {submitError}</div>}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: isMobile ? 'stretch' : 'flex-end' }}>
              <button onClick={handleRun} disabled={outputLoading} style={{ minWidth: isMobile ? '100%' : 148, padding: '12px 18px', borderRadius: 12, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', border: 'none', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>▶ 결과 실행</button>
              <button onClick={handleSubmit} disabled={loading} style={{ minWidth: isMobile ? '100%' : 164, padding: '12px 18px', borderRadius: 12, background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>🚀 최종 제출</button>
            </div>
          </div>
        </div>

        {showSuccess && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
            <div style={{ background: '#fff', borderRadius: 20, padding: '28px 32px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.16)', minWidth: isMobile ? 280 : 360 }}>
              <div style={{ fontSize: 54, marginBottom: 12 }}>🎉</div>
              <h3 style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>제출 완료!</h3>
              <p style={{ color: 'var(--text-sub)', fontSize: 14, marginBottom: 16 }}>5회 루브릭 평균 평가가 완료되어 결과 페이지로 이동하고 있습니다.</p>
            </div>
          </div>
        )}
      </div>

      <aside style={{ position: isMobile ? 'static' : 'sticky', top: 92, alignSelf: 'start' }}>
        <div style={{ background: 'linear-gradient(180deg, #fffdf7 0%, #fff6e7 100%)', borderRadius: 24, border: '1px solid #fdba74', boxShadow: '0 16px 40px rgba(217, 119, 6, 0.14)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid #fed7aa', display: 'flex', alignItems: 'center', gap: 12, background: 'linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,247,237,0.95))' }}>
            <div style={{ width: 56, height: 56, borderRadius: 18, background: promiStatus === 'thinking' ? '#fde68a' : '#ffedd5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, boxShadow: 'inset 0 -6px 12px rgba(255,255,255,0.55)' }}>
              {promiStatus === 'thinking' ? '🐕' : '🐶'}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#9a3412' }}>프롬이</div>
              <div style={{ fontSize: 12, color: '#c2410c', fontWeight: 700 }}>
                강아지 코치 · {promiStatus === 'thinking' ? '실행 결과 읽는 중' : promi ? '방금 실행 기준 코칭' : '실행 전 대기'}
              </div>
            </div>
            <div style={{ padding: '5px 9px', borderRadius: 999, background: promiStatus === 'thinking' ? '#fef3c7' : '#ecfdf5', color: promiStatus === 'thinking' ? '#92400e' : '#166534', fontSize: 11, fontWeight: 900 }}>
              {promiStatus === 'thinking' ? '분석 중' : 'LIVE'}
            </div>
          </div>
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ alignSelf: 'flex-start', maxWidth: '100%', background: '#ffffff', border: '1px solid #fdba74', borderRadius: 18, borderTopLeftRadius: 8, padding: '12px 14px', fontSize: 13, lineHeight: 1.7, color: '#7c2d12', boxShadow: '0 10px 24px rgba(251, 146, 60, 0.08)' }}>
                {promiLoading
                  ? '방금 실행한 결과를 보고 있어요. 지금 바로 고치면 좋은 한 가지를 골라볼게요.'
                  : (promi?.message ?? '결과 실행을 누르면 제가 방금 나온 결과를 보고 다음 수정 방향을 짧고 명확하게 알려드릴게요.')}
              </div>
              <div style={{ background: '#7c2d12', color: '#fff7ed', borderRadius: 18, borderTopRightRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.03em', marginBottom: 6, opacity: 0.82 }}>지금 먼저 고칠 것</div>
                <div style={{ fontSize: 13, lineHeight: 1.6, fontWeight: 700 }}>
                  {promiPrimaryAction}
                </div>
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.78)', border: '1px solid #fed7aa', borderRadius: 16, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: '#9a3412', marginBottom: 8 }}>체크리스트</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {promiCheckpoints.map((item, index) => (
                  <div key={index} style={{ display: 'grid', gridTemplateColumns: '20px minmax(0, 1fr)', gap: 8, alignItems: 'start', fontSize: 12, color: '#7c2d12', lineHeight: 1.6 }}>
                    <div style={{ width: 20, height: 20, borderRadius: 999, background: index === 0 ? '#fdba74' : '#ffedd5', color: index === 0 ? '#7c2d12' : '#c2410c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>
                      {index + 1}
                    </div>
                    <div>{item}</div>
                  </div>
                ))}
              </div>
            </div>
            {promi?.caution && (
              <div style={{ background: '#fff1f2', border: '1px solid #fda4af', borderRadius: 16, padding: '12px 14px', fontSize: 12, lineHeight: 1.6, color: '#9f1239' }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>이 방향은 피하기</div>
                <div>{promi.caution}</div>
              </div>
            )}
            <div style={{ background: '#ecfdf5', border: '1px solid #86efac', borderRadius: 16, padding: '12px 14px', fontSize: 12, lineHeight: 1.6, color: '#166534' }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>프롬이 한마디</div>
              <div>{promi?.encouragement ?? '실행 결과를 보고 바로 한 단계씩 다듬어가면 제출 전에 훨씬 안정적인 버전을 만들 수 있어요.'}</div>
            </div>
            <div style={{ background: '#ffffff', border: '1px solid #fed7aa', borderRadius: 16, padding: '12px 14px' }}>
              <div style={{ fontWeight: 900, marginBottom: 8, fontSize: 11, color: '#9a3412' }}>프롬이 최근 로그</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {promiLogs.length ? promiLogs.map(log => (
                  <div key={log.id} style={{ fontSize: 12, lineHeight: 1.6, color: '#7c2d12' }}>
                    <div style={{ fontWeight: 800 }}>v{log.run_version}</div>
                    <div>{log.message}</div>
                  </div>
                )) : <div style={{ fontSize: 12, color: '#7c2d12' }}>실행 후 코칭 로그가 여기에 쌓입니다.</div>}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
