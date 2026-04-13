export type RiskStage = '안정' | '경미' | '주의' | '고위험' | '심각';
export type DropoutType = 'cognitive' | 'motivational' | 'strategic' | 'sudden' | 'dependency' | 'compound' | 'none';
export type SubmissionType = 'assignment' | 'quiz' | 'reflection';

export interface LoginResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  user_id: string;
  role: string;
}

export interface SignupResponse {
  id: string;
  username: string;
  email: string;
  role: string;
  created_at: string;
}

export interface Problem {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  category: string;
  steps?: string[];
  core_concepts?: string[];
  methodology?: string[];
  concept_check_questions?: string[];
  recommended?: boolean;
  recommendation_reason?: string | null;
  recommended_at?: string | null;
}

export interface ProblemListResponse {
  items: Problem[];
  total: number;
}

export interface AutoCollected {
  session_duration_sec: number;
  attempt_count: number;
  revision_count: number;
  drop_midway: boolean;
}

export interface BehavioralData {
  login_frequency: number;
  session_duration: number;
  submission_interval: number;
  drop_midway_rate: number;
  attempt_count: number;
  revision_count: number;
  retry_count: number;
  strategy_change_count: number;
  task_success_rate: number;
  quiz_score_avg: number;
  score_delta: number;
}

export interface SubmissionResponse {
  id: string;
  student_id: string;
  problem_id: string | null;
  prompt_text: string;
  total_score: number;
  final_score: number;
  concept_reflection_passed: boolean;
  concept_reflection_score?: number | null;
  concept_reflection_feedback?: string | null;
  risk_triggered: boolean;
  created_at: string;
}

export interface SubmissionHistoryItem {
  id?: string;
  submission_id?: string;
  student_id?: string;
  problem_id: string | null;
  problem_title: string | null;
  prompt_text: string;
  created_at: string;
  risk_stage?: RiskStage;
  total_risk?: number;
  total_score?: number;
  final_score?: number;
  concept_reflection_passed?: boolean;
  concept_reflection_score?: number | null;
  concept_reflection_feedback?: string | null;
}

export interface SubmissionHistoryResponse {
  items: SubmissionHistoryItem[];
  total: number;
}

export interface RiskDetail {
  student_id: string;
  total_risk: number;
  risk_stage: RiskStage;
  dropout_type: DropoutType;
  base_risk: number;
  event_bonus: number;
  thinking_risk: number;
  calculated_at: string;
}

export interface RiskStatusResponse {
  student_id: string;
  latest_risk: RiskDetail | null;
}

export type RiskResponse = RiskDetail;

export interface GrowthTimelinePoint {
  date: string;
  score: number;
  submission_count: number;
  best_score: number;
}

export interface GrowthTimelineResponse {
  points: GrowthTimelinePoint[];
  total_submissions: number;
  average_score: number;
  best_score: number;
  helper_points: number;
}

export interface WeaknessItem {
  tag: string;
  label: string;
  count: number;
  last_seen_at?: string | null;
  recommendation: string;
}

export interface WeaknessReportResponse {
  items: WeaknessItem[];
  strongest_area?: string | null;
}

export interface ProblemLeaderboardEntry {
  rank: number;
  student_id: string;
  display_name: string;
  best_score: number;
  helper_points: number;
  latest_submitted_at: string;
}

export interface ProblemLeaderboardResponse {
  problem_id: string;
  total_participants: number;
  my_best_score: number;
  my_rank?: number | null;
  my_percentile: number;
  top_students: ProblemLeaderboardEntry[];
}

export interface ProblemQueueItem extends Problem {
  queue_reason: string;
  priority_score: number;
}

export interface ProblemQueueResponse {
  items: ProblemQueueItem[];
}

export interface PeerHelpMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  is_helpful: boolean;
  created_at: string;
}

export interface PeerHelpThread {
  id: string;
  problem_id: string;
  problem_title: string;
  requester_id: string;
  requester_name: string;
  helper_id: string;
  helper_name: string;
  request_message: string;
  status: string;
  helpful_marked: boolean;
  awarded_points: number;
  created_at: string;
  messages: PeerHelpMessage[];
}

export interface PromiCoachResponse {
  name: string;
  persona: string;
  mode: string;
  message: string;
  checkpoints: string[];
  encouragement: string;
  caution?: string | null;
}

export interface PromiCoachLog {
  id: string;
  problem_id: string;
  mode: string;
  run_version: number;
  message: string;
  checkpoints: string[];
  caution?: string | null;
  created_at: string;
}

export interface PromptComparisonItem {
  submission_id: string;
  problem_id?: string | null;
  problem_title: string;
  created_at: string;
  total_score: number;
  final_score: number;
  summary: string;
  failure_tags: string[];
}

export interface PromptComparisonResponse {
  current?: PromptComparisonItem | null;
  previous?: PromptComparisonItem | null;
  score_delta?: number | null;
  summary_delta: string[];
}

export interface ActivityLogItem {
  id: string;
  action: string;
  target_type: string;
  target_id?: string | null;
  message: string;
  created_at: string;
}

export interface WeeklyReportResponse {
  period_label: string;
  submission_count: number;
  average_score: number;
  best_score: number;
  score_delta?: number | null;
  strength: string;
  repeated_mistake: string;
  next_action: string;
  focus_area: string;
}

export interface ConceptReflectionResponse {
  submission_id: string;
  passed: boolean;
  score: number;
  required_score: number;
  feedback: string;
  missing_points: string[];
  evaluation_method: string;
  question_results?: {
    question_index: number;
    question: string;
    passed: boolean;
    score: number;
    feedback: string;
    missing_points: string[];
  }[];
}
