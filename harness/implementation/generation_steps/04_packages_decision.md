# Step 04 — packages/decision 구현

## 목표
위험도 점수를 기반으로 자동 개입 메시지와 유형을 결정한다.

## 결정 규칙

| level | 개입 유형 | 자동 생성 여부 |
|-------|-----------|--------------|
| low | 없음 | X |
| medium | email | O (선택적) |
| high | email | O (필수) |
| critical | call | O (즉시) |

## 생성 파일

### packages/decision/schemas.py
```python
from pydantic import BaseModel
from typing import Optional

class DecisionInput(BaseModel):
    student_id: str
    score: float
    level: str
    factors: dict[str, float]

class DecisionOutput(BaseModel):
    should_intervene: bool
    intervention_type: Optional[str]  # email | call | meeting | None
    message: Optional[str]
    urgency: str  # low | medium | high | immediate
```

### packages/decision/rules.py
```python
INTERVENTION_RULES = {
    "low": {
        "should_intervene": False,
        "type": None,
        "urgency": "low",
        "message_template": None,
    },
    "medium": {
        "should_intervene": True,
        "type": "email",
        "urgency": "medium",
        "message_template": "{student_id}님, 최근 학습 활동을 확인해주세요. 도움이 필요하시면 연락하세요.",
    },
    "high": {
        "should_intervene": True,
        "type": "email",
        "urgency": "high",
        "message_template": "{student_id}님, 학습에 어려움이 감지되었습니다. 학습 코치와 상담을 권장합니다.",
    },
    "critical": {
        "should_intervene": True,
        "type": "call",
        "urgency": "immediate",
        "message_template": "{student_id}님, 즉각적인 지원이 필요합니다. 담당자가 연락드릴 예정입니다.",
    },
}
```

### packages/decision/engine.py
```python
from .schemas import DecisionInput, DecisionOutput
from .rules import INTERVENTION_RULES

class DecisionEngine:
    def decide(self, input_data: DecisionInput) -> DecisionOutput:
        rule = INTERVENTION_RULES.get(input_data.level, INTERVENTION_RULES["low"])

        message = None
        if rule["message_template"]:
            message = rule["message_template"].format(student_id=input_data.student_id)

        return DecisionOutput(
            should_intervene=rule["should_intervene"],
            intervention_type=rule["type"],
            message=message,
            urgency=rule["urgency"],
        )
```

## 검증 기준
- [ ] level="low" → should_intervene=False
- [ ] level="critical" → intervention_type="call"
- [ ] level="high" → urgency="high"
- [ ] 메시지에 student_id 포함
