from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field

AudioFormat = Literal["wav"]


class SpeechRequest(BaseModel):
    # OpenAI-compatible fields
    model: str = Field(default="kokoro")
    input: str
    voice: Optional[str] = None
    response_format: AudioFormat = "wav"
    speed: Optional[float] = None
