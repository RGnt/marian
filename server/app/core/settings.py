from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from typing import List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    llm_base_url: str = Field(default="http://127.0.0.1:8080/v1")
    llm_api_key: str = Field(default="local")
    llm_model: str = Field(default="local-model")

    system_prompt: str = Field(
        default=(
            "You are a helpful assistant. Respond in markdown when useful. "
            "Be concise but complete."
        )
    )

    cors_allow_origins: List[str] = Field(
        default_factory=lambda: ["http://localhost:3000"]
    )

    kokoro_lang_code: str = Field(
        default="a"
    )  # 'a' American English, 'b' British English, etc.
    kokoro_voice: str = Field(
        default="af_heart"
    )  # default voice used in Kokoro examples
    kokoro_speed: float = Field(default=1.0)
    kokoro_split_pattern: str = Field(default=r"\n+")
    kokoro_sample_rate: int = Field(default=24000)

    kokoro_repo_id: str = Field(default="hexgrad/Kokoro-82M")
