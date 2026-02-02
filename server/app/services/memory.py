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
        """
        Purpose: Look up relevant facts or context for a query.
        How: Delegated to the concrete memory backend implementation.
        Parameters:
            query: User query or context string.
        Output:
            List[str]: List of fact strings or snippets.
        """
        pass

    @abstractmethod
    async def add_turn(self, user_content: str, assistant_content: str) -> None:
        """
        Purpose: Persist a user/assistant turn to long-term memory.
        How: Delegated to the concrete memory backend implementation.
        Parameters:
            user_content: User message text.
            assistant_content: Assistant response text.
        Output:
            None: Side effects only.
        """
        pass

    @abstractmethod
    async def close(self) -> None:
        """
        Purpose: Close any underlying client connections.
        How: Delegated to the concrete memory backend implementation.
        Parameters:
            None.
        Output:
            None: Side effects only.
        """
        pass

class NoOpMemoryClient(MemoryClient):
    async def search(self, query: str) -> List[str]:
        """
        Purpose: Provide a safe no-op search implementation.
        How: Returns an empty list without performing any IO.
        Parameters:
            query: User query (unused).
        Output:
            List[str]: Empty list.
        """
        return []

    async def add_turn(self, user_content: str, assistant_content: str) -> None:
        """
        Purpose: Provide a safe no-op write implementation.
        How: Does nothing.
        Parameters:
            user_content: User message text (unused).
            assistant_content: Assistant response text (unused).
        Output:
            None: No side effects.
        """
        pass

    async def close(self) -> None:
        """
        Purpose: Provide a safe no-op close implementation.
        How: Does nothing.
        Parameters:
            None.
        Output:
            None: No side effects.
        """
        pass

class GraphitiMemoryClient(MemoryClient):
    def __init__(self, client: Any):
        """
        Purpose: Wrap a Graphiti client with the MemoryClient interface.
        How: Stores the provided client instance.
        Parameters:
            client: Initialized Graphiti client instance.
        Output:
            None: Initializes instance state.
        """
        self.client = client

    async def search(self, query: str) -> List[str]:
        """
        Purpose: Search Graphiti for relevant memory facts.
        How: Delegates to the Graphiti client and extracts the `fact` attribute
        from result nodes.
        Parameters:
            query: User query or context string.
        Output:
            List[str]: Extracted fact strings, possibly empty on errors.
        """
        try:
            results = await self.client.search(query)
            if results:
                # Extract 'fact' attribute from results
                return [r.fact for r in results if getattr(r, "fact", None)]
        except Exception as e:
            logger.error(f"Error retrieving memory: {e}")
        return []

    async def add_turn(self, user_content: str, assistant_content: str) -> None:
        """
        Purpose: Save a conversation turn into Graphiti memory.
        How: Creates a deterministic episode id, then adds an episode node
        with the user and assistant content.
        Parameters:
            user_content: User message text.
            assistant_content: Assistant response text.
        Output:
            None: Side effects only.
        """
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
        """
        Purpose: Close the underlying Graphiti client connection.
        How: Attempts to close a client or driver if present.
        Parameters:
            None.
        Output:
            None: Side effects only.
        """
        try:
            if hasattr(self.client, "close"):
                await self.client.close()
            elif hasattr(self.client, "driver"):
                await self.client.driver.close()
            logger.info("Graphiti connection closed.")
        except Exception as e:
            logger.error(f"Error closing Graphiti connection: {e}")
