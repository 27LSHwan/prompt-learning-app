"""
Contract Check — Python import 스타일 검증

규칙:
  1. 함수/클래스/블록 안에 import 문이 있으면 안 된다.
     단, try/except ImportError 블록은 허용 (조건부 선택적 의존성)
     단, if __name__ == "__main__" 블록은 허용하지 않음 (상단으로 이동해야 함)

검사 대상: apps/backend/app/**/*.py, packages/**/*.py
제외 대상: .venv, __pycache__, seed.py (sys.path 조작 목적 제외)
"""

import ast
import json
import sys
from pathlib import Path
from typing import NamedTuple

_ROOT = Path(__file__).resolve().parents[3]

# 검사 대상 디렉토리
SCAN_DIRS = [
    _ROOT / "apps/backend/app",
    _ROOT / "packages",
]

# 검사 제외 파일 (상대 경로 suffix)
EXCLUDE_SUFFIXES = [
    ".venv",
    "__pycache__",
]

# 제외 파일명
EXCLUDE_FILES = {
    "seed.py",   # sys.path 조작이 필요한 스크립트
}

# try/except ImportError 안의 import는 허용 (선택적 의존성 패턴)
ALLOWED_TRY_IMPORT_PATTERN = True


class CheckResult(NamedTuple):
    name: str
    passed: bool
    message: str


def _is_in_try_except_import(node: ast.AST, tree: ast.Module) -> bool:
    """노드가 try/except ImportError 블록 안에 있는지 확인"""
    for n in ast.walk(tree):
        if not isinstance(n, ast.Try):
            continue
        # handler가 ImportError/ModuleNotFoundError 인지 확인
        for handler in n.handlers:
            if handler.type is None:
                continue
            handler_name = ""
            if isinstance(handler.type, ast.Name):
                handler_name = handler.type.id
            elif isinstance(handler.type, ast.Attribute):
                handler_name = handler.type.attr
            if handler_name in ("ImportError", "ModuleNotFoundError", "Exception"):
                # try 블록 안에 node가 있는지 확인
                for try_node in ast.walk(n):
                    if try_node is node:
                        return True
    return False


def check_file(path: Path) -> list[CheckResult]:
    results = []
    rel = path.relative_to(_ROOT)

    try:
        source = path.read_text(encoding="utf-8")
        tree = ast.parse(source, filename=str(path))
    except SyntaxError as e:
        results.append(CheckResult(str(rel), False, f"❌ 문법 오류: {e}"))
        return results

    violations = []

    for node in ast.walk(tree):
        # Import / ImportFrom 노드만 확인
        if not isinstance(node, (ast.Import, ast.ImportFrom)):
            continue

        # 최상위(module level)인지 확인
        # ast.walk는 부모 정보를 제공하지 않으므로 직접 확인
        # 대신 col_offset으로 들여쓰기 여부 판단
        if node.col_offset == 0:
            continue  # 최상위 — 정상

        # try/except ImportError 안이면 허용
        if _is_in_try_except_import(node, tree):
            continue

        # 위반
        if isinstance(node, ast.Import):
            names = ", ".join(a.name for a in node.names)
            stmt = f"import {names}"
        else:
            names = ", ".join(
                (a.asname or a.name) if a.name != "*" else "*"
                for a in node.names
            )
            mod = node.module or ""
            stmt = f"from {mod} import {names}"

        violations.append(f"  line {node.lineno}: {stmt}")

    if violations:
        detail = "\n".join(violations[:5])
        if len(violations) > 5:
            detail += f"\n  ... 외 {len(violations) - 5}건"
        results.append(CheckResult(
            f"import 위치: {rel}",
            False,
            f"❌ 함수/블록 내부 import {len(violations)}건\n{detail}",
        ))
    else:
        results.append(CheckResult(
            f"import 위치: {rel}",
            True,
            "✅ 모든 import가 최상단에 위치",
        ))

    return results


def _collect_files() -> list[Path]:
    files = []
    for scan_dir in SCAN_DIRS:
        if not scan_dir.exists():
            continue
        for path in scan_dir.rglob("*.py"):
            # 제외 경로
            if any(ex in path.parts for ex in EXCLUDE_SUFFIXES):
                continue
            if path.name in EXCLUDE_FILES:
                continue
            files.append(path)
    return sorted(files)


def run() -> dict:
    results: list[CheckResult] = []
    files = _collect_files()

    if not files:
        results.append(CheckResult("파일 탐색", False, "❌ 검사할 .py 파일을 찾지 못했습니다"))
        return _make_result(results)

    for path in files:
        results.extend(check_file(path))

    return _make_result(results)


def _make_result(results: list[CheckResult]) -> dict:
    passed = sum(1 for r in results if r.passed)
    failed = len(results) - passed
    return {
        "check_name": "contract_import_style",
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
    # 실패한 항목만 출력
    for item in r["results"]:
        if not item["passed"]:
            print(item["message"])
    print(f"\n결과: {r['passed_count']}/{r['total']} PASS")
    sys.exit(0 if r["passed"] else 1)
