"""
Contract Check — API 엔드포인트 계약 검증
백엔드 서버가 실행 중이어야 한다. (기본: http://localhost:8000)
JWT 인증이 필요한 엔드포인트는 시드 계정으로 로그인 후 토큰을 사용한다.
"""

import sys
import uuid
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


def login(server_url: str, email: str, password: str) -> dict:
    """로그인 후 {token, user_id} 반환. 실패 시 빈 dict."""
    try:
        resp = requests.post(
            f"{server_url}/api/v1/auth/login",
            json={"email": email, "password": password},
            timeout=5,
        )
        if resp.status_code == 200:
            data = resp.json()
            return {"token": data.get("access_token", ""), "user_id": data.get("user_id", "")}
    except Exception:
        pass
    return {}


def run(server_url: str = "http://localhost:8000") -> dict:
    results = []

    # ── 인증 토큰 취득 ──
    student_auth = login(server_url, "minjun@example.com", "student123")
    admin_auth = login(server_url, "admin@example.com", "admin1234")

    student_headers = {"Authorization": f"Bearer {student_auth.get('token', '')}"} if student_auth else {}
    admin_headers = {"Authorization": f"Bearer {admin_auth.get('token', '')}"} if admin_auth else {}
    student_id = student_auth.get("user_id", "")

    # 1. POST /student/submissions
    created_id = None
    try:
        payload = {
            "student_id": student_id or str(uuid.uuid4()),
            "prompt_text": "테스트 프롬프트 제출입니다.",
        }
        resp = requests.post(
            f"{server_url}/api/v1/student/submissions",
            json=payload,
            headers=student_headers,
            timeout=5,
        )
        if resp.status_code == 201:
            data = resp.json()
            required = ["id", "student_id", "prompt_text", "created_at"]
            missing = [f for f in required if f not in data]
            if missing:
                results.append(CheckResult("POST /submissions — 응답 필드", False, f"❌ 누락 필드: {missing}"))
            else:
                created_id = data["id"]
                results.append(CheckResult("POST /submissions", True, f"✅ 201 Created, id={created_id[:8]}..."))
        else:
            results.append(CheckResult("POST /submissions", False, f"❌ 상태코드 {resp.status_code} (기대: 201)"))
    except Exception as e:
        results.append(CheckResult("POST /submissions", False, f"❌ 연결 실패: {e}"))

    # 2. GET /student/submissions (목록 조회 — student_id 필수)
    try:
        resp = requests.get(
            f"{server_url}/api/v1/student/submissions",
            params={"student_id": student_id} if student_id else {},
            headers=student_headers,
            timeout=5,
        )
        if resp.status_code == 200:
            data = resp.json()
            has_items = "items" in data
            results.append(CheckResult(
                "GET /submissions (목록)",
                has_items,
                f"✅ 200 OK, {len(data.get('items', []))}건" if has_items else "❌ items 필드 없음",
            ))
        else:
            results.append(CheckResult("GET /submissions (목록)", False, f"❌ 상태코드 {resp.status_code}"))
    except Exception as e:
        results.append(CheckResult("GET /submissions (목록)", False, f"❌ 연결 실패: {e}"))

    # 3. GET /submissions/{fake_id}/result → 404 테스트
    try:
        fake_id = str(uuid.uuid4())
        resp = requests.get(
            f"{server_url}/api/v1/student/submissions/{fake_id}/result",
            headers=student_headers,
            timeout=5,
        )
        if resp.status_code == 404:
            results.append(CheckResult("GET /submissions/{fake_id} → 404", True, "✅ 404 Not Found 정상"))
        else:
            results.append(CheckResult("GET /submissions/{fake_id} → 404", False, f"❌ 상태코드 {resp.status_code} (기대: 404)"))
    except Exception as e:
        results.append(CheckResult("GET /submissions/{fake_id} → 404", False, f"❌ 연결 실패: {e}"))

    # 4. GET /student/risk (student_id 필수)
    try:
        resp = requests.get(
            f"{server_url}/api/v1/student/risk",
            params={"student_id": student_id} if student_id else {},
            headers=student_headers,
            timeout=5,
        )
        if resp.status_code == 200:
            data = resp.json()
            has_key = "latest_risk" in data
            results.append(CheckResult(
                "GET /student/risk",
                has_key,
                f"✅ latest_risk={'있음' if data.get('latest_risk') else 'null'}" if has_key else "❌ latest_risk 키 없음",
            ))
        else:
            results.append(CheckResult("GET /student/risk", False, f"❌ 상태코드 {resp.status_code}"))
    except Exception as e:
        results.append(CheckResult("GET /student/risk", False, f"❌ 연결 실패: {e}"))

    # 5. GET /admin/students (관리자 학생 목록 — 페이지네이션 응답)
    try:
        resp = requests.get(
            f"{server_url}/api/v1/admin/students",
            headers=admin_headers,
            timeout=5,
        )
        if resp.status_code == 200:
            data = resp.json()
            # {"items": [...], "total": N} 형식
            items = data.get("items", data) if isinstance(data, dict) else data
            is_list = isinstance(items, list)
            results.append(CheckResult(
                "GET /admin/students",
                is_list,
                f"✅ 200 OK, {len(items)}명" if is_list else f"❌ items 타입 오류: {type(items)}",
            ))
        else:
            results.append(CheckResult("GET /admin/students", False, f"❌ 상태코드 {resp.status_code}"))
    except Exception as e:
        results.append(CheckResult("GET /admin/students", False, f"❌ 연결 실패: {e}"))

    # 6. POST /admin/intervention (개입 생성)
    try:
        # 학생 목록에서 실제 student_id 가져오기
        students_resp = requests.get(
            f"{server_url}/api/v1/admin/students",
            headers=admin_headers,
            timeout=5,
        )
        target_student_id = None
        if students_resp.status_code == 200:
            data = students_resp.json()
            items = data.get("items", data) if isinstance(data, dict) else data
            if items:
                target_student_id = items[0].get("student_id")

        if not target_student_id:
            results.append(CheckResult("POST /admin/intervention", False, "❌ 테스트용 학생 ID 없음"))
        else:
            payload = {
                "student_id": target_student_id,
                "type": "message",
                "message": "E2E 테스트 개입 메시지입니다.",
                "dropout_type": "engagement_drop",
            }
            resp = requests.post(
                f"{server_url}/api/v1/admin/intervention",
                json=payload,
                headers=admin_headers,
                timeout=5,
            )
            if resp.status_code == 201:
                data = resp.json()
                required = ["id", "student_id", "type", "message", "status", "created_at"]
                missing = [f for f in required if f not in data]
                if missing:
                    results.append(CheckResult("POST /admin/intervention — 응답 필드", False, f"❌ 누락 필드: {missing}"))
                else:
                    results.append(CheckResult("POST /admin/intervention", True, "✅ 201 Created"))
            else:
                results.append(CheckResult("POST /admin/intervention", False, f"❌ 상태코드 {resp.status_code}: {resp.text[:100]}"))
    except Exception as e:
        results.append(CheckResult("POST /admin/intervention", False, f"❌ 연결 실패: {e}"))

    passed_count = sum(1 for r in results if r.passed)
    failed_count = len(results) - passed_count

    return {
        "check_name": "contract_api",
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
    import json
    result = run()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    sys.exit(0 if result["passed"] else 1)
