from __future__ import annotations
from abc import ABC, abstractmethod
from typing import List, Any
import logging
from datetime import datetime, timezone
import hashlib

logger = logging.getLogger(__name__)

class MemoryClient(ABC):
    @abstractmethod
    async def search(self, query: str) -> List[str]:
        """Search for relevant facts/context based on the query."""
        pass

    @abstractmethod
    async def add_turn(self, user_content: str, assistant_content: str) -> None:
        """Save a conversation turn to long-term memory."""
        pass

    @abstractmethod
    async def close(self) -> None:
        """Close any underlying connections."""
        pass

class NoOpMemoryClient(MemoryClient):
    async def search(self, query: str) -> List[str]:
        return []

    async def add_turn(self, user_content: str, assistant_content: str) -> None:
        pass

    async def close(self) -> None:
        pass

class GraphitiMemoryClient(MemoryClient):
    def __init__(self, client: Any):
        self.client = client

    async def search(self, query: str) -> List[str]:
        try:
            results = await self.client.search(query)
            if results:
                # Extract 'fact' attribute from results
                return [r.fact for r in results if getattr(r, "fact", None)]
        except Exception as e:
            logger.error(f"Error retrieving memory: {e}")
        return []

    async def add_turn(self, user_content: str, assistant_content: str) -> None:
        try:
            # We need EpisodeType here.
            # Since we wrap an initialized client, we can assume the library is installed.
            from graphiti_core.nodes import EpisodeType

            # Deterministic ID (logic copied from chat_runtime)
            # Use a simple hash of the content to avoid duplicates on restart
            raw = (user_content[:50] + assistant_content[:50]).encode("utf-8")
            turn_id = hashlib.sha256(raw).hexdigest()[:16]
            episode_name = f"turn_{turn_id}"
            body = f"User: {user_content}\nAssistant: {assistant_content}"

            await self.client.add_episode(
                name=episode_name,
                episode_body=body,
                source=EpisodeType.message,
                source_description="User chat interaction",
                reference_time=datetime.now(timezone.utc),
            )
            logger.debug(f"Saved episode {episode_name} to Graphiti memory.")
        except ImportError:
             logger.error("graphiti_core not installed but GraphitiMemoryClient used.")
        except Exception as e:
            logger.warning(f"Failed to save memory episode: {e}")

    async def close(self) -> None:
        try:
            if hasattr(self.client, "close"):
                await self.client.close()
            elif hasattr(self.client, "driver"):
                await self.client.driver.close()
            logger.info("Graphiti connection closed.")
        except Exception as e:
            logger.error(f"Error closing Graphiti connection: {e}")
