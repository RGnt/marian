from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.settings import Settings
from app.services.chat_runtime import build_chat_runtime
from app.services.tts_runtime import build_tts_runtime


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = Settings()
    app.state.settings = settings

    # Heavy init once
    app.state.chat = await build_chat_runtime(settings)
    app.state.tts = await build_tts_runtime(settings)

    yield

    # Optional: cleanup (close clients, etc.) if you add them later.


def create_app() -> FastAPI:
    settings = Settings()

    app = FastAPI(
        title="Local Chat Backend",
        version="0.1.0",
        lifespan=lifespan,
    )

    # CORS (keep enabled if you still access FastAPI directly from a browser)
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
