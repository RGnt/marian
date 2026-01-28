from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import Response

from app.schemas.openai_audio import SpeechRequest

router = APIRouter()


@router.post("/audio/speech")
async def audio_speech(req: SpeechRequest, request: Request):
    """
    OpenAI-compatible: POST /v1/audio/speech
    Returns raw audio bytes. We currently support WAV only.
    """
    tts = request.app.state.tts

    wav_bytes = await tts.synthesize_wav(
        text_markdown=req.input,
        voice=req.voice,
        speed=req.speed,
    )

    return Response(
        content=wav_bytes,
        media_type="audio/wav",
        headers={
            "Content-Disposition": 'inline; filename="speech.wav"',
        },
    )
