# Step 02 — packages/llm_analysis 구현

## 목표
학생 제출물 텍스트를 OpenAI API로 분석하여 구조화된 신호를 반환한다.

## 생성 파일

### packages/llm_analysis/schemas.py
```python
from pydantic import BaseModel, Field

class LLMAnalysisInput(BaseModel):
    student_id: str
    content: str
    submission_type: str

class LLMAnalysisOutput(BaseModel):
    engagement_signal: float = Field(ge=0.0, le=1.0, description="참여도 신호 (0~1)")
    performance_signal: float = Field(ge=0.0, le=1.0, description="성취도 신호 (0~1)")
    sentiment_signal: float = Field(ge=0.0, le=1.0, description="감정 신호 (0~1, 높을수록 긍정)")
    summary: str = Field(description="분석 요약")
    flags: list[str] = Field(default_factory=list, description="감지된 위험 플래그")
```

### packages/llm_analysis/prompts.py
```python
ANALYSIS_PROMPT = """
다음 학생의 학습 제출물을 분석하여 낙오 위험 신호를 평가하라.

제출 유형: {submission_type}
제출 내용:
---
{content}
---

다음 항목을 0.0~1.0 범위로 평가하라:
1. engagement_signal: 학습 참여도 (0=완전 이탈, 1=매우 적극적)
2. performance_signal: 성취도 (0=매우 낮음, 1=매우 높음)
3. sentiment_signal: 감정 상태 (0=매우 부정적, 1=매우 긍정적)

또한:
- 1-2문장 분석 요약 작성
- 위험 플래그 목록 (예: "반복적 불만 표현", "개념 혼란", "참여 회피")

JSON 형식으로 응답하라.
"""
```

### packages/llm_analysis/analyzer.py
```python
import json
from openai import AsyncOpenAI
from .schemas import LLMAnalysisInput, LLMAnalysisOutput
from .prompts import ANALYSIS_PROMPT

class LLMAnalyzer:
    def __init__(self, api_key: str, model: str = "gpt-4o"):
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = model

    async def analyze(self, input_data: LLMAnalysisInput) -> LLMAnalysisOutput:
        prompt = ANALYSIS_PROMPT.format(
            submission_type=input_data.submission_type,
            content=input_data.content,
        )
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )
        raw = json.loads(response.choices[0].message.content)
        return LLMAnalysisOutput(**raw)
```

## 검증 기준
- [ ] `LLMAnalyzer` 클래스 임포트 가능
- [ ] `LLMAnalysisOutput` 스키마 유효성 검사 동작
- [ ] engagement_signal 범위: 0.0 ~ 1.0
