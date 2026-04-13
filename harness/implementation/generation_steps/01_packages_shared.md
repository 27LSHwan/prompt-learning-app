# Step 01 — packages/shared 구현

## 목표
모든 패키지에서 공통으로 사용할 타입과 유틸리티를 구현한다.

## 생성 파일

### packages/shared/__init__.py
```python
from .types import RiskLevel, SubmissionType
from .utils import generate_uuid, now_utc

__all__ = ["RiskLevel", "SubmissionType", "generate_uuid", "now_utc"]
```

### packages/shared/types.py
```python
from enum import Enum

class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class SubmissionType(str, Enum):
    ASSIGNMENT = "assignment"
    QUIZ = "quiz"
    REFLECTION = "reflection"

class InterventionType(str, Enum):
    EMAIL = "email"
    CALL = "call"
    MEETING = "meeting"

class InterventionStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    COMPLETED = "completed"
```

### packages/shared/utils.py
```python
import uuid
from datetime import datetime, timezone

def generate_uuid() -> str:
    return str(uuid.uuid4())

def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def score_to_level(score: float) -> str:
    if score <= 25:
        return "low"
    elif score <= 50:
        return "medium"
    elif score <= 75:
        return "high"
    else:
        return "critical"
```

## 검증 기준
- [ ] `from packages.shared import RiskLevel` 가능
- [ ] `score_to_level(10)` → `"low"`
- [ ] `score_to_level(80)` → `"critical"`
