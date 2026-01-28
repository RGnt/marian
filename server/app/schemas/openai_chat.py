from __future__ import annotations

from typing import Any, Literal, List, Optional
from pydantic import BaseModel, Field

Role = Literal["system", "user", "assistant", "tool"]


class ChatMessage(BaseModel):
    role: Role
    content: str


class ChatCompletionRequest(BaseModel):
    model: str = Field(default="local-model")
    messages: List[ChatMessage]
    stream: bool = True

    # Optional knobs (accepted for compatibility; may not be used)
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    metadata: Optional[dict[str, Any]] = None
