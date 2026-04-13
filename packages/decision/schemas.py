from pydantic import BaseModel
from typing import Optional


class DecisionInput(BaseModel):
    student_id: str
    total_risk: float
    thinking_risk: float
    performance_risk: float
    progress_risk: float
    engagement_risk: float
    process_risk: float
    triggered_events: list[str] = []


class DecisionOutput(BaseModel):
    dropout_type:       str             # DropoutType 값
    risk_stage:         str             # RiskStage 값
    should_intervene:   bool
    intervention_type:  Optional[str]   # email | call | meeting | None
    intervention_message: Optional[str]
    urgency:            str             # low | medium | high | critical
