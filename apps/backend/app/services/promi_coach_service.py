import json
from dataclasses import dataclass
from typing import Optional

try:
    from openai import AsyncOpenAI
    _OPENAI_AVAILABLE = True
except ImportError:
    _OPENAI_AVAILABLE = False


@dataclass
class PromiCoachFeedback:
    name: str
    persona: str
    mode: str
    message: str
    checkpoints: list[str]
    encouragement: str
    caution: Optional[str] = None


class PromiCoachService:
    CHARACTER_NAME = "프롬이"
    PERSONA = "강아지 코치"

    def __init__(self, api_key: str = "", model: str = "gpt-4o-mini"):
        self._api_key = api_key or ""
        self._model = model or "gpt-4o-mini"
        self._use_mock = not self._api_key or not _OPENAI_AVAILABLE

    async def generate(
        self,
        problem_title: str,
        problem_description: str,
        system_prompt: str,
        user_template: str,
        test_input: str,
        few_shots: list[dict],
        latest_response: str | None,
        mode: str,
    ) -> PromiCoachFeedback:
        if self._use_mock:
            return self._mock_feedback(
                problem_title=problem_title,
                system_prompt=system_prompt,
                user_template=user_template,
                test_input=test_input,
                few_shots=few_shots,
                latest_response=latest_response,
                mode=mode,
            )
        return await self._llm_feedback(
            problem_title=problem_title,
            problem_description=problem_description,
            system_prompt=system_prompt,
            user_template=user_template,
            test_input=test_input,
            few_shots=few_shots,
            latest_response=latest_response,
            mode=mode,
        )

    def _mock_feedback(
        self,
        problem_title: str,
        system_prompt: str,
        user_template: str,
        test_input: str,
        few_shots: list[dict],
        latest_response: str | None,
        mode: str,
    ) -> PromiCoachFeedback:
        checkpoints: list[str] = []
        caution: Optional[str] = None

        if len(system_prompt.strip()) < 40:
            checkpoints.append("역할과 목표를 한 문장 더 구체적으로 적어주세요.")
        else:
            checkpoints.append("문제 목표는 잘 잡혔어요. 이제 출력 기준을 더 선명하게 해볼까요?")

        if "{{input}}" not in user_template:
            checkpoints.append("실행용 프롬프트에 {{input}} 자리를 넣어 테스트 입력이 자연스럽게 들어가게 해주세요.")
        else:
            checkpoints.append("테스트 입력이 들어갈 자리는 잘 연결되어 있어요.")

        if not any((item.get("input") or "").strip() and (item.get("output") or "").strip() for item in few_shots):
            checkpoints.append("Few-shot 예시를 1개만 추가해도 답변 톤과 형식이 훨씬 안정돼요.")
        else:
            checkpoints.append("Few-shot 예시가 있어서 응답 패턴을 잡기 좋아요.")

        lower_response = (latest_response or "").lower()
        if any(word in lower_response for word in ["정답", "답은", "the answer", "final answer"]):
            caution = "답을 바로 말하게 하기보다, 판단 기준이나 단계만 설명하도록 다시 유도해보세요."
        elif mode == "submit":
            caution = "제출 전에는 정답 자체보다 형식, 제약, 예외 처리 지시가 빠지지 않았는지 확인해보세요."

        if mode == "enter":
            message = f"{problem_title} 문제에 들어왔네요. 저는 강아지 코치 프롬이예요. 답 대신 방향을 같이 잡아드릴게요."
            encouragement = "먼저 역할, 목표, 출력 형식 세 가지부터 맞추면 출발이 훨씬 좋아져요."
        elif mode == "submit":
            message = "제출 직전이에요. 지금 채택된 버전이 문제 요구를 빠짐없이 담았는지 마지막으로 점검해볼게요."
            encouragement = "정답을 더 길게 쓰는 것보다, 지시를 더 선명하게 쓰는 편이 점수에 더 도움이 돼요."
        else:
            message = "방금 실행 결과를 바탕으로 다음 수정 방향을 잡아볼게요. 답을 바꾸기보다 지시를 다듬는 쪽으로 가보죠."
            encouragement = "한 번에 전부 고치지 말고, 역할 또는 형식 한 가지씩만 바꿔보면 비교가 쉬워져요."

        return PromiCoachFeedback(
            name=self.CHARACTER_NAME,
            persona=self.PERSONA,
            mode=mode,
            message=message,
            checkpoints=checkpoints[:3],
            encouragement=encouragement,
            caution=caution,
        )

    async def _llm_feedback(
        self,
        problem_title: str,
        problem_description: str,
        system_prompt: str,
        user_template: str,
        test_input: str,
        few_shots: list[dict],
        latest_response: str | None,
        mode: str,
    ) -> PromiCoachFeedback:
        client = AsyncOpenAI(api_key=self._api_key)
        few_shot_summary = []
        for index, item in enumerate(few_shots[:3], start=1):
            input_text = (item.get("input") or "").strip()
            output_text = (item.get("output") or "").strip()
            if input_text or output_text:
                few_shot_summary.append(f"{index}. 입력={input_text[:120]} / 출력={output_text[:120]}")

        system_instruction = """당신은 '프롬이'라는 이름의 강아지 코치입니다.
학생이 프롬프트 문제를 풀 때 옆에서 방향을 잡아주는 역할만 합니다.
절대 정답, 완성 답안, 직접적인 해결 문장을 제공하지 마세요.
대신 학생이 다음에 무엇을 점검하고 어떻게 수정해야 하는지 코칭하세요.
항상 한국어로 답하고, 친근하지만 과하지 않게 짧고 명확하게 말하세요.
반드시 아래 JSON 형식으로만 응답하세요.
{
  "message": "학생에게 주는 핵심 코칭 1~2문장",
  "checkpoints": ["점검 포인트 1", "점검 포인트 2", "점검 포인트 3"],
  "encouragement": "짧은 응원 한 문장",
  "caution": "직접 답변 유도 방지 또는 주의 문구, 없으면 null"
}"""

        user_prompt = (
            f"[문제]\n제목: {problem_title}\n설명: {problem_description[:700]}\n\n"
            f"[학생 초안 프롬프트]\n{system_prompt[:1200] or '(비어 있음)'}\n\n"
            f"[실행용 프롬프트]\n{user_template[:800]}\n\n"
            f"[테스트 입력]\n{test_input[:500] or '(비어 있음)'}\n\n"
            f"[Few-shot]\n{chr(10).join(few_shot_summary) if few_shot_summary else '(없음)'}\n\n"
            f"[최근 모델 응답]\n{(latest_response or '(없음)')[:1000]}\n\n"
            f"[코칭 모드]\n{mode}\n\n"
            "학생이 다음에 무엇을 수정하면 좋을지 방향만 안내해주세요. 답안은 절대 주지 마세요."
        )

        try:
            response = await client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.6,
                max_tokens=500,
                response_format={"type": "json_object"},
            )
            raw = response.choices[0].message.content or "{}"
            data = json.loads(raw)
            checkpoints = data.get("checkpoints") or []
            if not isinstance(checkpoints, list):
                checkpoints = []
            caution = data.get("caution")
            if caution == "":
                caution = None
            return PromiCoachFeedback(
                name=self.CHARACTER_NAME,
                persona=self.PERSONA,
                mode=mode,
                message=data.get("message", "지시를 더 선명하게 다듬어보면 좋겠어요."),
                checkpoints=[str(item) for item in checkpoints[:3]],
                encouragement=data.get("encouragement", "한 단계씩 다듬으면 훨씬 좋아질 수 있어요."),
                caution=str(caution) if caution is not None else None,
            )
        except Exception:
            return self._mock_feedback(
                problem_title=problem_title,
                system_prompt=system_prompt,
                user_template=user_template,
                test_input=test_input,
                few_shots=few_shots,
                latest_response=latest_response,
                mode=mode,
            )
