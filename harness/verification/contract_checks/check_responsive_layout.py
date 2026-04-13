"""
Contract Check — 반응형 레이아웃 계약 검증

학생/관리자 주요 화면이 데스크톱, 태블릿, 모바일 구간을 고려한
반응형 클래스/레이아웃 규칙을 포함하는지 정적 분석으로 확인한다.
"""

import json
from pathlib import Path
from typing import NamedTuple


class CheckResult(NamedTuple):
    name: str
    passed: bool
    message: str


ROOT = Path(__file__).resolve().parents[3]

FILES = {
    "student_css": ROOT / "apps/student-web/src/index.css",
    "student_layout": ROOT / "apps/student-web/src/components/Layout.tsx",
    "student_dashboard": ROOT / "apps/student-web/src/pages/DashboardPage.tsx",
    "student_problems": ROOT / "apps/student-web/src/pages/ProblemsPage.tsx",
    "student_problem_work": ROOT / "apps/student-web/src/pages/ProblemWorkPage.tsx",
    "student_risk": ROOT / "apps/student-web/src/pages/RiskPage.tsx",
    "student_history": ROOT / "apps/student-web/src/pages/HistoryPage.tsx",
    "student_recommend": ROOT / "apps/student-web/src/pages/RecommendPage.tsx",
    "admin_css": ROOT / "apps/admin-web/src/index.css",
    "admin_layout": ROOT / "apps/admin-web/src/components/Layout.tsx",
    "admin_dashboard": ROOT / "apps/admin-web/src/pages/DashboardPage.tsx",
    "admin_students": ROOT / "apps/admin-web/src/pages/StudentsPage.tsx",
    "admin_student_detail": ROOT / "apps/admin-web/src/pages/StudentDetailPage.tsx",
    "admin_interventions_list": ROOT / "apps/admin-web/src/pages/InterventionsListPage.tsx",
}


def _read(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def run() -> dict:
    src = {name: _read(path) for name, path in FILES.items()}
    results: list[CheckResult] = []

    results.append(CheckResult(
        "student-web 공통 반응형 클래스",
        all(token in src["student_css"] for token in [
            ".responsive-two-col",
            ".responsive-four-col",
            ".responsive-stack-card",
            "@media (max-width: 768px)",
        ]),
        "OK: 학생 웹 공통 반응형 클래스 정의" if all(token in src["student_css"] for token in [
            ".responsive-two-col", ".responsive-four-col", ".responsive-stack-card", "@media (max-width: 768px)",
        ]) else "FAIL: 학생 웹 공통 반응형 클래스 누락",
    ))

    results.append(CheckResult(
        "admin-web 공통 반응형 클래스",
        all(token in src["admin_css"] for token in [
            ".responsive-admin-grid-3",
            ".responsive-admin-grid-2",
            ".responsive-admin-row",
            ".responsive-table-wrap",
        ]),
        "OK: 관리자 웹 공통 반응형 클래스 정의" if all(token in src["admin_css"] for token in [
            ".responsive-admin-grid-3", ".responsive-admin-grid-2", ".responsive-admin-row", ".responsive-table-wrap",
        ]) else "FAIL: 관리자 웹 공통 반응형 클래스 누락",
    ))

    results.append(CheckResult(
        "student Layout 모바일 헤더/오버레이",
        all(token in src["student_layout"] for token in ["mobile-header", "mobile-overlay", "@media (max-width: 768px)"]),
        "OK: 학생 Layout 모바일 대응 존재" if all(token in src["student_layout"] for token in ["mobile-header", "mobile-overlay", "@media (max-width: 768px)"]) else "FAIL: 학생 Layout 모바일 대응 누락",
    ))

    results.append(CheckResult(
        "admin Layout 모바일 햄버거/오버레이",
        all(token in src["admin_layout"] for token in ["mobileMenuOpen", "☰", "position: 'fixed'"]),
        "OK: 관리자 Layout 모바일 메뉴 존재" if all(token in src["admin_layout"] for token in ["mobileMenuOpen", "☰", "position: 'fixed'"]) else "FAIL: 관리자 Layout 모바일 메뉴 누락",
    ))

    page_expectations = [
        ("학생 대시보드 반응형 그리드", src["student_dashboard"], ["responsive-two-col", "responsive-four-col"]),
        ("학생 문제목록 반응형 CTA", src["student_problems"], ["problem-card", "@media (max-width: 900px)"]),
        ("학생 문제풀이 반응형 패널", src["student_problem_work"], ["viewportWidth", "isMobile", "gridTemplateColumns"]),
        ("학생 위험도 반응형 레이아웃", src["student_risk"], ["responsive-two-col"]),
        ("학생 제출이력 반응형 카드", src["student_history"], ["responsive-stack-card"]),
        ("학생 추천 반응형 카드", src["student_recommend"], ["responsive-banner", "responsive-stack-card"]),
        ("관리자 대시보드 반응형 그리드", src["admin_dashboard"], ["responsive-admin-grid-3", "responsive-admin-grid-2"]),
        ("관리자 학생목록 반응형 테이블 래퍼", src["admin_students"], ["responsive-table-wrap", "responsive-table"]),
        ("관리자 학생상세 반응형 상세", src["admin_student_detail"], ["responsive-banner", "responsive-admin-grid-2", "responsive-admin-row"]),
        ("관리자 개입현황 반응형 목록", src["admin_interventions_list"], ["responsive-admin-actions", "responsive-admin-row"]),
    ]

    for name, file_src, tokens in page_expectations:
      passed = all(token in file_src for token in tokens)
      results.append(CheckResult(
          name,
          passed,
          "OK: 반응형 토큰 확인" if passed else f"FAIL: 누락 토큰 {', '.join([t for t in tokens if t not in file_src])}",
      ))

    passed_count = sum(1 for r in results if r.passed)
    failed_count = len(results) - passed_count
    return {
        "check_name": "contract_responsive_layout",
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
    raise SystemExit(0 if result["passed"] else 1)
