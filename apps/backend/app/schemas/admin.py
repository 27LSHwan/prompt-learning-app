from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class ProblemCreate(BaseModel):
    title: str
    description: str
    difficulty: str = "medium"
    category: str = "general"
    steps: list[str] = []
    rubric_criteria: list[dict] = []


class ProblemUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    difficulty: Optional[str] = None
    category: Optional[str] = None
    steps: Optional[list[str]] = None
    rubric_criteria: Optional[list[dict]] = None


class ProblemResponse(BaseModel):
    id: str
    title: str
    description: str
    difficulty: str
    category: str
    steps: list[str]
    created_at: datetime


class ProblemRecommendationCreate(BaseModel):
    problem_id: str
    reason: Optional[str] = None


class ProblemRecommendationResponse(BaseModel):
    id: str
    student_id: str
    problem_id: str
    admin_id: str
    reason: Optional[str] = None
    is_active: bool
    created_at: datetime
    problem_title: str
    problem_description: str
    problem_difficulty: str
    problem_category: str


class InterventionCreate(BaseModel):
    student_id: str
    type: Literal["message", "meeting", "resource", "alert", "problem_recommendation"] = "message"
    message: str = Field(min_length=1)
    dropout_type: str = "none"


class InterventionResponse(BaseModel):
    id: str
    student_id: str
    type: str
    message: str
    dropout_type: str
    status: str
    created_at: datetime


class InterventionListItem(InterventionResponse):
    username: str
    email: str


class InterventionListResponse(BaseModel):
    items: list[InterventionListItem]
    total: int


class InterventionStatusUpdate(BaseModel):
    status: Literal["pending", "completed", "cancelled"]
    message: Optional[str] = Field(default=None, min_length=1)


class BulkInterventionCreate(BaseModel):
    student_ids: list[str]
    type: Literal["message", "meeting", "resource", "alert", "problem_recommendation"] = "message"
    message: str = Field(min_length=1)
    dropout_type: str = "none"


class StudentRiskItem(BaseModel):
    student_id: str
    username: str
    email: str
    total_risk: float
    risk_stage: str
    dropout_type: str
    calculated_at: datetime
    helper_points: int = 0
    submission_count: int = 0
    avg_score: float = 0.0
    pattern_group: str = "general"
    latest_failure_tags: list[str] = []


class StudentListResponse(BaseModel):
    items: list[StudentRiskItem]
    total: int


class RiskHistoryItem(BaseModel):
    id: str
    total_risk: float
    base_risk: float
    event_bonus: float
    thinking_risk: float
    risk_stage: str
    dropout_type: str
    calculated_at: datetime


class StudentNoteCreate(BaseModel):
    content: str = Field(min_length=1)


class StudentNoteResponse(BaseModel):
    id: str
    student_id: str
    admin_id: str
    content: str
    created_at: datetime


class SubmissionAdminItem(BaseModel):
    submission_id: str
    problem_id: Optional[str]
    problem_title: Optional[str]
    prompt_text: str
    total_score: float = 0.0
    final_score: float = 0.0
    total_risk: float
    risk_stage: str
    created_at: datetime


class SubmissionAdminListResponse(BaseModel):
    items: list[SubmissionAdminItem]
    total: int


class StudentDetailResponse(BaseModel):
    student_id: str
    username: str
    email: str
    latest_risk: Optional[RiskHistoryItem]
    risk_history: list[RiskHistoryItem]
    interventions: list[InterventionResponse]
    helper_points: int = 0
    submission_count: int = 0
    avg_score: float = 0.0
    latest_failure_tags: list[str] = []
    pattern_summary: list[str] = []


class StudentDetailExtended(StudentDetailResponse):
    submissions: list[SubmissionAdminItem]
    notes: list[StudentNoteResponse]


class RiskDistributionItem(BaseModel):
    stage: str
    count: int
    percentage: float


class RecentHighRiskItem(BaseModel):
    student_id: str
    username: str
    email: str
    total_risk: float
    risk_stage: str
    dropout_type: str
    calculated_at: datetime


class RiskTrendPoint(BaseModel):
    date: str
    avg_risk: float
    high_risk_count: int


class RiskTrendResponse(BaseModel):
    points: list[RiskTrendPoint]


class DropoutTrendPoint(BaseModel):
    date: str
    cognitive: int
    motivational: int
    strategic: int
    sudden: int
    dependency: int
    compound: int


