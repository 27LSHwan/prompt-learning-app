"""
초기 DB 데이터 시드 스크립트
==============================
사용법:
    cd apps/backend
    python seed.py            # 기본 실행 (이미 데이터 있으면 skip)
    python seed.py --reset    # 전체 삭제 후 재생성

생성 데이터:
    - 관리자 계정 2개
    - 학생 계정 8명 (7가지 탈락 유형 전부 커버)
    - 학습 문제 18개 (다양한 카테고리 + 난이도)
    - 제출 이력 및 위험도 샘플 (유형별 맞춤 시나리오)
    - 개입 이력 (탈락 유형별 맞춤 메시지)
    - 관리자 문제 추천 (학생 문제 목록 추천 태그/개입 우선순위 반영)
    - 활동 로그 (학생별)
    - 마이크 개념 설명 통과 샘플 (제출 인정 기준)
    - 프롬이 코칭 로그 (학생별)
    - 프롬이 코칭 품질 리뷰 큐 샘플
    - 또래 도움 스레드와 도움 포인트
    - 관리자 메모

탈락 유형 커버리지:
    cognitive     — 김민준 (지식 격차 → 고위험)
    none          — 이서연 (안정 유지)
    motivational  — 박도윤 (동기 저하 → 고위험)
    strategic     — 최지우 (전략 부재 → 주의·불안정)
    sudden        — 정하은 (급격 하락형)
    dependency    — 강시우 (의존형 → 주의)
    compound      — 윤아린 (복합 위험 → 심각)
    cognitive     — 임주원 (인지 회복 중)
"""

import asyncio
import json
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

# ── 패키지 경로 설정 ─────────────────────────────────
ROOT = Path(__file__).resolve().parents[2]
for p in [str(ROOT), str(ROOT / "packages")]:
    if p not in sys.path:
        sys.path.insert(0, p)

import bcrypt
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.database import Base
from app.models.user import User
from app.models.problem import Problem
from app.models.submission import Submission
from app.models.risk_score import RiskScore
from app.models.intervention import Intervention
from app.models.learning_metrics import LearningMetrics
from app.models.peer_help_message import PeerHelpMessage
from app.models.peer_help_thread import PeerHelpThread
from app.models.student_note import StudentNote
from app.models.activity_log import ActivityLog
from app.models.problem_recommendation import ProblemRecommendation
from app.models.promi_coach_log import PromiCoachLog

# ── 설정 ─────────────────────────────────────────────
try:
    from dotenv import load_dotenv as _load_dotenv
    import os as _os
    _load_dotenv()
    DATABASE_URL = _os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./dev.db")
except Exception:
    DATABASE_URL = "sqlite+aiosqlite:///./dev.db"

def _hash(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _now(delta_days: int = 0, delta_hours: int = 0) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=delta_days, hours=delta_hours)


def _uid() -> str:
    return str(uuid.uuid4())


def _reflection_mapping(problem: dict) -> dict:
    title = problem.get("title", "문제")
    category = problem.get("category", "")
    concept_map = [
        (("Chain-of-Thought", "CoT", "논리 퍼즐"), ["Chain-of-Thought(CoT)", "상태 추적", "자기 검증", "백트래킹 지시"]),
        (("Few-Shot", "감성 분류기"), ["Few-Shot 프롬프팅", "라벨별 대표 예시", "예시 형식 일관성", "애매한 케이스 처리"]),
        (("인젝션",), ["프롬프트 인젝션 방어", "역할/권한 경계", "민감정보 보호", "안전한 거부와 대체 도움"]),
        (("역할극", "면접"), ["역할 프롬프팅", "시나리오 제약", "피드백 루브릭", "대화 종료 조건"]),
        (("멀티턴", "학습 코치"), ["시스템 프롬프트", "멀티턴 컨텍스트 유지", "소크라테스식 힌트", "적응형 난이도 조절"]),
        (("이메일",), ["역할 프롬프팅", "맥락 제공", "출력 형식 지정", "톤/분량 제약"]),
        (("가정교사", "수학"), ["역할 프롬프팅", "학습자 수준 지정", "예시/비유 요청", "이해 확인 질문"]),
        (("맛집", "큐레이터"), ["역할 프롬프팅", "정보 수집 질문", "필터 조건", "추천 결과 형식"]),
        (("데이터 분석 보고서", "데이터 표"), ["구조화된 출력", "분석 관점 지정", "수치 기준 명시", "인사이트 도출"]),
        (("Python 오류", "디버깅"), ["디버깅 역할 프롬프팅", "오류 맥락 제공", "원인 후보 분리", "재현/검증 절차"]),
        (("과학 기사", "요약"), ["요약 프롬프팅", "핵심 주장/근거 분리", "신뢰도 평가", "한계와 추가 확인 포인트"]),
        (("STAR",), ["STAR 구조화", "답변 재작성", "상황-과제-행동-결과 분리", "개선 피드백"]),
        (("영어 발표",), ["청중 수준 조정", "스타일 변환", "난이도 제약", "출력 버전 분리"]),
        (("학습 계획",), ["계획 생성 프롬프팅", "시간 제약 반영", "주차별 구조화", "복습 루틴 설계"]),
        (("AI 윤리",), ["AI 윤리 체크리스트", "편향성/개인정보/투명성/책임성", "배포 맥락 조정", "점검 기준 구체화"]),
        (("고객 리뷰",), ["분류 프롬프팅", "감성/개선 요청 라벨링", "빈도 기반 우선순위", "대표 인사이트 요약"]),
        (("퀴즈",), ["문항 생성 프롬프팅", "난이도 제어", "문항 유형 지정", "정답/해설 생성"]),
    ]
    concepts = ["역할 프롬프팅", "맥락 제공", "출력 형식 지정", "제약 조건 명시"]
    for keywords, mapped in concept_map:
        if any(keyword in title or keyword in category for keyword in keywords):
            concepts = mapped
            break

    methodology = [
        f"{concept}을(를) 프롬프트에 어떻게 넣었는지 설명합니다."
        for concept in concepts[:3]
    ]

    first = concepts[0]
    second = concepts[1] if len(concepts) > 1 else concepts[0]
    return {
        "core_concepts": concepts,
        "methodology": methodology,
        "concept_check_questions": [
            *[
                f"이 문제에서 써야 했던 프롬프트 개념 `{concept}`이 무엇인지 설명해보세요."
                for concept in concepts[:4]
            ],
            f"본인 프롬프트에서 `{first}` 또는 `{second}`를 어느 문장에 반영했는지 말해보세요.",
        ],
    }


# ══════════════════════════════════════════════════════
# 시드 데이터 정의
# ══════════════════════════════════════════════════════

ADMINS = [
    {"username": "관리자",  "email": "admin@example.com",    "password": "admin1234", "role": "admin"},
    {"username": "교수님",  "email": "professor@example.com", "password": "prof1234",  "role": "admin"},
]

# 각 학생에 dropout_type 명시 (7가지 전부 커버 + cognitive 1명 추가)
STUDENTS = [
    {"username": "김민준", "email": "minjun@example.com",  "password": "student123", "dropout_type": "cognitive"},
    {"username": "이서연", "email": "seoyeon@example.com", "password": "student123", "dropout_type": "none"},
    {"username": "박도윤", "email": "doyun@example.com",   "password": "student123", "dropout_type": "motivational"},
    {"username": "최지우", "email": "jiwoo@example.com",   "password": "student123", "dropout_type": "strategic"},
    {"username": "정하은", "email": "haeun@example.com",   "password": "student123", "dropout_type": "sudden"},
    {"username": "강시우", "email": "siwoo@example.com",   "password": "student123", "dropout_type": "dependency"},
    {"username": "윤아린", "email": "arin@example.com",    "password": "student123", "dropout_type": "compound"},
    {"username": "임주원", "email": "juwon@example.com",   "password": "student123", "dropout_type": "cognitive"},
]

