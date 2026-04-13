"""
Integration Check — packages/scoring + packages/decision 파이프라인 검증
§6 Scoring Engine 공식 및 §7 Decision Engine 판정 기준을 검증한다.
"""

import sys
from pathlib import Path
from typing import NamedTuple

_ROOT = Path(__file__).resolve().parents[3]
for _p in [str(_ROOT), str(_ROOT / "packages")]:
    if _p not in sys.path:
        sys.path.insert(0, _p)


class CheckResult(NamedTuple):
    name: str
    passed: bool
    message: str


# ──────────────────────────────────────────────
# 1. shared
# ──────────────────────────────────────────────
def check_shared() -> list[CheckResult]:
    results = []
    try:
        from packages.shared.utils import score_to_stage
        from packages.shared.types import RiskStage
        results.append(CheckResult("shared 임포트", True, "✅"))

        cases = [(10, "안정"), (25, "경미"), (45, "주의"), (65, "고위험"), (85, "심각")]
        for score, expected in cases:
            actual = score_to_stage(score).value
            ok = actual == expected
            results.append(CheckResult(
                f"score_to_stage({score}) = '{expected}'", ok,
                f"✅ {actual}" if ok else f"❌ {actual}",
            ))
    except Exception as e:
        results.append(CheckResult("shared 임포트", False, f"❌ {e}"))
    return results


# ──────────────────────────────────────────────
# 2. Scoring Engine §6 공식 검증
# ──────────────────────────────────────────────
def check_scoring() -> list[CheckResult]:
    results = []
    try:
        from packages.scoring.engine import ScoringEngine
        from packages.scoring.schemas import BehavioralData, EventFlags
        from packages.llm_analysis.schemas import ThinkingScores

        results.append(CheckResult("ScoringEngine 임포트", True, "✅"))
        eng = ScoringEngine()

        def make_thinking(v: float) -> ThinkingScores:
            return ThinkingScores(**{f: v for f in ThinkingScores.model_fields})

        # 모든 점수 최대 → total_risk ≈ 0
        best_b = BehavioralData(
            login_frequency=1.0, session_duration=1.0, submission_interval=0.0,
            drop_midway_rate=0.0, attempt_count=3, revision_count=2, retry_count=1,
            strategy_change_count=2, task_success_rate=1.0, quiz_score_avg=1.0, score_delta=1.0,
        )
        best_t = make_thinking(1.0)
        best_r = eng.calculate(best_b, best_t)
        ok = best_r.total_risk <= 10
        results.append(CheckResult("최우수 지표 → 낮은 risk", ok,
                                   f"✅ total_risk={best_r.total_risk}" if ok else f"❌ {best_r.total_risk}"))

        # 모든 점수 최악 → total_risk 높음
        worst_b = BehavioralData(
            login_frequency=0.0, session_duration=0.0, submission_interval=1.0,
            drop_midway_rate=1.0, attempt_count=0, revision_count=0, retry_count=0,
            strategy_change_count=0, task_success_rate=0.0, quiz_score_avg=0.0, score_delta=-1.0,
        )
        worst_t = make_thinking(0.0)
        worst_r = eng.calculate(worst_b, worst_t)
        ok = worst_r.total_risk >= 60
        results.append(CheckResult("최악 지표 → 높은 risk", ok,
                                   f"✅ total_risk={worst_r.total_risk}" if ok else f"❌ {worst_r.total_risk}"))

        # thinking_risk 공식: 100 - 가중합 검증
        half_t = make_thinking(0.5)
        tr = eng.calc_thinking_risk(half_t)
        ok = 45 <= tr <= 55  # 0.5 → ~50
        results.append(CheckResult("thinking_risk(0.5) ≈ 50", ok, f"✅ {tr:.1f}" if ok else f"❌ {tr:.1f}"))

        # total_risk 상한 100 검증
        ok = worst_r.total_risk <= 100
        results.append(CheckResult("total_risk ≤ 100 (상한)", ok, f"✅ {worst_r.total_risk}"))

        # event_bonus 검증: sudden_score_drop(+15) + sudden_activity_drop(+15) = +30
        flags = EventFlags(sudden_score_drop=True, sudden_activity_drop=True)
        bonus, triggered = eng.calc_event_bonus(flags)
        ok = bonus == 30.0
        results.append(CheckResult("event_bonus: +15+15=30", ok,
                                   f"✅ {bonus}" if ok else f"❌ {bonus}"))

        # multi_signal 자동 감지 검증
        multi_b = BehavioralData(
            login_frequency=0.0, session_duration=0.0, submission_interval=0.9,
            drop_midway_rate=0.8, attempt_count=0, revision_count=0, retry_count=5,
            strategy_change_count=0, task_success_rate=0.1, quiz_score_avg=0.1, score_delta=-0.5,
        )
        auto_flags = eng.detect_events(multi_b)
        ok = auto_flags.multi_signal
        results.append(CheckResult("다중 이벤트 → multi_signal 자동 감지", ok,
                                   "✅ multi_signal=True" if ok else "❌ multi_signal=False"))

    except Exception as e:
        results.append(CheckResult("ScoringEngine 오류", False, f"❌ {e}"))
    return results


