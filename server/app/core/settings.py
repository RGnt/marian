from __future__ import annotations

from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Main LLM (Generation)
    llm_base_url: str = Field(default="http://127.0.0.1:8080/v1")
    llm_api_key: str = Field(default="local")
    llm_model: str = Field(default="local-model")

    system_prompt: str = Field(
        default=(
            "You are a helpful assistant. Respond in markdown when useful. "
            "Be concise but complete."
        )
    )

    # CORS
    cors_allow_origins: List[str] = Field(
        default_factory=lambda: ["http://localhost:3001"]
    )

    # TTS (Kokoro)
    kokoro_lang_code: str = Field(default="a")
    kokoro_voice: str = Field(default="af_heart")
    kokoro_speed: float = Field(default=1.0)
    kokoro_split_pattern: str = Field(default=r"\n+")
    kokoro_sample_rate: int = Field(default=24000)
    kokoro_repo_id: str = Field(default="hexgrad/Kokoro-82M")

    # Graphiti (Memory)
    graphiti_url: str | None = Field(default="bolt://localhost:7687")
    graphiti_user: str | None = Field(default="neo4j")
    graphiti_password: str | None = Field(default="supahsecret")
    # Graphiti (LLM used for extraction)
    graphiti_llm_base_url: str = Field(default="http://127.0.0.1:8080/v1")
    graphiti_llm_api_key: str = Field(default="local")
    graphiti_llm_model: str = Field(default="local-model")
    graphiti_llm_small_model: str = Field(default="local-model")

    # Graphiti Embedding
    graphiti_embedding_base_url: Optional[str] = Field(
        default="http://127.0.0.1:8081/v1",
        description="OpenAI-compatible embeddings endpoint base URL (must include /v1).",
    )

    # Embeddings endpoint (OpenAI-compatible)
    graphiti_embedding_base_url: Optional[str] = Field(
        default="http://127.0.0.1:8081/v1",
        description="OpenAI-compatible embeddings base URL (must include /v1)",
    )
    graphiti_embedding_api_key: str = Field(default="sk-placeholder")
    graphiti_embedding_model: str = Field(default="Qwen3-embedding-0.6B-Q8_0")

    # Expected dimension used by Graphiti vector index.
    # Qwen3-Embedding-0.6B defaults to 1024. :contentReference[oaicite:4]{index=4}
    graphiti_embedding_dim: int = Field(default=1024)

    # Optional: request a smaller embedding vector size (if your embedding server supports it).
    # For OpenAIEmbeddings this maps to the `dimensions` parameter. :contentReference[oaicite:5]{index=5}
    graphiti_embedding_dimensions: Optional[int] = Field(default=None)

    # Langfuse (Observability)
    langfuse_secret_key: Optional[str] = Field(
        default="sk-lf-829cb373-d0af-436d-9d2a-174c3f772eda"
    )
    langfuse_public_key: Optional[str] = Field(
        default="pk-lf-f46d9e25-06c6-4f8f-88c4-4221e2233b8f"
    )

    # Self-hosted usually runs at http://localhost:3000
    # Langfuse expects this as LANGFUSE_BASE_URL. :contentReference[oaicite:6]{index=6}
    langfuse_host: str = Field(default="http://localhost:3000")

    @property
    def is_langfuse_enabled(self) -> bool:
        return bool(self.langfuse_public_key and self.langfuse_secret_key)
