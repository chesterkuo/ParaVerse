"""OpenAI-compatible language model wrapper for Concordia.

Uses the OpenAI SDK pointed at Gemini's OpenAI-compatible endpoint.
"""
import os
from collections.abc import Collection, Mapping, Sequence

from openai import OpenAI

from concordia.language_model.language_model import LanguageModel


class GeminiLanguageModel(LanguageModel):
    """Concordia LanguageModel backed by Gemini via OpenAI-compatible API."""

    def __init__(
        self,
        model_name: str | None = None,
        api_key: str | None = None,
        base_url: str | None = None,
    ):
        self._model = model_name or os.environ.get("LLM_MODEL_GENERAL", "gemini-2.5-flash")
        self._client = OpenAI(
            api_key=api_key or os.environ.get("LLM_API_KEY", ""),
            base_url=base_url or os.environ.get(
                "LLM_BASE_URL",
                "https://generativelanguage.googleapis.com/v1beta/openai/",
            ),
        )

    def sample_text(
        self,
        prompt: str,
        *,
        max_tokens: int = 5000,
        terminators: Collection[str] = (),
        temperature: float = 1.0,
        top_p: float = 0.95,
        top_k: int = 64,
        timeout: float = 60,
        seed: int | None = None,
    ) -> str:
        response = self._client.chat.completions.create(
            model=self._model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            temperature=min(temperature, 2.0),  # Gemini max temp
            top_p=top_p,
            timeout=timeout,
        )
        content = response.choices[0].message.content or ""

        # Apply terminators
        for term in terminators:
            idx = content.find(term)
            if idx >= 0:
                content = content[:idx]

        return content

    def sample_choice(
        self,
        prompt: str,
        responses: Sequence[str],
        *,
        seed: int | None = None,
    ) -> tuple[int, str, Mapping[str, object]]:
        choice_text = "\n".join(
            f"{i+1}. {r}" for i, r in enumerate(responses)
        )
        full_prompt = (
            f"{prompt}\n\n"
            f"Choose one of the following options by responding with ONLY the number:\n"
            f"{choice_text}\n\n"
            f"Your choice (number only):"
        )

        response = self._client.chat.completions.create(
            model=self._model,
            messages=[{"role": "user", "content": full_prompt}],
            max_tokens=10,
            temperature=0.3,
        )
        text = (response.choices[0].message.content or "").strip()

        # Parse the choice number
        for i, resp in enumerate(responses):
            if str(i + 1) in text or resp.lower() in text.lower():
                return i, resp, {}

        # Default to first option
        return 0, responses[0], {"parse_failed": True, "raw": text}
