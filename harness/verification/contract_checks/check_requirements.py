"""
Contract Check — requirements.txt 패키지 누락 및 임포트 검증

requirements.txt에 필수 패키지가 모두 선언되어 있는지,
그리고 실제로 import 가능한지 함께 확인한다.
"""

import importlib
import json
import sys
from pathlib import Path
from typing import NamedTuple


class CheckResult(NamedTuple):
    name: str
    passed: bool
    message: str


_ROOT = Path(__file__).resolve().parents[3]
_REQUIREMENTS = _ROOT / "apps/backend/requirements.txt"

# ── 필수 패키지 목록 ─────────────────────────────────────────────
# (requirements_name, import_name, 누락 시 오류 메시지)
REQUIRED_PACKAGES = [
    ("fastapi",              "fastapi",             "FastAPI 웹 프레임워크"),
    ("uvicorn",              "uvicorn",             "ASGI 서버"),
    ("sqlalchemy",           "sqlalchemy",          "ORM"),
    ("aiosqlite",            "aiosqlite",           "SQLite 비동기 드라이버"),
    ("greenlet",             "greenlet",            "SQLAlchemy AsyncSession 필수 의존성"),
    ("pydantic",             "pydantic",            "데이터 검증"),
    ("pydantic-settings",    "pydantic_settings",   "환경변수 설정"),
    ("python-jose",          "jose",                "JWT 토큰"),
    ("python-dotenv",        "dotenv",              "환경변수 로드"),
    ("openai",               "openai",              "LLM API"),
    ("requests",             "requests",            "HTTP 클라이언트"),
    ("pyyaml",               "yaml",                "YAML 파서 (하네스)"),
]


def _read_requirements() -> set[str]:
    """requirements.txt 에서 패키지 이름(소문자) 목록 반환"""
    if not _REQUIREMENTS.exists():
        return set()
    names = set()
    for line in _REQUIREMENTS.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        # "package>=1.0" → "package", "package[extra]>=1.0" → "package"
        base = line.split(">=")[0].split("==")[0].split("[")[0].strip().lower()
        names.add(base)
    return names


def run() -> dict:
    results: list[CheckResult] = []
    declared = _read_requirements()

    # 1. requirements.txt 존재 여부
    if not _REQUIREMENTS.exists():
        results.append(CheckResult(
            "requirements.txt 존재", False,
            f"❌ 파일 없음: {_REQUIREMENTS.relative_to(_ROOT)}",
        ))
        return _make_result(results)

    results.append(CheckResult("requirements.txt 존재", True, "✅ 파일 있음"))

    for req_name, import_name, description in REQUIRED_PACKAGES:
        req_key = req_name.lower()

        # 2. requirements.txt 선언 여부
        in_reqs = req_key in declared
        if not in_reqs:
            results.append(CheckResult(
                f"requirements: {req_name}",
                False,
                f"❌ requirements.txt에 '{req_name}' 미선언 ({description})",
            ))
        else:
            results.append(CheckResult(
                f"requirements: {req_name}",
                True,
                f"✅ 선언됨",
            ))

        # 3. 실제 import 가능 여부
        try:
            importlib.import_module(import_name)
            results.append(CheckResult(
                f"import: {import_name}",
                True,
                "✅ import 성공",
            ))
        except ImportError as e:
            results.append(CheckResult(
                f"import: {import_name}",
                False,
                f"❌ import 실패: {e} → pip install {req_name}",
            ))

    return _make_result(results)


def _make_result(results: list[CheckResult]) -> dict:
    passed = sum(1 for r in results if r.passed)
    failed = len(results) - passed
    return {
        "check_name": "contract_requirements",
        "passed": failed == 0,
        "total": len(results),
        "passed_count": passed,
        "failed_count": failed,
        "results": [
            {"name": r.name, "passed": r.passed, "message": r.message}
            for r in results
        ],
    }


if __name__ == "__main__":
    r = run()
    print(json.dumps(r, ensure_ascii=False, indent=2))
    sys.exit(0 if r["passed"] else 1)
