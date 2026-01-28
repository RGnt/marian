from __future__ import annotations

from fastapi import APIRouter

from .v1.openai.chat_completions import router as chat_router
from .v1.openai.audio_speech import router as speech_router

api_router = APIRouter()
api_router.include_router(chat_router, prefix="/v1", tags=["openai"])
api_router.include_router(speech_router, prefix="/v1", tags=["openai"])
