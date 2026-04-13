# 시스템 AI 프롬프트 설계서 — AI 학습 낙오 예측 시스템

> 본 문서는 시스템 내에서 실제로 사용되는 **AI 프롬프트(System Prompt) 설계 근거와 전략**을 정리한 문서입니다.
> 각 프롬프트가 왜 이 방식으로 설계되었는지, 어떤 엔지니어링 결정이 있었는지를 기록합니다.

---

## 목차

1. [전체 AI 프롬프트 구조 개요](#1-전체-ai-프롬프트-구조-개요)
2. [루브릭 평가 프롬프트 (RubricEvaluator)](#2-루브릭-평가-프롬프트-rubricevaluator)
3. [사고력 분석 프롬프트 (LLMAnalyzer)](#3-사고력-분석-프롬프트-llmanalyzer)
4. [프롬이 코칭 프롬프트 (PromiCoachService)](#4-프롬이-코칭-프롬프트-promicoachservice)
5. [피드백 에이전트 프롬프트 (FeedbackAgent)](#5-피드백-에이전트-프롬프트-feedbackagent)
6. [마이크 개념 확인 평가 프롬프트](#6-마이크-개념-확인-평가-프롬프트)
7. [프롬프트 엔지니어링 공통 원칙](#7-프롬프트-엔지니어링-공통-원칙)
8. [토큰 최적화 전략](#8-토큰-최적화-전략)

---

## 1. 전체 AI 프롬프트 구조 개요

이 시스템은 5가지 독립적인 AI 에이전트가 각자의 역할을 수행합니다.

```
학생 프롬프트 제출
        │
        ├─► [RubricEvaluator]   루브릭 기준 점수 산출 (1회 / 5회 평균)
        │         └─► rubric_json 동적 주입 + json_object 출력
        │
        ├─► [LLMAnalyzer]       사고력 14개 지표 분석 → 위험도 계산 입력
        │         └─► THINKING_ANALYSIS_PROMPT + json_object 출력
        │
        ├─► [PromiCoachService] 단계별 실시간 코칭 (enter/run/final)
        │         └─► 정답 제공 금지 원칙 + 방향 제시만
        │
        └─► [FeedbackAgent]     최종 통과 후 캐릭터 피드백 생성
                  └─► 이전 이력 + 현재 평가 결과 통합

마이크 녹음 전사
        │
        └─► [개념 확인 LLM 평가] 문항별 독립 평가 → 모든 문항 70점+ 조건
```

---

## 2. 루브릭 평가 프롬프트 (RubricEvaluator)

**위치:** `packages/llm_analysis/rubric_evaluator.py`

### 설계 목표
- 문제마다 다른 평가 기준을 일관되게 적용
- 학생 프롬프트의 강점과 개선점을 구체적으로 제시
- JSON 구조화 출력으로 안정적인 파싱 보장

### 시스템 프롬프트 설계

```python
system_prompt = f"""당신은 프롬프트 엔지니어링 교육 전문가입니다.
학생이 작성한 프롬프트를 아래 루브릭 기준으로 평가하세요.

평가 가이드라인: {guidelines}

루브릭 기준:
{criteria_str}

반드시 JSON 형식으로 응답하세요:
{{
  "criteria_scores": [
    {{"name": "기준명", "score": 0~max_score, "feedback": "구체적 피드백"}}
  ],
  "overall_feedback": "전체 평가 요약",
  "strengths": ["강점1", "강점2"],
  "improvements": ["개선점1", "개선점2"]
}}"""
```

### 핵심 엔지니어링 결정

| 결정 | 이유 |
|------|------|
| `temperature=0.3` | 낮은 온도로 평가 일관성 확보. 창의적 응답보다 일관된 채점 필요 |
| `response_format={"type": "json_object"}` | 파싱 오류 제거. 항상 유효한 JSON 반환 보장 |
| rubric_json 동적 주입 | 문제마다 다른 평가 기준 적용. 하드코딩 없이 유연한 평가 |
| 5회 반복 평균 | LLM 응답의 편차를 통계적으로 흡수. 신뢰도 향상 |
| 가중치 기반 총점 | `(score/max_score) * weight * 100`으로 공정한 100점 환산 |

### fallback 전략

OpenAI API 키가 없거나 호출 실패 시, 키워드 휴리스틱 mock 평가로 자동 전환:

```python
_CRITERION_KEYWORDS = {
    "명확성":    (["명확", "구체", "정확", ...], ["모르", "그냥", ...]),
    "역할 정의": (["역할", "전문가", "당신은", ...], ["없음"]),
    "출력 형식": (["형식", "목록", "JSON", ...], []),
    ...
}
```

---

## 3. 사고력 분석 프롬프트 (LLMAnalyzer)

**위치:** `packages/llm_analysis/prompts.py`, `packages/llm_analysis/analyzer.py`

### 설계 목표
- 학생의 프롬프트에서 **학습 사고 과정**을 추출
- 단순 점수가 아닌, 인지적 깊이를 14개 차원으로 정량화
- 위험도 분석의 입력 데이터로 활용

### 시스템 프롬프트 (THINKING_ANALYSIS_PROMPT)

```
당신은 학습자의 사고 구조를 분석하는 교육 AI 전문가입니다.
아래 학생의 프롬프트(제출물)를 읽고, 사고 역량 14개 항목을 0.0~1.0으로 채점하세요.

채점 기준 (0.0 = 매우 부족, 1.0 = 매우 우수):
 1. problem_understanding_score   : 문제를 정확하게 이해했는가
 2. problem_decomposition_score   : 문제를 하위 단계로 분해했는가
 3. constraint_awareness_score    : 제약 조건을 인식했는가
 4. validation_awareness_score    : 결과를 검증하려는 의식이 있는가
 5. improvement_prompt_score      : 프롬프트를 개선하려 시도했는가
 6. self_explanation_score        : 자신의 풀이 과정을 설명했는가
 7. reasoning_quality_score       : 추론의 논리적 품질
 8. reflection_depth_score        : 학습 과정에 대한 반성의 깊이
 9. error_analysis_score          : 오류 원인 분석
10. debugging_quality_score       : 오류 체계적 수정
11. decision_reasoning_score      : 결정 근거 명확성
12. approach_selection_score      : 적절한 접근 방식 선택
13. improvement_consistency_score : 반복 개선의 일관성
14. iteration_quality_score       : 반복 시도의 품질 향상
```

### 핵심 엔지니어링 결정

| 결정 | 이유 |
|------|------|
| 14개 세분화 지표 | 단일 점수보다 탈락 유형을 정확히 분류하기 위해 다차원 분석 필요 |
| `temperature=0.2` | 매우 낮은 온도로 분석 재현성 극대화 |
| `json_object` 강제 | 14개 float 값을 안정적으로 파싱 |
| thinking_risk 가중치 0.10 | LLM 분석은 오류 가능성 있어 전체 위험도에서 낮은 비중 유지, 행동 데이터(0.90)에 더 의존 |

### 5개 차원 위험도 가중치 설계 근거

```python
BASE_RISK_WEIGHTS = {
    "performance": 0.30,  # 가장 직접적인 학습 결과물 → 가장 높은 가중치
    "progress":    0.25,  # 제출 간격, 중도 포기율 → 탈락 선행 지표
    "engagement":  0.20,  # 로그인, 세션 시간 → 참여도
    "process":     0.15,  # 시도 횟수, 전략 변경 → 학습 과정
    "thinking":    0.10,  # LLM 분석 → 오류 가능성으로 낮은 비중
}
```

---

## 4. 프롬이 코칭 프롬프트 (PromiCoachService)

**위치:** `apps/backend/app/services/promi_coach_service.py`

### 설계 목표
- 학생에게 **직접 정답을 주지 않고** 방향만 제시
- 작성 단계마다 다른 맥락의 코칭 제공
- 친근한 강아지 캐릭터로 학습 심리적 부담 완화

### 시스템 프롬프트 설계

```
당신은 '프롬이'라는 이름의 강아지 코치입니다.
학생이 프롬프트 문제를 풀 때 옆에서 방향을 잡아주는 역할만 합니다.

[핵심 제약]
절대 정답, 완성 답안, 직접적인 해결 문장을 제공하지 마세요.
대신 학생이 다음에 무엇을 점검하고 어떻게 수정해야 하는지 코칭하세요.

[출력 형식]
{
  "message": "학생에게 주는 핵심 코칭 1~2문장",
  "checkpoints": ["점검 포인트 1", "점검 포인트 2", "점검 포인트 3"],
  "encouragement": "짧은 응원 한 문장",
  "caution": "직접 답변 유도 방지 주의 문구 또는 null"
}
```

### 3단계 모드 분기 전략

```
enter  → 문제 접근 방향 코칭: "역할, 목표, 출력 형식 세 가지부터 맞추면..."
run    → 실행 결과 기반 개선 코칭: latest_response 분석 → 구체적 수정 방향
final  → 최종 제출 전 점검: 형식, 제약, 예외 처리 누락 확인
```

### 핵심 엔지니어링 결정

| 결정 | 이유 |
|------|------|
| `temperature=0.6` | 평가(0.3)보다 높게 → 코칭 메시지의 다양성, 매번 새로운 관점 제시 |
| `max_tokens=500` | 코칭은 간결해야 함. 긴 설명은 학생 부담 증가 |
| `latest_response` 입력 포함 | "이 응답이 나온 이유"를 근거로 코칭 → 추상적 조언 방지 |
| 정답 제공 금지 원칙 | 코칭의 본질 보존. 정답을 주면 학생이 직접 사고하지 않음 |
| JSON 구조화 출력 | checkpoints 배열로 UI에서 체크리스트 렌더링 가능 |

---

## 5. 피드백 에이전트 프롬프트 (FeedbackAgent)

**위치:** `packages/llm_analysis/feedback_agent.py`

### 설계 목표
- 최종 통과 후 학생에게 **성장 중심의 감정적 피드백** 제공
- 이전 제출 이력 비교로 성장 스토리 생성
- 6가지 감정 상태 표현으로 캐릭터 몰입도 향상

### 감정 분류 설계

```python
if total_score >= 85:   emotion = "excited"      # 최고 성과
elif total_score >= 75: emotion = "happy"         # 좋은 성과
elif total_score >= 50: emotion = "encouraging"   # 보통 → 동기 부여
elif total_score >= 30: emotion = "thinking"      # 미흡 → 사고 촉진
else:                   emotion = "concerned"     # 낮음 → 걱정 + 응원
```

### 성장 노트 생성 로직

```python
if score_delta > 5:     growth_note = "지난 제출보다 {delta}점 올랐어요! 성장이 느껴져요 🌱"
elif score_delta < -5:  growth_note = "이번엔 {delta}점 낮아졌지만, 다음엔 분명 더 잘할 수 있어요!"
else:                   growth_note = "지난 제출과 비슷한 수준이에요. 조금 더 다듬어볼까요?"
```

### 핵심 엔지니어링 결정

| 결정 | 이유 |
|------|------|
| 6가지 감정 상태 | UI에서 SVG 표정으로 시각화 → 학생 감정 연결 향상 |
| 이전 이력 최대 3개 | 너무 오래된 이력은 무의미, 최근 3개가 가장 관련성 높음 |
| 마이크 통과 후에만 호출 | 토큰 낭비 방지 게이트. 미통과 학생에게 피드백 불필요 |

---

## 6. 마이크 개념 확인 평가 프롬프트

**위치:** `apps/backend/app/api/routes/student.py` → `evaluate_concept_reflection`

### 설계 목표
- 학생이 개념을 **진짜로 이해했는지** 구두로 검증
- 단순 암기가 아닌, 본인 프롬프트와 연결한 설명 능력 평가
- 문항별 독립 평가로 공정한 개별 채점

### 프롬프트 설계 원칙

```
입력 구성:
  [학생 제출 프롬프트] - 실제 작성한 프롬프트 전문
  [문제 핵심 개념] - 이 문제에서 배워야 할 개념 목록
  [확인 질문] - 현재 평가 중인 질문 텍스트
  [학생 구두 답변 전사문] - 마이크 녹음 후 전사된 텍스트

평가 기준:
  - 70점 기준: 개념 이해의 기본 수준 달성 여부
  - 개념 정확성 + 자신의 프롬프트에 연결한 설명 + 충분한 설명 깊이
```

### 핵심 엔지니어링 결정

| 결정 | 이유 |
|------|------|
| 문항별 독립 LLM 호출 | 하나의 LLM에 모든 질문을 묶으면 교차 영향 발생. 독립 평가로 공정성 확보 |
| 70점 임계값 | 완벽한 설명보다 기본 이해 수준을 기준으로. 학생 부담 과도 방지 |
| 전 문항 통과 조건 | 부분 통과로 전체 인정 시 학습 목표 미달성 가능. 모든 문항 통과로 완전한 이해 확인 |
| 실제 프롬프트 포함 입력 | "이 개념이 본인 프롬프트 어디에 적용됐는지" 연결 능력까지 평가 |
| `_is_concept_reflection_complete()` 재검증 | 과거 데이터의 일부 통과 버그 방지. 조회 시마다 엄격히 재검증 |

---

## 7. 프롬프트 엔지니어링 공통 원칙

이 시스템의 모든 AI 프롬프트에 공통으로 적용된 설계 원칙입니다.

### 원칙 1: JSON 구조화 출력 강제

모든 LLM 호출에 `response_format={"type": "json_object"}` 적용.

```
이유: 교육 시스템에서 LLM 응답 파싱 실패 = 학생에게 오류 노출
→ 구조화 출력으로 파싱 안정성 100% 확보
```

### 원칙 2: 역할-과제-제약-출력 형식 4요소 구조

모든 시스템 프롬프트에 4요소를 명시:

```
[역할] 당신은 프롬프트 엔지니어링 교육 전문가입니다.
[과제] 학생 프롬프트를 아래 루브릭 기준으로 평가하세요.
[제약] 반드시 JSON 형식으로만 응답하세요. 추측하지 마세요.
[출력] {"criteria_scores": [...], "overall_feedback": "...", ...}
```

### 원칙 3: 용도별 temperature 분리

| 용도 | temperature | 이유 |
|------|-------------|------|
| 루브릭 평가 | 0.3 | 일관된 채점 필요 |
| 사고력 분석 | 0.2 | 높은 재현성 필요 |
| 프롬이 코칭 | 0.6 | 매번 새로운 관점 제공 |
| 피드백 생성 | 0.7 | 창의적인 격려 메시지 |

### 원칙 4: Fallback 계층 설계

```
LLM 호출 (OpenAI API)
    → 실패 시 키워드 휴리스틱 Mock 평가 자동 전환
    → 개발/테스트 환경에서 API 키 없어도 시스템 작동
```

### 원칙 5: 컨텍스트 압축

긴 컨텍스트 불필요한 토큰 낭비 방지:

```python
# 루브릭 평가: 학생 프롬프트 전문 포함 (평가에 필수)
user_content = f"문제: {title}\n\n{desc}\n\n학생이 작성한 프롬프트:\n{prompt}"

# 프롬이 코칭: 길이 제한 적용
system_prompt=data.system_prompt[:1200]  # 최대 1200자
user_template=data.user_template[:800]   # 최대 800자
latest_response=(latest_response)[:1000] # 최대 1000자
```

---

## 8. 토큰 최적화 전략

### 전체 시스템 토큰 흐름

```
학생 1명의 전체 학습 여정에서 LLM 호출 횟수:

미리보기 실행 (run-preview):
  └─► RubricEvaluator × 1회 = 약 500~800 토큰

최종 제출 (concept_reflection 미통과 시):
  └─► RubricEvaluator × 5회 = 약 2,500~4,000 토큰
  └─► FeedbackAgent 호출 없음 (마이크 게이트 차단)

최종 제출 (concept_reflection 통과 시):
  └─► RubricEvaluator × 5회 = 약 2,500~4,000 토큰
  └─► FeedbackAgent × 1회 = 약 800~1,200 토큰
  └─► PromiCoachService × 1회 = 약 500~700 토큰

마이크 개념 확인 (5문항 × 1회):
  └─► 마이크 LLM × 5회 = 약 1,500~2,500 토큰
```

### 핵심 절약 포인트

```
① DB 캐싱: rubric_evaluation_json 저장
   → /feedback 재요청 시 DB에서 직접 반환, LLM 재호출 없음
   → 절약: 5회 × 800토큰 = 4,000 토큰/재요청

② 마이크 게이트: 미통과 시 /feedback 차단
   → 절약: 5회 루브릭 + 피드백 생성 = 약 5,000~6,000 토큰/미통과 학생

③ 1회 vs 5회 분리: 미리보기는 1회
   → 절약: 탐색 중 미리보기 10회 = 4회 × 800 × 10 = 32,000 토큰 절약

④ 경량 모델(gpt-4o-mini): gpt-4o 대비 ~10배 저렴
   → 동일 호출 비용 1/10로 감소
```
