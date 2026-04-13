"""
Contract Check — 보안 필수 요건 검증

다음 항목을 정적 코드 분석으로 검사합니다:
1. 비밀번호 해싱: hashlib.sha256 단독 사용 금지 (passlib/bcrypt 필수)
2. JWT 인증 의존성: student/admin 라우터에 get_current_user/get_current_student/get_current_admin 적용
3. Rate Limiting: /auth/login 엔드포인트에 slowapi 리미터 적용
4. 학생 API student_id 쿼리 파라미터 금지: 프론트엔드에서 student_id=? 쿼리 스트링 전송 금지
5. .env.example 파일 존재
6. 시크릿 키 하드코딩 금지: "dev-secret-key" 등 알려진 취약 키 금지
7. refresh 엔드포인트 존재: /auth/refresh 라우터 선언 확인
"""

import json
import re
from pathlib import Path
from typing import NamedTuple


class CheckResult(NamedTuple):
    name: str
    passed: bool
    message: str


def _find_root() -> Path:
    here = Path(__file__).resolve()
    for parent in here.parents:
        if (parent / "apps").exists():
            return parent
    return here.parents[4]


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


ROOT = _find_root()
BACKEND = ROOT / "apps/backend/app"
STUDENT_WEB = ROOT / "apps/student-web/src"


def check_password_hashing() -> CheckResult:
    """passlib[bcrypt] 사용, sha256 단독 해시 금지."""
    auth_svc = BACKEND / "services/auth_service.py"
    src = _read(auth_svc)

    uses_sha256_alone = (
        "hashlib.sha256" in src
        and "passlib" not in src
        and "bcrypt" not in src
    )
    uses_passlib = "CryptContext" in src or "passlib" in src

    if uses_sha256_alone:
        return CheckResult(
            "비밀번호 해싱 — bcrypt/passlib 사용",
            False,
            "FAIL: hashlib.sha256 단독 사용 감지 → passlib[bcrypt]로 교체 필요",
        )
    if not uses_passlib:
        return CheckResult(
            "비밀번호 해싱 — bcrypt/passlib 사용",
            False,
            "FAIL: passlib/bcrypt 미사용 — auth_service.py에 CryptContext 적용 필요",
        )
    return CheckResult("비밀번호 해싱 — bcrypt/passlib 사용", True, "OK: passlib CryptContext 사용 확인")


def check_auth_dependency() -> CheckResult:
    """student.py와 admin.py에 인증 의존성 적용 확인."""
    student = _read(BACKEND / "api/routes/student.py")
    admin = _read(BACKEND / "api/routes/admin.py")

    student_ok = "get_current_student" in student or "get_current_user" in student
    admin_ok = "get_current_admin" in admin or "get_current_user" in admin

    if not student_ok and not admin_ok:
        return CheckResult(
            "API 인증 의존성 — student/admin 라우터",
            False,
            "FAIL: student.py와 admin.py 모두 인증 의존성 없음",
        )
    if not student_ok:
        return CheckResult(
            "API 인증 의존성 — student/admin 라우터",
            False,
            "FAIL: student.py에 get_current_student/get_current_user 없음",
        )
    if not admin_ok:
        return CheckResult(
            "API 인증 의존성 — student/admin 라우터",
            False,
            "FAIL: admin.py에 get_current_admin/get_current_user 없음",
        )
    return CheckResult(
        "API 인증 의존성 — student/admin 라우터",
        True,
        "OK: student.py + admin.py 인증 의존성 확인",
    )


def check_rate_limiting() -> CheckResult:
    """로그인 엔드포인트에 slowapi 리미터 적용 확인."""
    auth_route = _read(BACKEND / "api/routes/auth.py")
    has_limiter = "limiter" in auth_route.lower() and ("@" in auth_route and "limit" in auth_route)
    has_slowapi = "slowapi" in auth_route or "Limiter" in auth_route
    if not (has_limiter and has_slowapi):
        return CheckResult(
            "Rate Limiting — 로그인 엔드포인트",
            False,
            "FAIL: auth/routes/auth.py에 slowapi Limiter 미적용 — 브루트포스 취약",
        )
    return CheckResult("Rate Limiting — 로그인 엔드포인트", True, "OK: slowapi rate limiter 적용 확인")


