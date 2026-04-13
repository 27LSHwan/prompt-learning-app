import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../lib/api';
import { getUserId } from '../lib/auth';
import { unwrapRiskResponse } from '../lib/risk';
import RiskBadge from '../components/RiskBadge';
import RiskGauge from '../components/RiskGauge';
import { CharacterMessage } from '../components/CharacterMessage';
import type { ConceptReflectionResponse, Problem, RiskDetail, RiskStatusResponse } from '../types';
import type { Emotion } from '../components/Character';

interface CriterionScore {
  name: string;
  score: number;
  max_score: number;
  feedback: string;
}

interface CharacterFeedbackResponse {
  submission_id: string;
  character_name: string;
  emotion: string;
  main_message: string;
  tips: string[];
  encouragement: string;
  growth_note: string | null;
  score_delta: number | null;
  total_score: number;
  criteria_scores: CriterionScore[];
  pass_threshold: number;
}

const safeNumber = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

export default function SubmissionResultPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const [risk, setRisk]     = useState<RiskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [characterFeedback, setCharacterFeedback] = useState<CharacterFeedbackResponse | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [submissionScore, setSubmissionScore] = useState(0);
  const [passThreshold, setPassThreshold] = useState(80);
  const [problemId, setProblemId] = useState<string | null>(null);
  const [reflectionProblem, setReflectionProblem] = useState<Problem | null>(null);
  const [reflectionTranscripts, setReflectionTranscripts] = useState<Record<number, string>>({});
  const [reflectionResult, setReflectionResult] = useState<ConceptReflectionResponse | null>(null);
  const [reflectionLoading, setReflectionLoading] = useState(false);
  const [reflectionError, setReflectionError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingQuestionIndex, setRecordingQuestionIndex] = useState<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const activeRecordingIndexRef = useRef<number | null>(null);
  const recordingStartedAt = useRef<number | null>(null);
  const recordingDurations = useRef<Record<number, number>>({});

  useEffect(() => {
    const id = getUserId();
    if (!id) return;
    setTimeout(() => {
      api.get<RiskStatusResponse>('/student/risk')
        .then(r => setRisk(unwrapRiskResponse(r.data)))
        .catch(() => setRisk(null))
        .finally(() => setLoading(false));
    }, 800);

    // Fetch submission info for problemId
    api.get('/student/submissions?limit=50')
      .then(r => {
        const found = (r.data as any).items.find(
          (s: any) => s.submission_id === submissionId || s.id === submissionId
        );
        if (found?.problem_id) setProblemId(found.problem_id);
        setSubmissionScore(safeNumber(found?.final_score, safeNumber(found?.total_score, 0)));
        if (found?.concept_reflection_passed) {
          setReflectionResult({
            submission_id: submissionId || found.submission_id || found.id || '',
            passed: true,
            score: safeNumber(found.concept_reflection_score, 70),
            required_score: 70,
            feedback: found.concept_reflection_feedback || '이미 마이크 개념 설명을 통과했습니다.',
            missing_points: [],
            evaluation_method: 'stored',
            question_results: [],
          });
        }
      })
      .catch(() => {});
  }, [submissionId]);

  useEffect(() => {
    if (!problemId) return;
    api.get<Problem>('/student/problems/' + problemId)
      .then(r => setReflectionProblem(r.data))
      .catch(() => setReflectionProblem(null));
  }, [problemId]);

  useEffect(() => () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  useEffect(() => {
    if (!submissionId || !reflectionResult?.passed) return;
    setFeedbackLoading(true);
    api.post<CharacterFeedbackResponse>(`/student/submissions/${submissionId}/feedback`)
      .then(r => {
        setCharacterFeedback(r.data);
        setPassThreshold(safeNumber(r.data.pass_threshold, 80));
        setSubmissionScore(safeNumber(r.data.total_score, submissionScore));
      })
      .catch(() => setCharacterFeedback(null))
      .finally(() => setFeedbackLoading(false));
  }, [submissionId, reflectionResult?.passed]);

  const breakdownItems = risk
    ? [
        { label: '현재 위험 점수', val: safeNumber(risk.total_risk), icon: '📊', color: '#4f46e5' },
        { label: '학습 기반 점수', val: safeNumber(risk.base_risk), icon: '🧩', color: '#0ea5e9' },
        { label: '추가 가중치', val: safeNumber(risk.event_bonus), icon: '⚡', color: '#f59e0b' },
        { label: '사고 과정 점수', val: safeNumber(risk.thinking_risk), icon: '🧠', color: '#a855f7' },
        { label: '위험 단계', val: risk.risk_stage, icon: '🚦', color: '#ef4444', isText: true },
        { label: '학습 유형', val: risk.dropout_type, icon: '🗂️', color: '#0891b2', isText: true },
      ]
    : [];
  const reflectionQuestions = reflectionProblem?.concept_check_questions?.length
    ? reflectionProblem.concept_check_questions
    : [
        '핵심 개념이나 방법론은 무엇인가요?',
        '내 프롬프트에서 어디에 반영했나요?',
        '이 문제에 맞는 프롬프트 개념을 설명해보세요.',
      ];
  const effectiveScore = characterFeedback ? characterFeedback.total_score : submissionScore;
  const scorePassed = effectiveScore >= passThreshold;
  const conceptPassed = Boolean(reflectionResult?.passed);
  const recognized = scorePassed && conceptPassed;
  const completedReflectionCount = reflectionQuestions.filter((_, index) => (reflectionTranscripts[index] ?? '').trim().length >= 20).length;
  const incompleteReflectionIndex = reflectionQuestions.findIndex((_, index) => (reflectionTranscripts[index] ?? '').trim().length < 20);

  const finishRecording = () => {
    const index = activeRecordingIndexRef.current;
    if (index !== null && recordingStartedAt.current) {
      recordingDurations.current[index] = Math.max(1, Math.round((Date.now() - recordingStartedAt.current) / 1000));
    }
    activeRecordingIndexRef.current = null;
    recordingStartedAt.current = null;
    setRecordingQuestionIndex(null);
    setIsRecording(false);
  };

  const startRecording = (questionIndex: number) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setReflectionError('이 브라우저는 음성 인식을 지원하지 않습니다. Chrome에서 마이크 설명을 진행해주세요.');
      return;
    }
    setReflectionError(null);
    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i][0]?.transcript || '';
      }
      setReflectionTranscripts(prev => ({ ...prev, [questionIndex]: transcript.trim() }));
    };
    recognition.onerror = () => {
      setReflectionError('마이크 입력을 인식하지 못했습니다. 권한을 확인한 뒤 다시 시도해주세요.');
      finishRecording();
    };
    recognition.onend = finishRecording;
    recognitionRef.current = recognition;
    activeRecordingIndexRef.current = questionIndex;
    recordingStartedAt.current = Date.now();
    recognition.start();
    setRecordingQuestionIndex(questionIndex);
    setIsRecording(true);
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  };

  const submitReflection = async () => {
    if (!submissionId) return;
    const answers = reflectionQuestions.map((question, index) => ({
      question_index: index,
      question,
      transcript: (reflectionTranscripts[index] ?? '').trim(),
      duration_seconds: recordingDurations.current[index],
    }));
    const incompleteIndex = answers.findIndex(answer => answer.transcript.length < 20);
    if (incompleteIndex >= 0) {
      setReflectionError(`${incompleteIndex + 1}번 확인 질문을 마이크로 2문장 이상 설명해주세요.`);
      return;
    }
    setReflectionLoading(true);
    setReflectionError(null);
    try {
      const res = await api.post<ConceptReflectionResponse>(`/student/submissions/${submissionId}/concept-reflection`, {
        answers,
      });
      setReflectionResult(res.data);
    } catch {
      setReflectionError('개념 설명 평가에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setReflectionLoading(false);
    }
  };

  return (
    <div className="animate-in" style={{ maxWidth: 640, margin: '0 auto' }}>
      {/* Success banner */}
      <div style={{
        background: 'linear-gradient(135deg, #10b981, #059669)',
        borderRadius: 20, padding: '32px', marginBottom: 24,
        color: '#fff', textAlign: 'center',
      }}>
        <div style={{ fontSize: 60, marginBottom: 12, animation: 'pulse 1s ease 2' }}>🎉</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>제출 완료!</h1>
        <p style={{ opacity: 0.85, fontSize: 15 }}>
          {recognized ? '개념 설명까지 통과되어 최종 분석을 확인할 수 있습니다.' : '점수 확인 후 마이크 개념 설명까지 통과해야 최종 인정됩니다.'}
        </p>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%', margin: '0 auto 16px',
            border: '4px solid #c7d2fe', borderTopColor: 'var(--primary)',
            animation: 'spin 0.8s linear infinite',
          }} />
          <p style={{ color: 'var(--text-sub)', fontSize: 15 }}>분석 중입니다...</p>
        </div>
      ) : risk ? (
        <>
          {/* Character Feedback */}
          {feedbackLoading && (
            <div style={{ marginTop: '24px', textAlign: 'center', color: 'var(--text-sub)' }}>
              🦉 프롬이가 피드백을 준비하고 있어요...
            </div>
          )}

          {(() => {
            const passed = scorePassed;
            return (
              <div style={{ marginTop: '20px' }}>
                {/* ── 점수 요약 카드 ── */}
                <div style={{
                  background: passed
                    ? 'linear-gradient(135deg, #ECFDF5, #D1FAE5)'
                    : 'linear-gradient(135deg, #FFF7ED, #FEF3C7)',
                  border: `2px solid ${passed ? '#6EE7B7' : '#FCD34D'}`,
                  borderRadius: '20px',
                  padding: '28px',
                  marginBottom: '16px',
                  textAlign: 'center',
                }}>
                  {/* Pass/Fail badge */}
                  <div style={{
                    display: 'inline-block',
                    background: recognized ? '#10B981' : passed ? '#0ea5e9' : '#F59E0B',
                    color: 'white',
                    borderRadius: '20px',
                    padding: '4px 16px',
                    fontSize: '13px',
                    fontWeight: 800,
                    marginBottom: '16px',
                    letterSpacing: '0.05em',
                  }}>
                    {recognized ? '✅ 최종 통과!' : passed ? '✅ 점수 통과' : '🔥 재도전 권장'}
                  </div>

                  {/* Score circle */}
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                    <div style={{
	                      width: '110px', height: '110px', borderRadius: '50%',
	                      background: `conic-gradient(
	                        ${passed ? '#10B981' : '#F59E0B'} ${effectiveScore * 3.6}deg,
	                        #E5E7EB ${effectiveScore * 3.6}deg
	                      )`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      position: 'relative',
                    }}>
                      <div style={{
                        width: '82px', height: '82px', borderRadius: '50%',
                        background: 'white',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      }}>
	                        <span style={{ fontSize: '26px', fontWeight: 900, color: passed ? '#10B981' : '#F59E0B' }}>
	                          {Math.round(effectiveScore)}
	                        </span>
                        <span style={{ fontSize: '11px', color: '#6B7280' }}>/ 100점</span>
                      </div>
                    </div>
                  </div>

	                  <p style={{ margin: '0', fontSize: '13px', color: '#6B7280' }}>
	                    점수 기준: {passThreshold}점 이상
	                  </p>
                  {passed && !conceptPassed && (
                    <p style={{ margin: '8px 0 0', fontSize: 13, color: '#9a3412', fontWeight: 800 }}>
                      아직 마이크 개념 설명이 끝나지 않아 최종 인정 전입니다.
                    </p>
                  )}
                  {recognized && (
                    <p style={{ margin: '8px 0 0', fontSize: 13, color: '#166534', fontWeight: 800 }}>
                      점수와 마이크 개념 설명을 모두 통과했습니다.
                    </p>
                  )}
                </div>

                {passed && (
                  <div style={{
                    background: conceptPassed ? '#ecfdf5' : '#fff7ed',
                    border: `2px solid ${conceptPassed ? '#86efac' : '#fed7aa'}`,
                    borderRadius: 20,
                    padding: 22,
                    marginBottom: 16,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 12 }}>
                      <div>
                        <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: conceptPassed ? '#166534' : '#9a3412' }}>
                          마이크 개념 설명 확인
                        </h3>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.6 }}>
                          이 문제의 핵심 개념, 사용한 방법론, 내 프롬프트에 반영한 이유를 직접 말해야 문제 풀이로 인정됩니다.
                        </p>
                      </div>
                      <span style={{ padding: '5px 10px', borderRadius: 20, fontSize: 12, fontWeight: 800, background: conceptPassed ? '#dcfce7' : '#ffedd5', color: conceptPassed ? '#166534' : '#9a3412' }}>
                        {conceptPassed ? `통과 ${reflectionResult?.score ?? 0}점` : '인정 대기'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                      {reflectionQuestions.map((question, index) => {
                        const transcript = reflectionTranscripts[index] ?? '';
                        const questionResult = reflectionResult?.question_results?.find(result => result.question_index === index);
                        const recordingThisQuestion = isRecording && recordingQuestionIndex === index;
                        return (
                          <div key={`${index}-${question}`} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 8 }}>
                              <div style={{ flex: 1, minWidth: 180 }}>
                                <div style={{ fontSize: 11, fontWeight: 900, color: '#9a3412', marginBottom: 4 }}>확인 질문 {index + 1}</div>
                                <div style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--text-main)' }}>{question}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => recordingThisQuestion ? stopRecording() : startRecording(index)}
                                disabled={isRecording && !recordingThisQuestion}
                                className={recordingThisQuestion ? 'btn btn-ghost' : 'btn btn-primary'}
                                style={{ padding: '8px 12px', fontSize: 12 }}
                              >
                                {recordingThisQuestion ? '녹음 중지' : transcript ? '다시 녹음' : '마이크 켜기'}
                              </button>
                            </div>
                            <div style={{ background: '#f8faff', border: '1px solid #e8edff', borderRadius: 10, padding: '10px 12px', minHeight: 54, fontSize: 12, lineHeight: 1.6, color: transcript ? 'var(--text-main)' : 'var(--text-sub)' }}>
                              {transcript || '이 질문에 대한 음성 전사문이 여기에 표시됩니다.'}
                            </div>
                            {questionResult && (
                              <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6, color: questionResult.passed ? '#166534' : '#9a3412', fontWeight: 700 }}>
                                {questionResult.passed ? '통과' : '재녹음 필요'} · {questionResult.score}점 · {questionResult.feedback}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {reflectionProblem && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 12 }}>
                        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px' }}>
                          <div style={{ fontSize: 11, fontWeight: 900, color: '#9a3412', marginBottom: 6 }}>이 문제의 핵심 개념</div>
                          <div style={{ fontSize: 12, lineHeight: 1.6 }}>{(reflectionProblem.core_concepts ?? []).join(' · ') || '루브릭 기준을 중심으로 설명하세요.'}</div>
                        </div>
                        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px' }}>
                          <div style={{ fontSize: 11, fontWeight: 900, color: '#9a3412', marginBottom: 6 }}>설명해야 할 프롬프트 개념</div>
                          <div style={{ fontSize: 12, lineHeight: 1.6 }}>{(reflectionProblem.methodology ?? []).slice(0, 3).join(' · ') || '이 문제에 맞는 프롬프트 개념을 말하세요.'}</div>
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                      <button
                        type="button"
                        onClick={submitReflection}
                        disabled={reflectionLoading || isRecording}
                        className="btn btn-primary"
                        style={{ padding: '10px 14px', fontSize: 13, opacity: incompleteReflectionIndex >= 0 ? 0.82 : 1 }}
                      >
                        {reflectionLoading ? '평가 중...' : '모든 설명 제출하고 인정받기'}
                      </button>
                      <span style={{ fontSize: 12, color: 'var(--text-sub)', fontWeight: 700 }}>
                        {completedReflectionCount}/{reflectionQuestions.length}개 녹음 완료
                        {incompleteReflectionIndex >= 0 ? ` · ${incompleteReflectionIndex + 1}번 질문 설명 필요` : ''}
                      </span>
                    </div>

                    {reflectionResult && (
                      <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.7, color: reflectionResult.passed ? '#166534' : '#9a3412' }}>
                        {reflectionResult.feedback}
                        {!reflectionResult.passed && reflectionResult.missing_points.length > 0 && (
                          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                            {reflectionResult.missing_points.map(point => <li key={point}>{point}</li>)}
                          </ul>
                        )}
                      </div>
                    )}
                    {reflectionError && <div style={{ marginTop: 10, fontSize: 12, color: '#b91c1c', fontWeight: 700 }}>{reflectionError}</div>}
                  </div>
                )}

                {!recognized && (
                  <div style={{
                    background: '#f8faff',
                    border: '1px solid var(--border)',
                    borderRadius: 16,
                    padding: '16px 18px',
                    marginBottom: 16,
                    color: 'var(--text-sub)',
                    fontSize: 13,
                    lineHeight: 1.7,
                  }}>
                    {passed
                      ? '마이크 설명을 LLM 평가로 통과하면 최종 결과가 열립니다.'
                      : '80점 미만이라 마이크 설명 단계로 넘어가지 않습니다. 이전 답안으로 다시 도전해 점수 기준을 먼저 통과하세요.'}
                  </div>
                )}

                {/* ── 루브릭 기준별 점수 ── */}
                {recognized && characterFeedback && characterFeedback.criteria_scores.length > 0 && (
                  <div style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    padding: '20px',
                    marginBottom: '16px',
                  }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>
                      📋 항목별 평가
                    </h3>
                    {characterFeedback.criteria_scores.map((c, i) => {
                      const score = safeNumber(c.score);
                      const maxScore = Math.max(safeNumber(c.max_score, 1), 1);
                      const ratio = score / maxScore;
                      const barColor = ratio >= 0.7 ? '#10B981' : ratio >= 0.4 ? '#F59E0B' : '#EF4444';
                      return (
                        <div key={i} style={{ marginBottom: i < characterFeedback.criteria_scores.length - 1 ? '14px' : 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                              {c.name}
                            </span>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: barColor }}>
                              {score.toFixed(1)} / {maxScore}
                            </span>
                          </div>
                          <div style={{ background: '#F3F4F6', borderRadius: '6px', height: '8px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${ratio * 100}%`, height: '100%',
                              background: barColor, borderRadius: '6px',
                              transition: 'width 0.8s ease',
                            }} />
                          </div>
                          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                            {c.feedback}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── 프롬이 피드백 ── */}
                {recognized && characterFeedback && <div style={{
                  background: 'linear-gradient(135deg, #F0EDFF 0%, #E8F4FF 100%)',
                  border: '2px solid #C5BEFF',
                  borderRadius: '20px',
                  padding: '24px',
                  marginBottom: '16px',
                }}>
                  <h3 style={{ margin: '0 0 16px', color: '#5B4CFF', fontSize: '16px' }}>
                    💬 프롬이의 피드백
                  </h3>
                  <CharacterMessage
                    emotion={characterFeedback.emotion as Emotion}
                    message={characterFeedback.main_message}
                    characterSize={80}
                  />

                  {characterFeedback.growth_note && (
                    <div style={{
                      marginTop: '16px', background: 'white',
                      borderRadius: '12px', padding: '12px 16px', border: '1px solid #C5BEFF',
                    }}>
                      <span style={{ fontSize: '13px', color: '#5B4CFF' }}>
                        📈 {characterFeedback.growth_note}
                      </span>
                    </div>
                  )}

                  {characterFeedback.tips.length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                      <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 700, color: '#5B4CFF' }}>
                        💡 이렇게 개선해봐요
                      </p>
                      {characterFeedback.tips.map((tip, i) => (
                        <div key={i} style={{
                          background: 'white', borderRadius: '8px',
                          padding: '10px 14px', marginBottom: '6px',
                          fontSize: '13px', color: 'var(--text-main)',
                          border: '1px solid #E8E0FF',
                          display: 'flex', gap: '8px', alignItems: 'flex-start',
                        }}>
                          <span style={{ color: '#8B7FFF', fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                          <span>{tip}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{
                    marginTop: '16px', textAlign: 'center', padding: '12px',
                    background: 'white', borderRadius: '12px', border: '1px dashed #C5BEFF',
                  }}>
                    <span style={{ fontSize: '14px', color: '#8B7FFF' }}>
                      ✨ {characterFeedback.encouragement}
                    </span>
                  </div>
                </div>}

                {recognized && (
                  <>
                    <div className="card" style={{ textAlign: 'center', padding: '32px', marginBottom: 16 }}>
                      <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>학습 위험도 분석</h3>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                        <RiskGauge score={risk.total_risk} stage={risk.risk_stage} size={200} />
                      </div>
                      <RiskBadge stage={risk.risk_stage} score={risk.total_risk} size="lg" />
                    </div>

                    <div className="card" style={{ marginBottom: 16 }}>
                      <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>분석 요약</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {breakdownItems.map(({ label, val, icon, color, isText }) => (
                          <div key={label} style={{
                            background: `${color}10`, borderRadius: 12, padding: '14px 16px',
                            border: `1px solid ${color}30`,
                          }}>
                            <div style={{ fontSize: 11, color: 'var(--text-sub)', marginBottom: 4 }}>
                              {icon} {label}
                            </div>
                            <div style={{ fontWeight: 800, fontSize: 18, color }}>
                              {isText ? String(val) : `${safeNumber(val).toFixed(1)}`}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* ── 액션 버튼 ── */}
                <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
                  {!passed && problemId && (
                    <Link
                      to={`/problems/${problemId}/work?retry=${submissionId}`}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        padding: '14px', borderRadius: '14px',
                        background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                        color: 'white', textDecoration: 'none',
                        fontWeight: 800, fontSize: '16px',
                        boxShadow: '0 4px 16px rgba(245,158,11,0.35)',
                      }}
                    >
                      🔥 이전 답안으로 다시 도전하기
                    </Link>
                  )}
                  {passed && !conceptPassed && (
                    <div style={{
                      textAlign: 'center', padding: '14px',
                      background: '#fff7ed',
                      borderRadius: '14px', border: '2px solid #fed7aa',
                      fontSize: '15px', fontWeight: 700, color: '#9a3412',
                    }}>
                      점수는 통과했지만, 마이크 개념 설명 통과 전이라 아직 문제 풀이로 인정되지 않았습니다.
                    </div>
                  )}
                  {recognized && (
                    <div style={{
                      textAlign: 'center', padding: '14px',
                      background: 'linear-gradient(135deg, #ECFDF5, #D1FAE5)',
                      borderRadius: '14px', border: '2px solid #6EE7B7',
                      fontSize: '15px', fontWeight: 700, color: '#065F46',
                    }}>
                      훌륭해요! 점수와 개념 설명이 모두 통과되어 이 문제 풀이로 인정됐습니다.
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <Link to="/problems" style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      padding: '12px', borderRadius: '12px',
                      background: 'var(--surface)', color: 'var(--text-main)',
                      border: '1px solid var(--border)', textDecoration: 'none',
                      fontSize: '14px', fontWeight: 600,
                    }}>
                      📝 다른 문제 풀기
                    </Link>
                    {recognized && <Link to="/risk" style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      padding: '12px', borderRadius: '12px',
                      background: 'var(--primary)', color: 'white',
                      textDecoration: 'none', fontSize: '14px', fontWeight: 600,
                    }}>
                      📊 위험도 보기
                    </Link>}
                  </div>
                </div>
              </div>
            );
          })()}
        </>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ color: 'var(--text-sub)' }}>위험도 데이터를 불러올 수 없습니다.</p>
        </div>
      )}

    </div>
  );
}