PROBLEMS = [
    # ══ 카테고리: 기본 프롬프팅 (easy) ══════════════════
    {
        "title": "AI 가정교사에게 수학 개념 설명 요청하기",
        "description": (
            "중학교 2학년 학생에게 '이차방정식'을 설명해 줄 AI 가정교사 프롬프트를 작성하세요.\n\n"
            "📌 요구사항:\n"
            "- AI의 역할(가정교사)을 명확히 설정하세요\n"
            "- 학생의 수준(중2)과 배경지식을 고려하세요\n"
            "- 이해하기 쉬운 예시를 요청하세요\n"
            "- 설명 후 확인 문제도 내달라고 하세요\n\n"
            "💡 팁: '너는 ~이다' 형태로 역할을 부여하면 더 좋은 응답을 얻을 수 있어요!"
        ),
        "difficulty": "easy",
        "category": "기본 프롬프팅",
        "steps": [
            "이 문제를 읽고 어떤 상황인지 파악하세요. AI에게 무엇을 시켜야 할까요?",
            "AI의 역할을 어떻게 설정할지 생각해보세요.",
            "학생의 수준과 필요한 설명 방식을 어떻게 전달할지 계획해보세요.",
            "위 내용을 바탕으로 프롬프트 초안을 작성해보세요.",
            "초안을 검토하고 최종 프롬프트를 완성하세요.",
        ],
        "rubric": {
            "criteria": [
                {"name": "역할 정의",   "description": "AI의 역할이 명확하게 설정되어 있는가",     "weight": 0.30, "max_score": 10},
                {"name": "대상 명시",   "description": "학생 수준과 배경이 구체적으로 명시되어 있는가", "weight": 0.25, "max_score": 10},
                {"name": "요청 명확성", "description": "이차방정식 설명 요청이 명확한가",            "weight": 0.20, "max_score": 10},
                {"name": "예시 요청",   "description": "이해를 돕는 예시나 비유를 요청했는가",       "weight": 0.15, "max_score": 10},
                {"name": "확인 문제",   "description": "이해 확인을 위한 문제 출제를 요청했는가",     "weight": 0.10, "max_score": 10},
            ],
            "evaluation_guidelines": "중학생 대상 AI 가정교사 역할 프롬프트를 평가합니다."
        },
    },
    {
        "title": "완벽한 이메일 작성 도우미 만들기",
        "description": (
            "업무용 이메일 작성을 도와주는 AI 어시스턴트 프롬프트를 작성하세요.\n\n"
            "📌 시나리오: 팀장에게 프로젝트 진행 상황을 보고하는 이메일 작성\n\n"
            "📌 요구사항:\n"
            "- 공손하고 전문적인 톤을 지정하세요\n"
            "- 이메일 구성 요소(제목, 인사, 본문, 마무리)를 명시하세요\n"
            "- 원하는 분량(3~5문장)을 지정하세요\n"
            "- 상황 맥락을 충분히 제공하세요\n\n"
            "💡 팁: 출력 형식을 구체적으로 지정할수록 원하는 결과물을 얻기 쉬워요!"
        ),
        "difficulty": "easy",
        "category": "기본 프롬프팅",
        "steps": [
            "이메일 작성 상황을 파악하세요.",
            "AI에게 어떤 톤과 스타일을 지정할지 생각해보세요.",
            "원하는 이메일 구조와 분량을 어떻게 명시할지 계획하세요.",
            "상황 맥락을 포함한 프롬프트 초안을 작성하세요.",
            "초안을 다듬어 최종 프롬프트를 완성하세요.",
        ],
        "rubric": {
            "criteria": [
                {"name": "맥락 제공", "description": "이메일 작성 상황과 맥락이 충분히 설명되어 있는가", "weight": 0.25, "max_score": 10},
                {"name": "톤 지정",   "description": "원하는 글의 톤이 명시되어 있는가",              "weight": 0.25, "max_score": 10},
                {"name": "출력 형식", "description": "이메일 구성 요소나 원하는 형식이 명시되어 있는가", "weight": 0.25, "max_score": 10},
                {"name": "제약 조건", "description": "분량, 언어 등 제약 조건이 포함되어 있는가",       "weight": 0.15, "max_score": 10},
                {"name": "명확성",    "description": "전체 요청이 명확하고 이해하기 쉬운가",            "weight": 0.10, "max_score": 10},
            ],
            "evaluation_guidelines": "업무용 이메일 작성 프롬프트를 평가합니다."
        },
    },
    {
        "title": "맛집 탐방 AI 큐레이터 프롬프트",
        "description": (
            "개인 취향에 맞는 맛집을 추천해주는 AI 큐레이터 프롬프트를 작성하세요.\n\n"
            "📌 요구사항:\n"
            "- AI가 먼저 취향을 파악하는 질문을 하도록 유도하세요\n"
            "- 추천 결과 형식을 지정하세요\n"
            "- 지역, 예산, 음식 종류 등 필터를 수집하도록 하세요\n"
            "- 한 번에 3~5개의 선택지를 제시하도록 요청하세요\n\n"
            "💡 팁: AI가 사용자와 대화하며 정보를 모으도록 설계해보세요!"
        ),
        "difficulty": "easy",
        "category": "기본 프롬프팅",
        "steps": [
            "맛집 추천 서비스에서 AI가 어떤 역할을 해야 하는지 생각해보세요.",
            "사용자의 취향을 파악하기 위해 AI가 어떤 정보를 수집해야 하는지 나열해보세요.",
            "추천 결과를 어떤 형식으로 출력하면 좋을지 설계해보세요.",
            "위 내용을 담은 프롬프트 초안을 작성하세요.",
            "초안을 다듬어 완성하세요.",
        ],
        "rubric": {
            "criteria": [
                {"name": "역할 정의",   "description": "AI 큐레이터 역할이 명확히 정의되어 있는가",  "weight": 0.20, "max_score": 10},
                {"name": "정보 수집",   "description": "취향/조건 파악을 위한 질문 유도가 있는가",   "weight": 0.30, "max_score": 10},
                {"name": "출력 구조",   "description": "추천 결과의 형식이 명시되어 있는가",         "weight": 0.25, "max_score": 10},
                {"name": "필터 조건",   "description": "지역, 예산, 음식 종류 등 필터가 포함되어 있는가", "weight": 0.15, "max_score": 10},
                {"name": "대화형 설계", "description": "대화하며 정보를 모으는 방식으로 설계되었는가",  "weight": 0.10, "max_score": 10},
            ],
            "evaluation_guidelines": "맛집 추천 큐레이터 프롬프트를 평가합니다."
        },
    },

    # ══ 카테고리: 고급 프롬프팅 기법 (medium) ═══════════
    {
        "title": "Chain-of-Thought로 논리 퍼즐 풀기",
        "description": (
            "AI가 단계별 사고 과정을 보여주며 논리 퍼즐을 푸는 CoT 프롬프트를 작성하세요.\n\n"
            "📌 풀어야 할 문제: '농부가 늑대, 염소, 양배추를 강 건너편으로 옮겨야 한다.'\n\n"
            "📌 요구사항:\n"
            "- 각 단계를 명시적으로 서술하도록 지시하세요\n"
            "- 각 이동 후 강의 양쪽 상태를 확인하도록 하세요\n"
            "- 막히면 되돌아가서 다시 시도하도록 안내하세요\n"
            "- 최종 답 전에 검증 과정을 거치도록 하세요\n\n"
            "💡 팁: '단계별로 생각해봅시다'가 핵심 CoT 트리거입니다!"
        ),
        "difficulty": "medium",
        "category": "고급 프롬프팅 기법",
        "steps": [
            "CoT 기법이 무엇인지 정리해보세요.",
            "이 농부 문제를 풀기 위해 AI가 어떤 단계들을 거쳐야 할지 생각해보세요.",
            "각 단계에서 AI가 확인해야 할 상태를 어떻게 표현하도록 지시할지 계획하세요.",
            "CoT 트리거 문구와 단계별 서술 지시를 포함한 프롬프트 초안을 작성하세요.",
            "검증 과정 요청과 되돌아가기 지시가 있는지 확인하고 최종본을 완성하세요.",
        ],
        "rubric": {
            "criteria": [
                {"name": "CoT 트리거",  "description": "단계별 사고를 유도하는 트리거 문구가 있는가", "weight": 0.25, "max_score": 10},
                {"name": "상태 확인",   "description": "각 이동 후 상태 확인 지시가 명확한가",        "weight": 0.25, "max_score": 10},
                {"name": "백트래킹",    "description": "막힐 때 되돌아가는 지시가 있는가",            "weight": 0.20, "max_score": 10},
                {"name": "검증 요청",   "description": "최종 답 전 검증 과정 요청이 있는가",          "weight": 0.20, "max_score": 10},
                {"name": "명확성",      "description": "전체 프롬프트가 명확한가",                   "weight": 0.10, "max_score": 10},
            ],
            "evaluation_guidelines": "CoT 논리 퍼즐 프롬프트를 평가합니다."
        },
    },
    {
        "title": "Few-Shot 예시로 감성 분류기 만들기",
        "description": (
            "긍정/부정/중립을 분류하는 AI 감성 분석기를 Few-Shot 기법으로 작성하세요.\n\n"
            "📌 요구사항:\n"
            "- 각 카테고리별 예시를 2개 이상 제공하세요\n"
            "- 예시 형식을 일관되게 유지하세요\n"
            "- 분류 기준을 명확히 설명하세요\n"
            "- 애매한 경우 처리 방법을 지정하세요\n\n"
            "💡 팁: 예시 품질이 Few-Shot 성능을 결정합니다!"
        ),
        "difficulty": "medium",
        "category": "고급 프롬프팅 기법",
        "steps": [
            "Few-Shot 기법의 원리를 이해하세요.",
            "각 감성 카테고리별 좋은 예시를 선정하세요.",
            "예시 형식을 통일하고 구조를 설계하세요.",
            "분류 기준과 애매한 경우 처리를 포함한 초안을 작성하세요.",
            "예시 일관성과 분류 기준 명확성을 점검하고 완성하세요.",
        ],
        "rubric": {
            "criteria": [
                {"name": "예시 품질",   "description": "각 카테고리별 예시가 전형적이고 명확한가",  "weight": 0.30, "max_score": 10},
                {"name": "형식 일관성", "description": "예시 형식이 일관되게 유지되는가",           "weight": 0.25, "max_score": 10},
                {"name": "분류 기준",   "description": "분류 기준이 명확하게 설명되어 있는가",      "weight": 0.20, "max_score": 10},
                {"name": "예외 처리",   "description": "애매한 경우 처리 방법이 지정되어 있는가",   "weight": 0.15, "max_score": 10},
                {"name": "예시 개수",   "description": "각 카테고리별 예시가 2개 이상인가",         "weight": 0.10, "max_score": 10},
            ],
            "evaluation_guidelines": "Few-Shot 감성 분류기 프롬프트를 평가합니다."
        },
    },
    {
        "title": "역할극 방식으로 취업 면접 준비하기",
        "description": (
            "AI와 함께 모의 취업 면접을 진행하는 역할극 프롬프트를 작성하세요.\n\n"
            "📌 요구사항:\n"
            "- AI에게 면접관 역할을 부여하세요\n"
            "- 면접 직종과 회사 유형을 설정하세요\n"
            "- 피드백 방식을 지정하세요 (점수, 개선점 등)\n"
            "- 면접 종료 조건을 설정하세요\n\n"
            "💡 팁: 역할극은 AI에게 상황과 규칙을 명확히 줄수록 효과적입니다!"
        ),
        "difficulty": "medium",
        "category": "고급 프롬프팅 기법",
        "steps": [
            "면접관 역할 설정 방법을 생각해보세요.",
            "직종, 회사, 면접 유형을 어떻게 명시할지 계획하세요.",
            "피드백 형식과 종료 조건을 설계하세요.",
            "역할극 규칙과 피드백 방식을 포함한 초안을 작성하세요.",
            "역할극 흐름이 자연스러운지 점검하고 완성하세요.",
        ],
        "rubric": {
            "criteria": [
                {"name": "역할 설정",   "description": "AI 면접관 역할이 구체적으로 설정되어 있는가", "weight": 0.25, "max_score": 10},
                {"name": "상황 설정",   "description": "직종, 회사, 면접 유형이 명시되어 있는가",     "weight": 0.25, "max_score": 10},
                {"name": "피드백 설계", "description": "피드백 방식과 기준이 명확한가",               "weight": 0.25, "max_score": 10},
                {"name": "종료 조건",   "description": "면접 종료 조건이 설정되어 있는가",            "weight": 0.15, "max_score": 10},
                {"name": "역할극 완성도", "description": "전체 역할극 흐름이 자연스럽고 완성도 있는가", "weight": 0.10, "max_score": 10},
            ],
            "evaluation_guidelines": "취업 면접 역할극 프롬프트를 평가합니다."
        },
    },

    # ══ 카테고리: 실전 프롬프트 엔지니어링 (hard) ════════
    {
        "title": "데이터 분석 보고서 자동화 프롬프트",
        "description": (
            "판매 데이터를 분석하여 경영진에게 보고할 보고서를 자동 생성하는 프롬프트를 작성하세요.\n\n"
            "📌 제공 데이터: 월별 제품별 판매량, 매출, 고객 유형, 반환율\n\n"
            "📌 요구사항:\n"
            "- 보고서 섹션 구조를 명확히 지정하세요\n"
            "- 필수 분석 항목을 지정하세요\n"
            "- 비전문가도 이해할 수 있는 언어를 요구하세요\n"
            "- 실행 가능한 권고사항 도출을 요청하세요\n\n"
            "💡 팁: 구조화된 출력 요청이 보고서 품질을 결정합니다!"
        ),
        "difficulty": "hard",
        "category": "실전 프롬프트 엔지니어링",
        "steps": [
            "비즈니스 데이터 분석에서 중요한 항목들을 파악하세요.",
            "경영진 보고서의 일반적인 구조를 설계하세요.",
            "필수 분석 항목과 계산 기준을 어떻게 명시할지 결정하세요.",
            "데이터 설명, 분석 지시, 보고서 형식을 포함한 초안을 작성하세요.",
            "최종 프롬프트를 검토하고 완성하세요.",
        ],
        "rubric": {
            "criteria": [
                {"name": "구조화",    "description": "보고서 섹션과 구조가 명확하게 지정되어 있는가",    "weight": 0.20, "max_score": 10},
                {"name": "분석 항목", "description": "필수 분석 항목이 포함되어 있는가",                "weight": 0.25, "max_score": 10},
                {"name": "계산 명시", "description": "수치 계산 방법이나 기준이 명확히 지정되어 있는가", "weight": 0.20, "max_score": 10},
                {"name": "독자 고려", "description": "비전문가도 이해할 언어/설명 수준이 지정되어 있는가", "weight": 0.15, "max_score": 10},
                {"name": "실행 가능성", "description": "실행 가능한 권고사항 도출을 요청했는가",         "weight": 0.20, "max_score": 10},
            ],
            "evaluation_guidelines": "데이터 분석 보고서 자동화 프롬프트를 평가합니다."
        },
    },
    {
        "title": "멀티턴 학습 코치 시스템 프롬프트 설계",
        "description": (
            "여러 번의 대화를 통해 학생을 지도하는 AI 학습 코치 시스템 프롬프트를 설계하세요.\n\n"
            "📌 요구사항:\n"
            "- 학습자의 현재 수준을 먼저 파악하는 프로세스를 설계하세요\n"
            "- 이전 대화 내용을 기억하고 연속성을 유지하도록 하세요\n"
            "- 학습자의 이해도에 따라 난이도를 조절하도록 설계하세요\n"
            "- 정답을 바로 주지 않고 힌트로 유도하는 소크라테스식 방법을 적용하세요\n\n"
            "💡 팁: 시스템 프롬프트는 AI의 전반적인 행동 방식을 정의하는 가장 강력한 도구입니다!"
        ),
        "difficulty": "hard",
        "category": "실전 프롬프트 엔지니어링",
        "steps": [
            "멀티턴 대화에서 AI가 유지해야 할 컨텍스트가 무엇인지 파악하세요.",
            "소크라테스식 교육 방법을 AI 프롬프트로 어떻게 표현할지 생각해보세요.",
            "학습자 수준 파악 → 맞춤 지도 → 이해도 확인 → 진도 요약 흐름을 설계하세요.",
            "위 흐름을 구현하는 시스템 프롬프트 초안을 작성하세요.",
            "최종 프롬프트를 완성하세요.",
        ],
        "rubric": {
            "criteria": [
                {"name": "시스템 설계",    "description": "AI의 전반적 행동 원칙이 명확하게 정의되어 있는가", "weight": 0.25, "max_score": 10},
                {"name": "적응형 교육",    "description": "학습자 수준에 따른 난이도 조절이 설계되어 있는가", "weight": 0.20, "max_score": 10},
                {"name": "소크라테스식 유도", "description": "정답 직접 제공 대신 힌트로 유도하는 방식이 있는가", "weight": 0.25, "max_score": 10},
                {"name": "연속성 유지",    "description": "대화 맥락과 이전 내용을 유지하도록 설계되어 있는가", "weight": 0.15, "max_score": 10},
                {"name": "진도 추적",      "description": "학습 진도 추적과 요약 기능이 설계되어 있는가",      "weight": 0.15, "max_score": 10},
            ],
            "evaluation_guidelines": "멀티턴 학습 코치 시스템 프롬프트를 평가합니다."
        },
    },
    {
        "title": "프롬프트 인젝션 방어 시스템 설계",
        "description": (
            "외부 입력으로 인한 프롬프트 인젝션 공격을 방어하는 프롬프트를 설계하세요.\n\n"
            "📌 시나리오: 고객 서비스 챗봇에 사용될 프롬프트\n\n"
            "📌 요구사항:\n"
            "- 챗봇의 역할과 허용 범위를 명확히 정의하세요\n"
            "- 민감한 정보 노출을 방지하세요\n"
            "- 역할 이탈 시도를 탐지하고 정중히 거부하는 방법을 설계하세요\n"
            "- 보안과 유용성 사이의 균형을 맞추세요\n\n"
            "💡 팁: 방어는 '무조건 거부'가 아니라 '경계 내에서 최대한 도움'이 되어야 해요!"
        ),
        "difficulty": "hard",
        "category": "실전 프롬프트 엔지니어링",
        "steps": [
            "프롬프트 인젝션이 무엇인지, 어떤 공격 패턴이 있는지 파악하세요.",
            "고객 서비스 챗봇의 허용 범위와 금지 사항을 명확히 정의해보세요.",
            "인젝션 공격 시도를 탐지하고 처리하는 방법을 설계하세요.",
            "역할 범위, 보안 경계, 거부 방식을 포함한 초안을 작성하세요.",
            "최종 프롬프트를 완성하세요.",
        ],
        "rubric": {
            "criteria": [
                {"name": "방어 메커니즘", "description": "인젝션 공격을 탐지하고 처리하는 명확한 지시가 있는가", "weight": 0.30, "max_score": 10},
                {"name": "경계 설정",     "description": "허용 범위와 금지 사항이 명확하게 정의되어 있는가",    "weight": 0.25, "max_score": 10},
                {"name": "우회 대응",     "description": "다양한 우회 시도에 대한 대응이 있는가",              "weight": 0.20, "max_score": 10},
                {"name": "유용성 유지",   "description": "보안을 유지하면서도 합법적 요청을 처리하는 균형이 있는가", "weight": 0.15, "max_score": 10},
                {"name": "명확성",        "description": "전체 프롬프트가 명확하고 모호하지 않은가",            "weight": 0.10, "max_score": 10},
            ],
            "evaluation_guidelines": "프롬프트 인젝션 방어 시스템 프롬프트를 평가합니다."
        },
    },

    # ══ 카테고리: 디버깅 / 정보 요약 / 실전 응용 (mixed) ══
    {
        "title": "Python 오류 로그를 보고 원인 분석 요청하기",
        "description": (
            "에러 메시지와 실행 환경 정보를 주고, 원인 후보와 재현 절차를 단계적으로 "
            "설명해 주는 디버깅 프롬프트를 작성하세요."
        ),
        "difficulty": "medium",
        "category": "디버깅",
        "steps": [
            "문제 요구사항과 사용자 상황을 먼저 정리하세요.",
            "AI의 역할, 입력 정보, 출력 형식을 어떻게 지정할지 계획하세요.",
            "조건과 제약을 빠뜨리지 않도록 초안을 작성하세요.",
            "검증 기준과 개선 지시를 추가해 프롬프트를 다듬으세요.",
            "최종 프롬프트가 목적과 형식 요구를 모두 만족하는지 점검하세요.",
        ],
        "rubric": {
            "criteria": [
                {"name": "목표 명확성", "description": "수행 목표가 구체적인가",           "weight": 0.25, "max_score": 10},
                {"name": "맥락 제공",   "description": "문제 상황과 정보가 충분한가",      "weight": 0.20, "max_score": 10},
                {"name": "출력 지시",   "description": "원하는 결과 형식이 명확한가",      "weight": 0.20, "max_score": 10},
                {"name": "제약 조건",   "description": "주의사항과 검증 기준이 포함되었는가", "weight": 0.20, "max_score": 10},
                {"name": "개선 가능성", "description": "수정/반복을 유도하는 장치가 있는가", "weight": 0.15, "max_score": 10},
            ],
            "evaluation_guidelines": "디버깅 프롬프트의 구조적 완성도를 평가합니다."
        },
    },
    {
        "title": "과학 기사 요약과 신뢰도 평가하기",
        "description": (
            "긴 과학 기사에서 핵심 주장, 근거, 한계, 추가 확인 포인트를 정리하는 "
            "요약 프롬프트를 작성하세요."
        ),
        "difficulty": "easy",
        "category": "정보 요약",
        "steps": [
            "문제 요구사항과 사용자 상황을 먼저 정리하세요.",
            "AI의 역할, 입력 정보, 출력 형식을 어떻게 지정할지 계획하세요.",
            "조건과 제약을 빠뜨리지 않도록 초안을 작성하세요.",
            "검증 기준과 개선 지시를 추가해 프롬프트를 다듬으세요.",
            "최종 프롬프트가 목적과 형식 요구를 모두 만족하는지 점검하세요.",
        ],
        "rubric": {
            "criteria": [
                {"name": "목표 명확성", "description": "수행 목표가 구체적인가",           "weight": 0.25, "max_score": 10},
                {"name": "맥락 제공",   "description": "문제 상황과 정보가 충분한가",      "weight": 0.20, "max_score": 10},
                {"name": "출력 지시",   "description": "원하는 결과 형식이 명확한가",      "weight": 0.20, "max_score": 10},
                {"name": "제약 조건",   "description": "주의사항과 검증 기준이 포함되었는가", "weight": 0.20, "max_score": 10},
                {"name": "개선 가능성", "description": "수정/반복을 유도하는 장치가 있는가", "weight": 0.15, "max_score": 10},
            ],
            "evaluation_guidelines": "정보 요약 프롬프트의 구조적 완성도를 평가합니다."
        },
    },
    {
        "title": "면접 답변을 STAR 형식으로 재작성하기",
        "description": (
            "학생의 초안 답변을 받아 STAR 형식으로 재구성하고 보완점을 제안하는 "
            "프롬프트를 작성하세요."
        ),
        "difficulty": "medium",
        "category": "실전 응용",
        "steps": [
            "문제 요구사항과 사용자 상황을 먼저 정리하세요.",
            "AI의 역할, 입력 정보, 출력 형식을 어떻게 지정할지 계획하세요.",
            "조건과 제약을 빠뜨리지 않도록 초안을 작성하세요.",
            "검증 기준과 개선 지시를 추가해 프롬프트를 다듬으세요.",
            "최종 프롬프트가 목적과 형식 요구를 모두 만족하는지 점검하세요.",
        ],
        "rubric": {
            "criteria": [
                {"name": "목표 명확성", "description": "수행 목표가 구체적인가",           "weight": 0.25, "max_score": 10},
                {"name": "맥락 제공",   "description": "문제 상황과 정보가 충분한가",      "weight": 0.20, "max_score": 10},
                {"name": "출력 지시",   "description": "원하는 결과 형식이 명확한가",      "weight": 0.20, "max_score": 10},
                {"name": "제약 조건",   "description": "주의사항과 검증 기준이 포함되었는가", "weight": 0.20, "max_score": 10},
                {"name": "개선 가능성", "description": "수정/반복을 유도하는 장치가 있는가", "weight": 0.15, "max_score": 10},
            ],
            "evaluation_guidelines": "실전 응용 프롬프트의 구조적 완성도를 평가합니다."
        },
    },
    {
        "title": "영어 발표 스크립트를 청중 수준에 맞게 조정하기",
        "description": (
            "같은 발표 내용을 초급 학습자용과 일반 청중용으로 각각 바꿔 쓰게 하는 "
            "프롬프트를 작성하세요."
        ),
        "difficulty": "medium",
        "category": "언어 표현",
        "steps": [
            "문제 요구사항과 사용자 상황을 먼저 정리하세요.",
            "AI의 역할, 입력 정보, 출력 형식을 어떻게 지정할지 계획하세요.",
            "조건과 제약을 빠뜨리지 않도록 초안을 작성하세요.",
            "검증 기준과 개선 지시를 추가해 프롬프트를 다듬으세요.",
            "최종 프롬프트가 목적과 형식 요구를 모두 만족하는지 점검하세요.",
        ],
        "rubric": {
            "criteria": [
                {"name": "목표 명확성", "description": "수행 목표가 구체적인가",           "weight": 0.25, "max_score": 10},
                {"name": "맥락 제공",   "description": "문제 상황과 정보가 충분한가",      "weight": 0.20, "max_score": 10},
                {"name": "출력 지시",   "description": "원하는 결과 형식이 명확한가",      "weight": 0.20, "max_score": 10},
                {"name": "제약 조건",   "description": "주의사항과 검증 기준이 포함되었는가", "weight": 0.20, "max_score": 10},
                {"name": "개선 가능성", "description": "수정/반복을 유도하는 장치가 있는가", "weight": 0.15, "max_score": 10},
            ],
            "evaluation_guidelines": "언어 표현 프롬프트의 구조적 완성도를 평가합니다."
        },
    },
    {
        "title": "데이터 표를 읽고 인사이트 3가지 도출하기",
        "description": (
            "표 형태 데이터를 보고 핵심 추세, 이상치, 후속 질문 3가지를 도출하도록 "
            "지시하는 분석 프롬프트를 작성하세요."
        ),
        "difficulty": "hard",
        "category": "데이터 분석",
        "steps": [
            "문제 요구사항과 사용자 상황을 먼저 정리하세요.",
            "AI의 역할, 입력 정보, 출력 형식을 어떻게 지정할지 계획하세요.",
            "조건과 제약을 빠뜨리지 않도록 초안을 작성하세요.",
            "검증 기준과 개선 지시를 추가해 프롬프트를 다듬으세요.",
            "최종 프롬프트가 목적과 형식 요구를 모두 만족하는지 점검하세요.",
        ],
        "rubric": {
            "criteria": [
                {"name": "목표 명확성", "description": "수행 목표가 구체적인가",           "weight": 0.25, "max_score": 10},
                {"name": "맥락 제공",   "description": "문제 상황과 정보가 충분한가",      "weight": 0.20, "max_score": 10},
                {"name": "출력 지시",   "description": "원하는 결과 형식이 명확한가",      "weight": 0.20, "max_score": 10},
                {"name": "제약 조건",   "description": "주의사항과 검증 기준이 포함되었는가", "weight": 0.20, "max_score": 10},
                {"name": "개선 가능성", "description": "수정/반복을 유도하는 장치가 있는가", "weight": 0.15, "max_score": 10},
            ],
            "evaluation_guidelines": "데이터 분석 프롬프트의 구조적 완성도를 평가합니다."
        },
    },
    {
        "title": "학습 계획표를 주차별로 재구성하기",
        "description": (
            "시험일까지 남은 시간을 기준으로 주차별 학습 계획과 복습 루틴을 만들어 주는 "
            "프롬프트를 작성하세요."
        ),
        "difficulty": "easy",
        "category": "학습 계획",
        "steps": [
            "문제 요구사항과 사용자 상황을 먼저 정리하세요.",
            "AI의 역할, 입력 정보, 출력 형식을 어떻게 지정할지 계획하세요.",
            "조건과 제약을 빠뜨리지 않도록 초안을 작성하세요.",
            "검증 기준과 개선 지시를 추가해 프롬프트를 다듬으세요.",
            "최종 프롬프트가 목적과 형식 요구를 모두 만족하는지 점검하세요.",
        ],
        "rubric": {
            "criteria": [
                {"name": "목표 명확성", "description": "수행 목표가 구체적인가",           "weight": 0.25, "max_score": 10},
                {"name": "맥락 제공",   "description": "문제 상황과 정보가 충분한가",      "weight": 0.20, "max_score": 10},
                {"name": "출력 지시",   "description": "원하는 결과 형식이 명확한가",      "weight": 0.20, "max_score": 10},
                {"name": "제약 조건",   "description": "주의사항과 검증 기준이 포함되었는가", "weight": 0.20, "max_score": 10},
                {"name": "개선 가능성", "description": "수정/반복을 유도하는 장치가 있는가", "weight": 0.15, "max_score": 10},
            ],
            "evaluation_guidelines": "학습 계획 프롬프트의 구조적 완성도를 평가합니다."
        },
    },
    {
        "title": "AI 윤리 체크리스트 작성하기",
        "description": (
            "특정 AI 시스템 배포 전 검토해야 할 윤리 체크리스트를 생성하는 "
            "프롬프트를 작성하세요.\n\n"
            "📌 요구사항:\n"
            "- 편향성, 개인정보, 투명성, 책임성 항목을 포함하세요\n"
            "- 각 항목에 구체적인 점검 방법을 지시하세요\n"
            "- 배포 유형(의료, 교육, 금융 등)에 맞춰 조정 가능하게 설계하세요\n"
        ),
        "difficulty": "hard",
        "category": "AI 윤리",
        "steps": [
            "AI 윤리의 핵심 원칙들을 파악하세요.",
            "각 윤리 항목에 대한 점검 방법을 생각해보세요.",
            "배포 유형별 맞춤 조정이 가능한 구조를 설계하세요.",
            "체크리스트 형식과 항목을 포함한 초안을 작성하세요.",
            "완성도를 점검하고 최종본을 완성하세요.",
        ],
        "rubric": {
            "criteria": [
                {"name": "윤리 항목 포괄성", "description": "편향성, 개인정보, 투명성, 책임성이 모두 포함되는가", "weight": 0.30, "max_score": 10},
                {"name": "점검 방법",         "description": "각 항목에 구체적인 점검 방법이 지시되어 있는가",     "weight": 0.25, "max_score": 10},
                {"name": "맞춤 조정 가능성",  "description": "배포 유형별 조정이 가능한 구조인가",               "weight": 0.20, "max_score": 10},
                {"name": "실용성",            "description": "실제로 사용 가능한 수준의 체크리스트인가",          "weight": 0.15, "max_score": 10},
                {"name": "명확성",            "description": "전체 프롬프트가 명확하고 완결성이 있는가",          "weight": 0.10, "max_score": 10},
            ],
            "evaluation_guidelines": "AI 윤리 체크리스트 프롬프트를 평가합니다."
        },
    },
    {
        "title": "고객 리뷰 감성 분석 및 개선안 도출",
        "description": (
            "제품 리뷰 데이터에서 주요 불만사항을 분류하고 우선순위별 개선안을 "
            "도출하는 프롬프트를 작성하세요.\n\n"
            "📌 요구사항:\n"
            "- 긍정/부정/개선 요청으로 분류하세요\n"
            "- 빈도 기반 우선순위를 정하세요\n"
            "- 각 카테고리별 대표 인사이트를 요약하세요\n"
        ),
        "difficulty": "hard",
        "category": "데이터 분석",
        "steps": [
            "리뷰 분석에서 중요한 분류 체계를 설계하세요.",
            "각 카테고리의 정의와 분류 기준을 명확히 하세요.",
            "우선순위 산정 방식을 어떻게 지시할지 계획하세요.",
            "분류, 우선순위, 인사이트 추출을 포함한 초안을 작성하세요.",
            "최종 프롬프트를 완성하세요.",
        ],
        "rubric": {
            "criteria": [
                {"name": "분류 체계",   "description": "분류 카테고리가 명확하고 체계적인가",        "weight": 0.25, "max_score": 10},
                {"name": "우선순위",    "description": "빈도 기반 우선순위 산정 방식이 명시되어 있는가", "weight": 0.25, "max_score": 10},
                {"name": "인사이트 추출", "description": "카테고리별 대표 인사이트 요약을 요청했는가", "weight": 0.25, "max_score": 10},
                {"name": "실용성",      "description": "실제 의사결정에 활용 가능한 수준인가",        "weight": 0.15, "max_score": 10},
                {"name": "명확성",      "description": "전체 프롬프트가 명확한가",                   "weight": 0.10, "max_score": 10},
            ],
            "evaluation_guidelines": "고객 리뷰 분석 프롬프트를 평가합니다."
        },
    },
    {
        "title": "교육용 퀴즈 자동 생성기 설계",
        "description": (
            "특정 학습 목표에 맞는 퀴즈 문제를 자동으로 생성하는 프롬프트를 설계하세요.\n\n"
            "📌 요구사항:\n"
            "- 난이도별(easy/medium/hard) 문제 유형을 지정하세요\n"
            "- 4지선다, OX, 단답형 중 유형을 선택 가능하게 하세요\n"
            "- 정답과 해설도 함께 생성하도록 요청하세요\n"
            "- 학습 목표와 출제 범위를 입력받도록 설계하세요\n"
        ),
        "difficulty": "medium",
        "category": "교육 설계",
        "steps": [
            "퀴즈 생성기에서 필요한 입력 요소들을 파악하세요.",
            "난이도별, 유형별 문제 구조를 설계하세요.",
            "정답과 해설 포함 방식을 계획하세요.",
            "학습 목표, 범위, 문제 유형, 해설을 포함한 초안을 작성하세요.",
            "최종 프롬프트를 완성하세요.",
        ],
        "rubric": {
            "criteria": [
                {"name": "난이도 설계",  "description": "난이도별 문제 유형이 명확하게 지정되어 있는가", "weight": 0.25, "max_score": 10},
                {"name": "문제 유형",    "description": "다양한 문제 유형(4지선다, OX 등)이 포함되어 있는가", "weight": 0.20, "max_score": 10},
                {"name": "정답·해설",   "description": "정답과 해설 생성을 요청했는가",                 "weight": 0.25, "max_score": 10},
                {"name": "입력 구조",    "description": "학습 목표와 범위를 입력받는 구조인가",          "weight": 0.20, "max_score": 10},
                {"name": "실용성",       "description": "실제 교육 환경에 활용 가능한 수준인가",         "weight": 0.10, "max_score": 10},
            ],
            "evaluation_guidelines": "교육용 퀴즈 자동 생성기 프롬프트를 평가합니다."
        },
    },
]

