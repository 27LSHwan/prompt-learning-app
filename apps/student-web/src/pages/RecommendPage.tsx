import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { getUserId } from '../lib/auth';
import { unwrapRiskResponse } from '../lib/risk';
import type { ProblemQueueItem, ProblemQueueResponse, RiskDetail, RiskStatusResponse, WeaknessReportResponse } from '../types';

interface ConceptRecommendation {
  icon: string;
  concept: string;
  why: string;
  youtubeQuery: string;
  problems: ProblemQueueItem[];
}

const YOUTUBE_BASE = 'https://www.youtube.com/results?search_query=';

const WEAKNESS_CONCEPTS: Record<string, { icon: string; concept: string; why: string; query: string }> = {
  role_missing: {
    icon: '🎭',
    concept: '역할 프롬프팅',
    why: '모델이 어떤 전문가처럼 답해야 하는지 고정하지 않으면 답변 기준이 흔들립니다.',
    query: '프롬프트 엔지니어링 역할 프롬프팅 강의',
  },
  goal_unclear: {
    icon: '🎯',
    concept: '목표와 성공 기준 명시',
    why: '무엇을 잘한 답으로 볼지 적어야 평가 기준에 맞는 결과가 나옵니다.',
    query: '프롬프트 엔지니어링 목표 제약 조건 작성법',
  },
  fewshot_missing: {
    icon: '🧪',
    concept: 'Few-shot 예시 설계',
    why: '입출력 예시가 없으면 분류 기준이나 답변 형식이 매번 달라질 수 있습니다.',
    query: 'Few-shot prompting 프롬프트 엔지니어링 예시',
  },
  input_template_missing: {
    icon: '🧩',
    concept: '입력 템플릿',
    why: '사용자 입력이 어디에 들어가는지 명확해야 재사용 가능한 프롬프트가 됩니다.',
    query: '프롬프트 템플릿 input variable 작성법',
  },
  format_missing: {
    icon: '📐',
    concept: '출력 형식 지정',
    why: 'JSON, 표, 항목형 등 결과 형식을 지정해야 채점과 비교가 쉬워집니다.',
    query: '프롬프트 엔지니어링 출력 형식 JSON markdown',
  },
};

const DROPOUT_FALLBACK_CONCEPTS: Record<string, { icon: string; concept: string; why: string; query: string }[]> = {
  cognitive: [
    { icon: '🧠', concept: '핵심 개념 분해', why: '문제에서 요구한 개념을 작게 나눠야 프롬프트 누락을 줄일 수 있습니다.', query: '프롬프트 엔지니어링 핵심 개념 분해' },
    { icon: '✅', concept: '자기 검증 기준', why: '내 프롬프트가 조건을 만족했는지 스스로 확인하는 기준이 필요합니다.', query: '프롬프트 엔지니어링 self evaluation checklist' },
  ],
  motivational: [
    { icon: '🏁', concept: '작은 성공 단위 설계', why: '짧은 문제에서 한 개념씩 통과 경험을 쌓는 것이 학습 지속에 유리합니다.', query: '프롬프트 엔지니어링 입문 쉬운 예제' },
    { icon: '📌', concept: '명확한 과제 목표', why: '해야 할 일이 분명해야 제출까지 이어질 가능성이 높습니다.', query: '프롬프트 작성 목표 명확화 방법' },
  ],
  strategic: [
    { icon: '🗺️', concept: '프롬프트 구조화', why: '역할, 목표, 조건, 출력 형식을 분리하면 수정 방향이 명확해집니다.', query: '프롬프트 엔지니어링 구조화 role task format' },
    { icon: '🔎', concept: '테스트 입력 검증', why: '제출 전 테스트 입력으로 결과를 비교해야 안정적인 점수를 얻을 수 있습니다.', query: '프롬프트 테스트 케이스 검증 방법' },
  ],
  sudden: [
    { icon: '🧭', concept: '문제 요구사항 재정렬', why: '최근 흐름이 흔들렸다면 요구사항을 다시 항목별로 정리하는 것이 우선입니다.', query: '프롬프트 엔지니어링 요구사항 분석' },
  ],
  dependency: [
    { icon: '🪞', concept: '자기 설명 기반 학습', why: 'AI 답을 복붙하지 않고 내가 쓴 개념을 말로 설명할 수 있어야 실력이 남습니다.', query: '프롬프트 엔지니어링 자기 설명 학습' },
    { icon: '🐶', concept: '코칭 피드백 반영', why: '프롬이 피드백을 정답 대신 수정 힌트로 사용해야 의존도를 낮출 수 있습니다.', query: 'AI tutoring feedback prompt engineering' },
  ],
  compound: [
    { icon: '🧱', concept: '기본 프롬프트 구성요소', why: '복합적으로 흔들릴 때는 역할, 목표, 입력, 출력 형식을 먼저 복구해야 합니다.', query: '프롬프트 엔지니어링 기본 구성요소' },
  ],
  none: [
    { icon: '📈', concept: '고급 프롬프트 패턴', why: '현재 흐름이 안정적이면 Few-shot, CoT, 검증 루브릭 같은 패턴을 확장할 수 있습니다.', query: 'advanced prompt engineering few-shot chain of thought rubric' },
  ],
};

