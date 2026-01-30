# app/services/graphiti_embedder_pydanticai.py
from __future__ import annotations

from collections.abc import Iterable
from typing import Optional

from pydantic import Field

from graphiti_core.embedder.client import EmbedderClient, EmbedderConfig

from pydantic_ai import Embedder
from pydantic_ai.embeddings import EmbeddingSettings
from pydantic_ai.embeddings.openai import OpenAIEmbeddingModel
from pydantic_ai.providers.openai import OpenAIProvider


class PydanticAIEmbedderConfig(EmbedderConfig):
    # EmbedderConfig already includes: embedding_dim (default from EMBEDDING_DIM env var). :contentReference[oaicite:2]{index=2}
    embedding_model: str = Field(default="text-embedding-3-small")
    base_url: str = Field(default="http://127.0.0.1:8081/v1")
    api_key: str = Field(default="local")

    # Optional: send OpenAI-style `dimensions` parameter (works for text-embedding-3-*) :contentReference[oaicite:3]{index=3}
    dimensions: Optional[int] = Field(default=None)


class PydanticAIEmbedder(EmbedderClient):
    def __init__(self, config: PydanticAIEmbedderConfig | None = None):
        self.config = config or PydanticAIEmbedderConfig()

        provider = OpenAIProvider(
            base_url=self.config.base_url,
            api_key=self.config.api_key,
        )
        model = OpenAIEmbeddingModel(self.config.embedding_model, provider=provider)

        settings = (
            EmbeddingSettings(dimensions=self.config.dimensions)
            if self.config.dimensions is not None
            else None
        )

        self._embedder = Embedder(model, settings=settings)

    def _normalize_inputs(
        self, input_data: str | list[str] | Iterable[int] | Iterable[Iterable[int]]
    ) -> list[str]:
        if isinstance(input_data, str):
            return [input_data]
        if isinstance(input_data, list):
            return [str(i) for i in input_data if i]
        # iterables of ints / iterables => stringify, filter empties
        out: list[str] = []
        for i in input_data:
            if i is None:
                continue
            out.append(str(i))
        return [s for s in out if s]

    def _assert_dim(self, vec: list[float]) -> list[float]:
        if not vec:
            return vec
        if len(vec) != self.config.embedding_dim:
            raise ValueError(
                f"Embedding dimension mismatch: got {len(vec)} but expected {self.config.embedding_dim}. "
                f"Fix by aligning Settings.graphiti_embedding_dim with the model output, or set "
                f"Settings.graphiti_embedding_dimensions (if your embedding backend supports OpenAI `dimensions`)."
            )
        return vec

    async def create(
        self,
        input_data: str | list[str] | Iterable[int] | Iterable[Iterable[int]],
    ) -> list[float]:
        input_list = self._normalize_inputs(input_data)
        if not input_list:
            return []

        # Single string is most commonly a query
        if isinstance(input_data, str):
            result = await self._embedder.embed_query(input_list[0])
            vec = [float(x) for x in result.embeddings[0]]
            return self._assert_dim(vec)

        # Otherwise treat as documents
        result = await self._embedder.embed_documents(input_list)
        vec = [float(x) for x in result.embeddings[0]]
        return self._assert_dim(vec)

    async def create_batch(self, input_data_list: list[str]) -> list[list[float]]:
        input_list = [s for s in (x.strip() for x in input_data_list) if s]
        if not input_list:
            return []

        result = await self._embedder.embed_documents(input_list)
        out = []
        for emb in result.embeddings:
            vec = [float(x) for x in emb]
            out.append(self._assert_dim(vec))
        return out
