"""
루브릭 기반 프롬프트 품질 평가기
OpenAI API가 없으면 키워드 휴리스틱 mock 평가를 수행한다.
"""
from dataclasses import dataclass, field
from typing import Optional
import json
import re

try:
    from openai import AsyncOpenAI
    _OPENAI_AVAILABLE = True
except ImportError:
    _OPENAI_AVAILABLE = False


@dataclass
class CriterionScore:
    name: str
    score: float        # 0 ~ max_score
    max_score: float    # 보통 10
    feedback: str

@dataclass
class RubricEvaluationResult:
    criteria_scores: list[CriterionScore]
    total_score: float          # 0~100 (가중 평균)
    overall_feedback: str
    strengths: list[str]
    improvements: list[str]


# 각 루브릭 기준별 핵심 키워드
_CRITERION_KEYWORDS = {
    "명확성":       (["명확", "구체", "정확", "분명", "상세", "설명", "요청", "질문", "알려"], ["모르", "그냥", "뭔가", "아무거나"]),
    "역할 정의":    (["역할", "전문가", "당신은", "너는", "~로서", "~처럼", "교수", "선생", "코치", "분석가", "도우미"], ["없음"]),
    "출력 형식":    (["형식", "목록", "리스트", "번호", "표", "단계", "순서", "줄바꿈", "마크다운", "JSON", "한국어", "영어"], []),
    "맥락 제공":    (["배경", "맥락", "상황", "이유", "목적", "학생", "초보", "경험", "수준", "대상"], []),
    "예시 포함":    (["예시", "예를 들면", "예를 들어", "예:", "입력:", "출력:", "샘플", "다음과 같이", "예제"], []),
    "제약 조건":    (["하지 마", "금지", "반드시", "~만", "최대", "최소", "범위", "제한", "조건", "단", "단,", "주의"], []),
    "CoT 기법":     (["단계별", "step by step", "차례대로", "순서대로", "먼저", "다음으로", "마지막으로", "이유", "왜냐하면", "따라서"], []),
    "Few-shot":     (["예시:", "입력:", "출력:", "질문:", "답변:", "예제1", "예제2", "다음은", "같은 방식으로"], []),
    "구조화":       (["구조", "섹션", "단락", "항목", "목차", "개요", "형식", "템플릿", "스키마"], []),
    "안전성":       (["적절", "윤리", "안전", "존중", "공정", "편견", "제한", "경계", "거부", "해로운"], ["욕설", "폭력", "불법"]),
}

def _mock_criterion_score(criterion_name: str, student_prompt: str, max_score: float = 10.0) -> tuple[float, str]:
    """키워드 휴리스틱으로 단일 기준 점수를 추정한다."""
    text = student_prompt.lower()
    length_factor = min(1.0, len(student_prompt) / 500)
    
    # 기준명에서 핵심 키워드 매칭
    matched = False
    for key, (pos_kw, neg_kw) in _CRITERION_KEYWORDS.items():
        if key in criterion_name:
            pos_hits = sum(1 for k in pos_kw if k in text)
            neg_hits = sum(1 for k in neg_kw if k in text)
            score_raw = min(1.0, (pos_hits * 0.25 + length_factor * 0.15 - neg_hits * 0.2 + 0.3))
            score = round(max(2.0, min(max_score, score_raw * max_score)), 1)
            if pos_hits >= 2:
                feedback = f"'{criterion_name}' 관련 표현이 잘 포함되어 있습니다."
            elif pos_hits == 1:
                feedback = f"'{criterion_name}' 요소가 부분적으로 있으나 보완이 필요합니다."
            else:
                feedback = f"'{criterion_name}' 요소가 부족합니다. 더 구체적으로 작성해 보세요."
            matched = True
            return score, feedback
    
    if not matched:
        # 기본 점수: 글자 수와 구체성 기반
        score = round(max(2.0, min(max_score, (length_factor * 0.6 + 0.2) * max_score)), 1)
        feedback = "내용을 더 구체적으로 작성하면 점수가 높아집니다."
        return score, feedback


