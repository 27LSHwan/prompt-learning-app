export type RiskStage = '안정' | '경미' | '주의' | '고위험' | '심각';
export type DropoutType = 'cognitive' | 'motivational' | 'strategic' | 'sudden' | 'dependency' | 'compound' | 'none';
export type InterventionType = 'message' | 'meeting' | 'resource' | 'alert' | 'problem_recommendation';
export type InterventionStatus = 'pending' | 'completed' | 'cancelled';

export interface LoginResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  user_id: string;
  role: string;
}

export interface RiskDistribution {
  stage: RiskStage;
  count: number;
  percentage?: number;
}

export interface DashboardResponse {
  total_students: number;
  high_risk_count: number;
  pending_interventions: number;
  risk_distribution: RiskDistribution[];
  recent_high_risk: StudentSummary[];
  pattern_summary: string[];
}

export interface StudentSummary {
  student_id: string;
  username: string;
  email: string;
  total_risk: number;
  risk_stage: RiskStage;
  dropout_type: DropoutType;
  calculated_at: string;
  helper_points: number;
  submission_count: number;
  avg_score: number;
  pattern_group: string;
  latest_failure_tags: string[];
}

export interface StudentListResponse {
  items: StudentSummary[];
  total: number;
}

export interface RiskScore {
  id: string;
  total_risk: number;
  base_risk: number;
  event_bonus: number;
  thinking_risk: number;
  risk_stage: RiskStage;
  dropout_type: DropoutType;
  calculated_at: string;
}

export interface StudentDetail {
  student_id: string;
  username: string;
  email: string;
  latest_risk: RiskScore | null;
  risk_history: RiskScore[];
  interventions: Intervention[];
  helper_points: number;
  submission_count: number;
  avg_score: number;
  latest_failure_tags: string[];
  pattern_summary: string[];
}

export interface Intervention {
  id: string;
  student_id: string;
  type: InterventionType;
  message: string;
  dropout_type: DropoutType;
  status: InterventionStatus;
  created_at: string;
  updated_at: string;
}

export interface InterventionCreateRequest {
  student_id: string;
  type: InterventionType;
  message: string;
}

export interface InterventionResponse {
  id: string;
  student_id: string;
  type: InterventionType;
  message: string;
  dropout_type: DropoutType;
  status: InterventionStatus;
  created_at: string;
}

export interface Problem {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  created_at: string;
  updated_at?: string;
}

export interface ProblemCreate {
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
}

export interface ProblemUpdate {
  title?: string;
  description?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  category?: string;
}

export interface ProblemRecommendation {
  id: string;
  student_id: string;
  problem_id: string;
  admin_id: string;
  reason: string | null;
  is_active: boolean;
  created_at: string;
  problem_title: string;
  problem_description: string;
  problem_difficulty: string;
  problem_category: string;
}

export interface InterventionListItem {
  id: string;
  student_id: string;
  username: string;
  email: string;
  type: InterventionType;
  message: string;
  dropout_type: DropoutType;
  status: InterventionStatus;
  created_at: string;
}

export interface InterventionListResponse {
  items: InterventionListItem[];
  total: number;
}

export interface StudentNote {
  id: string;
  student_id: string;
  admin_id: string;
  content: string;
  created_at: string;
}

export interface StudentNoteCreate {
  content: string;
}

export interface SubmissionAdminItem {
  submission_id: string;
  problem_id: string | null;
  problem_title: string | null;
  prompt_text: string;
  total_score: number;
  final_score: number;
  total_risk: number;
  risk_stage: RiskStage;
  created_at: string;
}

export interface LearningPatternItem {
  student_id: string;
  username: string;
  pattern_group: string;
  summary: string;
  avg_score: number;
  submission_count: number;
}

export interface LearningPatternResponse {
  items: LearningPatternItem[];
}

export interface SubmissionAdminListResponse {
  items: SubmissionAdminItem[];
  total: number;
}

export interface RiskTrendPoint {
  date: string;
  avg_risk: number;
  high_risk_count: number;
}

export interface RiskTrendResponse {
  points: RiskTrendPoint[];
  period_days: number;
}

export interface DropoutTrendPoint {
  date: string;
  cognitive: number;
  motivational: number;
  strategic: number;
  sudden: number;
  dependency: number;
  compound: number;
}

export interface DropoutTrendResponse {
  points: DropoutTrendPoint[];
  period_days: number;
}

export interface InterventionEffectItem {
  intervention_id: string;
  student_id: string;
  username: string;
  risk_before: number;
  risk_after: number | null;
  delta: number | null;
  submissions_before: number;
  submissions_after: number;
  avg_score_before: number | null;
  avg_score_after: number | null;
  score_delta: number | null;
  intervention_type: InterventionType;
  tracking_days: number;
  created_at: string;
}

export interface InterventionEffectResponse {
  items: InterventionEffectItem[];
}

export interface RecommendationEffectItem {
  recommendation_id: string;
  student_id: string;
  username: string;
  problem_title: string;
  created_at: string;
  attempted: boolean;
  submission_count: number;
  avg_score: number | null;
  latest_score: number | null;
}

export interface RecommendationEffectResponse {
  items: RecommendationEffectItem[];
}

export interface InterventionSuggestionItem {
  type: string;
  title: string;
  message: string;
}

export interface StudentTimelineItem {
  kind: string;
  title: string;
  description: string;
  created_at: string;
}

export interface StudentTimelineResponse {
  items: StudentTimelineItem[];
}

export interface ActivityLogItem {
  id: string;
  role: string;
  username: string;
  action: string;
  target_type: string;
  message: string;
  created_at: string;
}

export interface ActivityLogListResponse {
  items: ActivityLogItem[];
}

export interface StudentDetailExtended extends StudentDetail {
  submissions?: SubmissionAdminItem[];
  notes?: StudentNote[];
}

export interface InterventionPriorityItem {
  student_id: string;
  username: string;
  email: string;
  priority_score: number;
  risk_stage: string;
  total_risk: number;
  reasons: string[];
  recommended_action: string;
  last_submission_at?: string | null;
}

export interface InterventionPriorityQueueResponse {
  items: InterventionPriorityItem[];
}

export interface ProblemInsightItem {
  problem_id: string;
  title: string;
  difficulty: string;
  category: string;
  submission_count: number;
  participant_count: number;
  average_score: number;
  run_count: number;
  promi_feedback_count: number;
  top_failure_tags: string[];
  insight: string;
  recommended_action: string;
}

export interface ProblemInsightResponse {
  items: ProblemInsightItem[];
}

export interface PromiReviewQueueItem {
  log_id: string;
  student_id: string;
  username: string;
  problem_id: string;
  problem_title: string;
  message: string;
  checkpoints: string[];
  caution?: string | null;
  flags: string[];
  review_reason: string;
  created_at: string;
}

export interface PromiReviewQueueResponse {
  items: PromiReviewQueueItem[];
}
