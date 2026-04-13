"""
E2E Check — 관리자 흐름 검증
관리자가 대시보드 조회 → 위험 학생 목록 확인 → 개입 생성하는 흐름을 검증한다.
JWT 인증을 사용하며 시드 계정(admin@example.com)으로 테스트한다.
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

    # ── 관리자 인증 ──
    try:
        resp = requests.post(
            f"{server_url}/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "admin1234"},
            timeout=5,
        )
        if resp.status_code == 200:
            data = resp.json()
            context["headers"] = {"Authorization": f"Bearer {data['access_token']}"}
        else:
            results.append(CheckResult("E2E 관리자: 로그인", False, f"❌ 상태코드 {resp.status_code}"))
            return _make_result(results)
    except Exception as e:
        results.append(CheckResult("E2E 관리자: 로그인", False, f"❌ 연결 실패: {e}"))
        return _make_result(results)

    # ── Step 1: 대시보드 조회 ──
    try:
        resp = requests.get(
            f"{server_url}/api/v1/admin/dashboard",
            headers=context["headers"],
            timeout=5,
        )
        if resp.status_code == 200:
            data = resp.json()
            required = ["total_students", "high_risk_count", "pending_interventions", "risk_distribution"]
            missing = [f for f in required if f not in data]
            if missing:
                results.append(CheckResult("E2E 관리자: Step1 — 대시보드 필드", False, f"❌ 누락 필드: {missing}"))
            else:
                results.append(CheckResult(
                    "E2E 관리자: Step1 — 대시보드 조회",
                    True,
                    f"✅ total={data['total_students']}, high_risk={data['high_risk_count']}",
                ))
                # risk_distribution은 리스트여야 함
                is_list = isinstance(data["risk_distribution"], list)
                results.append(CheckResult(
                    "E2E 관리자: Step1 — risk_distribution 타입",
                    is_list,
                    f"✅ list 형식, {len(data['risk_distribution'])}개 항목" if is_list else "❌ list가 아님",
                ))
        else:
            results.append(CheckResult("E2E 관리자: Step1 — 대시보드 조회", False, f"❌ 상태코드 {resp.status_code}"))
    except Exception as e:
        results.append(CheckResult("E2E 관리자: Step1 — 대시보드 조회", False, f"❌ 오류: {e}"))

    # ── Step 2: 학생 목록 조회 ({"items": [...], "total": N} 형식) ──
    try:
        resp = requests.get(
            f"{server_url}/api/v1/admin/students",
            headers=context["headers"],
            timeout=5,
        )
        if resp.status_code == 200:
            data = resp.json()
            # 페이지네이션 응답: {"items": [...], "total": N} 또는 plain list
            items = data.get("items", data) if isinstance(data, dict) else data
            is_list = isinstance(items, list)
            results.append(CheckResult(
                "E2E 관리자: Step2 — 학생 목록 조회",
                is_list,
                f"✅ {len(items)}명" if is_list else f"❌ items 타입 오류: {type(items)}",
            ))
            if is_list and len(items) > 0:
                context["target_student_id"] = items[0].get("student_id")
                # 학생 항목 필드 검증 (username이 name 대신 사용됨)
                required = ["student_id", "email", "risk_stage", "total_risk"]
                missing = [f for f in required if f not in items[0]]
                results.append(CheckResult(
                    "E2E 관리자: Step2 — 학생 항목 필드",
                    len(missing) == 0,
                    f"✅ 필수 필드 모두 있음" if not missing else f"❌ 누락 필드: {missing}",
                ))
        else:
            results.append(CheckResult("E2E 관리자: Step2 — 학생 목록 조회", False, f"❌ 상태코드 {resp.status_code}"))
    except Exception as e:
        results.append(CheckResult("E2E 관리자: Step2 — 학생 목록 조회", False, f"❌ 오류: {e}"))

    # ── Step 3: 고위험 학생에 대한 개입 생성 ──
    target_student_id = context.get("target_student_id")
    if not target_student_id:
        results.append(CheckResult("E2E 관리자: Step3 — 개입 생성", False, "❌ 테스트용 학생 ID 없음"))
    else:
        try:
            payload = {
                "student_id": target_student_id,
                "type": "message",
                "message": "E2E 테스트: 최근 학습 참여도가 감소했습니다. 상담을 권장합니다.",
                "dropout_type": "engagement_drop",
            }
            resp = requests.post(
                f"{server_url}/api/v1/admin/intervention",
                json=payload,
                headers=context["headers"],
                timeout=5,
            )
            if resp.status_code == 201:
                data = resp.json()
                required = ["id", "student_id", "type", "message", "status", "created_at"]
                missing = [f for f in required if f not in data]
                if missing:
                    results.append(CheckResult("E2E 관리자: Step3 — 개입 응답 필드", False, f"❌ 누락 필드: {missing}"))
                else:
                    results.append(CheckResult(
                        "E2E 관리자: Step3 — 개입 생성",
                        True,
                        f"✅ 개입 생성 완료 (id={data['id'][:8]}...)",
                    ))
                # 초기 상태 = pending
                is_pending = data.get("status") == "pending"
                results.append(CheckResult(
                    "E2E 관리자: Step3 — 초기 상태 = pending",
                    is_pending,
                    f"✅ status=pending" if is_pending else f"❌ status={data.get('status')}",
                ))
                # student_id 일치
                id_match = data.get("student_id") == target_student_id
                results.append(CheckResult(
                    "E2E 관리자: Step3 — student_id 일치",
                    id_match,
                    "✅ student_id 일치" if id_match else f"❌ 불일치: {data.get('student_id')}",
                ))
            else:
                results.append(CheckResult(
                    "E2E 관리자: Step3 — 개입 생성",
                    False,
                    f"❌ 상태코드 {resp.status_code}: {resp.text[:100]}",
                ))
        except Exception as e:
            results.append(CheckResult("E2E 관리자: Step3 — 개입 생성", False, f"❌ 오류: {e}"))

    # ── Step 4: 학생 상세 조회 ──
    if target_student_id:
        try:
            resp = requests.get(
                f"{server_url}/api/v1/admin/students/{target_student_id}",
                headers=context["headers"],
                timeout=5,
            )
            if resp.status_code == 200:
                data = resp.json()
                required = ["student_id", "username", "email"]
                missing = [f for f in required if f not in data]
                results.append(CheckResult(
                    "E2E 관리자: Step4 — 학생 상세 조회",
                    len(missing) == 0,
                    f"✅ 상세 조회 성공" if not missing else f"❌ 누락 필드: {missing}",
                ))
            else:
                results.append(CheckResult("E2E 관리자: Step4 — 학생 상세 조회", False, f"❌ 상태코드 {resp.status_code}"))
        except Exception as e:
            results.append(CheckResult("E2E 관리자: Step4 — 학생 상세 조회", False, f"❌ 오류: {e}"))

    return _make_result(results)


def _make_result(results: list[CheckResult]) -> dict:
    passed_count = sum(1 for r in results if r.passed)
    failed_count = len(results) - passed_count
    return {
        "check_name": "e2e_admin",
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