class DropoutTrendResponse(BaseModel):
    points: list[DropoutTrendPoint]


class InterventionEffectItem(BaseModel):
    intervention_id: str
    student_id: str
    username: str
    risk_before: float
    risk_after: Optional[float]
    delta: Optional[float]
    submissions_before: int = 0
    submissions_after: int = 0
    avg_score_before: Optional[float] = None
    avg_score_after: Optional[float] = None
    score_delta: Optional[float] = None
    intervention_type: str
    tracking_days: int = 7
    created_at: datetime


class InterventionEffectResponse(BaseModel):
    items: list[InterventionEffectItem]


class DashboardResponse(BaseModel):
    total_students: int
    high_risk_count: int
    pending_interventions: int
    risk_distribution: list[RiskDistributionItem]
    recent_high_risk: list[RecentHighRiskItem]
    pattern_summary: list[str] = []


class LearningPatternItem(BaseModel):
    student_id: str
    username: str
    pattern_group: str
    summary: str
    avg_score: float = 0.0
    submission_count: int = 0


class LearningPatternResponse(BaseModel):
    items: list[LearningPatternItem]


class RecommendationEffectItem(BaseModel):
    recommendation_id: str
    student_id: str
    username: str
    problem_title: str
    created_at: datetime
    attempted: bool
    submission_count: int = 0
    avg_score: Optional[float] = None
    latest_score: Optional[float] = None


class RecommendationEffectResponse(BaseModel):
    items: list[RecommendationEffectItem]


class InterventionSuggestionItem(BaseModel):
    type: str
    title: str
    message: str


class StudentTimelineItem(BaseModel):
    kind: str
    title: str
    description: str
    created_at: datetime


class StudentTimelineResponse(BaseModel):
    items: list[StudentTimelineItem]


class ActivityLogItem(BaseModel):
    id: str
    role: str
    username: str
    action: str
    target_type: str
    message: str
    created_at: datetime


class ActivityLogListResponse(BaseModel):
    items: list[ActivityLogItem]


class InterventionPriorityItem(BaseModel):
    student_id: str
    username: str
    email: str
    priority_score: float
    risk_stage: str
    total_risk: float
    reasons: list[str]
    recommended_action: str
    last_submission_at: Optional[datetime] = None


class InterventionPriorityQueueResponse(BaseModel):
    items: list[InterventionPriorityItem]


class ProblemInsightItem(BaseModel):
    problem_id: str
    title: str
    difficulty: str
    category: str
    submission_count: int
    participant_count: int
    average_score: float
    run_count: int
    promi_feedback_count: int
    top_failure_tags: list[str]
    insight: str
    recommended_action: str


class ProblemInsightResponse(BaseModel):
    items: list[ProblemInsightItem]


class PromiReviewQueueItem(BaseModel):
    log_id: str
    student_id: str
    username: str
    problem_id: str
    problem_title: str
    message: str
    checkpoints: list[str]
    caution: Optional[str] = None
    flags: list[str]
    review_reason: str
    created_at: datetime


class PromiReviewQueueResponse(BaseModel):
    items: list[PromiReviewQueueItem]


class PromiReviewAction(BaseModel):
    status: Literal["approved", "needs_prompt_update", "follow_up_student"] = "approved"
    note: Optional[str] = None


class PromiReviewActionResponse(BaseModel):
    ok: bool
    status: str
    intervention_id: Optional[str] = None
    rule_update_id: Optional[str] = None
    action: str


class PromiRuleUpdateItem(BaseModel):
    id: str
    promi_log_id: Optional[str] = None
    student_id: Optional[str] = None
    username: str
    problem_id: Optional[str] = None
    problem_title: str
    original_message: str
    caution: Optional[str] = None
    review_note: Optional[str] = None
    admin_message: str
    status: Literal["pending", "reflected", "held"] = "pending"
    resolved_note: Optional[str] = None
    rule_patch: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime


class PromiRuleUpdateQueueResponse(BaseModel):
    items: list[PromiRuleUpdateItem]


class PromiRuleUpdateResolve(BaseModel):
    status: Literal["reflected", "held"] = "reflected"
    note: Optional[str] = None
    rule_patch: Optional[str] = None


class PromiRuleUpdateResolveResponse(BaseModel):
    ok: bool
    status: str
