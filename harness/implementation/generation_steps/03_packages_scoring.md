# Step 03 — packages/scoring 구현

## 목표
LLM 분석 결과를 받아 0~100 범위의 위험도 점수를 계산한다.

## 가중치 설계

| 신호 | 기여도 | 방향 |
|------|--------|------|
| engagement_signal | 40% | 낮을수록 위험 ↑ |
| performance_signal | 35% | 낮을수록 위험 ↑ |
| sentiment_signal | 25% | 낮을수록 위험 ↑ |

## 생성 파일

### packages/scoring/weights.py
```python
ENGAGEMENT_WEIGHT = 0.40
PERFORMANCE_WEIGHT = 0.35
SENTIMENT_WEIGHT = 0.25

assert abs(ENGAGEMENT_WEIGHT + PERFORMANCE_WEIGHT + SENTIMENT_WEIGHT - 1.0) < 1e-9
```

### packages/scoring/schemas.py
```python
from pydantic import BaseModel, Field

class ScoringInput(BaseModel):
    engagement_signal: float = Field(ge=0.0, le=1.0)
    performance_signal: float = Field(ge=0.0, le=1.0)
    sentiment_signal: float = Field(ge=0.0, le=1.0)

class ScoringOutput(BaseModel):
    score: float = Field(ge=0.0, le=100.0, description="위험도 점수 (0~100, 높을수록 위험)")
    level: str = Field(description="low | medium | high | critical")
    breakdown: dict[str, float] = Field(description="각 신호별 기여 점수")
```

### packages/scoring/calculator.py
```python
from .schemas import ScoringInput, ScoringOutput
from .weights import ENGAGEMENT_WEIGHT, PERFORMANCE_WEIGHT, SENTIMENT_WEIGHT
from packages.shared.utils import score_to_level

class RiskCalculator:
    def calculate(self, input_data: ScoringInput) -> ScoringOutput:
        # 신호 반전: 신호가 낮을수록 위험도 높음
        eng_risk = (1.0 - input_data.engagement_signal) * ENGAGEMENT_WEIGHT * 100
        perf_risk = (1.0 - input_data.performance_signal) * PERFORMANCE_WEIGHT * 100
        sent_risk = (1.0 - input_data.sentiment_signal) * SENTIMENT_WEIGHT * 100

        score = eng_risk + perf_risk + sent_risk

        return ScoringOutput(
            score=round(score, 2),
            level=score_to_level(score),
            breakdown={
                "engagement": round(eng_risk, 2),
                "performance": round(perf_risk, 2),
                "sentiment": round(sent_risk, 2),
            }
        )
```

## 검증 기준
- [ ] 모든 신호 1.0 → score ≈ 0
- [ ] 모든 신호 0.0 → score ≈ 100
- [ ] score 범위: 0 ~ 100
- [ ] level 문자열 올바름
