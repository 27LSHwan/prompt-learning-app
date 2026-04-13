"""
§7 낙오 유형 분류 규칙 및 개입 전략 매핑
"""
import sys
from pathlib import Path
_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from packages.shared.types import DropoutType

# ──────────────────────────────────────────────────────────────
# 낙오 유형 판별 규칙 (ScoringResult + ThinkingScores 기반)
# ──────────────────────────────────────────────────────────────

def classify_dropout_type(
    total_risk: float,
    thinking_risk: float,
    performance_risk: float,
    progress_risk: float,
    engagement_risk: float,
    process_risk: float,
    triggered_events: list[str],
) -> DropoutType:
    """
    위험 점수 프로필을 분석해 낙오 유형을 결정한다.

    우선순위:
    1. compound  — 3개 이상 차원 동시 고위험
    2. sudden    — sudden_* 이벤트 트리거
    3. dependency— dependency 이벤트 트리거
    4. cognitive — thinking_risk 최우세
    5. motivational — engagement_risk 최우세
    6. strategic — process_risk 또는 progress_risk 최우세
    7. none      — total_risk < 20
    """
    if total_risk < 20:
        return DropoutType.NONE

    risks = {
        "thinking":    thinking_risk,
        "performance": performance_risk,
        "progress":    progress_risk,
        "engagement":  engagement_risk,
        "process":     process_risk,
    }
    high_dims = [k for k, v in risks.items() if v >= 60]

    # compound: 고위험 차원 3개 이상
    if len(high_dims) >= 3:
        return DropoutType.COMPOUND

    # sudden: 급격한 변화 감지
    if "sudden_score_drop" in triggered_events or "sudden_activity_drop" in triggered_events:
        return DropoutType.SUDDEN

    # dependency: 전략 없이 반복
    if "dependency" in triggered_events:
        return DropoutType.DEPENDENCY

    # 가장 높은 차원으로 분류
    dominant = max(risks, key=risks.get)
    if dominant == "thinking":
        return DropoutType.COGNITIVE
    elif dominant == "engagement":
        return DropoutType.MOTIVATIONAL
    else:
        return DropoutType.STRATEGIC


# ──────────────────────────────────────────────────────────────
# 낙오 유형별 개입 전략
# ──────────────────────────────────────────────────────────────

INTERVENTION_STRATEGIES = {
    DropoutType.COGNITIVE: {
        "type": "meeting",
        "message_template": (
            "{student}님, 학습 내용 이해에 어려움이 감지되었습니다. "
            "개념 정리 및 사고력 향상을 위한 1:1 튜터링을 권장합니다."
        ),
    },
    DropoutType.MOTIVATIONAL: {
        "type": "message",
        "message_template": (
            "{student}님, 학습 참여도가 감소하고 있습니다. "
            "학습 동기 회복을 위한 상담을 제안합니다. 언제든 연락주세요."
        ),
    },
    DropoutType.STRATEGIC: {
        "type": "resource",
        "message_template": (
            "{student}님, 학습 전략 개선이 필요합니다. "
            "효과적인 문제 해결 방법을 함께 찾아보는 코칭을 안내드립니다."
        ),
    },
    DropoutType.SUDDEN: {
        "type": "alert",
        "message_template": (
            "{student}님, 갑작스러운 학습 변화가 감지되었습니다. "
            "담당 교수가 곧 연락드릴 예정입니다. 어떤 어려움이 있으신지 함께 알아보겠습니다."
        ),
    },
    DropoutType.DEPENDENCY: {
        "type": "meeting",
        "message_template": (
            "{student}님, 동일한 방식의 반복 시도가 감지되었습니다. "
            "전략적 학습 방법 변환을 위한 상담을 진행하겠습니다."
        ),
    },
    DropoutType.COMPOUND: {
        "type": "alert",
        "message_template": (
            "{student}님, 다수의 학습 위험 신호가 동시에 감지되었습니다. "
            "즉각적인 종합 지원이 필요합니다. 담당 팀이 빠르게 연락드리겠습니다."
        ),
    },
    DropoutType.NONE: {
        "type": None,
        "message_template": None,
    },
}
