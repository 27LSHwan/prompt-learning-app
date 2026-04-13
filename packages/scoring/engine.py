"""
§6 Scoring Engine
──────────────────────────────────────────────────
thinking_risk = 100 - 가중합(사고 점수 14개)
base_risk     = 0.30*performance + 0.25*progress + 0.20*engagement
                + 0.15*process + 0.10*thinking
event_bonus   = 각 이벤트 플래그 합산
total_risk    = min(100, base_risk + event_bonus)
"""

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from packages.shared.utils import clamp
from packages.llm_analysis.schemas import ThinkingScores
from .schemas import BehavioralData, EventFlags, ScoringResult
from .weights import (
    BASE_RISK_WEIGHTS, EVENT_BONUSES,
    THINKING_SCORE_FIELDS, THINKING_WEIGHT_PER_FIELD,
)


class ScoringEngine:
    # ── 1. thinking_risk ───────────────────────────────────────
    def calc_thinking_risk(self, scores: ThinkingScores) -> float:
        """thinking_risk = 100 - 가중합(사고 점수 14개 × 균등 가중치 × 100)"""
        values = scores.model_dump()
        weighted_sum = sum(values[f] * THINKING_WEIGHT_PER_FIELD for f in THINKING_SCORE_FIELDS)
        return clamp(100.0 - weighted_sum * 100.0)

    # ── 2. 차원별 위험도 (0~100, 높을수록 위험) ─────────────────
    def _performance_risk(self, b: BehavioralData) -> float:
        """quiz_score_avg, task_success_rate, score_delta → 높으면 안전"""
        score_delta_norm = clamp((b.score_delta + 1) / 2)   # -1~1 → 0~1
        avg = (b.quiz_score_avg + b.task_success_rate + score_delta_norm) / 3
        return clamp((1.0 - avg) * 100)

    def _progress_risk(self, b: BehavioralData) -> float:
        """submission_interval(높을수록 위험), drop_midway_rate(높을수록 위험)"""
        interval_norm = clamp(b.submission_interval)        # 이미 0~1 정규화 가정
        avg = (interval_norm + b.drop_midway_rate) / 2
        return clamp(avg * 100)

    def _engagement_risk(self, b: BehavioralData) -> float:
        """login_frequency, session_duration → 높으면 안전"""
        avg = (clamp(b.login_frequency) + clamp(b.session_duration)) / 2
        return clamp((1.0 - avg) * 100)

    def _process_risk(self, b: BehavioralData) -> float:
        """
        attempt_count, revision_count, retry_count, strategy_change_count.
        극단적으로 적으면(비참여) 위험, 적당히 있으면 안전, 과도하면 약간 위험.
        """
        def norm(v: int, ideal: float = 3.0) -> float:
            if v == 0:
                return 1.0          # 시도조차 없음 → 최대 위험
            ratio = v / ideal
            if ratio <= 1.0:
                return 1.0 - ratio  # 0~ideal: 위험 감소
            else:
                return min(0.5, (ratio - 1.0) * 0.2)  # ideal 초과: 약간 위험

        scores = [
            norm(b.attempt_count, 3),
            norm(b.revision_count, 2),
            norm(b.retry_count, 2),
            norm(b.strategy_change_count, 2),
        ]
        return clamp(sum(scores) / len(scores) * 100)

    # ── 3. event_bonus ─────────────────────────────────────────
    def calc_event_bonus(self, flags: EventFlags) -> tuple[float, list[str]]:
        """이벤트 플래그 → 보너스 점수 + 트리거된 이벤트 목록"""
        bonus = 0.0
        triggered = []
        for event, points in EVENT_BONUSES.items():
            if getattr(flags, event, False):
                bonus += points
                triggered.append(event)
        return bonus, triggered

    # ── 4. 이벤트 자동 감지 ────────────────────────────────────
    def detect_events(self, b: BehavioralData) -> EventFlags:
        """행동 데이터에서 이벤트 플래그를 자동 감지한다."""
        flags = EventFlags()

        # sudden_score_drop: 점수가 크게 하락
        if b.score_delta < -0.3:
            flags.sudden_score_drop = True

        # sudden_activity_drop: 로그인+세션 모두 낮음
        if b.login_frequency < 0.2 and b.session_duration < 0.2:
            flags.sudden_activity_drop = True

        # repeated_error: 재시도가 많은데 성공률 낮음
        if b.retry_count >= 3 and b.task_success_rate < 0.4:
            flags.repeated_error = True

        # no_improvement: score_delta가 0에 가깝고 퀴즈 점수도 낮음
        if abs(b.score_delta) < 0.05 and b.quiz_score_avg < 0.4:
            flags.no_improvement = True

        # dependency: 전략 변경 없이 재시도만 반복
        if b.strategy_change_count == 0 and b.retry_count >= 3:
            flags.dependency = True

        # multi_signal: 2개 이상 이벤트 동시 발생
        active = sum([
            flags.sudden_score_drop, flags.sudden_activity_drop,
            flags.repeated_error, flags.no_improvement, flags.dependency,
        ])
        if active >= 2:
            flags.multi_signal = True

        return flags

    # ── 5. 메인 계산 ───────────────────────────────────────────
    def calculate(
        self,
        behavioral: BehavioralData,
        thinking_scores: ThinkingScores,
        event_flags: EventFlags | None = None,
    ) -> ScoringResult:
        """
        §6 공식 전체 실행.
        event_flags 미입력 시 행동 데이터에서 자동 감지.
        """
        # 1. thinking_risk
        thinking_risk = self.calc_thinking_risk(thinking_scores)

        # 2. 차원별 위험도
        perf_risk   = self._performance_risk(behavioral)
        prog_risk   = self._progress_risk(behavioral)
        eng_risk    = self._engagement_risk(behavioral)
        proc_risk   = self._process_risk(behavioral)

        # 3. base_risk
        w = BASE_RISK_WEIGHTS
        base_risk = (
            perf_risk   * w["performance"] +
            prog_risk   * w["progress"]    +
            eng_risk    * w["engagement"]  +
            proc_risk   * w["process"]     +
            thinking_risk * w["thinking"]
        )

        # 4. event_bonus
        if event_flags is None:
            event_flags = self.detect_events(behavioral)
        bonus, triggered = self.calc_event_bonus(event_flags)

        # 5. total_risk
        total_risk = clamp(base_risk + bonus)

        return ScoringResult(
            total_risk=round(total_risk, 2),
            base_risk=round(base_risk, 2),
            event_bonus=round(bonus, 2),
            thinking_risk=round(thinking_risk, 2),
            performance_risk=round(perf_risk, 2),
            progress_risk=round(prog_risk, 2),
            engagement_risk=round(eng_risk, 2),
            process_risk=round(proc_risk, 2),
            triggered_events=triggered,
        )
