from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class RiskDetail(BaseModel):
    student_id:    str
    total_risk:    float
    risk_stage:    str
    dropout_type:  str
    base_risk:     float
    event_bonus:   float
    thinking_risk: float
    calculated_at: datetime


class RiskStatusResponse(BaseModel):
    """GET /student/risk 응답 — latest_risk 가 없으면 None"""
    student_id:  str
    latest_risk: Optional[RiskDetail] = None


# 제출 결과 페이지용 (submission_id 포함)
class SubmissionRiskResponse(BaseModel):
    submission_id: str
    student_id:    str
    problem_id:    Optional[str] = None
    total_risk:    float
    base_risk:     float
    event_bonus:   float
    thinking_risk: float
    risk_stage:    str
    dropout_type:  str
    calculated_at: datetime


# 내부 호환용 alias
RiskResponse = RiskDetail
