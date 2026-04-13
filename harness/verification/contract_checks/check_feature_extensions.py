"""
Contract Check — 학생/관리자 확장 기능 검증

다음 확장 기능이 코드베이스에 반영되었는지 정적 분석으로 확인한다.
- 학생: 약점 리포트, 문제 큐, 버전 비교, 프롬이 로그, 활동 로그, 주간 리포트, 마이크 개념 설명 확인
- 관리자: 학습 패턴, 추천 효과, 자동 개입 추천, 학생 타임라인, 활동 로그, 개입 우선순위 큐,
  문제별 운영 인사이트, 프롬이 코칭 품질 리뷰 큐
"""

import json
import sys
from pathlib import Path
from typing import NamedTuple


class CheckResult(NamedTuple):
    name: str
    passed: bool
    message: str


ROOT = Path(__file__).resolve().parents[3]
STUDENT_ROUTE = ROOT / "apps/backend/app/api/routes/student.py"
ADMIN_ROUTE = ROOT / "apps/backend/app/api/routes/admin.py"
STUDENT_DASH = ROOT / "apps/student-web/src/pages/DashboardPage.tsx"
STUDENT_WORK = ROOT / "apps/student-web/src/pages/ProblemWorkPage.tsx"
STUDENT_HISTORY = ROOT / "apps/student-web/src/pages/HistoryPage.tsx"
STUDENT_RESULT = ROOT / "apps/student-web/src/pages/SubmissionResultPage.tsx"
SUBMISSION_MODEL = ROOT / "apps/backend/app/models/submission.py"
ADMIN_SCHEMA = ROOT / "apps/backend/app/schemas/admin.py"
ADMIN_DASH = ROOT / "apps/admin-web/src/pages/DashboardPage.tsx"
ADMIN_STUDENT = ROOT / "apps/admin-web/src/pages/StudentDetailPage.tsx"
INTERVENTION_PAGE = ROOT / "apps/admin-web/src/pages/InterventionPage.tsx"


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def run() -> dict:
    student_route = _read(STUDENT_ROUTE)
    admin_route = _read(ADMIN_ROUTE)
    student_dash = _read(STUDENT_DASH)
    student_work = _read(STUDENT_WORK)
    student_history = _read(STUDENT_HISTORY)
    student_result = _read(STUDENT_RESULT)
    submission_model = _read(SUBMISSION_MODEL)
    admin_schema = _read(ADMIN_SCHEMA)
    admin_dash = _read(ADMIN_DASH)
    admin_student = _read(ADMIN_STUDENT)
    intervention_page = _read(INTERVENTION_PAGE)

    checks = [
        # 학생 API
        CheckResult("학생 API: 약점 리포트", "/weakness-report" in student_route, "약점 리포트 엔드포인트"),
        CheckResult("학생 API: 문제 큐", "/problem-queue" in student_route, "문제 큐 엔드포인트"),
        CheckResult("학생 API: 버전 비교", "/prompt-comparisons" in student_route, "버전 비교 엔드포인트"),
        CheckResult("학생 API: 프롬이 로그", "/promi-coach-logs" in student_route, "프롬이 로그 엔드포인트"),
        CheckResult("학생 API: 활동 로그", "/activity-logs" in student_route, "활동 로그 엔드포인트"),
        CheckResult("학생 API: 프롬이 코치", "promi-coach" in student_route, "프롬이 코치 엔드포인트"),
        CheckResult("학생 API: 자동 주간 학습 리포트", "/weekly-report" in student_route, "주간 학습 리포트 엔드포인트"),
        CheckResult("학생 API: 마이크 개념 설명 확인", "/concept-reflection" in student_route, "마이크 개념 설명 평가 엔드포인트"),
        # 학생 화면
        CheckResult("학생 화면: 약점 리포트 카드", "개인 약점 리포트" in student_dash, "학생 대시보드 약점 리포트"),
        CheckResult("학생 화면: 다음 문제 큐", "다음 문제 큐" in student_dash, "학생 대시보드 문제 큐"),
        CheckResult("학생 화면: 자동 주간 학습 리포트", "자동 주간 학습 리포트" in student_dash, "학생 대시보드 주간 리포트"),
        CheckResult("학생 화면: 삭제 대상 체크인 제거", ("자기" + "조절") not in student_dash and ("self" + "-regulation") not in student_route, "삭제 대상 체크인 제거"),
        CheckResult("학생 화면: 마이크 개념 설명 확인", "마이크 개념 설명 확인" in student_result and "SpeechRecognition" in student_result, "제출 결과 화면 마이크 설명"),
        CheckResult("학생 화면: 제출 전 체크리스트", "제출 전 체크리스트" in student_work, "ProblemWorkPage 체크리스트"),
        CheckResult("학생 화면: 프롬프트 버전 비교", "프롬프트 버전 비교" in student_work, "ProblemWorkPage 버전 비교"),
        CheckResult("학생 화면: 프롬이 최근 로그", "프롬이 최근 로그" in student_work, "ProblemWorkPage 프롬이 로그"),
        CheckResult("학생 화면: 실행 시 프롬이 코칭", "promi-coach" in student_work, "ProblemWorkPage 실행 시 코칭 호출"),
        CheckResult("학생 화면: 제출 이력 결과 보기 링크", "/result" in student_history, "HistoryPage 결과 보기 링크"),
        # 기술 부채 제거 확인
        CheckResult("hint 필드 제거: 모델", "hint_penalty" not in submission_model, "submission 모델에 hint_penalty 없어야 함"),
        CheckResult("hint 필드 제거: 스키마", "hint_penalty" not in admin_schema, "admin 스키마에 hint_penalty 없어야 함"),
        # 관리자 API
        CheckResult("관리자 API: 학습 패턴", "/analytics/learning-patterns" in admin_route, "학습 패턴 엔드포인트"),
        CheckResult("관리자 API: 추천 효과", "/analytics/recommendation-effect" in admin_route, "추천 효과 엔드포인트"),
        CheckResult("관리자 API: 자동 개입 추천", "/intervention-recommendations" in admin_route, "개입 추천 엔드포인트"),
        CheckResult("관리자 API: 학생 타임라인", "/timeline" in admin_route, "학생 타임라인 엔드포인트"),
        CheckResult("관리자 API: 활동 로그", "/activity-logs" in admin_route, "관리자 활동 로그 엔드포인트"),
        CheckResult("관리자 API: 개입 우선순위 큐", "/intervention-priority-queue" in admin_route, "개입 우선순위 큐 엔드포인트"),
        CheckResult("관리자 API: 문제별 운영 인사이트", "/analytics/problem-insights" in admin_route, "문제별 운영 인사이트 엔드포인트"),
        CheckResult("관리자 API: 프롬이 코칭 품질 리뷰 큐", "/promi-review-queue" in admin_route, "프롬이 리뷰 큐 엔드포인트"),
        # 관리자 화면
        CheckResult("관리자 화면: 학습 패턴 요약", "학습 패턴 요약" in admin_dash, "관리자 대시보드 요약"),
        CheckResult("관리자 화면: 개입 우선순위 큐", "개입 우선순위 큐" in admin_dash, "관리자 대시보드 우선순위 큐"),
        CheckResult("관리자 화면: 문제별 운영 인사이트", "문제별 운영 인사이트" in admin_dash, "관리자 대시보드 문제 인사이트"),
        CheckResult("관리자 화면: 프롬이 코칭 품질 리뷰 큐", "프롬이 코칭 품질 리뷰 큐" in admin_dash, "관리자 대시보드 프롬이 리뷰 큐"),
        CheckResult("관리자 화면: 추천 문제 효과", "추천 문제 효과" in admin_dash and "추천 문제 효과" in admin_student, "대시보드/학생상세 추천 효과"),
        CheckResult("관리자 화면: 최근 활동 로그", "최근 활동 로그" in admin_dash, "관리자 대시보드 활동 로그"),
        CheckResult("관리자 화면: 자동 개입 추천", "자동 개입 추천" in admin_student, "학생 상세 자동 개입 추천"),
        CheckResult("관리자 화면: 활동 타임라인", "활동 타임라인" in admin_student, "학생 상세 타임라인"),
        CheckResult("관리자 화면: 탈락 유형 개입 템플릿", "DROPOUT_TEMPLATES" in intervention_page, "개입 생성 페이지 탈락 유형 템플릿"),
        CheckResult("관리자 화면: 문제 추천 개입 유형", "problem_recommendation" in intervention_page, "개입 생성 페이지 문제 추천 유형"),
    ]

    passed = sum(1 for item in checks if item.passed)
    failed = len(checks) - passed
    return {
        "check_name": "contract_feature_extensions",
        "passed": failed == 0,
        "total": len(checks),
        "passed_count": passed,
        "failed_count": failed,
        "results": [{"name": item.name, "passed": item.passed, "message": item.message} for item in checks],
    }


if __name__ == "__main__":
    result = run()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    sys.exit(0 if result["passed"] else 1)
