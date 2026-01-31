from fastapi import Request
from app.services.chat_runtime import ChatRuntime
from app.services.tts_runtime import KokoroRuntime
from app.services.history import SQLiteChatHistory


def get_chat_runtime(request: Request) -> ChatRuntime:
    runtime = getattr(request.app.state, "chat", None)
    if not runtime:
        raise RuntimeError("Chat runtime not initialized")
    return runtime


def get_tts_runtime(request: Request) -> KokoroRuntime:
    runtime = getattr(request.app.state, "tts", None)
    if not runtime:
        raise RuntimeError("TTS runtime not initialized")
    return runtime


def get_history_service(request: Request) -> SQLiteChatHistory:
    service = getattr(request.app.state, "history", None)
    if not service:
        raise RuntimeError("History service not initialized")
    return service