def check_no_student_id_query_param() -> CheckResult:
    """프론트엔드 API 호출에서 student_id=$ 쿼리 파라미터 금지."""
    bad_pattern = re.compile(r"student_id=\$\{|student_id=\$\(|student_id=.*getUserId")
    violations: list[str] = []
    for tsx in STUDENT_WEB.rglob("*.tsx"):
        src = _read(tsx)
        if bad_pattern.search(src):
            violations.append(tsx.name)
    if violations:
        return CheckResult(
            "프론트엔드 — student_id 쿼리 파라미터 금지",
            False,
            f"FAIL: student_id 쿼리 파라미터 사용 파일: {violations} → JWT 토큰으로 서버에서 추출해야 함",
        )
    return CheckResult(
        "프론트엔드 — student_id 쿼리 파라미터 금지",
        True,
        "OK: student_id 쿼리 파라미터 미사용 확인",
    )


def check_env_example_exists() -> CheckResult:
    """백엔드 .env.example 파일 존재 확인."""
    env_example = ROOT / "apps/backend/.env.example"
    if not env_example.exists():
        return CheckResult(
            ".env.example 파일 존재",
            False,
            "FAIL: apps/backend/.env.example 없음 → 환경변수 설정 가이드 필요",
        )
    content = _read(env_example)
    has_secret = "SECRET_KEY" in content
    has_openai = "OPENAI_API_KEY" in content
    if not has_secret or not has_openai:
        missing = [k for k, v in {"SECRET_KEY": has_secret, "OPENAI_API_KEY": has_openai}.items() if not v]
        return CheckResult(
            ".env.example 파일 존재",
            False,
            f"FAIL: .env.example에 필수 변수 누락: {missing}",
        )
    return CheckResult(".env.example 파일 존재", True, "OK: .env.example 존재 및 필수 변수 확인")


def check_no_hardcoded_secret() -> CheckResult:
    """알려진 취약 시크릿 키 하드코딩 금지."""
    config = _read(BACKEND / "config.py")
    known_weak = ["dev-secret-key", "secret", "changeme", "your-secret"]
    found = [k for k in known_weak if f'"{k}"' in config or f"'{k}'" in config]
    if found:
        return CheckResult(
            "JWT 시크릿 키 하드코딩 금지",
            False,
            f"FAIL: 알려진 취약 시크릿 키 감지: {found} → .env의 강력한 랜덤 키로 교체",
        )
    return CheckResult("JWT 시크릿 키 하드코딩 금지", True, "OK: 알려진 취약 시크릿 키 미감지")


def check_refresh_endpoint() -> CheckResult:
    """/auth/refresh 엔드포인트 존재 확인."""
    auth_route = _read(BACKEND / "api/routes/auth.py")
    has_refresh = '"/refresh"' in auth_route or "'/refresh'" in auth_route
    if not has_refresh:
        return CheckResult(
            "/auth/refresh 엔드포인트 존재",
            False,
            "FAIL: auth/routes/auth.py에 /refresh 엔드포인트 없음 → 토큰 만료 시 강제 로그아웃 발생",
        )
    return CheckResult("/auth/refresh 엔드포인트 존재", True, "OK: /auth/refresh 엔드포인트 확인")


def run() -> dict:
    checks = [
        check_password_hashing,
        check_auth_dependency,
        check_rate_limiting,
        check_no_student_id_query_param,
        check_env_example_exists,
        check_no_hardcoded_secret,
        check_refresh_endpoint,
    ]
    results = [c() for c in checks]
    passed_count = sum(1 for r in results if r.passed)
    failed_count = len(results) - passed_count
    return {
        "check_name": "contract_security",
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
    status = "✅ PASS" if result["passed"] else "❌ FAIL"
    print(f"\n{status}  보안 검증 ({result['passed_count']}/{result['total']})\n")
    for item in result["results"]:
        icon = "✅" if item["passed"] else "❌"
        print(f"  {icon} {item['name']}")
        if not item["passed"]:
            print(f"      → {item['message']}")
    print()
    print(json.dumps(result, ensure_ascii=False, indent=2))
