"""
Contract Check — 로그인 폼 계약 검증

LoginPage에서 반드시 지켜야 하는 규칙:
1. URLSearchParams / form-urlencoded 사용 금지
2. 'username' 필드 대신 'email' 필드 사용
3. JSON body로 전송 (api.post('/auth/login', { email, password }))
4. 포털 역할에 맞는 role 검증 필수
"""

import json
import re
from pathlib import Path
from typing import NamedTuple


class CheckResult(NamedTuple):
    name: str
    passed: bool
    message: str


def _find_project_root() -> Path:
    here = Path(__file__).resolve()
    for parent in here.parents:
        if (parent / "apps").exists():
            return parent
    return here.parents[4]


def check_login_page(label: str, path: Path) -> list[CheckResult]:
    results: list[CheckResult] = []

    if not path.exists():
        results.append(CheckResult(
            name=f"{label} 파일 존재",
            passed=False,
            message=f"파일 없음: {path}",
        ))
        return results

    src = path.read_text(encoding="utf-8")

    # 규칙 1: URLSearchParams 사용 금지
    has_url_params = "URLSearchParams" in src
    results.append(CheckResult(
        name=f"{label} — URLSearchParams 금지",
        passed=not has_url_params,
        message=(
            "FAIL: URLSearchParams 사용 감지 → JSON body로 전송해야 함"
            if has_url_params else
            "OK: URLSearchParams 미사용"
        ),
    ))

    # 규칙 2: form-urlencoded 헤더 금지
    has_form_enc = "application/x-www-form-urlencoded" in src
    results.append(CheckResult(
        name=f"{label} — form-urlencoded 헤더 금지",
        passed=not has_form_enc,
        message=(
            "FAIL: Content-Type application/x-www-form-urlencoded 감지 → 제거해야 함"
            if has_form_enc else
            "OK: form-urlencoded 헤더 미사용"
        ),
    ))

    # 규칙 3: 'username' 필드로 로그인 요청 금지 (form state key 허용, append/post body 금지)
    # params.append('username', ...) 또는 { username: form.username } 패턴 감지
    bad_patterns = [
        r"params\.append\(['\"]username['\"]",
        r"username:\s*form\.",
        r"[{,]\s*username\s*:",
    ]
    found_username_field = any(re.search(p, src) for p in bad_patterns)
    results.append(CheckResult(
        name=f"{label} — 로그인 바디에 username 필드 금지",
        passed=not found_username_field,
        message=(
            "FAIL: 로그인 요청 바디에 username 필드 감지 → email 필드를 사용해야 함"
            if found_username_field else
            "OK: username 필드 미사용"
        ),
    ))

    # 규칙 4: email 필드로 로그인 요청 확인
    has_email_in_body = bool(re.search(r"email:\s*form\.", src))
    results.append(CheckResult(
        name=f"{label} — 로그인 바디에 email 필드 사용",
        passed=has_email_in_body,
        message=(
            "OK: email 필드로 로그인 요청"
            if has_email_in_body else
            "FAIL: 로그인 요청 바디에 email 필드 없음 → { email, password } 형식으로 보내야 함"
        ),
    ))

    # 규칙 5: 포털 역할 검증 필수
    expected_role = "student" if "student-web" in label else "admin"
    has_role_guard = bool(
        re.search(rf"res\.data\.role\s*!==\s*['\"]{expected_role}['\"]", src)
        or re.search(rf"res\.data\.role\s*===\s*['\"]{expected_role}['\"]", src)
    )
    results.append(CheckResult(
        name=f"{label} — {expected_role} role 검증",
        passed=has_role_guard,
        message=(
            f"OK: {expected_role} role 검증 존재"
            if has_role_guard else
            f"FAIL: 로그인 응답의 role을 {expected_role}로 검증해야 함"
        ),
    ))

    return results


def run() -> dict:
    root = _find_project_root()

    targets = [
        ("student-web LoginPage", root / "apps/student-web/src/pages/LoginPage.tsx"),
        ("admin-web LoginPage",   root / "apps/admin-web/src/pages/LoginPage.tsx"),
    ]

    all_results: list[CheckResult] = []
    for label, path in targets:
        all_results.extend(check_login_page(label, path))

    passed_count = sum(1 for r in all_results if r.passed)
    failed_count = len(all_results) - passed_count

    return {
        "check_name": "contract_login_form",
        "passed": failed_count == 0,
        "total": len(all_results),
        "passed_count": passed_count,
        "failed_count": failed_count,
        "results": [
            {"name": r.name, "passed": r.passed, "message": r.message}
            for r in all_results
        ],
    }


if __name__ == "__main__":
    result = run()
    status = "✅ PASS" if result["passed"] else "❌ FAIL"
    print(f"\n{status}  로그인 폼 계약 검증 ({result['passed_count']}/{result['total']})\n")
    for item in result["results"]:
        icon = "✅" if item["passed"] else "❌"
        print(f"  {icon} {item['name']}")
        if not item["passed"]:
            print(f"      → {item['message']}")
    print(json.dumps(result, ensure_ascii=False, indent=2))
