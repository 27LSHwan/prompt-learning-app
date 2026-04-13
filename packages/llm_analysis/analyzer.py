"""
LLM 기반 사고 구조 분석기.
OpenAI API가 없으면 텍스트 휴리스틱으로 mock 분석을 수행한다.
"""
import json
import re
from typing import Optional

try:
    from openai import AsyncOpenAI
    _OPENAI_AVAILABLE = True
except ImportError:
    _OPENAI_AVAILABLE = False

from .schemas import LLMAnalysisInput, LLMAnalysisOutput, ThinkingScores
from .prompts import THINKING_ANALYSIS_PROMPT


# ──────────────────────────────────────────
# 키워드 기반 mock 분석 규칙
# ──────────────────────────────────────────

_POSITIVE = [
    "이해", "분석", "검토", "확인", "개선", "수정", "시도", "단계", "이유",
    "왜냐하면", "따라서", "검증", "오류 수정", "반성", "다시", "접근",
]
_NEGATIVE = [
    "모르겠", "포기", "어렵", "이해 안", "안 됨", "그냥", "모름",
    "왜인지", "이상함", "됐으면", "아무거나",
]
_REFLECTION = ["돌아보면", "배운 것", "느낀 점", "다음엔", "개선할", "반성"]
_ERROR      = ["오류", "에러", "버그", "수정", "고쳤", "디버그", "왜 안"]
_STRATEGY   = ["전략", "방법", "방식", "접근", "대신", "바꿔", "다른 방법"]


def _keyword_score(text: str, pos_kw: list[str], neg_kw: list[str]) -> float:
    t = text.lower()
    pos = sum(1 for k in pos_kw if k in t)
    neg = sum(1 for k in neg_kw if k in t)
    raw = (pos - neg * 0.5) / max(len(pos_kw) * 0.3, 1)
    return max(0.0, min(1.0, 0.4 + raw * 0.6))


def _mock_thinking_scores(prompt_text: str) -> ThinkingScores:
    """텍스트 길이와 키워드로 14개 점수를 추정한다."""
    t = prompt_text
    length_factor = min(1.0, len(t) / 600)

    has_reflection = any(k in t for k in _REFLECTION)
    has_error      = any(k in t for k in _ERROR)
    has_strategy   = any(k in t for k in _STRATEGY)
    neg_count      = sum(1 for k in _NEGATIVE if k in t)
    pos_count      = sum(1 for k in _POSITIVE if k in t)

    base = _keyword_score(t, _POSITIVE, _NEGATIVE)

    return ThinkingScores(
        problem_understanding_score   = min(1.0, base * 0.9 + length_factor * 0.1),
        problem_decomposition_score   = min(1.0, base * 0.8 + (0.2 if "단계" in t else 0.0)),
        constraint_awareness_score    = min(1.0, base * 0.85 + (0.15 if "제약" in t or "조건" in t else 0.0)),
        validation_awareness_score    = min(1.0, base * 0.8 + (0.2 if "검증" in t or "확인" in t else 0.0)),
        improvement_prompt_score      = min(1.0, base * 0.7 + (0.3 if "개선" in t or "수정" in t else 0.0)),
        self_explanation_score        = min(1.0, base * 0.75 + length_factor * 0.25),
        reasoning_quality_score       = min(1.0, base * 0.9),
        reflection_depth_score        = min(1.0, (0.7 if has_reflection else 0.3) * base + 0.1),
        error_analysis_score          = min(1.0, (0.8 if has_error else 0.3) + base * 0.1),
        debugging_quality_score       = min(1.0, (0.75 if has_error else 0.25) + base * 0.1),
        decision_reasoning_score      = min(1.0, base * 0.85),
        approach_selection_score      = min(1.0, (0.7 if has_strategy else 0.4) + base * 0.1),
        improvement_consistency_score = min(1.0, base * 0.8),
        iteration_quality_score       = min(1.0, base * 0.75 + length_factor * 0.15),
    )


class LLMAnalyzer:
    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-4o"):
        self.model = model
        self._client = None
        if _OPENAI_AVAILABLE and api_key:
            self._client = AsyncOpenAI(api_key=api_key)

    async def analyze(self, input_data: LLMAnalysisInput) -> LLMAnalysisOutput:
        if self._client:
            return await self._llm_analyze(input_data)
        return self._mock_analyze(input_data)

    async def _llm_analyze(self, inp: LLMAnalysisInput) -> LLMAnalysisOutput:
        prompt = THINKING_ANALYSIS_PROMPT.format(
            problem_title=inp.problem_title,
            problem_description=inp.problem_description,
            prompt_text=inp.prompt_text,
        )
        resp = await self._client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        raw = json.loads(resp.choices[0].message.content)
        scores = ThinkingScores(**{k: raw[k] for k in ThinkingScores.model_fields})
        return LLMAnalysisOutput(
            thinking_scores=scores,
            analysis_summary=raw.get("analysis_summary", ""),
            detected_issues=raw.get("detected_issues", []),
        )

    def _mock_analyze(self, inp: LLMAnalysisInput) -> LLMAnalysisOutput:
        scores = _mock_thinking_scores(inp.prompt_text)
        avg = sum(scores.model_dump().values()) / 14
        issues = []
        if avg < 0.4:
            issues.append("전반적인 사고 역량 부족 감지")
        if scores.reflection_depth_score < 0.3:
            issues.append("자기 반성 부재")
        if scores.error_analysis_score < 0.3:
            issues.append("오류 분석 미흡")
        summary = f"사고 역량 평균 {avg:.2f} — {'양호' if avg >= 0.5 else '개선 필요'}."
        return LLMAnalysisOutput(
            thinking_scores=scores,
            analysis_summary=summary,
            detected_issues=issues,
        )
