from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class BehavioralDataSchema(BaseModel):
    login_frequency: float = Field(ge=0.0, le=1.0, default=0.5)
    session_duration: float = Field(ge=0.0, le=1.0, default=0.5)
    submission_interval: float = Field(ge=0.0, le=1.0, default=0.5)
    drop_midway_rate: float = Field(ge=0.0, le=1.0, default=0.0)
    attempt_count: int = Field(ge=0, default=1)
    revision_count: int = Field(ge=0, default=0)
    retry_count: int = Field(ge=0, default=0)
    strategy_change_count: int = Field(ge=0, default=0)
    task_success_rate: float = Field(ge=0.0, le=1.0, default=0.5)
    quiz_score_avg: float = Field(ge=0.0, le=1.0, default=0.5)
    score_delta: float = Field(ge=-1.0, le=1.0, default=0.0)


class SubmissionCreate(BaseModel):
    student_id: Optional[str] = None
    problem_id: Optional[str] = None
    prompt_text: str = Field(min_length=1)
    raw_score: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    behavioral_data: BehavioralDataSchema = Field(default_factory=BehavioralDataSchema)


class SubmissionResponse(BaseModel):
    id: str
    student_id: str
    problem_id: Optional[str]
    prompt_text: str
    total_score: float = 0.0
    final_score: float = 0.0
    concept_reflection_passed: bool = False
    concept_reflection_score: Optional[float] = None
    concept_reflection_feedback: Optional[str] = None
    risk_triggered: bool
    created_at: datetime


class ProblemResponse(BaseModel):
    id: str
    title: str
    description: str
    difficulty: str
    category: str
    core_concepts: list[str] = []
    methodology: list[str] = []
    recommended: bool = False
    recommendation_reason: Optional[str] = None
    recommended_at: Optional[datetime] = None


class ProblemListResponse(BaseModel):
    items: list[ProblemResponse]
    total: int


class SubmissionHistoryItem(BaseModel):
    submission_id: str
    problem_id: Optional[str] = None
    problem_title: str
    prompt_text: str
    total_score: float = 0.0
    final_score: float = 0.0
    concept_reflection_passed: bool = False
    concept_reflection_score: Optional[float] = None
    concept_reflection_feedback: Optional[str] = None
    total_risk: float
    risk_stage: str
    dropout_type: str
    created_at: datetime


class SubmissionHistoryResponse(BaseModel):
    items: list[SubmissionHistoryItem]
    total: int


class ProblemDetailResponse(BaseModel):
    id: str
    title: str
    description: str
    difficulty: str
    category: str
    steps: list[str]
    core_concepts: list[str] = []
    methodology: list[str] = []
    concept_check_questions: list[str] = []


class CriterionScoreResponse(BaseModel):
    name: str
    score: float
    max_score: float
    feedback: str


class EvaluationResultResponse(BaseModel):
    submission_id: str
    total_score: float
    overall_feedback: str
    criteria_scores: list[CriterionScoreResponse]
    strengths: list[str]
    improvements: list[str]


class NotificationItem(BaseModel):
    id: str
    type: str
    message: str
    dropout_type: Optional[str] = None
    created_at: datetime
    is_read: bool


class NotificationListResponse(BaseModel):
    items: list[NotificationItem]
    unread_count: int


class CharacterFeedbackResponse(BaseModel):
    submission_id: str
    character_name: str
    emotion: str
    main_message: str
    tips: list[str]
    encouragement: str
    growth_note: Optional[str] = None
    score_delta: Optional[float] = None
    total_score: float = 0.0
    criteria_scores: list[CriterionScoreResponse] = []
    pass_threshold: float = 80.0


class RunPreviewRequest(BaseModel):
    system_prompt: str = ""
    user_template: str = "{{input}}"
    few_shots: list[dict] = []
    test_input: str = ""
    temperature: float = 0.7
    max_tokens: int = 500


class TestCaseResult(BaseModel):
    id: int
    label: str
    input: str
    expected: str
    actual: str
    passed: bool


class RunPreviewResponse(BaseModel):
    assembled_prompt: str
    model_response: str
    test_input: str
    test_results: list[TestCaseResult]
    scores: dict
    improvement_tips: list[str]
    failure_tags: list[str] = []
    status: str = "ok"


class ProblemLeaderboardEntry(BaseModel):
    rank: int
    student_id: str
    display_name: str
    best_score: float
    helper_points: int
    latest_submitted_at: datetime


class ProblemLeaderboardResponse(BaseModel):
    problem_id: str
    total_participants: int
    my_best_score: float
    my_rank: Optional[int] = None
    my_percentile: float = 0.0
    top_students: list[ProblemLeaderboardEntry]


class GrowthTimelinePoint(BaseModel):
    date: str
    score: float
    submission_count: int
    best_score: float


class GrowthTimelineResponse(BaseModel):
    points: list[GrowthTimelinePoint]
    total_submissions: int
    average_score: float
    best_score: float
    helper_points: int