# ══════════════════════════════════════════════════════
# 탈락 유형별 시나리오 정의
# ══════════════════════════════════════════════════════
# 각 항목: (total_risk, base_risk, event_bonus, thinking_risk, risk_stage, dropout_type, final_score, days_ago_offset)
# dropout_type: cognitive / none / motivational / strategic / sudden / dependency / compound

STUDENT_SCENARIOS = [
    # ── 김민준 (cognitive): 인지 격차형 ── 개념 이해 부족, 점수 하락세
    {
        "dropout_type": "cognitive",
        "scenarios": [
            (42.0, 30.0, 7.0,  5.0,  "경미",   "cognitive", 72, 20),
            (55.0, 40.0, 9.0,  6.0,  "주의",   "cognitive", 58, 15),
            (65.0, 47.0, 11.0, 7.0,  "주의",   "cognitive", 50, 10),
            (72.0, 52.0, 12.0, 8.0,  "고위험", "cognitive", 42, 5),
            (75.0, 54.0, 13.0, 8.0,  "고위험", "cognitive", 38, 2),
        ],
        "interventions": [
            ("resource", "completed", 8, "개념 이해 격차를 보완할 기초 자료를 공유했습니다. 이차방정식 예시 프롬프트 3종을 첨부했습니다."),
            ("message",  "pending",   3, "최근 제출 점수가 계속 하락하고 있습니다. 프롬프트 구조화 방법부터 다시 점검해보도록 안내했습니다."),
            ("meeting",  "pending",   1, "1:1 면담을 통해 개념 이해 수준을 직접 확인하고 맞춤 학습 계획을 세울 예정입니다."),
        ],
        "notes": [
            "역할 정의와 출력 형식 지시는 하고 있지만, 제약 조건 명시가 반복적으로 누락됩니다. 다음 면담에서 체크리스트 활용을 유도할 것.",
            "프롬프트 구조는 점점 나빠지고 있음. 기초 개념부터 다시 점검 필요.",
        ],
        "coach_messages": [
            ("프롬프트에서 역할 정의는 잘 하셨어요! 하지만 제약 조건이 빠져 있어요. '출력은 3문장 이내로'처럼 분량 제약을 추가해보세요.", "['제약 조건 추가', '출력 형식 명시', '예시 요청 포함']"),
            ("개념 설명 프롬프트는 역할 + 대상 + 요청 + 제약 4가지가 모두 있어야 해요. 지금은 제약이 없네요.", "['4요소 체크', '분량 지정', '학습자 수준 고려']"),
        ],
    },

    # ── 이서연 (none): 안정형 ── 꾸준히 좋은 성과
    {
        "dropout_type": "none",
        "scenarios": [
            (22.0, 16.0, 4.0, 2.0, "안정", "none", 88, 18),
            (18.0, 13.0, 3.0, 2.0, "안정", "none", 92, 12),
            (20.0, 14.0, 4.0, 2.0, "안정", "none", 89, 7),
            (15.0, 11.0, 2.0, 2.0, "안정", "none", 95, 3),
        ],
        "interventions": [],
        "notes": [
            "꾸준히 높은 점수를 유지하고 있습니다. 제약 조건과 예시 요청을 항상 포함하는 좋은 습관을 보여주고 있어요."
        ],
        "coach_messages": [
            ("정말 잘 하고 있어요! 역할, 대상, 출력 형식, 제약이 모두 균형 있게 들어가 있어요. 이 구조를 다른 문제에도 적용해보세요.", "['현재 구조 유지', '다른 문제 유형에 적용', '심화 기법 시도']"),
            ("이번 프롬프트도 훌륭해요. Few-Shot 예시를 하나 더 추가하면 결과 품질이 더 올라갈 수 있어요!", "['Few-Shot 예시 추가', '조건 명확화', '반복 테스트']"),
        ],
    },

    # ── 박도윤 (motivational): 동기 저하형 ── 점점 참여 줄어듦
    {
        "dropout_type": "motivational",
        "scenarios": [
            (38.0, 27.0, 7.0,  4.0,  "경미",   "motivational", 68, 30),
            (48.0, 35.0, 8.0,  5.0,  "경미",   "motivational", 60, 22),
            (62.0, 45.0, 11.0, 6.0,  "주의",   "motivational", 48, 16),
            (74.0, 53.0, 13.0, 8.0,  "고위험", "motivational", 35, 10),
            (80.0, 57.0, 14.0, 9.0,  "고위험", "motivational", 28, 5),
        ],
        "interventions": [
            ("message",  "completed", 12, "참여 빈도가 줄어든 것을 확인했습니다. 짧은 격려 메시지를 보내 작은 목표부터 다시 시작하도록 안내했습니다."),
            ("meeting",  "pending",   4,  "동기 저하 원인을 파악하기 위한 1:1 면담을 예약했습니다. 학습 환경과 어려움을 직접 들어볼 예정입니다."),
            ("resource", "pending",   1,  "흥미를 되살릴 수 있는 실생활 응용 프롬프트 예시 모음을 공유했습니다."),
        ],
        "notes": [
            "초반에는 참여도가 높았으나 최근 제출 간격이 길어지고 있습니다. 외적 동기 부여가 필요해 보입니다.",
            "제출 시 프롬프트 품질이 점점 낮아지고 있음. 최소한의 형식도 지키지 않는 경향이 있음.",
        ],
        "coach_messages": [
            ("다시 돌아와 주셔서 반가워요! 프롬프트의 역할 설정 부분이 좋아요. 지금 작은 시도를 하고 있다는 게 중요해요.", "['작은 목표 설정', '역할 정의 유지', '포기하지 말기']"),
            ("오늘 제출한 게 정말 용기 있는 행동이에요! 조금 더 구체적인 출력 형식을 추가해보면 어떨까요?", "['출력 형식 추가', '분량 지정', '단계별 접근']"),
        ],
    },

    # ── 최지우 (strategic): 전략 부재형 ── 일관성 없는 접근, 지그재그 점수
    {
        "dropout_type": "strategic",
        "scenarios": [
            (58.0, 42.0, 10.0, 6.0, "주의",   "strategic", 65, 25),
            (45.0, 33.0, 7.0,  5.0, "경미",   "strategic", 78, 20),
            (68.0, 49.0, 12.0, 7.0, "주의",   "strategic", 52, 14),
            (42.0, 30.0, 7.0,  5.0, "경미",   "strategic", 80, 9),
            (72.0, 52.0, 12.0, 8.0, "고위험", "strategic", 45, 3),
        ],
        "interventions": [
            ("resource", "completed", 10, "일관된 프롬프트 작성 전략이 부족해 보입니다. 구조화 템플릿과 자기 점검 체크리스트를 공유했습니다."),
            ("message",  "pending",   3,  "점수가 들쭉날쭉합니다. 매번 다른 방식보다 검증된 구조를 반복 연습하도록 안내했습니다."),
        ],
        "notes": [
            "점수 편차가 너무 큽니다. 잘 될 때와 안 될 때의 차이가 전략의 일관성 여부에 있어 보입니다.",
            "성공 경험이 있는 프롬프트 구조를 정리하고 반복 적용하도록 지도 필요.",
        ],
        "coach_messages": [
            ("이번 제출은 구조가 아주 명확해요! 지난번에 이 구조를 썼을 때도 잘 됐죠? 이 방식을 일관되게 적용해보세요.", "['성공한 구조 반복', '일관성 유지', '매번 체크리스트 활용']"),
            ("프롬프트 구조가 매번 달라지고 있어요. 역할-맥락-요청-제약 4단계를 항상 순서대로 확인해보세요.", "['4단계 구조 고수', '이전 성공 패턴 분석', '체크리스트 활용']"),
        ],
    },

    # ── 정하은 (sudden): 급변형 ── 갑자기 점수 폭락
    {
        "dropout_type": "sudden",
        "scenarios": [
            (18.0, 13.0, 3.0,  2.0,  "안정",   "none",    90, 30),
            (20.0, 14.0, 4.0,  2.0,  "안정",   "none",    88, 24),
            (22.0, 16.0, 3.0,  3.0,  "안정",   "none",    92, 18),
            (78.0, 55.0, 14.0, 9.0,  "고위험", "sudden",  35, 8),
            (85.0, 60.0, 15.0, 10.0, "고위험", "sudden",  28, 3),
        ],
        "interventions": [
            ("alert",   "pending",   5, "이전까지 안정적이었던 학생이 갑자기 위험 단계로 진입했습니다. 즉각적인 상담이 필요합니다."),
            ("meeting", "pending",   4, "급격한 성과 하락 원인 파악을 위한 긴급 면담을 요청했습니다. 외부 요인(개인 상황, 스트레스)을 먼저 확인할 예정입니다."),
            ("message", "completed", 3, "최근 변화를 감지했습니다. 어려운 상황이 있다면 언제든 이야기해도 된다는 메시지를 전달했습니다."),
        ],
        "notes": [
            "이전까지 최상위권이었는데 갑작스러운 하락이 발생했습니다. 개인적 사유가 있는지 먼저 확인이 필요합니다.",
            "3주 전부터 제출 내용이 급격히 부실해졌습니다. 단순 학업 문제가 아닐 수 있습니다.",
        ],
        "coach_messages": [
            ("이전에 정말 훌륭한 프롬프트를 작성했던 기억이 나요! 지금 잠깐 어렵더라도 예전 방식대로 역할 설정부터 다시 시작해보면 어떨까요?", "['이전 성공 패턴 복기', '기본 구조부터 시작', '천천히 회복']"),
            ("요즘 힘든 일이 있나요? 프롬프트보다 지금 컨디션이 더 중요해요. 작은 것 하나씩만 해봐요.", "['컨디션 회복 우선', '작은 목표', '도움 요청 가능']"),
        ],
    },

    # ── 강시우 (dependency): 의존형 ── 많은 시도, 낮은 독립성
    {
        "dropout_type": "dependency",
        "scenarios": [
            (52.0, 38.0, 9.0,  5.0, "주의", "dependency", 62, 22),
            (55.0, 40.0, 9.0,  6.0, "주의", "dependency", 60, 17),
            (58.0, 42.0, 10.0, 6.0, "주의", "dependency", 58, 12),
            (60.0, 44.0, 10.0, 6.0, "주의", "dependency", 55, 7),
            (62.0, 45.0, 11.0, 6.0, "주의", "dependency", 52, 2),
        ],
        "interventions": [
            ("message",  "completed", 9, "자신만의 프롬프트 전략을 개발하도록 독려했습니다. 예시 복사보다 원리 이해에 집중하도록 안내했습니다."),
            ("resource", "completed", 4, "독립적 문제 해결을 연습하는 연습 문제 세트를 제공했습니다. 예시 없이 혼자 작성하는 훈련입니다."),
        ],
        "notes": [
            "예시 프롬프트를 많이 참고하지만 자신만의 응용이 부족합니다. 패턴 암기보다 원리 이해를 강조해야 합니다.",
            "시도 횟수는 많지만 매번 비슷한 실수를 반복합니다. 오류 분석 능력을 키워야 합니다.",
        ],
        "coach_messages": [
            ("이번엔 예시 없이 스스로 작성해봤군요! 독립적으로 시도하는 게 중요해요. 역할 설정 방식이 특히 좋았어요.", "['독립적 작성 시도', '원리 이해 강화', '오류 패턴 분석']"),
            ("비슷한 실수가 반복되고 있어요. 제출 후 '어떤 부분이 안 됐지?'라고 스스로 물어보는 습관을 길러보세요.", "['오류 패턴 분석', '자기 점검 습관', '독립적 수정']"),
        ],
    },

    # ── 윤아린 (compound): 복합 위험형 ── 여러 요인 동시 위험
    {
        "dropout_type": "compound",
        "scenarios": [
            (72.0, 52.0, 12.0, 8.0,  "고위험", "compound", 40, 28),
            (80.0, 57.0, 14.0, 9.0,  "고위험", "compound", 32, 22),
            (88.0, 62.0, 16.0, 10.0, "고위험", "compound", 25, 15),
            (92.0, 65.0, 17.0, 10.0, "심각",   "compound", 20, 8),
            (95.0, 68.0, 17.0, 10.0, "심각",   "compound", 15, 2),
        ],
        "interventions": [
            ("alert",    "pending",   6, "복합적 위험 요인이 동시에 악화되고 있습니다. 즉시 교수자 개입이 필요합니다."),
            ("meeting",  "pending",   5, "긴급 면담을 예약했습니다. 학습 동기, 이해도, 참여율 모두 동시에 낮아지고 있어 종합 상담이 필요합니다."),
            ("message",  "completed", 3, "혼자 감당하기 어려운 상황이라면 도움을 요청해도 된다고 전달했습니다."),
            ("resource", "pending",   1, "기초부터 다시 시작하는 스텝별 가이드를 제공했습니다."),
        ],
        "notes": [
            "참여율, 점수, 제출 빈도, 전략 일관성 모두 동시에 낮아지고 있습니다. 단일 개입으로는 부족하며 종합적 지원이 필요합니다.",
            "이 학생은 지금 학습 자체에 대한 자신감이 많이 떨어진 것 같습니다. 심리적 지원도 함께 고려해야 합니다.",
        ],
        "coach_messages": [
            ("지금 많이 힘들죠? 하지만 오늘 제출한 것 자체가 정말 용기 있는 행동이에요. 역할 정의 한 문장부터 시작해봐요.", "['한 번에 하나씩', '기본 역할 정의', '포기하지 않기']"),
            ("조금씩이라도 나아지고 있어요. 지금 작성한 프롬프트에서 좋은 부분을 찾아볼게요. 역할 설정이 이전보다 구체적이에요.", "['강점 찾기', '작은 진전 인식', '체크리스트 활용']"),
        ],
    },

    # ── 임주원 (cognitive): 인지 회복 중 ── 처음엔 부진, 점점 나아짐
    {
        "dropout_type": "cognitive",
        "scenarios": [
            (70.0, 50.0, 12.0, 8.0, "고위험", "cognitive", 40, 24),
            (65.0, 47.0, 11.0, 7.0, "주의",   "cognitive", 50, 18),
            (58.0, 42.0, 10.0, 6.0, "주의",   "cognitive", 60, 12),
            (48.0, 35.0, 8.0,  5.0, "경미",   "cognitive", 68, 6),
            (38.0, 28.0, 6.0,  4.0, "경미",   "cognitive", 75, 2),
        ],
        "interventions": [
            ("resource", "completed", 18, "지식 격차를 메우기 위한 기초 프롬프팅 자료를 공유했습니다. 꾸준히 학습 중입니다."),
            ("message",  "completed", 8,  "개선되고 있는 점수를 언급하며 격려 메시지를 보냈습니다. 계속 이 방향으로 노력하도록 응원했습니다."),
        ],
        "notes": [
            "초반 개념 이해가 부족했지만 꾸준한 학습으로 점차 개선되고 있습니다. 이 흐름을 유지하도록 격려 필요.",
            "제약 조건 명시가 이전보다 훨씬 나아졌습니다. 이제 예시 요청까지 일관되게 넣는 연습이 필요합니다.",
        ],
        "coach_messages": [
            ("점점 나아지고 있어요! 이번엔 역할 정의와 대상 명시를 함께 넣었네요. 다음엔 제약 조건도 추가해보세요.", "['현재 성장 인식', '제약 조건 추가', '지속 개선']"),
            ("훌륭해요! 이번 프롬프트는 이전 것보다 확실히 좋아졌어요. 예시 요청을 넣으면 더욱 완성도가 올라갈 거예요.", "['예시 요청 추가', '구조 유지', '성장 지속']"),
        ],
    },
]


