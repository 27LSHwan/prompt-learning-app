from pydantic import BaseModel, Field
from typing import Optional


class BehavioralData(BaseModel):
    """§4.1 행동 데이터 11개"""
    login_frequency:       float = Field(ge=0.0, description="로그인 빈도 (정규화 0~1)")
    session_duration:      float = Field(ge=0.0, description="세션 시간 (정규화 0~1)")
    submission_interval:   float = Field(ge=0.0, description="제출 간격 (높을수록 위험, 정규화 0~1)")
    drop_midway_rate:      float = Field(ge=0.0, le=1.0, description="중도 포기율 (0~1)")
    attempt_count:         int   = Field(ge=0, description="시도 횟수")
    revision_count:        int   = Field(ge=0, description="수정 횟수")
    retry_count:           int   = Field(ge=0, description="재시도 횟수")
    strategy_change_count: int   = Field(ge=0, description="전략 변경 횟수")
    task_success_rate:     float = Field(ge=0.0, le=1.0, description="과제 성공률 (0~1)")
    quiz_score_avg:        float = Field(ge=0.0, le=1.0, description="퀴즈 평균 점수 (0~1)")
    score_delta:           float = Field(description="점수 변화 (-1~1, 양수=개선)")


class EventFlags(BaseModel):
    """이벤트 보너스 트리거 플래그"""
    sudden_score_drop:    bool = False   # +15
    sudden_activity_drop: bool = False   # +15
    repeated_error:       bool = False   # +10
    no_improvement:       bool = False   # +10
    dependency:           bool = False   # +15
    multi_signal:         bool = False   # +20


class ScoringResult(BaseModel):
    """§6 Scoring Engine 최종 결과"""
    total_risk:    float = Field(ge=0.0, le=100.0)
    base_risk:     float = Field(ge=0.0, le=100.0)
    event_bonus:   float = Field(ge=0.0)
    thinking_risk: float = Field(ge=0.0, le=100.0)

    # 차원별 점수 (디버깅용)
    performance_risk: float
    progress_risk:    float
    engagement_risk:  float
    process_risk:     float

    triggered_events: list[str] = Field(default_factory=list)