class RubricEvaluator:
    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-4o"):
        self.model = model
        self._client = None
        if _OPENAI_AVAILABLE and api_key:
            self._client = AsyncOpenAI(api_key=api_key)

    async def evaluate(
        self,
        student_prompt: str,
        problem_title: str,
        problem_description: str,
        rubric: dict,
    ) -> RubricEvaluationResult:
        """
        rubric 형식:
        {
          "criteria": [
            {"name": "명확성", "description": "태스크가 명확한가", "weight": 0.2, "max_score": 10},
            ...
          ],
          "evaluation_guidelines": "이 문제는 역할 기반 프롬프팅을 평가합니다..."
        }
        """
        if self._client:
            try:
                return await self._llm_evaluate(student_prompt, problem_title, problem_description, rubric)
            except Exception:
                # API 키가 유효하지 않거나 네트워크 오류 시 mock으로 fallback
                pass
        return self._mock_evaluate(student_prompt, rubric)

    async def _llm_evaluate(self, prompt: str, title: str, desc: str, rubric: dict) -> RubricEvaluationResult:
        criteria = rubric.get("criteria", [])
        guidelines = rubric.get("evaluation_guidelines", "")
        
        criteria_str = "\n".join(
            f"- {c['name']} (배점: {c.get('max_score',10)}점, 가중치: {c.get('weight',1/len(criteria)):.2f}): {c['description']}"
            for c in criteria
        )
        
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

        user_content = f"문제: {title}\n\n{desc}\n\n학생이 작성한 프롬프트:\n{prompt}"
        
        resp = await self._client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
        )
        raw = json.loads(resp.choices[0].message.content)
        
        criteria_map = {c["name"]: c for c in criteria}
        cs_list = []
        weighted_total = 0.0
        total_weight = 0.0
        
        for cs in raw.get("criteria_scores", []):
            criterion = criteria_map.get(cs["name"], {})
            max_s = criterion.get("max_score", 10)
            weight = criterion.get("weight", 1.0 / len(criteria))
            score = max(0.0, min(float(max_s), float(cs.get("score", 5))))
            cs_list.append(CriterionScore(
                name=cs["name"], score=score, max_score=max_s, feedback=cs.get("feedback", "")
            ))
            weighted_total += (score / max_s) * weight
            total_weight += weight
        
        total = round((weighted_total / max(total_weight, 1e-9)) * 100, 1)
        return RubricEvaluationResult(
            criteria_scores=cs_list,
            total_score=total,
            overall_feedback=raw.get("overall_feedback", ""),
            strengths=raw.get("strengths", []),
            improvements=raw.get("improvements", []),
        )

    def _mock_evaluate(self, student_prompt: str, rubric: dict) -> RubricEvaluationResult:
        criteria = rubric.get("criteria", [])
        cs_list = []
        weighted_total = 0.0
        total_weight = 0.0
        
        for c in criteria:
            max_s = c.get("max_score", 10)
            weight = c.get("weight", 1.0 / max(len(criteria), 1))
            score, feedback = _mock_criterion_score(c["name"], student_prompt, max_s)
            cs_list.append(CriterionScore(name=c["name"], score=score, max_score=max_s, feedback=feedback))
            weighted_total += (score / max_s) * weight
            total_weight += weight
        
        total = round((weighted_total / max(total_weight, 1e-9)) * 100, 1)
        
        # 강점/개선점 추출
        strengths = [cs.name for cs in cs_list if cs.score / cs.max_score >= 0.7][:2]
        improvements = [cs.name for cs in cs_list if cs.score / cs.max_score < 0.5][:2]
        
        if total >= 70:
            overall = f"전반적으로 잘 작성된 프롬프트입니다. 총점 {total}점."
        elif total >= 50:
            overall = f"기본 요소는 있으나 일부 개선이 필요합니다. 총점 {total}점."
        else:
            overall = f"프롬프트 구성 요소를 더 충실히 포함해야 합니다. 총점 {total}점."
        
        return RubricEvaluationResult(
            criteria_scores=cs_list,
            total_score=total,
            overall_feedback=overall,
            strengths=strengths if strengths else ["기본 구조 존재"],
            improvements=improvements if improvements else ["전체적인 구체성 향상"],
        )
