# DB Contracts — 데이터베이스 계약 명세 (final_ai_dropout_spec 기반)

## 테이블 목록
users, problems, submissions, learning_metrics, risk_scores, interventions

---

### users
| 컬럼 | 타입 | 제약 |
|------|------|------|
| id | UUID | PK |
| username | VARCHAR(100) | NOT NULL, UNIQUE |
| email | VARCHAR(200) | NOT NULL, UNIQUE |
| password_hash | VARCHAR(255) | NOT NULL |
| role | VARCHAR(20) | NOT NULL (student/admin) |
| created_at | TIMESTAMP | NOT NULL |

---

### problems
| 컬럼 | 타입 | 제약 |
|------|------|------|
| id | UUID | PK |
| title | VARCHAR(200) | NOT NULL |
| description | TEXT | NOT NULL |
| difficulty | VARCHAR(50) | NOT NULL |
| category | VARCHAR(100) | NOT NULL |
| created_at | TIMESTAMP | NOT NULL |

---

### submissions
| 컬럼 | 타입 | 제약 |
|------|------|------|
| id | UUID | PK |
| student_id | UUID | FK → users.id |
| problem_id | UUID | FK → problems.id |
| prompt_text | TEXT | NOT NULL |
| created_at | TIMESTAMP | NOT NULL |

---

### learning_metrics
행동 데이터 11개 + 사고 점수 14개를 저장

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| submission_id | UUID | FK → submissions.id |
| student_id | UUID | FK → users.id |
| login_frequency | FLOAT | 행동 |
| session_duration | FLOAT | 행동 |
| submission_interval | FLOAT | 행동 |
| drop_midway_rate | FLOAT | 행동 |
| attempt_count | INT | 행동 |
| revision_count | INT | 행동 |
| retry_count | INT | 행동 |
| strategy_change_count | INT | 행동 |
| task_success_rate | FLOAT | 행동 |
| quiz_score_avg | FLOAT | 행동 |
| score_delta | FLOAT | 행동 |
| problem_understanding_score | FLOAT | 사고(LLM) |
| problem_decomposition_score | FLOAT | 사고(LLM) |
| constraint_awareness_score | FLOAT | 사고(LLM) |
| validation_awareness_score | FLOAT | 사고(LLM) |
| improvement_prompt_score | FLOAT | 사고(LLM) |
| self_explanation_score | FLOAT | 사고(LLM) |
| reasoning_quality_score | FLOAT | 사고(LLM) |
| reflection_depth_score | FLOAT | 사고(LLM) |
| error_analysis_score | FLOAT | 사고(LLM) |
| debugging_quality_score | FLOAT | 사고(LLM) |
| decision_reasoning_score | FLOAT | 사고(LLM) |
| approach_selection_score | FLOAT | 사고(LLM) |
| improvement_consistency_score | FLOAT | 사고(LLM) |
| iteration_quality_score | FLOAT | 사고(LLM) |
| created_at | TIMESTAMP | NOT NULL |

---

### risk_scores
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| student_id | UUID | FK → users.id |
| submission_id | UUID | FK → submissions.id |
| total_risk | FLOAT | 최종 위험도 (0~100) |
| base_risk | FLOAT | 기본 위험도 |
| event_bonus | FLOAT | 이벤트 가산점 |
| thinking_risk | FLOAT | 사고 위험도 |
| risk_stage | VARCHAR(20) | 안정/경미/주의/고위험/심각 |
| dropout_type | VARCHAR(30) | cognitive/motivational/... |
| calculated_at | TIMESTAMP | NOT NULL |

---

### interventions
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| student_id | UUID | FK → users.id |
| type | VARCHAR(50) | email/call/meeting/auto |
| message | TEXT | NOT NULL |
| dropout_type | VARCHAR(30) | 연관 낙오 유형 |
| status | VARCHAR(50) | pending/active/completed |
| created_at | TIMESTAMP | NOT NULL |
| updated_at | TIMESTAMP | NOT NULL |
