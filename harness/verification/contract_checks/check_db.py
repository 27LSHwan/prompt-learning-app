"""
Contract Check — DB 스키마 계약 검증 (final_ai_dropout_spec 기반)
SQLAlchemy 모델 파일에서 Column 정의를 텍스트 파싱으로 검증한다.
"""

import json
import re
import sys
from pathlib import Path
from typing import NamedTuple

import yaml


class CheckResult(NamedTuple):
    name: str
    passed: bool
    message: str


_ROOT = Path(__file__).resolve().parents[3]
_MODELS_DIR = _ROOT / "apps/backend/app/models"


# ──────────────────────────────────────────────────────────────
# 명세 기반 테이블-컬럼 기대값 (final_ai_dropout_spec §9)
# ──────────────────────────────────────────────────────────────

EXPECTED = {
    "users": {
        "file": "user.py",
        "tablename": "users",
        "columns": ["id", "username", "email", "password_hash", "role", "created_at"],
    },
    "problems": {
        "file": "problem.py",
        "tablename": "problems",
        "columns": ["id", "title", "description", "difficulty", "category", "created_at"],
    },
    "submissions": {
        "file": "submission.py",
        "tablename": "submissions",
        "columns": ["id", "student_id", "problem_id", "prompt_text", "created_at"],
    },
    "learning_metrics": {
        "file": "learning_metrics.py",
        "tablename": "learning_metrics",
        "columns": [
            "id", "submission_id", "student_id",
            # 행동 데이터 11개
            "login_frequency", "session_duration", "submission_interval",
            "drop_midway_rate", "attempt_count", "revision_count",
            "retry_count", "strategy_change_count", "task_success_rate",
            "quiz_score_avg", "score_delta",
            # 사고 점수 14개
            "problem_understanding_score", "problem_decomposition_score",
            "constraint_awareness_score", "validation_awareness_score",
            "improvement_prompt_score", "self_explanation_score",
            "reasoning_quality_score", "reflection_depth_score",
            "error_analysis_score", "debugging_quality_score",
            "decision_reasoning_score", "approach_selection_score",
            "improvement_consistency_score", "iteration_quality_score",
        ],
    },
    "risk_scores": {
        "file": "risk_score.py",
        "tablename": "risk_scores",
        "columns": [
            "id", "student_id", "submission_id",
            "total_risk", "base_risk", "event_bonus", "thinking_risk",
            "risk_stage", "dropout_type", "calculated_at",
        ],
    },
    "interventions": {
        "file": "intervention.py",
        "tablename": "interventions",
        "columns": [
            "id", "student_id", "type", "message",
            "dropout_type", "status", "created_at", "updated_at",
        ],
    },
}


def run() -> dict:
    results = []

    for table, spec in EXPECTED.items():
        model_path = _MODELS_DIR / spec["file"]

        if not model_path.exists():
            results.append(CheckResult(f"모델 파일: {spec['file']}", False, f"❌ 없음"))
            continue

        content = model_path.read_text(encoding="utf-8")

        # __tablename__ 확인
        ok = f'"{spec["tablename"]}"' in content or f"'{spec['tablename']}'" in content
        results.append(CheckResult(
            f"[{table}] __tablename__", ok,
            "✅" if ok else f"❌ '{spec['tablename']}' 미발견",
        ))

        # 컬럼 확인 (공백 여러 개 허용: `id   = Column(`)
        for col in spec["columns"]:
            ok = bool(re.search(rf"\b{re.escape(col)}\s*=\s*Column", content))
            results.append(CheckResult(
                f"[{table}].{col}", ok,
                "✅" if ok else f"❌ 컬럼 미발견",
            ))

    # 마이그레이션 (경고만, pass 판정 제외)
    for mig in ["alembic.ini", "alembic"]:
        p = _ROOT / "apps/backend" / mig
        results.append(CheckResult(
            f"마이그레이션: {mig}", p.exists(),
            "✅" if p.exists() else f"⚠️  권장 파일 없음",
        ))

    critical_failed = sum(1 for r in results if not r.passed and "마이그레이션" not in r.name)
    passed = sum(1 for r in results if r.passed)

    return {
        "check_name": "contract_db",
        "passed": critical_failed == 0,
        "total": len(results),
        "passed_count": passed,
        "failed_count": len(results) - passed,
        "results": [{"name": r.name, "passed": r.passed, "message": r.message} for r in results],
    }


if __name__ == "__main__":
    r = run()
    print(json.dumps(r, ensure_ascii=False, indent=2))
    sys.exit(0 if r["passed"] else 1)