const youtubeUrl = (query: string) => `${YOUTUBE_BASE}${encodeURIComponent(query)}`;

const includesConcept = (problem: ProblemQueueItem, concept: string) => {
  const haystack = [problem.title, problem.description, problem.category, ...(problem.core_concepts ?? [])].join(' ').toLowerCase();
  return concept.split(/[ /()·-]+/).some(part => part.length >= 2 && haystack.includes(part.toLowerCase()));
};

function buildConceptRecommendations(
  risk: RiskDetail | null,
  weakness: WeaknessReportResponse | null,
  queue: ProblemQueueResponse | null,
): ConceptRecommendation[] {
  const problemQueue = queue?.items ?? [];
  const base = (weakness?.items?.length ? weakness.items : [])
    .map(item => WEAKNESS_CONCEPTS[item.tag])
    .filter(Boolean);
  const fallbacks = DROPOUT_FALLBACK_CONCEPTS[risk?.dropout_type ?? 'none'] ?? DROPOUT_FALLBACK_CONCEPTS.none;
  const merged = [...base, ...fallbacks];
  const unique = merged.filter((item, index, list) => list.findIndex(other => other.concept === item.concept) === index).slice(0, 4);

  return unique.map(item => {
    const matchedProblems = problemQueue.filter(problem => includesConcept(problem, item.concept));
    const fallbackProblems = problemQueue.filter(problem => !matchedProblems.some(matched => matched.id === problem.id));
    return {
      icon: item.icon,
      concept: item.concept,
      why: item.why,
      youtubeQuery: item.query,
      problems: [...matchedProblems, ...fallbackProblems].slice(0, 3),
    };
  });
}