def _clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def _submission_prompt(student_name: str, problem: Problem, seq: int, stage: str,
                       total_risk: float, dropout_type: str) -> str:
    type_contexts = {
        "cognitive":    "개념 이해에 어려움이 있어 역할 설정은 했지만 제약 조건이 빠져 있다.",
        "none":         "구조적으로 완성도 있는 프롬프트를 작성했다. 역할, 대상, 요청, 제약이 모두 포함되어 있다.",
        "motivational": "최근 참여 의욕이 낮아져 프롬프트 품질이 이전보다 떨어졌다.",
        "strategic":    "일관된 전략 없이 매번 다른 방식으로 접근해 결과가 불안정하다.",
        "sudden":       "이전에는 잘 썼지만 최근 갑작스러운 어려움으로 품질이 급격히 낮아졌다.",
        "dependency":   "예시를 많이 참고하지만 자신만의 응용이 부족하다.",
        "compound":     "여러 요인이 동시에 취약해져 전체적인 완성도가 낮다.",
    }
    ctx = type_contexts.get(dropout_type, "문제 해결을 시도했다.")
    return (
        f"[초안 프롬프트]\n"
        f"{student_name}은(는) '{problem.title}' 문제를 해결하기 위해 AI 역할과 출력 형식을 지정했다.\n\n"
        f"[실행용 프롬프트]\n"
        f"초안을 검토하고 누락된 부분을 보완했다. {ctx}\n\n"
        f"[실행 미리보기 최고 점수]\n"
        f"실행점수 {max(0, min(100, 100 - total_risk * 0.35 + seq * 2)):.1f}\n\n"
        f"[현재 채택 버전]\n"
        f"문제 핵심: {problem.description[:120]}...\n"
        f"역할 정의, 작업 목표, 출력 형식, 확인 절차를 포함했다.\n\n"
        f"[실패 케이스 요약]\n"
        f"{seq}번째 제출. 현재 위험 단계: {stage}, 총 위험도: {total_risk:.1f}.\n\n"
        f"[추천 수정 액션]\n"
        f"{student_name}은(는) 이전 제출보다 구체적인 조건을 추가하고 답변 검증 문장을 보완했다."
    )


