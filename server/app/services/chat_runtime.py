from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
import logging
from typing import Any, AsyncIterator, TypedDict, List

from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from langgraph.graph import StateGraph, START, END
from langgraph.config import get_stream_writer
try:
    from graphiti_core import Graphiti
    from graphiti_core.nodes import EpisodeType  # type: ignore
    memory_available = True
except ImportError:
    memory_available = False

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


async def _save_memory_background(
    client: "Graphiti",  # type: ignore
    user_content: str,
    assistant_content: str,
):
    if memory_available:
        try:
            episode_name = f"turn_{hash(user_content[:50] + assistant_content[:50])}"
            body = f"User: {user_content}\nAssistant: {assistant_content}"

            await client.add_episode(
                name=episode_name,
                episode_body=body,
                source=EpisodeType.message, # type: ignore
                source_description="User chat interaction",
                reference_time=datetime.now(timezone.utc),
            )
            logger.debug("Saved episode to Graphiti memory.")
        except Exception as e:
            logger.warning(f"Failed to save memory episode: {e}")


@dataclass
class ChatRuntime:
    agent: Agent
    graph: Any
    memory: Graphiti | None

    async def stream_deltas(
        self,
        messages: List[ChatMessage],
        disconnect_check: Any = None,
    ) -> AsyncIterator[str]:
        user_query = ""
        for m in reversed(messages):
            if m.role.lower() == "user":
                user_query = (m.content or "").strip()
                break

        transcript = _messages_to_transcript(messages)

        context_str = ""
        if self.memory and user_query:
            try:
                results = await self.memory.search(user_query)
                if results:
                    facts = [r.fact for r in results if getattr(r, "fact", None)]
                    if facts:
                        context_str = (
                            "RELEVANT LONG-TERM MEMORY:\n- "
                            + "\n- ".join(facts)
                            + "\n\n"
                        )
            except Exception as e:
                logger.error(f"Error retrieving memory: {e}")

        full_prompt = f"{context_str}TRANSCRIPT:\n{transcript}"

        async for chunk in self.graph.astream(
            {"prompt": full_prompt, "response": "", "user_query": user_query},
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

    # Langfuse works via PydanticAI instrumentation (set up in main.py) + instrument=True here
    agent = Agent(
        model,
        system_prompt=system_prompt_text,
        output_type=str,
        instrument=settings.is_langfuse_enabled,
    )

    async def respond_node(state: ChatState) -> ChatState:
        writer = get_stream_writer()

        prompt = state["prompt"]
        user_query = state.get("user_query", "")
        response_acc = ""

        async with agent.run_stream(prompt) as result:
            # Prefer delta streaming if available in your installed PydanticAI
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
        if memory_available:
            asyncio.create_task(
                _save_memory_background(memory_client, user_query, response_acc) # type: ignore
            )

        return {"prompt": prompt, "response": response_acc, "user_query": user_query}

    graph = (
        StateGraph(ChatState)
        .add_node("respond", respond_node)
        .add_edge(START, "respond")
        .add_edge("respond", END)
        .compile()
    )

    return ChatRuntime(
        agent=agent,
        graph=graph,
        memory=memory_client,
    )
