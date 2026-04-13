# File Plan — 생성 파일 목록

## Backend (apps/backend/)

```
apps/backend/
├── app/
│   ├── __init__.py
│   ├── main.py                        # FastAPI 앱 진입점
│   ├── config.py                      # 환경 변수 설정
│   ├── database.py                    # DB 연결 설정
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes/
│   │       ├── __init__.py
│   │       ├── submissions.py         # POST /submissions, GET /submissions/{id}
│   │       ├── risk.py                # GET /risk/{student_id}
│   │       └── interventions.py       # GET /interventions, POST /interventions
│   ├── models/
│   │   ├── __init__.py
│   │   ├── submission.py              # Submission ORM 모델
│   │   ├── risk_score.py              # RiskScore ORM 모델
│   │   └── intervention.py            # Intervention ORM 모델
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── submission.py              # Pydantic 스키마
│   │   ├── risk_score.py
│   │   └── intervention.py
│   └── services/
│       ├── __init__.py
│       ├── submission_service.py      # 제출 처리 서비스
│       ├── risk_service.py            # 위험도 계산 서비스ㅂ   ~
│       └── intervention_service.py    # 개입 생성 서비스
├── requirements.txt
└── .env.example
```

## Packages

```
packages/
├── llm_analysis/
│   ├── __init__.py
│   ├── analyzer.py                    # LLM 분석 메인 클래스
│   ├── prompts.py                     # 프롬프트 템플릿
│   └── schemas.py                     # 입출력 스키마
├── scoring/
│   ├── __init__.py
│   ├── calculator.py                  # 위험도 점수 계산기
│   ├── weights.py                     # 가중치 설정
│   └── schemas.py
├── decision/
│   ├── __init__.py
│   ├── engine.py                      # 개입 결정 엔진
│   ├── rules.py                       # 결정 규칙
│   └── schemas.py
└── shared/
    ├── __init__.py
    ├── types.py                       # 공통 타입 정의
    └── utils.py                       # 공통 유틸리티
```

## Student Web (apps/student-web/)

```
apps/student-web/
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── lib/
│   │   └── api.ts                     # Axios 인스턴스
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx
│   │   └── SubmissionPage.tsx
│   └── components/
│       ├── SubmissionForm.tsx
│       └── FeedbackCard.tsx
├── package.json
└── tsconfig.json
```

## Admin Web (apps/admin-web/)

```
apps/admin-web/
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── lib/
│   │   └── api.ts
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx
│   │   └── InterventionPage.tsx
│   └── components/
│       ├── RiskStudentList.tsx
│       └── InterventionForm.tsx
├── package.json
└── tsconfig.json
```

## 생성 우선순위

| 순서 | 파일 그룹 | 이유 |
|------|-----------|------|
| 1 | packages/shared | 모든 패키지 의존 |
| 2 | packages/llm_analysis | scoring 의존 |
| 3 | packages/scoring | decision 의존 |
| 4 | packages/decision | backend 의존 |
| 5 | apps/backend/models | schemas 의존 |
| 6 | apps/backend/schemas | services 의존 |
| 7 | apps/backend/services | routes 의존 |
| 8 | apps/backend/routes | main 의존 |
| 9 | apps/student-web | backend 완성 후 |
| 10 | apps/admin-web | backend 완성 후 |
