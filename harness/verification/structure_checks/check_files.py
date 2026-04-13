"""
Structure Check — 필수 파일 존재 여부 검증 (spec_manifest.yaml 기반)
"""

import json
import sys
from pathlib import Path
from typing import NamedTuple

import yaml


class CheckResult(NamedTuple):
    name: str
    passed: bool
    message: str


def _root() -> Path:
    return Path(__file__).resolve().parents[3]


def _manifest() -> dict:
    p = Path(__file__).resolve().parents[1] / "spec_manifest.yaml"
    with open(p, encoding="utf-8") as f:
        return yaml.safe_load(f)


def run() -> dict:
    root = _root()
    manifest = _manifest()
    results = []

    for category, files in manifest.get("required_files", {}).items():
        for fpath in files:
            exists = (root / fpath).exists()
            results.append(CheckResult(
                f"[{category}] {fpath}",
                exists,
                "✅ 존재" if exists else f"❌ 없음",
            ))

    passed = sum(1 for r in results if r.passed)
    failed = len(results) - passed
    return {
        "check_name": "structure",
        "passed": failed == 0,
        "total": len(results),
        "passed_count": passed,
        "failed_count": failed,
        "results": [{"name": r.name, "passed": r.passed, "message": r.message} for r in results],
    }


if __name__ == "__main__":
    r = run()
    print(json.dumps(r, ensure_ascii=False, indent=2))
    sys.exit(0 if r["passed"] else 1)
