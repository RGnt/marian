from __future__ import annotations

from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.services.factory import initialize_graphiti, initialize_langfuse
from app.services.history import build_history_service

from app.api.router import api_router
from app.core.settings import Settings
from app.services.chat_runtime import build_chat_runtime
from app.services.tts_runtime import build_tts_runtime

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = Settings()
    app.state.settings = settings

    # Initialize Observability (Langfuse) - Safe fail
    app.state.langfuse = initialize_langfuse(settings)

    # Initialize Databases
    # 1. Graphiti (Long-term memory) - safe fail
    memory_client = await initialize_graphiti(settings)
    app.state.memory = memory_client

    # 2. SQLite (Short-term/Conversation History)
    history_service = await build_history_service()
    app.state.history = history_service

    # Init Runtimes
    # Pass both memories to Chat Runtime
    app.state.chat = await build_chat_runtime(
        settings,
        memory_client=memory_client,
        history_service=history_service,
    )

    # Init TTS
    app.state.tts = await build_tts_runtime(settings)

    logger.info("Application startup complete.")
    yield

    # Cleanup
    logger.info("Shutting down...")

    if memory_client:
        try:
            if hasattr(memory_client, "close"):
                await memory_client.close()
            elif hasattr(memory_client, "driver"):
                await memory_client.driver.close()
            logger.info("Graphiti connection closed.")
        except Exception as e:
            logger.error(f"Error closing Graphiti connection: {e}")

    if app.state.langfuse:
        try:
            app.state.langfuse.flush()
            logger.info("Langfuse flushed.")
        except Exception:
            pass


def create_app() -> FastAPI:
    settings = Settings()

    app = FastAPI(
        title="Local STT -> TTS Chat Backend",
        version="0.2.0",
        lifespan=lifespan,
    )

    if settings.cors_allow_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_allow_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    app.include_router(api_router)

    @app.get("/healthz")
    async def healthz():
        return {"ok": True}

    return app


app = create_app()
