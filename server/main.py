from __future__ import annotations

from contextlib import asynccontextmanager
import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    from graphiti_core import Graphiti
    from graphiti_core.llm_client.config import LLMConfig
    from graphiti_core.llm_client.openai_generic_client import OpenAIGenericClient
    from graphiti_core.embedder.openai import OpenAIEmbedder, OpenAIEmbedderConfig

    memory_available = True
except ImportError:
    memory_available = False

try:
    from langfuse import get_client as langfuse_get_client

    langfuse_available = True
except ImportError:
    langfuse_available = False

from app.api.router import api_router
from app.core.settings import Settings
from app.services.chat_runtime import build_chat_runtime
from app.services.tts_runtime import build_tts_runtime

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = Settings()
    app.state.settings = settings
    memory_client = None
    langfuse_client = None

    if langfuse_available:
        try:
            # Langfuse reads these env vars
            os.environ["LANGFUSE_PUBLIC_KEY"] = settings.langfuse_public_key or ""
            os.environ["LANGFUSE_SECRET_KEY"] = settings.langfuse_secret_key or ""
            os.environ["LANGFUSE_BASE_URL"] = settings.langfuse_host

            # Enable PydanticAI instrumentation globally
            from pydantic_ai import Agent as PydanticAIAgent

            PydanticAIAgent.instrument_all()

            langfuse_client = langfuse_get_client() # type: ignore
            try:
                if not langfuse_client.auth_check():
                    logger.warning(
                        "Langfuse auth_check failed. Verify keys and LANGFUSE_BASE_URL."
                    )
                else:
                    logger.info("Langfuse authenticated.")
            except Exception:
                # auth_check may not exist depending on SDK version; not fatal
                logger.info("Langfuse client created (no auth_check available).")

        except Exception as e:
            logger.warning(
                f"Langfuse init failed; continuing without tracing. Error: {e}"
            )
            langfuse_client = None

    app.state.langfuse = langfuse_client

    # Graphiti (Memory)

    logger.info("Initializing Graphiti Memory...")
    if memory_available:
        try:
            llm_config = LLMConfig( # type: ignore
                api_key=settings.graphiti_llm_api_key,
                base_url=settings.graphiti_llm_base_url,
                model=settings.graphiti_llm_model,
                small_model=settings.graphiti_llm_small_model,
            )
            llm_client = OpenAIGenericClient(config=llm_config) # type: ignore
            embedder = None
            if settings.graphiti_embedding_base_url and OpenAIEmbedder: # type: ignore
                logger.info(
                    f"Using custom embedding endpoint: {settings.graphiti_embedding_base_url}"
                )
                embedder_config = OpenAIEmbedderConfig( # type: ignore
                    api_key=settings.graphiti_embedding_api_key,
                    base_url=settings.graphiti_embedding_base_url,
                    embedding_model=settings.graphiti_embedding_model,
                )  # type: ignore
                embedder = OpenAIEmbedder(config=embedder_config)

            memory_client = Graphiti( # type: ignore
                settings.graphiti_url,
                settings.graphiti_user,
                settings.graphiti_password,
                embedder=embedder,
                llm_client=llm_client,
            )

            await memory_client.build_indices_and_constraints()
            logger.info("Graphiti Memory initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize Graphiti: {e}")

    app.state.chat = await build_chat_runtime(settings, memory_client=memory_client)
    app.state.tts = await build_tts_runtime(settings)

    app.state.memory = memory_client

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

    if langfuse_client:
        try:
            langfuse_client.flush()
        except Exception:
            pass


def create_app() -> FastAPI:
    settings = Settings()

    app = FastAPI(
        title="Local STT -> TTS Chat Backend",
        version="0.1.1",
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
