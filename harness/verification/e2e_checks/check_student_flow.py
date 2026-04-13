"""
E2E Check — 학생 흐름 검증
학생이 문제 목록 조회 → 프롬프트 제출 → 루브릭 평가 → 위험도 조회하는 전체 흐름을 검증한다.
JWT 인증을 사용하며 시드 계정(minjun@example.com)으로 테스트한다.
"""

import json
import sys
from typing import NamedTuple

try:
    import requests
except ImportError:
    print("requests 패키지가 필요합니다: pip install requests")
    sys.exit(1)


class CheckResult(NamedTuple):
    name: str
    passed: bool
    message: str


def run(server_url: str = "http://localhost:8000") -> dict:
    results = []
    context = {}

    # ── 인증 ──
    try:
        resp = requests.post(
            f"{server_url}/api/v1/auth/login",
            json={"email": "minjun@example.com", "password": "student123"},
            timeout=5,
        )
        if resp.status_code == 200:
            data = resp.json()
            context["token"] = data["access_token"]
            context["student_id"] = data["user_id"]
            context["headers"] = {"Authorization": f"Bearer {data['access_token']}"}
        else:
            results.append(CheckResult("E2E 학생: 로그인", False, f"❌ 상태코드 {resp.status_code}"))
            return _make_result(results)
    except Exception as e:
        results.append(CheckResult("E2E 학생: 로그인", False, f"❌ 연결 실패: {e}"))
        return _make_result(results)

    # ── Step 1: 문제 목록 조회 ──
    try:
        resp = requests.get(
            f"{server_url}/api/v1/student/problems",
            headers=context["headers"],
            timeout=5,
        )
        if resp.status_code == 200:
            data = resp.json()
            problems = data.get("items", data) if isinstance(data, dict) else data
            has_problems = isinstance(problems, list) and len(problems) > 0
            results.append(CheckResult(
                "E2E 학생: Step1 — 문제 목록 조회",
                has_problems,
                f"✅ 문제 {len(problems)}개 조회" if has_problems else "❌ 문제 없음",
            ))
            if has_problems:
                context["problem_id"] = problems[0]["id"]
        else:
            results.append(CheckResult("E2E 학생: Step1 — 문제 목록 조회", False, f"❌ 상태코드 {resp.status_code}"))
    except Exception as e:
        results.append(CheckResult("E2E 학생: Step1 — 문제 목록 조회", False, f"❌ 오류: {e}"))

    # ── Step 1b: 문제 상세 조회 (steps 포함) ──
    if context.get("problem_id"):
        try:
            resp = requests.get(
                f"{server_url}/api/v1/student/problems/{context['problem_id']}",
                headers=context["headers"],
                timeout=5,
            )
            if resp.status_code == 200:
                data = resp.json()
                has_steps = isinstance(data.get("steps"), list) and len(data["steps"]) > 0
                results.append(CheckResult(
                    "E2E 학생: Step1b — 문제 상세 (steps)",
                    has_steps,
                    f"✅ steps {len(data.get('steps', []))}개" if has_steps else "❌ steps 없음",
                ))
            else:
                results.append(CheckResult("E2E 학생: Step1b — 문제 상세", False, f"❌ 상태코드 {resp.status_code}"))
        except Exception as e:
            results.append(CheckResult("E2E 학생: Step1b — 문제 상세", False, f"❌ 오류: {e}"))

    # ── Step 2: 프롬프트 제출 ──
    try:
        payload = {
            "student_id": context["student_id"],
            "problem_id": context.get("problem_id"),
            "prompt_text": "너는 중학교 2학년 수학 전문 가정교사야. 이차방정식을 처음 배우는 학생에게 쉬운 예시와 단계별 풀이로 설명해줘. 학생 수준을 고려하고, 설명 후 확인 문제도 내줘.",
        }
        resp = requests.post(
            f"{server_url}/api/v1/student/submissions",
            json=payload,
            headers=context["headers"],
            timeout=180,
        )
        if resp.status_code == 201:
            data = resp.json()
            context["submission_id"] = data["id"]
            required = ["id", "student_id", "prompt_text", "created_at"]
            missing = [f for f in required if f not in data]
            if missing:
                results.append(CheckResult("E2E 학생: Step2 — 제출 응답 필드", False, f"❌ 누락 필드: {missing}"))
            else:
                results.append(CheckResult(
                    "E2E 학생: Step2 — 제출물 생성",
                    True,
                    f"✅ 제출 완료 (id={context['submission_id'][:8]}...)",
                ))
        else:
            results.append(CheckResult(
                "E2E 학생: Step2 — 제출물 생성",
                False,
                f"❌ 상태코드 {resp.status_code}: {resp.text[:100]}",
            ))
    except Exception as e:
        results.append(CheckResult("E2E 학생: Step2 — 제출물 생성", False, f"❌ 연결 실패: {e}"))

    # ── Step 3: 루브릭 평가 ──
    if context.get("submission_id"):
        try:
            resp = requests.post(
                f"{server_url}/api/v1/student/submissions/{context['submission_id']}/evaluate",
                json={"final_prompt": "너는 중학교 2학년 수학 가정교사야. 이차방정식을 쉬운 예시로 설명하고 확인 문제를 내줘."},
                headers=context["headers"],
                timeout=60,
            )
            if resp.status_code == 200:
                data = resp.json()
                required = ["submission_id", "total_score", "overall_feedback", "criteria_scores"]
                missing = [f for f in required if f not in data]
                score_valid = isinstance(data.get("total_score"), (int, float)) and 0 <= data["total_score"] <= 100
                if missing:
                    results.append(CheckResult("E2E 학생: Step3 — 평가 응답 필드", False, f"❌ 누락 필드: {missing}"))
                elif not score_valid:
                    results.append(CheckResult("E2E 학생: Step3 — 평가 점수 범위", False, f"❌ total_score={data.get('total_score')} 범위 초과"))
                else:
                    results.append(CheckResult(
                        "E2E 학생: Step3 — 루브릭 평가",
                        True,
                        f"✅ total_score={data['total_score']}, criteria={len(data['criteria_scores'])}개",
                    ))
            else:
                results.append(CheckResult(
                    "E2E 학생: Step3 — 루브릭 평가",
                    False,
                    f"❌ 상태코드 {resp.status_code}: {resp.text[:100]}",
                ))
        except Exception as e:
            results.append(CheckResult("E2E 학생: Step3 — 루브릭 평가", False, f"❌ 오류: {e}"))

    # ── Step 4: 위험도 조회 (student_id 필수 쿼리 파라미터) ──
    try:
        resp = requests.get(
            f"{server_url}/api/v1/student/risk",
            params={"student_id": context["student_id"]},
            headers=context["headers"],
            timeout=5,
        )
        if resp.status_code == 200:
            data = resp.json()
            has_key = "latest_risk" in data
            latest = data.get("latest_risk")
            results.append(CheckResult(
                "E2E 학생: Step4 — 위험도 조회",
                has_key,
                f"✅ latest_risk={'있음' if latest else 'null (미계산)'}" if has_key else "❌ latest_risk 키 없음",
            ))
        else:
            results.append(CheckResult(
                "E2E 학생: Step4 — 위험도 조회",
                False,
                f"❌ 상태코드 {resp.status_code}",
            ))
    except Exception as e:
        results.append(CheckResult("E2E 학생: Step4 — 위험도 조회", False, f"❌ 오류: {e}"))

    # ── Step 5: 제출 이력 조회 (student_id 필수 쿼리 파라미터) ──
    try:
        resp = requests.get(
            f"{server_url}/api/v1/student/submissions",
            params={"student_id": context["student_id"]},
            headers=context["headers"],
            timeout=5,
        )
        if resp.status_code == 200:
            data = resp.json()
            items = data.get("items", [])
            results.append(CheckResult(
                "E2E 학생: Step5 — 제출 이력 조회",
                isinstance(items, list),
                f"✅ {len(items)}건 이력",
            ))
        else:
            results.append(CheckResult("E2E 학생: Step5 — 제출 이력 조회", False, f"❌ 상태코드 {resp.status_code}"))
    except Exception as e:
        results.append(CheckResult("E2E 학생: Step5 — 제출 이력 조회", False, f"❌ 오류: {e}"))

    # ── Step 6: 캐릭터 피드백 조회 (루브릭 결과 + 합격 판정) ──
    if context.get("submission_id"):
        try:
            resp = requests.post(
                f"{server_url}/api/v1/student/submissions/{context['submission_id']}/feedback",
                headers=context["headers"],
                timeout=60,
            )
            if resp.status_code == 200:
                data = resp.json()
                required = ["submission_id", "character_name", "emotion", "main_message",
                            "tips", "total_score", "criteria_scores", "pass_threshold"]
                missing = [f for f in required if f not in data]
                score_valid = isinstance(data.get("total_score"), (int, float)) and 0 <= data.get("total_score", -1) <= 100
                threshold_valid = data.get("pass_threshold") == 80.0
                criteria_list = isinstance(data.get("criteria_scores"), list)
                if missing:
                    results.append(CheckResult(
                        "E2E 학생: Step6 — 캐릭터 피드백 필드",
                        False, f"❌ 누락 필드: {missing}",
                    ))
                elif not score_valid:
                    results.append(CheckResult(
                        "E2E 학생: Step6 — 피드백 점수 범위",
                        False, f"❌ total_score={data.get('total_score')} 범위 초과",
                    ))
                elif not threshold_valid:
                    results.append(CheckResult(
                        "E2E 학생: Step6 — 합격 기준선",
                        False, f"❌ pass_threshold={data.get('pass_threshold')} (기대값: 80.0)",
                    ))
                elif not criteria_list:
                    results.append(CheckResult(
                        "E2E 학생: Step6 — criteria_scores 형식",
                        False, "❌ criteria_scores가 배열이 아님",
                    ))
                else:
                    passed_str = "합격" if data["total_score"] >= 80 else "불합격"
                    results.append(CheckResult(
                        "E2E 학생: Step6 — 캐릭터 피드백",
                        True,
                        f"✅ score={data['total_score']} ({passed_str}), criteria={len(data['criteria_scores'])}개, emotion={data['emotion']}",
                    ))
            else:
                results.append(CheckResult(
                    "E2E 학생: Step6 — 캐릭터 피드백",
                    False,
                    f"❌ 상태코드 {resp.status_code}: {resp.text[:100]}",
                ))
        except Exception as e:
            results.append(CheckResult("E2E 학생: Step6 — 캐릭터 피드백", False, f"❌ 오류: {e}"))

    # ── Step 7: 알림 목록 조회 (개입 알림) ──
    try:
        resp = requests.get(
            f"{server_url}/api/v1/student/notifications",
            params={"student_id": context["student_id"]},
            headers=context["headers"],
            timeout=5,
        )
        if resp.status_code == 200:
            data = resp.json()
            has_items = "items" in data
            has_unread = "unread_count" in data
            results.append(CheckResult(
                "E2E 학생: Step7 — 알림 목록 조회",
                has_items and has_unread,
                f"✅ items={len(data.get('items', []))}건, unread={data.get('unread_count', '?')}"
                if (has_items and has_unread)
                else f"❌ 누락 키: {'items' if not has_items else 'unread_count'}",
            ))
        else:
            results.append(CheckResult(
                "E2E 학생: Step7 — 알림 목록 조회",
                False,
                f"❌ 상태코드 {resp.status_code}",
            ))
    except Exception as e:
        results.append(CheckResult("E2E 학생: Step7 — 알림 목록 조회", False, f"❌ 오류: {e}"))

    return _make_result(results)


def _make_result(results: list[CheckResult]) -> dict:
    passed_count = sum(1 for r in results if r.passed)
    failed_count = len(results) - passed_count
    return {
        "check_name": "e2e_student",
        "passed": failed_count == 0,
        "total": len(results),
        "passed_count": passed_count,
        "failed_count": failed_count,
        "results": [
            {"name": r.name, "passed": r.passed, "message": r.message}
            for r in results
        ],
    }


if __name__ == "__main__":
    result = run()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    sys.exit(0 if result["passed"] else 1)
