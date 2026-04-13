"""
§6 Scoring Engine 가중치 & 이벤트 보너스 정의
"""

# ── base_risk 차원별 가중치 (합 = 1.0) ──────────────────────────
BASE_RISK_WEIGHTS = {
    "performance": 0.30,   # quiz_score_avg, task_success_rate, score_delta
    "progress":    0.25,   # submission_interval, drop_midway_rate
    "engagement":  0.20,   # login_frequency, session_duration
    "process":     0.15,   # attempt_count, revision_count, retry_count, strategy_change_count
    "thinking":    0.10,   # thinking_risk (LLM)
}

assert abs(sum(BASE_RISK_WEIGHTS.values()) - 1.0) < 1e-9

# ── §6 event_bonus ──────────────────────────────────────────────
EVENT_BONUSES = {
    "sudden_score_drop":    15,
    "sudden_activity_drop": 15,
    "repeated_error":       10,
    "no_improvement":       10,
    "dependency":           15,
    "multi_signal":         20,
}

# ── thinking_risk 개별 점수 가중치 (균등) ───────────────────────
THINKING_SCORE_FIELDS = [
    "problem_understanding_score",
    "problem_decomposition_score",
    "constraint_awareness_score",
    "validation_awareness_score",
    "improvement_prompt_score",
    "self_explanation_score",
    "reasoning_quality_score",
    "reflection_depth_score",
    "error_analysis_score",
    "debugging_quality_score",
    "decision_reasoning_score",
    "approach_selection_score",
    "improvement_consistency_score",
    "iteration_quality_score",
]
THINKING_WEIGHT_PER_FIELD = 1.0 / len(THINKING_SCORE_FIELDS)  # 균등 가중치
