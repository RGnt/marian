from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import Response

from app.schemas.openai_audio import SpeechRequest

router = APIRouter()


@router.post("/audio/speech")
async def audio_speech(req: SpeechRequest, request: Request):
    """
    Purpose: Serve an OpenAI-compatible text-to-speech endpoint.
    How: Uses the initialized TTS runtime to synthesize speech from markdown,
    then returns raw WAV bytes.
    Parameters:
        req: Validated speech request payload (text, voice, speed, format).
        request: FastAPI request for access to the app TTS runtime.
    Output:
        Response: WAV audio response with appropriate headers.
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
