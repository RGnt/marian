from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import logging
from typing import Any, AsyncIterator, TypedDict, List

from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from langgraph.graph import StateGraph, START, END
from langgraph.config import get_stream_writer

from app.services.history import SQLiteChatHistory

try:
    from graphiti_core import Graphiti
    from graphiti_core.nodes import EpisodeType  # type: ignore

    graphiti_available = True
except ImportError:
    graphiti_available = False

from app.core.settings import Settings
from app.schemas.openai_chat import ChatMessage

logger = logging.getLogger(__name__)


class ChatState(TypedDict):
    prompt: str
    user_query: str
    response: str


def _messages_to_transcript(messages: List[ChatMessage]) -> str:
    parts: list[str] = []
    for m in messages:
        role = m.role.upper()
        content = (m.content or "").strip()
        if not content:
            continue
        parts.append(f"{role}:\n{content}\n")
    return "\n".join(parts).strip()


def generate_turn_id(content_a: str, content_b: str) -> str:
    """
    Generate a deterministic ID based on content.
    """
    raw = (content_a[:50] + content_b[:50]).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:16]


async def _save_memory_background(
    client: Graphiti | None,
    history: SQLiteChatHistory,
    session_id: str,
    user_content: str,
    assistant_content: str,
):
    """
    1. Save immediate chat history to SQLite
    2. Save episode to Graphiti if available.
    """

    try:
        # 1. Save to SQLite
        if session_id:
            await history.add_message(session_id, "user", user_content)
            await history.add_message(session_id, "assistant", assistant_content)
    except Exception as e:
        logger.error(f"Failed ot save SQLite history: {e}")
    # 2. Save to Graphiti
    if client and graphiti_available:
        try:
            # Deterministic ID prevents duplicates of restart

            turn_id = generate_turn_id(user_content, assistant_content)
            episode_name = f"turn_{turn_id}"

            body = f"User: {user_content}\nAssistant: {assistant_content}"

            await client.add_episode(
                name=episode_name,
                episode_body=body,
                source=EpisodeType.message,  # type: ignore
                source_description="User chat interaction",
                reference_time=datetime.now(timezone.utc),
            )
            logger.debug(f"Saved episode {episode_name} to Graphiti memory.")
        except Exception as e:
            logger.warning(f"Failed to save memory episode: {e}")


@dataclass
class ChatRuntime:
    agent: Agent
    graph: Any
    memory: Graphiti | None
    history: SQLiteChatHistory

    async def stream_deltas(
        self,
        messages: List[ChatMessage],
        session_id: str,
        disconnect_check: Any = None,
    ) -> AsyncIterator[str]:
        # 1. Extract latest user query
        user_query = ""
        for m in reversed(messages):
            if m.role.lower() == "user":
                user_query = (m.content or "").strip()
                break

        # 2. Fetch Chat History (SQLite)
        short_term_msgs = await self.history.get_recent_messages(session_id, limit=6)
        short_term_str = _messages_to_transcript(short_term_msgs)

        # 3. Fetch Long-Term Memory (Graphiti)
        long_term_context = ""
        if self.memory and user_query:
            try:
                results = await self.memory.search(user_query)
                if results:
                    facts = [r.fact for r in results if getattr(r, "fact", None)]
                    if facts:
                        long_term_context = (
                            "RELEVANT LONG-TERM MEMORY (Facts):\n- "
                            + "\n- ".join(facts)
                            + "\n\n"
                        )
            except Exception as e:
                logger.error(f"Error retrieving memory: {e}")

        # 4. Construct Full Prompt
        # Structure: Facts -> Recent History -> Current Input
        current_transcript = _messages_to_transcript(messages)

        full_prompt = (
            f"{long_term_context}"
            f"PREVIOUS CONVERSATION HISTORY:\n{short_term_str}"
            f"CURRENT INTERACTION:\n{current_transcript}"
        )

        # 5. Execute LangGraph / PydanticAI Stream
        async for chunk in self.graph.astream(
            {
                "prompt": full_prompt,
                "response": "",
                "user_query": user_query,
                "session_id": session_id,
            },
            stream_mode="custom",
        ):
            if disconnect_check is not None:
                try:
                    if await disconnect_check.is_disconnected():
                        break
                except Exception:
                    pass

            if isinstance(chunk, dict) and chunk.get("type") == "token":
                delta = chunk.get("delta") or ""
                if delta:
                    yield delta


async def build_chat_runtime(
    settings: Settings,
    memory_client: Graphiti | None,
    history_service: SQLiteChatHistory,
) -> ChatRuntime:
    provider = OpenAIProvider(
        base_url=settings.llm_base_url,
        api_key=settings.llm_api_key,
    )
    model = OpenAIChatModel(settings.llm_model, provider=provider)

    system_prompt_text = settings.system_prompt
    system_prompt_text += (
        "\n\nYou may receive a section titled 'RELEVANT LONG-TERM MEMORY'. "
        "Use it when helpful and accurate."
    )

    agent = Agent(
        model,
        system_prompt=system_prompt_text,
        output_type=str,
        instrument=settings.is_langfuse_enabled,  # <- <- Langfuse works via PydanticAI instrumentation (set up in main.py) + instrument=True here
    )

    async def respond_node(state: ChatState) -> ChatState:
        # Note: 'state' is typed dict, but LangGraph passes it as dict at runtime
        writer = get_stream_writer()

        prompt = state.get("prompt", "")
        user_query = state.get("user_query", "")
        session_id = state.get("session_id", "default")

        response_acc = ""

        try:
            async with agent.run_stream(prompt) as result:
                # Prefer delta streaming if available
                try:
                    async for delta in result.stream_text(delta=True):
                        if not delta:
                            continue
                        writer({"type": "token", "delta": delta})
                        response_acc += delta
                except TypeError:
                    # Fallback: stream full text and compute deltas
                    async for full in result.stream_text():
                        if not isinstance(full, str):
                            continue
                        delta = full[len(response_acc) :]
                        if delta:
                            writer({"type": "token", "delta": delta})
                            response_acc = full
        except Exception as e:
            logger.error(f"Agent run failed: {e}")
            response_acc = f"[Error generating response: {e}]"
            writer({"type": "token", "delta": response_acc})

        # lunch BG save
        # Save to SQLite (history) and Graphiti (memory)
        asyncio.create_task(
            _save_memory_background(
                memory_client, history_service, session_id, user_query, response_acc
            )
        )

        return {
            "prompt": prompt,
            "response": response_acc,
            "user_query": user_query,
        }

    # Graph def
    workflow = StateGraph(ChatState)
    workflow.add_node("respond", respond_node)
    workflow.add_edge(START, "respond")
    workflow.add_edge("respond", END)

    graph = workflow.compile()

    return ChatRuntime(
        agent=agent,
        graph=graph,
        memory=memory_client,
        history=history_service,
    )
