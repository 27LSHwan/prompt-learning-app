"""
Contract Check — 루브릭 기반 프롬프트 평가 검증
RubricEvaluator를 직접 호출하여 평가 시스템의 correctness를 검증한다.
- OpenAI API 없이 mock 모드로 실행
- 좋은 프롬프트 vs 나쁜 프롬프트 상대적 점수 비교
- 응답 구조 검증
"""
import sys
import asyncio
from pathlib import Path
from typing import NamedTuple

_ROOT = Path(__file__).resolve().parents[3]  # harness/verification/contract_checks -> project root
for _p in [str(_ROOT), str(_ROOT / "packages")]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

from packages.llm_analysis.rubric_evaluator import RubricEvaluator, RubricEvaluationResult


class CheckResult(NamedTuple):
    name: str
    passed: bool
    message: str


# ── 테스트용 루브릭 ──────────────────────────────────────
_TEST_RUBRIC = {
    "criteria": [
        {"name": "역할 정의", "description": "AI 역할이 명확한가", "weight": 0.30, "max_score": 10},
        {"name": "명확성",    "description": "요청이 명확한가",   "weight": 0.25, "max_score": 10},
        {"name": "출력 형식", "description": "형식이 명시되었는가","weight": 0.25, "max_score": 10},
        {"name": "맥락 제공", "description": "맥락이 있는가",      "weight": 0.20, "max_score": 10},
    ],
    "evaluation_guidelines": "프롬프트 기본 품질을 평가합니다."
}

# 좋은 프롬프트 (역할 + 명확성 + 형식 + 맥락 모두 포함)
_GOOD_PROMPT = """
당신은 중학교 수학 전문 가정교사입니다.
중학교 2학년 학생에게 이차방정식을 설명해주세요.

요구사항:
- 실생활 예시를 2개 이상 포함하세요
- 단계별로 설명하세요 (1단계, 2단계, 3단계)
- 학생이 이해했는지 확인하는 연습문제를 마지막에 3개 제시하세요
- 중학생 수준의 쉬운 언어를 사용하세요

출력 형식:
1. 개념 설명
2. 실생활 예시
3. 풀이 단계
4. 연습 문제
"""

# 나쁜 프롬프트 (막연하고 요소 없음)
_BAD_PROMPT = "이차방정식 설명해줘"

# 중간 프롬프트
_MEDIUM_PROMPT = "수학 선생님처럼 이차방정식을 중학생에게 설명해주세요. 예시도 포함해주세요."


async def run_checks() -> list[CheckResult]:
    results = []
    evaluator = RubricEvaluator(api_key=None)  # mock 모드

    # ── 검증 1: 결과 구조 확인 ───────────────────────────
    try:
        result = await evaluator.evaluate(
            student_prompt=_GOOD_PROMPT,
            problem_title="테스트 문제",
            problem_description="테스트 설명",
            rubric=_TEST_RUBRIC,
        )
        assert isinstance(result, RubricEvaluationResult), "결과 타입 오류"
        assert 0 <= result.total_score <= 100, f"점수 범위 오류: {result.total_score}"
        assert len(result.criteria_scores) == len(_TEST_RUBRIC["criteria"]), "기준 수 불일치"
        assert isinstance(result.overall_feedback, str), "피드백 타입 오류"
        assert isinstance(result.strengths, list), "강점 타입 오류"
        assert isinstance(result.improvements, list), "개선점 타입 오류"
        results.append(CheckResult("결과 구조 검증", True, f"total_score={result.total_score}, criteria={len(result.criteria_scores)}개"))
    except Exception as e:
        results.append(CheckResult("결과 구조 검증", False, str(e)))

    # ── 검증 2: 좋은 프롬프트 > 나쁜 프롬프트 ────────────
    try:
        good_result = await evaluator.evaluate(_GOOD_PROMPT, "", "", _TEST_RUBRIC)
        bad_result  = await evaluator.evaluate(_BAD_PROMPT,  "", "", _TEST_RUBRIC)
        passed = good_result.total_score > bad_result.total_score
        results.append(CheckResult(
            "상대 점수 비교 (좋은>나쁜)",
            passed,
            f"좋은 프롬프트={good_result.total_score:.1f} vs 나쁜 프롬프트={bad_result.total_score:.1f}"
        ))
    except Exception as e:
        results.append(CheckResult("상대 점수 비교 (좋은>나쁜)", False, str(e)))

    # ── 검증 3: 중간 프롬프트가 범위 내 점수 ────────────
    try:
        medium_result = await evaluator.evaluate(_MEDIUM_PROMPT, "", "", _TEST_RUBRIC)
        passed = 0 < medium_result.total_score < 100
        results.append(CheckResult(
            "중간 프롬프트 점수 범위",
            passed,
            f"중간 프롬프트 점수={medium_result.total_score:.1f} (0~100 범위)"
        ))
    except Exception as e:
        results.append(CheckResult("중간 프롬프트 점수 범위", False, str(e)))

    # ── 검증 4: 각 기준 점수가 max_score 이하 ────────────
    try:
        result = await evaluator.evaluate(_GOOD_PROMPT, "", "", _TEST_RUBRIC)
        all_valid = all(0 <= cs.score <= cs.max_score for cs in result.criteria_scores)
        details = ", ".join(f"{cs.name}={cs.score}/{cs.max_score}" for cs in result.criteria_scores)
        results.append(CheckResult("기준별 점수 유효성", all_valid, details))
    except Exception as e:
        results.append(CheckResult("기준별 점수 유효성", False, str(e)))

    # ── 검증 5: 빈 프롬프트도 처리 가능 ─────────────────
    try:
        empty_result = await evaluator.evaluate("", "", "", _TEST_RUBRIC)
        passed = 0 <= empty_result.total_score <= 100
        results.append(CheckResult("빈 프롬프트 처리", passed, f"점수={empty_result.total_score}"))
    except Exception as e:
        results.append(CheckResult("빈 프롬프트 처리", False, str(e)))

    return results


def run() -> dict:
    """run_all.py 호출용 함수"""
    results = asyncio.run(run_checks())
    passed = sum(1 for r in results if r.passed)
    total = len(results)

    return {
        "check_name": "contract_prompt_eval",
        "passed": passed == total,
        "total": total,
        "passed_count": passed,
        "failed_count": total - passed,
        "results": [{"name": r.name, "passed": r.passed, "message": r.message} for r in results],
    }


def main():
    result = run()
    print(f"\n루브릭 평가 검증: {result['passed_count']}/{result['total']} 통과\n")
    for item in result["results"]:
        icon = "✅" if item["passed"] else "❌"
        print(f"  {icon} {item['name']}: {item['message']}")
    return result["passed"]


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
