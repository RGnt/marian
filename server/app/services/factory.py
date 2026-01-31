from __future__ import annotations

import logging
import os
from typing import Any

from app.core.settings import Settings

logger = logging.getLogger(__name__)


# -------------------------------------------------------------------------
# LANGFUSE FACTORY
# -------------------------------------------------------------------------
def initialize_langfuse(settings: Settings) -> Any | None:
    """
    Attempts to initialize Langfuse. Returns the client or None.
    Safe to call even if Langfuse is not installed or configured.
    """
    if not settings.is_langfuse_enabled:
        logger.info("Langfuse disabled (missing keys).")
        return None

    try:
        from langfuse import get_client

        # 1. Set Envs for the SDK
        os.environ["LANGFUSE_PUBLIC_KEY"] = settings.langfuse_public_key
        os.environ["LANGFUSE_SECRET_KEY"] = settings.langfuse_secret_key
        os.environ["LANGFUSE_BASE_URL"] = settings.langfuse_host

        # 2. Instrument PydanticAI
        try:
            from pydantic_ai import Agent as PydanticAIAgent

            PydanticAIAgent.instrument_all()
        except ImportError:
            logger.warning("PydanticAI not found; skipping instrumentation.")

        # 3. Create Client
        client = get_client()

        # 4. Optional Auth Check
        try:
            if hasattr(client, "auth_check"):
                if not client.auth_check():
                    logger.warning("Langfuse auth_check failed. Check keys.")
                    return None
                logger.info("Langfuse authenticated successfully.")
        except Exception:
            pass  # Non-fatal if auth_check doesn't exist in older SDKs

        return client

    except ImportError:
        logger.warning("Langfuse SDK not installed. Skipping.")
        return None
    except Exception as e:
        logger.warning(f"Langfuse init failed: {e}")
        return None


# -------------------------------------------------------------------------
# GRAPHITI (MEMGRAPH) FACTORY
# -------------------------------------------------------------------------
async def initialize_graphiti(settings: Settings) -> Any | None:
    """
    Attempts to connect to Graphiti (Memgraph).
    Returns the Graphiti client or None if dependencies/connection fail.
    """
    # Fast exit if no credentials/url provided
    if not settings.graphiti_url:
        logger.info("Graphiti URL not set. Memory disabled.")
        return None

    try:
        from graphiti_core import Graphiti
        from graphiti_core.llm_client.config import LLMConfig
        from graphiti_core.llm_client.openai_generic_client import OpenAIGenericClient
        from graphiti_core.embedder.openai import OpenAIEmbedder, OpenAIEmbedderConfig
    except ImportError:
        logger.info("Graphiti Core not installed. Memory disabled.")
        return None

    try:
        logger.info("Initializing Graphiti Memory...")

        # 1. Setup LLM Client for Graphiti (Entity Extraction)
        llm_config = LLMConfig(
            api_key=settings.graphiti_llm_api_key,
            base_url=settings.graphiti_llm_base_url,
            model=settings.graphiti_llm_model,
            small_model=settings.graphiti_llm_small_model,
        )
        llm_client = OpenAIGenericClient(config=llm_config)

        # 2. Setup Embedder
        embedder = None
        if settings.graphiti_embedding_base_url:
            logger.info(
                f"Using custom embedding endpoint: {settings.graphiti_embedding_base_url}"
            )
            embedder_config = OpenAIEmbedderConfig(
                api_key=settings.graphiti_embedding_api_key,
                base_url=settings.graphiti_embedding_base_url,
                embedding_model=settings.graphiti_embedding_model,
                # If your fork supports dimensions config, add it here
            )
            embedder = OpenAIEmbedder(config=embedder_config)

        # 3. Connect
        client = Graphiti(
            settings.graphiti_url,
            settings.graphiti_user,
            settings.graphiti_password,
            embedder=embedder,
            llm_client=llm_client,
        )

        # 4. Initialize Indices
        await client.build_indices_and_constraints()
        logger.info("Graphiti Memory initialized successfully.")
        return client

    except Exception as e:
        logger.error(f"Failed to initialize Graphiti: {e}")
        return None
