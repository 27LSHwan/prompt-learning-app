"""
Contract Check — 반응형 프롬프트 실습 UI 검증

ProblemWorkPage.tsx 가 4패널(과제/목표, 프롬프트에디터, 실행결과, 분석/정리) 구조와
분리된 액션 바, 반응형 레이아웃, /run-preview 연동을 구현했는지 정적 분석으로 검증한다.
"""

import json
import re
import sys
from pathlib import Path
from typing import NamedTuple

class CheckResult(NamedTuple):
    name: str
    passed: bool
    message: str


_ROOT        = Path(__file__).resolve().parents[3]
_PAGE_FILE   = _ROOT / "apps/student-web/src/pages/ProblemWorkPage.tsx"
_ROUTE_FILE  = _ROOT / "apps/backend/app/api/routes/student.py"
_SCHEMA_FILE = _ROOT / "apps/backend/app/schemas/student.py"


def _read(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def run() -> dict:
    results: list[CheckResult] = []

    # ── 파일 존재 여부 ───────────────────────────────────────────
    page_src   = _read(_PAGE_FILE)
    route_src  = _read(_ROUTE_FILE)
    schema_src = _read(_SCHEMA_FILE)

    results.append(CheckResult(
        "UI: ProblemWorkPage.tsx 존재",
        bool(page_src),
        "✅ 존재" if page_src else f"❌ 없음: {_PAGE_FILE.relative_to(_ROOT)}",
    ))

    # ── 반응형 4패널 구조 ───────────────────────────────────────
    has_responsive_grid = (
        "viewportWidth" in page_src and
        "gridTemplateColumns" in page_src and
        "repeat(2, minmax(0, 1fr))" in page_src
    )
    results.append(CheckResult(
        "UI: 반응형 4패널 레이아웃",
        has_responsive_grid,
        "✅ viewportWidth/panelGrid 기반 반응형 레이아웃" if has_responsive_grid else "❌ 반응형 패널 레이아웃 미구현",
    ))

    # ── 4개 패널 존재 여부 ───────────────────────────────────────
    panels = {
        "TL 과제/목표": "과제 / 목표" in page_src or "과제/목표" in page_src,
        "BL 프롬프트에디터": "프롬프트 에디터" in page_src or "Prompt Editor" in page_src,
        "TR 실행결과": "실행 결과" in page_src or "실행결과" in page_src,
        "BR 분석/정리": "분석 / 정리" in page_src or "분석/정리" in page_src,
    }
    for panel_name, exists in panels.items():
        results.append(CheckResult(
            f"UI: 패널 — {panel_name}",
            exists,
            "✅ 패널 텍스트 존재" if exists else f"❌ '{panel_name}' 패널 미발견",
        ))

    # ── 핵심 UI 요소 ─────────────────────────────────────────────
    ui_elements = {
        "System Prompt 입력": "System Prompt" in page_src or "systemPrompt" in page_src,
        "User Template 입력": "userTemplate" in page_src or "{{input}}" in page_src,
        "Few-shot 예시": "fewShots" in page_src or "Few-shot" in page_src,
        "Temperature 슬라이더": 'type="range"' in page_src and "temperature" in page_src.lower(),
        "Max Tokens 파라미터": "maxTokens" in page_src or "max_tokens" in page_src,
        "실행 버튼": "handleRun" in page_src and ("결과 실행" in page_src or "Run" in page_src),
        "최종 제출 버튼": "handleSubmit" in page_src and "최종 제출" in page_src,
        "분리된 하단 액션 바": "position: isMobile ? 'static' : 'sticky'" in page_src,
        "모델 응답 표시": "modelResponse" in page_src or "model_response" in page_src,
        "테스트 케이스 결과": "testResults" in page_src or "test_results" in page_src,
        "Assembled Prompt 표시": "assembledPrompt" in page_src or "assembled_prompt" in page_src,
        "점수 표시 (정확도/형식/일관성)": "accuracy" in page_src and "consistency" in page_src,
        "개선 가이드 표시": "improvementTips" in page_src or "improvement_tips" in page_src,
        "제출 전 체크리스트": "제출 전 체크리스트" in page_src,
        "프롬프트 버전 비교": "프롬프트 버전 비교" in page_src,
        "프롬이 최근 로그": "프롬이 최근 로그" in page_src,
        "JSON 파싱 결과": "JSON.parse" in page_src or "json" in page_src.lower(),
    }
    for elem, found in ui_elements.items():
        results.append(CheckResult(
            f"UI: {elem}",
            found,
            "✅ 구현됨" if found else f"❌ 미구현",
        ))

    # ── 백엔드 /run-preview 엔드포인트 ───────────────────────────
    has_run_preview_route = "run-preview" in route_src or "run_preview" in route_src
    results.append(CheckResult(
        "Backend: /run-preview 엔드포인트",
        has_run_preview_route,
        "✅ run-preview 라우트 존재" if has_run_preview_route else "❌ /run-preview 엔드포인트 없음",
    ))

    has_jwt_auth = (
        "get_current_student" in route_src and
        "run_preview" in route_src
    )
    results.append(CheckResult(
        "Backend: run-preview JWT 인증",
        has_jwt_auth,
        "✅ Depends(get_current_student) 사용" if has_jwt_auth else "❌ JWT 인증 미적용",
    ))

    # ── 스키마 ─────────────────────────────────────────────────
    schema_checks = {
        "RunPreviewRequest 스키마": "RunPreviewRequest" in schema_src,
        "RunPreviewResponse 스키마": "RunPreviewResponse" in schema_src,
        "TestCaseResult 스키마": "TestCaseResult" in schema_src,
        "scores 필드 (dict)": "scores" in schema_src,
        "improvement_tips 필드": "improvement_tips" in schema_src,
        "assembled_prompt 필드": "assembled_prompt" in schema_src,
        "model_response 필드": "model_response" in schema_src,
        "max_tokens 파라미터": "max_tokens" in schema_src,
    }
    for name, found in schema_checks.items():
        results.append(CheckResult(
            f"Schema: {name}",
            found,
            "✅ 선언됨" if found else "❌ 누락",
        ))

    # ── 프론트엔드 백엔드 API 연동 ─────────────────────────────
    has_api_call = (
        "run-preview" in page_src and
        "api.post" in page_src
    )
    results.append(CheckResult(
        "연동: 프론트엔드 → /run-preview 호출",
        has_api_call,
        "✅ api.post('/student/problems/.../run-preview') 호출 확인" if has_api_call else "❌ run-preview API 호출 없음",
    ))

    has_submit_api = (
        "/student/submissions" in page_src and
        "api.post" in page_src
    )
    results.append(CheckResult(
        "연동: 프론트엔드 → /student/submissions 제출",
        has_submit_api,
        "✅ api.post('/student/submissions') 호출 확인" if has_submit_api else "❌ submissions API 호출 없음",
    ))

    # ── 보안: run-preview 에 Query(student_id) 형식 쿼리 파라미터 금지 ─
    # docstring 주석에 student_id 언급은 허용, Query( 로 선언된 경우만 검출
    no_student_id_query_param = True
    if "run_preview" in route_src:
        preview_body = route_src.split("run_preview")[1][:800]
        # Query( 앞에 student_id 가 있으면 쿼리 파라미터로 선언된 것
        no_student_id_query_param = not bool(
            re.search(r"student_id\s*[^#\n]*Query\s*\(", preview_body)
        )
    results.append(CheckResult(
        "보안: run-preview student_id 쿼리 파라미터 금지",
        no_student_id_query_param,
        "✅ JWT 기반 인증 (쿼리 파라미터 없음)" if no_student_id_query_param else "❌ student_id 쿼리 파라미터 사용 중",
    ))

    # ── 사용 흐름 순서 주석 또는 번호 표시 ──────────────────────
    has_flow_guide = (
        "① 과제 / 목표" in page_src and
        "② 분석 / 정리" in page_src and
        "③ 프롬프트 에디터" in page_src and
        "④ 실행 결과" in page_src
    )
    results.append(CheckResult(
        "UI: 사용 흐름 안내 (①②③④ 단계)",
        has_flow_guide,
        "✅ 단계별 사용 흐름 표시됨" if has_flow_guide else "❌ 단계 안내 없음",
    ))

    has_legacy_retry_compat = (
        "LEGACY_SECTION_LABELS" in page_src and
        "safeSectionExtract" in page_src
    )
    results.append(CheckResult(
        "UI: 재도전 시 구버전 제출 라벨 호환",
        has_legacy_retry_compat,
        "✅ 신/구 라벨 모두 파싱" if has_legacy_retry_compat else "❌ 재도전 라벨 호환 없음",
    ))

    # ── LLM Fallback 시뮬레이션 ─────────────────────────────────
    has_fallback = "시뮬레이션" in route_src or "fallback" in route_src.lower() or "Fallback" in route_src
    results.append(CheckResult(
        "Backend: OpenAI 없을 때 Fallback 시뮬레이션",
        has_fallback,
        "✅ Fallback 시뮬레이션 구현됨" if has_fallback else "❌ Fallback 없음 (API 키 없으면 오류 발생 가능)",
    ))

    passed = sum(1 for r in results if r.passed)
    failed = len(results) - passed
    return {
        "check_name": "contract_ui_prompt_work",
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
