"""
FeedbackAgent — 학생 제출 피드백 생성 에이전트
이전 이력 + 현재 평가 결과 → 캐릭터 피드백 (감정 + 메시지 + 팁 + 격려)
LLM 모드(OpenAI) + Mock 모드(규칙 기반) 지원
"""
import asyncio
import json
from dataclasses import dataclass
from typing import Optional

try:
    from openai import AsyncOpenAI
    _OPENAI_AVAILABLE = True
except ImportError:
    _OPENAI_AVAILABLE = False


@dataclass
class SubmissionHistory:
    prompt_text: str
    total_score: float
    created_at: str  # ISO string


@dataclass
class CharacterFeedback:
    character_name: str          # "프롬이"
    emotion: str                 # happy | encouraging | thinking | concerned | excited | neutral
    main_message: str            # 주요 피드백 메시지 (1~2문장, 캐릭터 말투)
    tips: list[str]              # 개선 팁 2~3개
    encouragement: str           # 응원 메시지
    growth_note: Optional[str]   # 이전 제출 대비 성장 노트 (이력 있을 때만)
    score_delta: Optional[float] # 이전 제출 대비 점수 변화


class FeedbackAgent:
    CHARACTER_NAME = "프롬이"

    def __init__(self, api_key: Optional[str] = None):
        self._api_key = api_key
        self._use_mock = not api_key

    async def generate(
        self,
        problem_title: str,
        problem_description: str,
        current_prompt: str,
        total_score: float,
        criteria_scores: list[dict],   # [{"name": str, "score": float, "max_score": float, "feedback": str}]
        history: list[SubmissionHistory],  # 이전 제출 이력 (최신순)
    ) -> CharacterFeedback:
        if self._use_mock:
            return self._mock_feedback(total_score, criteria_scores, history)
        return await self._llm_feedback(problem_title, problem_description, current_prompt, total_score, criteria_scores, history)

    def _mock_feedback(
        self, total_score: float, criteria_scores: list[dict], history: list[SubmissionHistory]
    ) -> CharacterFeedback:
        # 감정 결정
        if total_score >= 75:
            emotion = "excited" if total_score >= 85 else "happy"
        elif total_score >= 50:
            emotion = "encouraging"
        elif total_score >= 30:
            emotion = "thinking"
        else:
            emotion = "concerned"

        # 성장 노트
        score_delta = None
        growth_note = None
        if history:
            prev_score = history[0].total_score
            score_delta = total_score - prev_score
            if score_delta > 5:
                growth_note = f"지난 제출보다 {score_delta:.1f}점 올랐어요! 성장이 느껴져요 🌱"
            elif score_delta < -5:
                growth_note = f"이번엔 {abs(score_delta):.1f}점 낮아졌지만, 다음엔 분명 더 잘할 수 있어요!"
            else:
                growth_note = "지난 제출과 비슷한 수준이에요. 조금 더 다듬어볼까요?"

        # 주요 피드백 메시지 (점수 구간별)
        if emotion == "excited":
            main_message = f"와아! {total_score:.0f}점이에요! 정말 훌륭한 프롬프트를 작성했어요! 저도 감동받았어요 ✨"
        elif emotion == "happy":
            main_message = f"{total_score:.0f}점, 아주 잘 했어요! 프롬프트의 핵심 요소들을 잘 담았네요 😊"
        elif emotion == "encouraging":
            main_message = f"{total_score:.0f}점이에요! 좋은 시작이에요. 조금만 더 다듬으면 훨씬 좋아질 거예요 💪"
        elif emotion == "thinking":
            main_message = f"음... {total_score:.0f}점이에요. 몇 가지 핵심 요소가 빠져 있어요. 같이 살펴볼까요? 🤔"
        else:
            main_message = f"아직 {total_score:.0f}점이지만 괜찮아요! 프롬프트 작성은 연습이 중요해요. 포기하지 마요! 🌟"

        # 개선 팁 추출 (낮은 점수 기준 상위 3개)
        tips = []
        sorted_criteria = sorted(criteria_scores, key=lambda x: x["score"] / max(x["max_score"], 1))
        for c in sorted_criteria[:3]:
            ratio = c["score"] / max(c["max_score"], 1)
            if ratio < 0.7:
                tips.append(f"'{c['name']}' 부분을 더 구체적으로 작성해 보세요!")
        if not tips:
            tips = ["현재 프롬프트를 실제 AI에 적용해보고 결과를 확인해 보세요!", "다양한 문구로 실험해보는 것도 좋은 방법이에요!"]

        # 응원 메시지
        encouragements = {
            "excited": "이 실력이면 프롬프트 마스터가 될 날이 멀지 않았어요! 계속 도전해요! 🏆",
            "happy": "이 방향으로 계속 연습하면 금방 전문가 수준이 될 거예요! 🎯",
            "encouraging": "한 번 더 수정해보면 훨씬 더 좋아질 거예요. 같이 해봐요! 💫",
            "thinking": "어떤 부분이 어려운지 힌트를 보고 다시 도전해봐요. 할 수 있어요! 🔥",
            "concerned": "처음이라 어렵겠지만, 차근차근 하나씩 해보면 반드시 늘어요! 응원할게요! ⭐",
        }
        encouragement = encouragements.get(emotion, "계속 도전하면 반드시 성장해요! 💪")

        return CharacterFeedback(
            character_name=self.CHARACTER_NAME,
            emotion=emotion,
            main_message=main_message,
            tips=tips,
            encouragement=encouragement,
            growth_note=growth_note,
            score_delta=score_delta,
        )

    async def _llm_feedback(
        self,
        problem_title: str,
        problem_description: str,
        current_prompt: str,
        total_score: float,
        criteria_scores: list[dict],
        history: list[SubmissionHistory],
    ) -> CharacterFeedback:
        if not _OPENAI_AVAILABLE:
            return await self._mock_feedback(
                problem_title, problem_description, current_prompt,
                total_score, criteria_scores, history,
            )
        try:
            client = AsyncOpenAI(api_key=self._api_key)

            history_text = ""
            if history:
                history_text = "\n\n[이전 제출 이력]\n"
                for i, h in enumerate(history[:3], 1):
                    history_text += f"  {i}번째 이전 ({h.created_at[:10]}): 점수={h.total_score:.1f}, 프롬프트 요약={h.prompt_text[:100]}...\n"

            criteria_text = "\n".join([
                f"  - {c['name']}: {c['score']:.1f}/{c['max_score']:.1f}점 — {c['feedback']}"
                for c in criteria_scores
            ])

            system_prompt = """당신은 "프롬이"라는 귀여운 캐릭터입니다.
프롬프트 학습을 도와주는 AI 마스코트예요.
말투는 친근하고 따뜻하며, 학생이 성장할 수 있도록 격려해주세요.
반드시 다음 JSON 형식으로만 응답하세요:
{
  "emotion": "happy|encouraging|thinking|concerned|excited|neutral",
  "main_message": "주요 피드백 (1~2문장, 프롬이 말투로)",
  "tips": ["개선팁1", "개선팁2", "개선팁3"],
  "encouragement": "응원 메시지 (1문장)",
  "growth_note": "이전 제출 대비 성장 메모 또는 null"
}"""

            user_prompt = f"""문제: {problem_title}
현재 제출 점수: {total_score:.1f}/100점

[평가 세부 결과]
{criteria_text}
{history_text}
[현재 프롬프트 일부]
{current_prompt[:300]}

위 정보를 바탕으로 프롬이 캐릭터로서 학생에게 피드백을 주세요."""

            resp = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.7,
                max_tokens=600,
            )
            raw = resp.choices[0].message.content.strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            data = json.loads(raw)

            # score_delta
            score_delta = None
            if history:
                score_delta = total_score - history[0].total_score

            return CharacterFeedback(
                character_name=self.CHARACTER_NAME,
                emotion=data.get("emotion", "neutral"),
                main_message=data.get("main_message", ""),
                tips=data.get("tips", []),
                encouragement=data.get("encouragement", ""),
                growth_note=data.get("growth_note"),
                score_delta=score_delta,
            )
        except Exception:
            return self._mock_feedback(total_score, criteria_scores, history)
