from pydantic import BaseModel, Field


class ThinkingScores(BaseModel):
    """§4.2 사고 데이터 — LLM이 분석하여 점수화 (0.0 ~ 1.0)"""

    # 문제 이해 & 분해
    problem_understanding_score:   float = Field(ge=0.0, le=1.0)
    problem_decomposition_score:   float = Field(ge=0.0, le=1.0)
    constraint_awareness_score:    float = Field(ge=0.0, le=1.0)
    validation_awareness_score:    float = Field(ge=0.0, le=1.0)

    # 프롬프트 개선 & 자기 설명
    improvement_prompt_score:      float = Field(ge=0.0, le=1.0)
    self_explanation_score:        float = Field(ge=0.0, le=1.0)

    # 추론 & 반성
    reasoning_quality_score:       float = Field(ge=0.0, le=1.0)
    reflection_depth_score:        float = Field(ge=0.0, le=1.0)

    # 오류 분석 & 디버깅
    error_analysis_score:          float = Field(ge=0.0, le=1.0)
    debugging_quality_score:       float = Field(ge=0.0, le=1.0)

    # 결정 & 접근
    decision_reasoning_score:      float = Field(ge=0.0, le=1.0)
    approach_selection_score:      float = Field(ge=0.0, le=1.0)

    # 개선 일관성 & 반복 품질
    improvement_consistency_score: float = Field(ge=0.0, le=1.0)
    iteration_quality_score:       float = Field(ge=0.0, le=1.0)


class LLMAnalysisInput(BaseModel):
    student_id: str
    prompt_text: str = Field(min_length=1)
    problem_title: str = ""
    problem_description: str = ""


class LLMAnalysisOutput(BaseModel):
    thinking_scores: ThinkingScores
    analysis_summary: str
    detected_issues: list[str] = Field(default_factory=list)
