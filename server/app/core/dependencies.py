from fastapi import Request
from app.services.chat_runtime import ChatRuntime
from app.services.tts_runtime import KokoroRuntime
from app.services.history import SQLiteChatHistory


def get_chat_runtime(request: Request) -> ChatRuntime:
    """
    Purpose: Resolve the chat runtime from app state.
    How: Reads the `chat` attribute on FastAPI app state and raises if missing.
    Parameters:
        request: Incoming FastAPI request for access to app state.
    Output:
        ChatRuntime: Initialized chat runtime instance.
    """
    runtime = getattr(request.app.state, "chat", None)
    if not runtime:
        raise RuntimeError("Chat runtime not initialized")
    return runtime


def get_tts_runtime(request: Request) -> KokoroRuntime:
    """
    Purpose: Resolve the TTS runtime from app state.
    How: Reads the `tts` attribute on FastAPI app state and raises if missing.
    Parameters:
        request: Incoming FastAPI request for access to app state.
    Output:
        KokoroRuntime: Initialized text-to-speech runtime instance.
    """
    runtime = getattr(request.app.state, "tts", None)
    if not runtime:
        raise RuntimeError("TTS runtime not initialized")
    return runtime


def get_history_service(request: Request) -> SQLiteChatHistory:
    """
    Purpose: Resolve the history service from app state.
    How: Reads the `history` attribute on FastAPI app state and raises if missing.
    Parameters:
        request: Incoming FastAPI request for access to app state.
    Output:
        SQLiteChatHistory: Initialized SQLite history service instance.
    """
    service = getattr(request.app.state, "history", None)
    if not service:
        raise RuntimeError("History service not initialized")
    return service
