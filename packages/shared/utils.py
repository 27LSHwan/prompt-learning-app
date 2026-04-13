import uuid
from datetime import datetime, timezone
from .types import RiskStage


def generate_uuid() -> str:
    return str(uuid.uuid4())


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def score_to_stage(total_risk: float) -> RiskStage:
    """
    §7 위험 단계 매핑
    0~19  → 안정
    20~39 → 경미
    40~59 → 주의
    60~79 → 고위험
    80~100→ 심각
    """
    if total_risk < 20:
        return RiskStage.STABLE
    elif total_risk < 40:
        return RiskStage.MILD
    elif total_risk < 60:
        return RiskStage.CAUTION
    elif total_risk < 80:
        return RiskStage.HIGH
    else:
        return RiskStage.CRITICAL


def clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, value))
