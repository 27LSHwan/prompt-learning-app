#!/usr/bin/env python3
"""
run_all.py — AI 학습 낙오 예측 시스템 전체 검증 실행기

사용법:
  python harness/verification/run_all.py
  python harness/verification/run_all.py --server http://localhost:8000
  python harness/verification/run_all.py --skip-server-checks
  python harness/verification/run_all.py --only structure integration

출력:
  harness/verification/reports/report_{timestamp}.json
  harness/verification/reports/report_latest.json
"""

import argparse
import importlib
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import requests as _requests
    _REQUESTS_AVAILABLE = True
except ImportError:
    _REQUESTS_AVAILABLE = False


# ──────────────────────────────────────────────
# 경로 설정
# ──────────────────────────────────────────────

HARNESS_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = HARNESS_DIR.parents[1]
REPORTS_DIR = HARNESS_DIR / "reports"

# 패키지 경로 추가
for path in [str(PROJECT_ROOT), str(PROJECT_ROOT / "packages")]:
    if path not in sys.path:
        sys.path.insert(0, path)


# ──────────────────────────────────────────────
# 검증 모듈 목록 (순서 중요)
# ──────────────────────────────────────────────

CHECK_MODULES = [
    {
        "key": "structure",
        "name": "구조 검증",
        "module": "structure_checks.check_files",
        "requires_server": False,
    },
    {
        "key": "integration",
        "name": "통합 검증 (LLM→scoring→decision)",
        "module": "integration_checks.check_flow",
        "requires_server": False,
    },
    {
        "key": "contract_requirements",
        "name": "패키지 의존성 검증",
        "module": "contract_checks.check_requirements",
        "requires_server": False,
    },
    {
        "key": "contract_db",
        "name": "DB 스키마 계약 검증",
        "module": "contract_checks.check_db",
        "requires_server": False,
    },
    {
        "key": "contract_import_style",
        "name": "import 스타일 검증",
        "module": "contract_checks.check_import_style",
        "requires_server": False,
    },
    {
        "key": "contract_login_form",
        "name": "로그인 폼 계약 검증",
        "module": "contract_checks.check_login_form",
        "requires_server": False,
    },
    {
        "key": "contract_responsive_layout",
        "name": "반응형 레이아웃 계약 검증",
        "module": "contract_checks.check_responsive_layout",
        "requires_server": False,
    },
    {
        "key": "contract_security",
        "name": "보안 필수 요건 검증",
        "module": "contract_checks.check_security",
        "requires_server": False,
    },
    {
        "key": "contract_prompt_eval",
        "name": "루브릭 평가 검증",
        "module": "contract_checks.check_prompt_eval",
        "requires_server": False,
    },
    {
        "key": "contract_ui_prompt_work",
        "name": "프롬프트 실습 UI 검증",
        "module": "contract_checks.check_ui_prompt_work",
        "requires_server": False,
    },
    {
        "key": "contract_feature_extensions",
        "name": "확장 기능 계약 검증",
        "module": "contract_checks.check_feature_extensions",
        "requires_server": False,
    },
    {
        "key": "contract_api",
        "name": "API 계약 검증",
        "module": "contract_checks.check_api",
        "requires_server": True,
    },
    {
        "key": "e2e_student",
        "name": "E2E 학생 흐름 검증",
        "module": "e2e_checks.check_student_flow",
        "requires_server": True,
    },
    {
        "key": "e2e_admin",
        "name": "E2E 관리자 흐름 검증",
        "module": "e2e_checks.check_admin_flow",
        "requires_server": True,
    },
]


# ──────────────────────────────────────────────
# 서버 연결 확인
# ──────────────────────────────────────────────

def check_server_available(server_url: str) -> bool:
    if not _REQUESTS_AVAILABLE:
        return False
    try:
        resp = _requests.get(f"{server_url}/health", timeout=3)
        return resp.status_code < 500
    except Exception:
        try:
            resp = _requests.get(f"{server_url}/api/v1/interventions", timeout=3)
            return resp.status_code < 500
        except Exception:
            return False


# ──────────────────────────────────────────────
# 출력 헬퍼
# ──────────────────────────────────────────────

RESET = "\033[0m"
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
DIM = "\033[2m"


def print_banner():
    print(f"\n{BOLD}{CYAN}{'='*60}{RESET}")
    print(f"{BOLD}{CYAN}  AI 학습 낙오 예측 시스템 — 검증 하네스{RESET}")
    print(f"{BOLD}{CYAN}{'='*60}{RESET}\n")


def print_section(title: str):
    print(f"\n{BOLD}▶ {title}{RESET}")
    print(f"{DIM}{'─'*50}{RESET}")


def print_check_result(result: dict):
    icon = f"{GREEN}✅{RESET}" if result["passed"] else f"{RED}❌{RESET}"
    print(f"  {icon} {result['name']}")
    if not result["passed"]:
        print(f"     {DIM}{result['message']}{RESET}")


def print_summary(all_results: list[dict], total_time: float):
    print(f"\n{BOLD}{CYAN}{'='*60}{RESET}")
    print(f"{BOLD}  검증 결과 요약{RESET}")
    print(f"{CYAN}{'='*60}{RESET}")

    overall_passed = True
    for check in all_results:
        status = f"{GREEN}PASS{RESET}" if check["passed"] else f"{RED}FAIL{RESET}"
        bar = build_bar(check["passed_count"], check["total"])
        print(f"  [{status}] {check['check_name']:<20} {bar}  ({check['passed_count']}/{check['total']})")
        if not check["passed"]:
            overall_passed = False

    print(f"\n{DIM}  총 소요 시간: {total_time:.2f}초{RESET}")
    if overall_passed:
        print(f"\n{BOLD}{GREEN}  🎉 모든 검증 통과!{RESET}")
    else:
        failed_checks = [c["check_name"] for c in all_results if not c["passed"]]
        print(f"\n{BOLD}{RED}  ⚠️  검증 실패: {', '.join(failed_checks)}{RESET}")

    print(f"{CYAN}{'='*60}{RESET}\n")
    return overall_passed


