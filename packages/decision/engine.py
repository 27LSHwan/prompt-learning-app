import sys
from pathlib import Path
_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from packages.shared.types import DropoutType, RiskStage
from packages.shared.utils import score_to_stage
from .schemas import DecisionInput, DecisionOutput
from .types import classify_dropout_type, INTERVENTION_STRATEGIES

_URGENCY_MAP = {
    RiskStage.STABLE:   "low",
    RiskStage.MILD:     "low",
    RiskStage.CAUTION:  "medium",
    RiskStage.HIGH:     "high",
    RiskStage.CRITICAL: "critical",
}


class DecisionEngine:
    """
    §7 Decision Engine
    ScoringResult → DropoutType 분류 + RiskStage 판정 + 개입 전략 결정
    """

    def decide(self, inp: DecisionInput) -> DecisionOutput:
        # 1. 위험 단계
        stage = score_to_stage(inp.total_risk)

        # 2. 낙오 유형
        dtype = classify_dropout_type(
            total_risk=inp.total_risk,
            thinking_risk=inp.thinking_risk,
            performance_risk=inp.performance_risk,
            progress_risk=inp.progress_risk,
            engagement_risk=inp.engagement_risk,
            process_risk=inp.process_risk,
            triggered_events=inp.triggered_events,
        )

        # 3. 개입 여부: 경미(20) 이상이면 개입
        should_intervene = inp.total_risk >= 20

        # 4. 개입 전략
        strategy = INTERVENTION_STRATEGIES.get(dtype, INTERVENTION_STRATEGIES[DropoutType.NONE])
        intervention_type = strategy["type"]
        intervention_message = None
        if strategy["message_template"] and should_intervene:
            intervention_message = strategy["message_template"].format(
                student=inp.student_id
            )

        return DecisionOutput(
            dropout_type=dtype.value,
            risk_stage=stage.value,
            should_intervene=should_intervene,
            intervention_type=intervention_type,
            intervention_message=intervention_message,
            urgency=_URGENCY_MAP[stage],
        )
