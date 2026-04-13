# API Contracts — API 계약 명세 (final_ai_dropout_spec 기반)

## Base URL
```
http://localhost:8000/api/v1
```

---

## Auth API

### POST /auth/signup
```json
Request:  { "username": "string", "email": "string", "password": "string", "role": "student|admin" }
Response 201: { "id": "uuid", "username": "string", "email": "string", "role": "string", "created_at": "ISO8601" }
```

### POST /auth/login
```json
Request:  { "email": "string", "password": "string" }
Response 200: { "access_token": "string", "token_type": "bearer", "user_id": "uuid", "role": "string" }
```

---

## Student API

### GET /student/problems
```json
Response 200: { "items": [...], "total": int }
Problem: { "id": "uuid", "title": "string", "description": "string", "difficulty": "string", "category": "string" }
```

### POST /student/submissions
```json
Request: {
  "student_id": "uuid",
  "problem_id": "uuid",
  "prompt_text": "string",
  "behavioral_data": {
    "login_frequency": float,
    "session_duration": float,
    "submission_interval": float,
    "drop_midway_rate": float,
    "attempt_count": int,
    "revision_count": int,
    "retry_count": int,
    "strategy_change_count": int,
    "task_success_rate": float,
    "quiz_score_avg": float,
    "score_delta": float
  }
}
Response 201: {
  "id": "uuid",
  "student_id": "uuid",
  "problem_id": "uuid",
  "prompt_text": "string",
  "risk_triggered": true,
  "created_at": "ISO8601"
}
```

### GET /student/risk
```json
Query: ?student_id=uuid
Response 200: {
  "student_id": "uuid",
  "total_risk": float,
  "risk_stage": "안정|경미|주의|고위험|심각",
  "dropout_type": "cognitive|motivational|strategic|sudden|dependency|compound|none",
  "base_risk": float,
  "event_bonus": float,
  "thinking_risk": float,
  "calculated_at": "ISO8601"
}
```

---

## Admin API

### GET /admin/dashboard
```json
Response 200: {
  "total_students": int,
  "risk_distribution": { "안정": int, "경미": int, "주의": int, "고위험": int, "심각": int },
  "dropout_type_distribution": { "cognitive": int, ... },
  "recent_interventions": [...]
}
```

### GET /admin/students
```json
Query: ?risk_stage=string&dropout_type=string&limit=int
Response 200: { "items": [...], "total": int }
Student: { "student_id": "uuid", "username": "string", "total_risk": float, "risk_stage": "string", "dropout_type": "string" }
```

### POST /admin/intervention
```json
Request: { "student_id": "uuid", "type": "email|call|meeting|auto", "message": "string", "dropout_type": "string" }
Response 201: { "id": "uuid", "student_id": "uuid", "type": "string", "message": "string", "status": "pending", "created_at": "ISO8601" }
```

---

## Score Level 매핑

| total_risk | risk_stage |
|-----------|------------|
| 0~19      | 안정       |
| 20~39     | 경미       |
| 40~59     | 주의       |
| 60~79     | 고위험     |
| 80~100    | 심각       |