def build_bar(passed: int, total: int) -> str:
    if total == 0:
        return "[----------]"
    filled = int((passed / total) * 10)
    return f"[{'█' * filled}{'░' * (10 - filled)}]"


# ──────────────────────────────────────────────
# 리포트 저장
# ──────────────────────────────────────────────

def save_report(all_results: list[dict], total_time: float, args: argparse.Namespace):
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    now = datetime.now(timezone.utc)
    timestamp = now.strftime("%Y%m%d_%H%M%S")

    overall_passed = all(r["passed"] for r in all_results)
    total_checks = sum(r["total"] for r in all_results)
    total_passed = sum(r["passed_count"] for r in all_results)

    report = {
        "generated_at": now.isoformat(),
        "project": "AI 학습 낙오 예측 시스템",
        "server_url": args.server,
        "total_time_seconds": round(total_time, 2),
        "overall_passed": overall_passed,
        "summary": {
            "total_checks": total_checks,
            "passed_checks": total_passed,
            "failed_checks": total_checks - total_passed,
            "pass_rate": f"{(total_passed / total_checks * 100):.1f}%" if total_checks > 0 else "0%",
        },
        "checks": all_results,
    }

    # 타임스탬프 리포트
    report_path = REPORTS_DIR / f"report_{timestamp}.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    # 최신 리포트 (항상 덮어쓰기)
    latest_path = REPORTS_DIR / "report_latest.json"
    with open(latest_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"{DIM}  📄 리포트 저장: {report_path.relative_to(PROJECT_ROOT)}{RESET}")
    print(f"{DIM}  📄 최신 리포트: {latest_path.relative_to(PROJECT_ROOT)}{RESET}")

    return report_path


# ──────────────────────────────────────────────
# 메인
# ──────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="AI 학습 낙오 예측 시스템 — 전체 검증 실행"
    )
    parser.add_argument(
        "--server",
        default="http://localhost:8000",
        help="백엔드 서버 URL (기본: http://localhost:8000)",
    )
    parser.add_argument(
        "--skip-server-checks",
        action="store_true",
        help="서버가 필요한 검증 항목 건너뜀",
    )
    parser.add_argument(
        "--only",
        nargs="+",
        metavar="CHECK",
        help="특정 검증만 실행 (예: --only structure integration)",
    )
    return parser.parse_args()


def run_check_module(module_path: str, server_url: str) -> dict:
    """검증 모듈을 동적으로 임포트하여 실행"""
    # harness/verification/ 경로를 sys.path에 추가
    verification_dir = str(HARNESS_DIR)
    if verification_dir not in sys.path:
        sys.path.insert(0, verification_dir)

    try:
        mod = importlib.import_module(module_path)
        importlib.reload(mod)  # 캐시 무효화

        sig = mod.run.__code__.co_varnames[:mod.run.__code__.co_argcount]
        if "server_url" in sig:
            return mod.run(server_url=server_url)
        else:
            return mod.run()

    except ModuleNotFoundError as e:
        return {
            "check_name": module_path.split(".")[-1],
            "passed": False,
            "total": 1,
            "passed_count": 0,
            "failed_count": 1,
            "results": [{"name": "모듈 로드", "passed": False, "message": f"❌ 모듈 없음: {e}"}],
        }
    except Exception as e:
        return {
            "check_name": module_path.split(".")[-1],
            "passed": False,
            "total": 1,
            "passed_count": 0,
            "failed_count": 1,
            "results": [{"name": "실행 오류", "passed": False, "message": f"❌ {type(e).__name__}: {e}"}],
        }


def main():
    args = parse_args()
    print_banner()

    start_time = time.time()

    # 서버 연결 확인
    server_available = False
    if not args.skip_server_checks:
        print(f"{DIM}  서버 연결 확인: {args.server} ...{RESET}", end="", flush=True)
        server_available = check_server_available(args.server)
        if server_available:
            print(f" {GREEN}연결됨{RESET}")
        else:
            print(f" {YELLOW}연결 실패 (서버 필요 검증 항목 건너뜀){RESET}")
    else:
        print(f"{YELLOW}  ⚠️  --skip-server-checks: 서버 검증 항목을 건너뜁니다.{RESET}")

    all_results = []
    skipped = []

    for check_def in CHECK_MODULES:
        key = check_def["key"]

        # --only 필터
        if args.only and key not in args.only:
            continue

        # 서버 필요 여부 확인
        if check_def["requires_server"] and (args.skip_server_checks or not server_available):
            skipped.append(key)
            continue

        print_section(f"{check_def['name']} ({key})")

        result = run_check_module(check_def["module"], args.server)
        all_results.append(result)

        for item in result["results"]:
            print_check_result(item)

        status_text = f"{GREEN}PASS{RESET}" if result["passed"] else f"{RED}FAIL{RESET}"
        print(f"\n  → {status_text} ({result['passed_count']}/{result['total']})")

    if skipped:
        print(f"\n{YELLOW}  건너뜀: {', '.join(skipped)} (서버 미연결){RESET}")

    total_time = time.time() - start_time
    overall_passed = print_summary(all_results, total_time)

    if all_results:
        save_report(all_results, total_time, args)

    sys.exit(0 if overall_passed else 1)


if __name__ == "__main__":
    main()
