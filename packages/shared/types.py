from enum import Enum


class RiskStage(str, Enum):
    """§7 위험 단계 (0~19 안정 / 20~39 경미 / 40~59 주의 / 60~79 고위험 / 80~100 심각)"""
    STABLE    = "안정"
    MILD      = "경미"
    CAUTION   = "주의"
    HIGH      = "고위험"
    CRITICAL  = "심각"


class DropoutType(str, Enum):
    """§7 낙오 유형 6종"""
    COGNITIVE    = "cognitive"
    MOTIVATIONAL = "motivational"
    STRATEGIC    = "strategic"
    SUDDEN       = "sudden"
    DEPENDENCY   = "dependency"
    COMPOUND     = "compound"
    NONE         = "none"


class UserRole(str, Enum):
    STUDENT = "student"
    ADMIN   = "admin"


class InterventionType(str, Enum):
    EMAIL   = "email"
    CALL    = "call"
    MEETING = "meeting"
    AUTO    = "auto"


class InterventionStatus(str, Enum):
    PENDING   = "pending"
    ACTIVE    = "active"
    COMPLETED = "completed"