const STAGE_BANNER: Record<string, { bg: string; color: string; border: string; icon: string; msg: string }> = {
  '안정':   { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7', icon: '🌟', msg: '훌륭해요! 지금처럼 꾸준히 이어가세요.' },
  '경미':   { bg: '#fef3c7', color: '#92400e', border: '#fcd34d', icon: '⚡', msg: '조금만 더 신경 써봐요.' },
  '주의':   { bg: '#ffedd5', color: '#9a3412', border: '#fdba74', icon: '🔶', msg: '아래 방법들을 적극 실천해보세요.' },
  '고위험': { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5', icon: '🚨', msg: '지금 바로 교수자에게 연락하세요!' },
  '심각':   { bg: '#7f1d1d', color: '#fff',    border: '#991b1b', icon: '🆘', msg: '즉각적인 도움을 받으세요.' },
};

export default function RecommendPage() {
  const [risk, setRisk]       = useState<RiskDetail | null>(null);
  const [weakness, setWeakness] = useState<WeaknessReportResponse | null>(null);
  const [queue, setQueue] = useState<ProblemQueueResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = getUserId();
    if (!id) return;
    Promise.allSettled([
      api.get<RiskStatusResponse>('/student/risk'),
      api.get<WeaknessReportResponse>('/student/weakness-report'),
      api.get<ProblemQueueResponse>('/student/problem-queue'),
    ]).then(results => {
      if (results[0].status === 'fulfilled') setRisk(unwrapRiskResponse(results[0].value.data));
      if (results[1].status === 'fulfilled') setWeakness(results[1].value.data);
      if (results[2].status === 'fulfilled') setQueue(results[2].value.data);
    }).finally(() => setLoading(false));
  }, []);

  const recs = buildConceptRecommendations(risk, weakness, queue);
  const banner = risk ? STAGE_BANNER[risk.risk_stage] : null;

  return (
    <div className="animate-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>💡 맞춤 학습 추천</h1>
        <p style={{ color: 'var(--text-sub)', fontSize: 14 }}>지금 필요한 프롬프트 개념, 참고 영상, 바로 풀 문제를 같이 확인하세요</p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[1,2,3].map(i => <div key={i} style={{ height: 90, borderRadius: 14, background: '#e8eaf6', animation: 'pulse 1.5s infinite' }} />)}
        </div>
      ) : (
        <>
          {banner && (
            <div className="responsive-banner" style={{
              background: banner.bg, color: banner.color,
              border: `2px solid ${banner.border}`,
              borderRadius: 14, padding: '16px 22px', marginBottom: 20,
              fontSize: 15, fontWeight: 700,
            }}>
              <span style={{ fontSize: 28 }}>{banner.icon}</span>
              <span>{banner.msg}</span>
              {risk && <span style={{ marginLeft: 'auto', opacity: 0.7, fontWeight: 500, fontSize: 13 }}>
                위험 유형: {risk.dropout_type}
              </span>}
            </div>
          )}

          <div style={{ display: 'grid', gap: 14 }}>
            {recs.map((rec, i) => (
              <div key={i} className="card responsive-stack-card" style={{
                padding: '22px 24px', border: '2px solid transparent',
                transition: 'all 0.18s',
                animationDelay: `${i * 0.08}s`,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = '#818cf8';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 14, fontSize: 26,
                  background: 'var(--primary-pale)', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {rec.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: '#059669', fontWeight: 900, marginBottom: 3 }}>필요한 개념</div>
                  <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 5 }}>{rec.concept}</div>
                  <div style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.65 }}>{rec.why}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    <a href={youtubeUrl(rec.youtubeQuery)} target="_blank" rel="noreferrer" className="btn btn-ghost"
                      style={{ display: 'inline-flex', padding: '7px 16px', fontSize: 13 }}>
                      유튜브 강의 검색 →
                    </a>
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>이 개념으로 바로 풀 문제</div>
                    {rec.problems.length ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {rec.problems.map(problem => (
                          <Link key={problem.id} to={`/problems/${problem.id}/work`} style={{ display: 'block', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', background: '#f8fffb', textDecoration: 'none' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                              <strong style={{ fontSize: 13, color: 'var(--text)' }}>{problem.title}</strong>
                              {problem.recommended && <span style={{ fontSize: 10, color: '#fff', background: '#059669', borderRadius: 20, padding: '2px 7px', fontWeight: 800 }}>추천 문제</span>}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 4 }}>{problem.queue_reason}</div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>문제 큐를 불러오면 추천 문제가 표시됩니다.</div>
                    )}
                  </div>
                </div>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--primary-pale)', color: 'var(--primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 13,
                }}>
                  {i + 1}
                </div>
              </div>
            ))}
          </div>

          {!risk && (
            <div className="card" style={{ textAlign: 'center', padding: '50px 40px', marginTop: 16 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
              <p style={{ color: 'var(--text-sub)', marginBottom: 20 }}>
                위험도 분석 데이터가 없습니다. 문제를 먼저 제출해주세요.
              </p>
              <Link to="/problems" className="btn btn-primary" style={{ padding: '10px 24px' }}>
                📝 문제 풀러 가기
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
