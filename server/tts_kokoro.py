import asyncio
import wave
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from io import BytesIO
from typing import Literal, Optional

import numpy as np
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field

from kokoro import KPipeline

import re

_LINK_RE = re.compile(r"\[([^\]]+)\]\([^)]+\)")  # [text](url)
_IMG_RE = re.compile(r"!\[([^\]]*)\]\([^)]+\)")
_INLINE_CODE_RE = re.compile(r"`([^`]+)`")
_MD_EMPH_RE = re.compile(r"(\*\*|__|\*|_|~~)")
_HEADING_RE = re.compile(r"(?m)^\s{0,3}#{1,6}\s+")
_BLOCKQUOTE_RE = re.compile(r"(?m)^\s{0,3}>\s?")
_LIST_BULLET_RE = re.compile(r"(?m)^\s*[-*+]\s+")
_LIST_NUM_RE = re.compile(r"(?m)^\s*\d+\.\s+")
_MULTI_WS_RE = re.compile(r"[ \t]+")


def replace_fenced_code_blocks(md: str) -> str:
    """
    Replace each fenced code block ```...``` with a single sentence:
    'Check the code below.'
    This keeps the displayed markdown intact (frontend), but audio avoids reading code.
    """
    out = []
    i = 0
    in_code = False
    while i < len(md):
        j = md.find("```", i)
        if j == -1:
            if not in_code:
                out.append(md[i:])
            # if in_code, discard remainder
            break

        if not in_code:
            # keep prose up to fence
            out.append(md[i:j])
            # insert placeholder once per block
            out.append("\nCheck the code below.\n")
            in_code = True
        else:
            # leaving code: discard code content between fences
            in_code = False

        i = j + 3

    return "".join(out)


def markdown_to_tts_text(md: str) -> str:
    s = md or ""
    s = replace_fenced_code_blocks(s)

    # Remove images entirely
    s = _IMG_RE.sub("", s)

    # Convert links to just the visible label
    s = _LINK_RE.sub(r"\1", s)

    # Inline code: remove backticks but keep content
    s = _INLINE_CODE_RE.sub(r"\1", s)

    # Headings, blockquotes: strip syntax
    s = _HEADING_RE.sub("", s)
    s = _BLOCKQUOTE_RE.sub("", s)

    # List markers: keep item text, remove marker
    s = _LIST_BULLET_RE.sub("", s)
    s = _LIST_NUM_RE.sub("", s)

    # Emphasis markers
    s = _MD_EMPH_RE.sub("", s)

    # Normalize whitespace a bit
    s = _MULTI_WS_RE.sub(" ", s)
    s = s.replace("\r\n", "\n").replace("\r", "\n")
    s = re.sub(r"\n{3,}", "\n\n", s)

    return s.strip()


class AudioSpeechRequest(BaseModel):
    input: str = Field(..., min_length=1, max_length=4096)
    model: str
    voice: str
    response_format: Literal["wav", "pcm"] = "wav"
    speed: float = Field(1.0, ge=0.25, le=4.0)
    stream_format: Optional[Literal["sse", "audio"]] = None


@dataclass
class KokoroEngine:
    pipeline: KPipeline
    sample_rate: int = 24000
    # Use default_factory to avoid creating a lock at import time
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    def synthesize_float32(self, text: str, voice: str, speed: float) -> np.ndarray:
        generator = self.pipeline(
            text,
            voice=voice,
            speed=speed,
            split_pattern=r"\n+",
        )
        parts: list[np.ndarray] = []
        for _gs, _ps, audio in generator:
            if audio is None:
                continue
            a = np.asarray(audio, dtype=np.float32)
            if a.size:
                parts.append(a)
        return np.concatenate(parts) if parts else np.zeros((0,), dtype=np.float32)

    @staticmethod
    def float32_to_wav_pcm16_bytes(audio: np.ndarray, sample_rate: int) -> bytes:
        audio = np.asarray(audio, dtype=np.float32)
        audio = np.clip(audio, -1.0, 1.0)
        pcm16 = (audio * 32767.0).astype(np.int16)

        buf = BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(pcm16.tobytes())
        return buf.getvalue()


@asynccontextmanager
async def tts_lifespan(app):
    """
    Router lifespan handler. Runs once when the app starts, and once on shutdown.
    This is the recommended replacement for on_event startup/shutdown. :contentReference[oaicite:1]{index=1}
    """
    pipeline = KPipeline(lang_code="a")
    app.state.kokoro_engine = KokoroEngine(pipeline=pipeline, sample_rate=24000)
    try:
        yield
    finally:
        # Optional cleanup. If Kokoro exposes explicit teardown later, call it here.
        app.state.kokoro_engine = None


router = APIRouter(lifespan=tts_lifespan)


@router.post("/v1/audio/speech")
async def create_speech(req: AudioSpeechRequest, request: Request):
    engine: KokoroEngine | None = getattr(request.app.state, "kokoro_engine", None)
    if engine is None:
        raise HTTPException(status_code=503, detail="TTS engine not initialized")

    text = req.input.strip()
    if not text:
        raise HTTPException(status_code=400, detail="input must be non-empty")

    text_for_tts = markdown_to_tts_text(req.input)

    async with engine.lock:
        audio = await asyncio.to_thread(
            engine.synthesize_float32,
            text_for_tts,
            req.voice,
            req.speed,
        )

    if req.response_format == "pcm":
        audio = np.clip(audio, -1.0, 1.0)
        pcm16 = (audio * 32767.0).astype(np.int16).tobytes()
        return Response(content=pcm16, media_type="application/octet-stream")

    wav_bytes = engine.float32_to_wav_pcm16_bytes(audio, engine.sample_rate)
    return Response(content=wav_bytes, media_type="audio/wav")