def _learning_metrics_payload(student_idx: int, seq: int, total: float, thinking: float,
                               dropout_type: str) -> dict:
    risk_norm = total / 100.0
    thinking_norm = thinking / 25.0

    # 탈락 유형별 메트릭 보정
    adjustments = {
        "cognitive":    {"problem_understanding_score": -0.20, "problem_decomposition_score": -0.18},
        "motivational": {"login_frequency": -0.30, "session_duration": -0.25, "drop_midway_rate": +0.20},
        "strategic":    {"strategy_change_count": +3, "improvement_consistency_score": -0.20},
        "sudden":       {"score_delta": -0.30, "quiz_score_avg": -0.25},
        "dependency":   {"attempt_count": +3, "revision_count": +2, "self_explanation_score": -0.15},
        "compound":     {"task_success_rate": -0.25, "quiz_score_avg": -0.20, "login_frequency": -0.20},
        "none":         {"task_success_rate": +0.10, "quiz_score_avg": +0.08},
    }
    adj = adjustments.get(dropout_type, {})

    def adj_val(key: str, base: float) -> float:
        return base + adj.get(key, 0.0)

    return {
        "login_frequency":             round(_clamp(adj_val("login_frequency",             0.95 - risk_norm * 0.75 + (student_idx % 2) * 0.04), 0.05, 0.98), 3),
        "session_duration":            round(_clamp(adj_val("session_duration",            0.88 - risk_norm * 0.45 + seq * 0.015), 0.08, 0.98), 3),
        "submission_interval":         round(_clamp(0.18 + risk_norm * 0.65, 0.05, 0.98), 3),
        "drop_midway_rate":            round(_clamp(adj_val("drop_midway_rate",            risk_norm * 0.45 - seq * 0.02), 0.0, 0.95), 3),
        "attempt_count":               max(1, 2 + seq + (student_idx % 3) + int(adj.get("attempt_count", 0))),
        "revision_count":              max(0, 1 + seq // 2 + (student_idx % 2) + int(adj.get("revision_count", 0))),
        "retry_count":                 max(0, seq // 3),
        "strategy_change_count":       max(0, (seq + student_idx) % 4 + int(adj.get("strategy_change_count", 0))),
        "task_success_rate":           round(_clamp(adj_val("task_success_rate",           0.92 - risk_norm * 0.62), 0.08, 0.97), 3),
        "quiz_score_avg":              round(_clamp(adj_val("quiz_score_avg",              0.9  - risk_norm * 0.55), 0.10, 0.96), 3),
        "score_delta":                 round(_clamp(adj_val("score_delta",                 0.18 - risk_norm * 0.32 + seq * 0.015), -0.45, 0.35), 3),
        "problem_understanding_score": round(_clamp(adj_val("problem_understanding_score", 0.94 - thinking_norm * 0.4), 0.15, 0.98), 3),
        "problem_decomposition_score": round(_clamp(adj_val("problem_decomposition_score", 0.9  - thinking_norm * 0.35 + seq * 0.02), 0.15, 0.98), 3),
        "constraint_awareness_score":  round(_clamp(0.88 - risk_norm * 0.30, 0.18, 0.97), 3),
        "validation_awareness_score":  round(_clamp(0.86 - risk_norm * 0.28 + seq * 0.02, 0.15, 0.98), 3),
        "improvement_prompt_score":    round(_clamp(0.83 - risk_norm * 0.22 + seq * 0.03, 0.15, 0.98), 3),
        "self_explanation_score":      round(_clamp(adj_val("self_explanation_score",      0.82 - thinking_norm * 0.25), 0.15, 0.97), 3),
        "reasoning_quality_score":     round(_clamp(0.9  - thinking_norm * 0.38, 0.12, 0.98), 3),
        "reflection_depth_score":      round(_clamp(0.8  - risk_norm * 0.24 + seq * 0.02, 0.12, 0.96), 3),
        "error_analysis_score":        round(_clamp(0.81 - thinking_norm * 0.22 + seq * 0.02, 0.10, 0.96), 3),
        "debugging_quality_score":     round(_clamp(0.78 - risk_norm * 0.20 + seq * 0.03, 0.10, 0.96), 3),
        "decision_reasoning_score":    round(_clamp(0.84 - thinking_norm * 0.26, 0.12, 0.97), 3),
        "approach_selection_score":    round(_clamp(0.85 - risk_norm * 0.24, 0.15, 0.97), 3),
        "improvement_consistency_score": round(_clamp(adj_val("improvement_consistency_score", 0.79 - risk_norm * 0.18 + seq * 0.03), 0.15, 0.98), 3),
        "iteration_quality_score":     round(_clamp(0.8  - thinking_norm * 0.21 + seq * 0.03, 0.15, 0.98), 3),
    }


# ══════════════════════════════════════════════════════
# 실행 함수
# ══════════════════════════════════════════════════════

async def seed(reset: bool = False):
    engine = create_async_engine(DATABASE_URL, echo=False)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        if reset:
            print("⚠️  기존 데이터 삭제 중...")
            # 테이블을 완전히 드롭해서 스키마 변경도 반영
            await conn.run_sync(Base.metadata.drop_all)
            print("✅ 기존 테이블 삭제 완료")
        await conn.run_sync(Base.metadata.create_all)

    async with session_factory() as db:
        # ── 중복 체크 ───────────────────────────────
        existing = await db.execute(select(User).where(User.role == "admin"))
        if existing.scalars().first() and not reset:
            print("ℹ️  이미 시드 데이터가 존재합니다. --reset 옵션으로 재생성 가능합니다.")
            await engine.dispose()
            return

        # ── 1. 관리자 계정 생성 ──────────────────────
        print("\n👤 관리자 계정 생성 중...")
        admin_records = []
        for a in ADMINS:
            user = User(
                id=_uid(), username=a["username"], email=a["email"],
                password_hash=_hash(a["password"]), role=a["role"],
                created_at=_now(30),
            )
            db.add(user)
            admin_records.append(user)
            print(f"   ✅ {a['role']}: {a['email']} / {a['password']}")
        await db.flush()

        # ── 2. 학생 계정 생성 ────────────────────────
        print("\n🎓 학생 계정 생성 중...")
        student_records = []
        for i, s in enumerate(STUDENTS):
            user = User(
                id=_uid(), username=s["username"], email=s["email"],
                password_hash=_hash(s["password"]), role="student",
                helper_points=[6, 42, 4, 18, 12, 9, 2, 24][i],
                created_at=_now(20 - i),
            )
            db.add(user)
            student_records.append(user)
            print(f"   ✅ {s['username']}: {s['email']} ({s['dropout_type']}형)")
        await db.flush()

        # ── 3. 문제 생성 ─────────────────────────────
        print("\n📝 학습 문제 생성 중...")
        problem_records = []
        for p in PROBLEMS:
            reflection_mapping = _reflection_mapping(p)
            prob = Problem(
                id=_uid(), title=p["title"], description=p["description"],
                difficulty=p["difficulty"], category=p["category"],
                steps_json=json.dumps(p.get("steps", []), ensure_ascii=False),
                rubric_json=json.dumps(p.get("rubric", {}), ensure_ascii=False),
                core_concepts_json=json.dumps(p.get("core_concepts", reflection_mapping["core_concepts"]), ensure_ascii=False),
                methodology_json=json.dumps(p.get("methodology", reflection_mapping["methodology"]), ensure_ascii=False),
                concept_check_questions_json=json.dumps(p.get("concept_check_questions", reflection_mapping["concept_check_questions"]), ensure_ascii=False),
                created_at=_now(60),
            )
            db.add(prob)
            problem_records.append(prob)
        print(f"   ✅ 문제 {len(problem_records)}개 생성")
        await db.flush()

        # ── 4. 제출 + 위험도 + 학습지표 생성 ────────
        print("\n📊 제출 이력 및 위험도 데이터 생성 중...")
        total_submissions = 0
        total_metrics = 0

        for idx, (student, scenario_data) in enumerate(zip(student_records, STUDENT_SCENARIOS)):
            dtype = scenario_data["dropout_type"]
            for s_idx, (total, base, event, thinking, stage, sc_dtype, final_score, days_ago) in enumerate(scenario_data["scenarios"]):
                days_ago_adj = days_ago + (idx % 2)
                prob = problem_records[(idx * 3 + s_idx) % len(problem_records)]

                sub = Submission(
                    id=_uid(),
                    student_id=student.id,
                    problem_id=prob.id,
                    prompt_text=_submission_prompt(student.username, prob, s_idx + 1, stage, total, sc_dtype),
                    total_score=float(final_score),
                    final_score=float(final_score),
                    concept_reflection_text=(
                        f"{prob.title}에서 중요한 개념은 역할, 범위, 출력 형식, 검증 기준을 분리하는 것입니다. "
                        f"제가 작성한 프롬프트에는 이 방법론을 단계와 기준으로 넣었고, 왜 필요한지 설명했습니다."
                    ),
                    concept_reflection_score=float(min(96, max(72, final_score + 8))),
                    concept_reflection_passed=True,
                    concept_reflection_feedback="핵심 개념과 설계 방법론 설명이 확인되었습니다.",
                    created_at=_now(days_ago_adj),
                )
                db.add(sub)
                await db.flush()

                risk = RiskScore(
                    id=_uid(), student_id=student.id, submission_id=sub.id,
                    total_risk=total, base_risk=base, event_bonus=event,
                    thinking_risk=thinking, risk_stage=stage, dropout_type=sc_dtype,
                    calculated_at=_now(days_ago_adj),
                )
                db.add(risk)

                metrics = LearningMetrics(
                    id=_uid(),
                    submission_id=sub.id,
                    student_id=student.id,
                    created_at=_now(days_ago_adj),
                    **_learning_metrics_payload(idx, s_idx, total, thinking, sc_dtype),
                )
                db.add(metrics)
                total_submissions += 1
                total_metrics += 1

        print(f"   ✅ 제출 {total_submissions}건 / 위험도 {total_submissions}건 / 학습지표 {total_metrics}건 생성")
        await db.flush()

        # ── 5. 개입 이력 생성 ────────────────────────
        print("\n🛠️  개입 이력 생성 중...")
        count = 0
        for idx, (student, scenario_data) in enumerate(zip(student_records, STUDENT_SCENARIOS)):
            for iv_type, status, days_ago, message in scenario_data["interventions"]:
                iv = Intervention(
                    id=_uid(),
                    student_id=student.id,
                    type=iv_type,
                    message=f"{student.username} 학생 대상: {message}",
                    dropout_type=scenario_data["dropout_type"],
                    status=status,
                    created_at=_now(days_ago),
                )
                db.add(iv)
                count += 1
        print(f"   ✅ 개입 {count}건 생성")

        # ── 5-1. 관리자 문제 추천 생성 ───────────────
        print("\n🎯 관리자 문제 추천 데이터 생성 중...")
        rec_count = 0
        recommendation_plan = [
            (0, 4, "Few-Shot 예시 누락이 반복되어 감성 분류기 문제를 우선 추천합니다."),
            (0, 8, "기초 개념 설명 구조를 다시 잡기 위해 디버깅형 문제를 추가 추천합니다."),
            (2, 11, "동기 회복을 위해 난이도가 낮고 성취감을 얻기 쉬운 학습 계획 문제를 추천합니다."),
            (3, 5, "전략 일관성을 연습할 수 있도록 역할극 면접 문제를 추천합니다."),
            (4, 1, "급격한 하락 이후 부담을 낮추기 위해 쉬운 이메일 작성 문제부터 재시작하도록 추천합니다."),
            (5, 12, "의존형 패턴을 줄이기 위해 스스로 체크리스트를 설계하는 AI 윤리 문제를 추천합니다."),
            (6, 0, "복합 위험군이라 가장 쉬운 기본 프롬프팅 문제부터 다시 시작하도록 추천합니다."),
            (7, 6, "회복 흐름을 이어가도록 데이터 분석 보고서 문제를 심화 추천합니다."),
        ]
        for rec_idx, problem_idx, reason in recommendation_plan:
            rec = ProblemRecommendation(
                id=_uid(),
                student_id=student_records[rec_idx].id,
                problem_id=problem_records[problem_idx % len(problem_records)].id,
                admin_id=admin_records[rec_idx % len(admin_records)].id,
                reason=reason,
                is_active=True,
                created_at=_now(rec_idx % 5),
            )
            db.add(rec)
            rec_count += 1
        print(f"   ✅ 문제 추천 {rec_count}건 생성")

        # ── 6. 관리자 메모 생성 ─────────────────────
        print("\n🗒️  관리자 메모 생성 중...")
        note_count = 0
        for idx, (student, scenario_data) in enumerate(zip(student_records, STUDENT_SCENARIOS)):
            for note_idx, content in enumerate(scenario_data["notes"]):
                note = StudentNote(
                    id=_uid(),
                    student_id=student.id,
                    admin_id=admin_records[idx % len(admin_records)].id,
                    content=content,
                    created_at=_now(14 - idx - note_idx),
                )
                db.add(note)
                note_count += 1
        print(f"   ✅ 메모 {note_count}건 생성")

        # ── 7. 프롬이 코칭 로그 생성 ────────────────
        print("\n🤖 프롬이 코칭 로그 생성 중...")
        coach_count = 0
        for idx, (student, scenario_data) in enumerate(zip(student_records, STUDENT_SCENARIOS)):
            prob = problem_records[idx % len(problem_records)]
            for c_idx, (message, checkpoints_str) in enumerate(scenario_data["coach_messages"]):
                try:
                    checkpoints_list = json.loads(checkpoints_str) if checkpoints_str.startswith("[") else [checkpoints_str]
                except Exception:
                    checkpoints_list = [checkpoints_str]
                log = PromiCoachLog(
                    id=_uid(),
                    student_id=student.id,
                    problem_id=prob.id,
                    mode="run",
                    run_version=c_idx + 1,
                    message=message,
                    checkpoints_json=json.dumps(checkpoints_list, ensure_ascii=False),
                    caution="답을 바로 알려주지 않도록 관리자 확인이 필요합니다." if idx in {0, 4, 6} and c_idx == 0 else None,
                    created_at=_now((len(scenario_data["coach_messages"]) - c_idx) * 3),
                )
                db.add(log)
                coach_count += 1
        review_samples = [
            (student_records[0], problem_records[0], "정답은 이렇게 작성하면 됩니다. 아래 문장을 그대로 쓰면 점수를 받을 수 있어요.", ["정답 직접 제공 여부 확인", "힌트 중심으로 수정", "학생 사고 유도"]),
            (student_records[2], problem_records[1], "좋아요. 더 구체적으로 명확하게 확인해보세요.", ["너무 일반적인 피드백인지 확인", "구체 액션 추가"]),
            (student_records[6], problem_records[6], "정답을 대신 완성하기보다 역할, 경계, 검증 조건을 스스로 채워보세요.", ["정답 대체 표현 점검", "검증 조건 확인"]),
        ]
        review_log_records: list[tuple[PromiCoachLog, User, Problem, str]] = []
        for r_idx, (student, prob, message, checkpoints) in enumerate(review_samples):
            review_log = PromiCoachLog(
                id=_uid(),
                student_id=student.id,
                problem_id=prob.id,
                mode="run",
                run_version=10 + r_idx,
                message=message,
                checkpoints_json=json.dumps(checkpoints, ensure_ascii=False),
                caution="관리자 리뷰 큐 샘플: 코칭 품질 확인 필요",
                created_at=_now(r_idx + 1, r_idx),
            )
            db.add(review_log)
            review_log_records.append((review_log, student, prob, message))
            coach_count += 1
        print(f"   ✅ 프롬이 코칭 로그 {coach_count}건 생성")

        # ── 8. 활동 로그 생성 ────────────────────────
        print("\n📜 활동 로그 생성 중...")
        log_count = 0
        action_templates = [
            ("problem_view",   "문제 열람",    "problem"),
            ("run_preview",    "결과 실행",    "problem"),
            ("submit_prompt",  "최종 제출",    "submission"),
            ("view_result",    "결과 확인",    "submission"),
            ("view_history",   "이력 조회",    "submission"),
        ]
        for idx, student in enumerate(student_records):
            scenario_data = STUDENT_SCENARIOS[idx]
            sub_count = len(scenario_data["scenarios"])
            for a_idx in range(min(6, sub_count * 2)):
                action, msg_tmpl, ttype = action_templates[a_idx % len(action_templates)]
                prob = problem_records[(idx + a_idx) % len(problem_records)]
                log = ActivityLog(
                    id=_uid(),
                    user_id=student.id,
                    role="student",
                    action=action,
                    target_type=ttype,
                    target_id=prob.id,
                    message=f"{student.username}: {msg_tmpl} — {prob.title[:40]}",
                    metadata_json=json.dumps({"problem_id": prob.id}, ensure_ascii=False),
                    created_at=_now(max(0, sub_count * 2 - a_idx)),
                )
                db.add(log)
                log_count += 1
            db.add(ActivityLog(
                id=_uid(),
                user_id=student.id,
                role="student",
                action="concept_reflection_passed",
                target_type="student",
                target_id=student.id,
                message=f"{student.username}: 마이크 개념 설명을 통과했습니다.",
                metadata_json=json.dumps({"score": 82 + idx}, ensure_ascii=False),
                created_at=_now(idx % 4),
            ))
            log_count += 1
        # 관리자 활동 로그도 추가
        for admin in admin_records:
            for a_idx in range(3):
                student = student_records[a_idx % len(student_records)]
                log = ActivityLog(
                    id=_uid(),
                    user_id=admin.id,
                    role="admin",
                    action="view_student_detail",
                    target_type="student",
                    target_id=student.id,
                    message=f"{admin.username}: {student.username} 학생 상세 조회",
                    metadata_json=json.dumps({"student_id": student.id}, ensure_ascii=False),
                    created_at=_now(a_idx + 1),
                )
                db.add(log)
                log_count += 1

        # 프롬이 규칙 개선 큐 샘플: 대기/보류/반영 완료 상태를 모두 확인할 수 있게 생성
        print("   🐶 프롬이 규칙 개선 요청 샘플 생성 중...")
        rule_update_samples = [
            ("pending", "정답을 직접 제공한 듯한 표현이라 소크라테스식 질문으로 바꿔야 합니다.", None),
            ("held", "일반적인 피드백이지만 즉시 규칙 변경보다는 유사 사례를 더 모읍니다.", "동일한 일반 피드백이 3회 이상 반복될 때 규칙으로 승격 검토"),
            ("reflected", "보안 경계 안내는 유지하되 학생이 직접 채울 체크리스트를 먼저 묻게 반영했습니다.", "보안/인젝션 문제에서는 정답 예시보다 역할 경계, 민감정보, 거부 정책 체크리스트를 질문형으로 먼저 제시한다."),
        ]
        for idx, (status, note, rule_patch) in enumerate(rule_update_samples):
            review_log, student, prob, message = review_log_records[idx % len(review_log_records)]
            rule_update_id = _uid()
            db.add(ActivityLog(
                id=rule_update_id,
                user_id=admin_records[idx % len(admin_records)].id,
                role="admin",
                action="promi_rule_update_needed",
                target_type="promi_coach_log",
                target_id=review_log.id,
                message="프롬이 코칭 규칙 개선 필요 항목이 등록되었습니다.",
                metadata_json=json.dumps({
                    "log_id": review_log.id,
                    "student_id": student.id,
                    "problem_id": prob.id,
                    "message": message,
                    "caution": review_log.caution,
                    "note": note,
                }, ensure_ascii=False),
                created_at=_now(idx + 1),
            ))
            log_count += 1
            if status != "pending":
                db.add(ActivityLog(
                    id=_uid(),
                    user_id=admin_records[idx % len(admin_records)].id,
                    role="admin",
                    action="promi_rule_update_resolved",
                    target_type="promi_rule_update",
                    target_id=rule_update_id,
                    message="프롬이 규칙 개선 항목이 처리되었습니다.",
                    metadata_json=json.dumps({
                        "status": status,
                        "note": note,
                        "rule_patch": rule_patch,
                        "promi_log_id": review_log.id,
                    }, ensure_ascii=False),
                    created_at=_now(idx),
                ))
                log_count += 1
        print(f"   ✅ 활동 로그 {log_count}건 생성")

        # ── 9. 또래 도움 스레드 생성 ────────────────
        print("\n💬 또래 도움 스레드 생성 중...")
        thread_count = 0
        help_pairs = [
            (student_records[0], student_records[1], problem_records[0], "역할 정의는 했는데 출력 형식을 어떻게 잡아야 할지 모르겠어요."),
            (student_records[3], student_records[7], problem_records[4], "Few-shot 예시를 넣으면 오히려 길어지는데 어떻게 정리하면 좋을까요?"),
            (student_records[6], student_records[1], problem_records[6], "보안 경계를 어떻게 쓰면 정답을 직접 주는 느낌이 안 날까요?"),
        ]
        for t_idx, (requester, helper, problem, request) in enumerate(help_pairs):
            thread = PeerHelpThread(
                id=_uid(),
                problem_id=problem.id,
                requester_id=requester.id,
                helper_id=helper.id,
                request_message=request,
                status="closed" if t_idx == 0 else "open",
                helpful_marked=t_idx == 0,
                awarded_points=5 if t_idx == 0 else 0,
                created_at=_now(t_idx + 2),
                updated_at=_now(t_idx + 1),
            )
            db.add(thread)
            await db.flush()
            db.add(PeerHelpMessage(
                id=_uid(),
                thread_id=thread.id,
                sender_id=requester.id,
                content=request,
                is_helpful=False,
                created_at=_now(t_idx + 2),
            ))
            db.add(PeerHelpMessage(
                id=_uid(),
                thread_id=thread.id,
                sender_id=helper.id,
                content="정답 문장을 만들기보다 출력 항목 이름부터 정해보세요. 예: 대상, 핵심 설명, 예시, 확인 질문.",
                is_helpful=t_idx == 0,
                created_at=_now(t_idx + 1, 12),
            ))
            thread_count += 1
        print(f"   ✅ 또래 도움 스레드 {thread_count}건 생성")

        await db.commit()

    await engine.dispose()

    # ── 완료 요약 ─────────────────────────────────
    print("\n" + "=" * 60)
    print("🎉 시드 데이터 생성 완료!")
    print("=" * 60)
    print("\n📋 로그인 계정 정보:")
    print("\n  [관리자]")
    for a in ADMINS:
        print(f"  • {a['email']}  /  {a['password']}")
    print("\n  [학생] (비밀번호 공통: student123)")
    for s in STUDENTS:
        print(f"  • {s['username']}: {s['email']}  ({s['dropout_type']}형)")
    print("\n  [관리자 웹] http://localhost:5174")
    print("  [학생 웹]   http://localhost:5173")
    print("  [API 문서]  http://localhost:8000/docs")
    print()


if __name__ == "__main__":
    reset_flag = "--reset" in sys.argv
    if reset_flag:
        confirm = input("⚠️  모든 기존 데이터를 삭제하고 재생성합니다. 계속하시겠습니까? (y/N): ")
        if confirm.lower() != "y":
            print("취소되었습니다.")
            sys.exit(0)
    asyncio.run(seed(reset=reset_flag))