# ──────────────────────────────────────────────
# 3. Decision Engine §7 검증
# ──────────────────────────────────────────────
def check_decision() -> list[CheckResult]:
    results = []
    try:
        from packages.decision.engine import DecisionEngine
        from packages.decision.schemas import DecisionInput

        results.append(CheckResult("DecisionEngine 임포트", True, "✅"))
        eng = DecisionEngine()

        def make_input(total: float, dominant: str = "thinking", events: list = []) -> DecisionInput:
            risks = dict(thinking_risk=20.0, performance_risk=20.0,
                         progress_risk=20.0, engagement_risk=20.0, process_risk=20.0)
            if dominant == "thinking":
                risks["thinking_risk"] = total * 0.8
            elif dominant == "engagement":
                risks["engagement_risk"] = total * 0.8
            return DecisionInput(student_id="s1", total_risk=total, triggered_events=events, **risks)

        # §7 위험 단계 5단계 검증
        stage_cases = [(10, "안정"), (30, "경미"), (50, "주의"), (70, "고위험"), (90, "심각")]
        for score, expected_stage in stage_cases:
            out = eng.decide(make_input(score))
            ok = out.risk_stage == expected_stage
            results.append(CheckResult(f"risk_stage({score}) = '{expected_stage}'", ok,
                                       f"✅ {out.risk_stage}" if ok else f"❌ {out.risk_stage}"))

        # 낙오 유형 검증
        # cognitive: thinking_risk 최우세
        out = eng.decide(DecisionInput(student_id="s", total_risk=60, thinking_risk=80,
                                       performance_risk=20, progress_risk=20, engagement_risk=20, process_risk=20))
        ok = out.dropout_type == "cognitive"
        results.append(CheckResult("thinking 우세 → cognitive", ok, f"✅" if ok else f"❌ {out.dropout_type}"))

        # motivational: engagement_risk 최우세
        out = eng.decide(DecisionInput(student_id="s", total_risk=60, thinking_risk=20,
                                       performance_risk=20, progress_risk=20, engagement_risk=80, process_risk=20))
        ok = out.dropout_type == "motivational"
        results.append(CheckResult("engagement 우세 → motivational", ok, f"✅" if ok else f"❌ {out.dropout_type}"))

        # sudden: sudden_score_drop 이벤트
        out = eng.decide(DecisionInput(student_id="s", total_risk=50, thinking_risk=30,
                                       performance_risk=30, progress_risk=30, engagement_risk=30, process_risk=30,
                                       triggered_events=["sudden_score_drop"]))
        ok = out.dropout_type == "sudden"
        results.append(CheckResult("sudden_score_drop → sudden", ok, f"✅" if ok else f"❌ {out.dropout_type}"))

        # compound: 3개 이상 차원 고위험
        out = eng.decide(DecisionInput(student_id="s", total_risk=80, thinking_risk=70,
                                       performance_risk=70, progress_risk=70, engagement_risk=70, process_risk=70))
        ok = out.dropout_type == "compound"
        results.append(CheckResult("다차원 고위험 → compound", ok, f"✅" if ok else f"❌ {out.dropout_type}"))

        # total_risk < 20 → should_intervene=False
        out = eng.decide(make_input(10))
        ok = not out.should_intervene
        results.append(CheckResult("risk<20 → should_intervene=False", ok, "✅" if ok else "❌"))

        # total_risk >= 20 → should_intervene=True
        out = eng.decide(make_input(30))
        ok = out.should_intervene
        results.append(CheckResult("risk>=20 → should_intervene=True", ok, "✅" if ok else "❌"))

    except Exception as e:
        results.append(CheckResult("DecisionEngine 오류", False, f"❌ {e}"))
    return results


# ──────────────────────────────────────────────
# 4. LLM Analyzer mock 검증
# ──────────────────────────────────────────────
def check_llm_analyzer() -> list[CheckResult]:
    results = []
    try:
        import asyncio
        from packages.llm_analysis.analyzer import LLMAnalyzer
        from packages.llm_analysis.schemas import LLMAnalysisInput

        analyzer = LLMAnalyzer()  # mock 모드
        inp = LLMAnalysisInput(student_id="s1", prompt_text="문제를 이해하고 단계별로 분석했습니다. 오류를 발견하여 수정했습니다.")

        result = asyncio.get_event_loop().run_until_complete(analyzer.analyze(inp)) \
            if asyncio.get_event_loop().is_running() else \
            asyncio.run(analyzer.analyze(inp))

        ts = result.thinking_scores
        ok = 14 == len(ts.model_dump())
        results.append(CheckResult("LLMAnalyzer: 사고 점수 14개 반환", ok, f"✅ {len(ts.model_dump())}개" if ok else f"❌"))

        ok = all(0.0 <= v <= 1.0 for v in ts.model_dump().values())
        results.append(CheckResult("사고 점수 범위 0~1", ok, "✅" if ok else "❌ 범위 초과"))

    except Exception as e:
        results.append(CheckResult("LLMAnalyzer 오류", False, f"❌ {e}"))
    return results


# ──────────────────────────────────────────────
# run()
# ──────────────────────────────────────────────
def run() -> dict:
    results = []
    results.extend(check_shared())
    results.extend(check_scoring())
    results.extend(check_decision())
    results.extend(check_llm_analyzer())

    passed = sum(1 for r in results if r.passed)
    failed = len(results) - passed
    return {
        "check_name": "integration",
        "passed": failed == 0,
        "total": len(results),
        "passed_count": passed,
        "failed_count": failed,
        "results": [{"name": r.name, "passed": r.passed, "message": r.message} for r in results],
    }


if __name__ == "__main__":
    import json
    r = run()
    print(json.dumps(r, ensure_ascii=False, indent=2))
    sys.exit(0 if r["passed"] else 1)