class PeerHelpCreateRequest(BaseModel):
    helper_student_id: str
    message: str = Field(min_length=1)


class PeerHelpMessageCreate(BaseModel):
    message: str = Field(min_length=1)


class PeerHelpMessageResponse(BaseModel):
    id: str
    sender_id: str
    sender_name: str
    sender_role: str
    content: str
    is_helpful: bool
    created_at: datetime


class PeerHelpThreadResponse(BaseModel):
    id: str
    problem_id: str
    problem_title: str
    requester_id: str
    requester_name: str
    helper_id: str
    helper_name: str
    request_message: str
    status: str
    helpful_marked: bool
    awarded_points: int
    created_at: datetime
    messages: list[PeerHelpMessageResponse]


class PromiCoachRequest(BaseModel):
    system_prompt: str = ""
    user_template: str = "{{input}}"
    few_shots: list[dict] = []
    test_input: str = ""
    latest_response: Optional[str] = None
    mode: str = "enter"


class PromiCoachResponse(BaseModel):
    name: str = "프롬이"
    persona: str = "강아지 코치"
    mode: str
    message: str
    checkpoints: list[str]
    encouragement: str
    caution: Optional[str] = None


class PromptComparisonItem(BaseModel):
    submission_id: str
    problem_id: Optional[str] = None
    problem_title: str
    created_at: datetime
    total_score: float
    final_score: float
    summary: str
    failure_tags: list[str] = []


class PromptComparisonResponse(BaseModel):
    current: Optional[PromptComparisonItem] = None
    previous: Optional[PromptComparisonItem] = None
    score_delta: Optional[float] = None
    summary_delta: list[str] = []


class WeaknessItem(BaseModel):
    tag: str
    label: str
    count: int
    last_seen_at: Optional[datetime] = None
    recommendation: str


class WeaknessReportResponse(BaseModel):
    items: list[WeaknessItem]
    strongest_area: Optional[str] = None


class ProblemQueueItem(ProblemResponse):
    queue_reason: str
    priority_score: float = 0.0


class ProblemQueueResponse(BaseModel):
    items: list[ProblemQueueItem]


class PromiCoachLogResponse(BaseModel):
    id: str
    problem_id: str
    mode: str
    run_version: int
    message: str
    checkpoints: list[str]
    caution: Optional[str] = None
    created_at: datetime


class ActivityLogResponse(BaseModel):
    id: str
    action: str
    target_type: str
    target_id: Optional[str] = None
    message: str
    created_at: datetime


class WeeklyReportResponse(BaseModel):
    period_label: str
    submission_count: int
    average_score: float
    best_score: float
    score_delta: Optional[float] = None
    strength: str
    repeated_mistake: str
    next_action: str
    focus_area: str


class ConceptReflectionAnswer(BaseModel):
    question_index: int = Field(ge=0)
    question: str = Field(min_length=1)
    transcript: str = Field(min_length=20)
    duration_seconds: Optional[int] = Field(default=None, ge=0)


class ConceptReflectionRequest(BaseModel):
    transcript: Optional[str] = Field(default=None, min_length=20)
    duration_seconds: Optional[int] = Field(default=None, ge=0)
    answers: list[ConceptReflectionAnswer] = Field(default_factory=list)


class ConceptReflectionQuestionResult(BaseModel):
    question_index: int
    question: str
    passed: bool
    score: float
    feedback: str
    missing_points: list[str] = Field(default_factory=list)


class ConceptReflectionResponse(BaseModel):
    submission_id: str
    passed: bool
    score: float
    required_score: float = 70.0
    feedback: str
    missing_points: list[str] = Field(default_factory=list)
    evaluation_method: str = "llm"
    question_results: list[ConceptReflectionQuestionResult] = Field(default_factory=list)


class WeaknessPatternItem(BaseModel):
    criterion: str
    miss_count: int
    last_seen_days_ago: int


class WeaknessPatternResponse(BaseModel):
    patterns: list[WeaknessPatternItem]
    total_submissions: int


class GallerySubmissionItem(BaseModel):
    score: float
    prompt_preview: str
    submitted_days_ago: int


class ScoreDistribution(BaseModel):
    range_0_49: int = Field(0, alias="0-49")
    range_50_69: int = Field(0, alias="50-69")
    range_70_84: int = Field(0, alias="70-84")
    range_85_100: int = Field(0, alias="85-100")

    class Config:
        populate_by_name = True


class ProblemGalleryResponse(BaseModel):
    top_submissions: list[GallerySubmissionItem]
    score_distribution: dict[str, int]
    my_best_score: Optional[float] = None


class MySubmissionItem(BaseModel):
    id: str
    final_score: float
    prompt_text: str
    created_at: datetime


class MySubmissionsResponse(BaseModel):
    submissions: list[MySubmissionItem]
