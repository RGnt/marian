from __future__ import annotations

from dataclasses import dataclass
from typing import Any, AsyncIterator, TypedDict, List

from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from langgraph.graph import StateGraph, START, END
from langgraph.config import get_stream_writer

from app.core.settings import Settings
from app.schemas.openai_chat import ChatMessage


class ChatState(TypedDict):
    prompt: str
    response: str


def _messages_to_transcript(messages: List[ChatMessage]) -> str:
    """
    Convert OpenAI-style {role, content} messages into a single prompt string.
    This avoids having to map to PydanticAI internal message types.
    """
    parts: list[str] = []
    for m in messages:
        role = m.role.upper()
        content = (m.content or "").strip()
        if not content:
            continue
        parts.append(f"{role}:\n{content}\n")
    return "\n".join(parts).strip()


@dataclass
class ChatRuntime:
    agent: Agent
    graph: Any 

    async def stream_deltas(self, messages: List[ChatMessage]) -> AsyncIterator[str]:
        transcript = _messages_to_transcript(messages)

        async for chunk in self.graph.astream(
            {"prompt": transcript, "response": ""}, stream_mode="custom"
        ):
            if isinstance(chunk, dict) and chunk.get("type") == "token":
                delta = chunk.get("delta") or ""
                if delta:
                    yield delta


async def build_chat_runtime(settings: Settings) -> ChatRuntime:
    provider = OpenAIProvider(
        base_url=settings.llm_base_url,
        api_key=settings.llm_api_key,
    )
    model = OpenAIChatModel(settings.llm_model, provider=provider)

    agent = Agent(
        model,
        system_prompt=settings.system_prompt,
        output_type=str,
    )

    async def respond_node(state: ChatState) -> ChatState:
        """
        Single-node graph: run the agent and stream token deltas
        """
        writer = get_stream_writer()
        prompt = state["prompt"]

        prev = ""
        async with agent.run_stream(prompt) as result:
            async for full in result.stream_text():
                # PydanticAI yields the *full* text so far; convert to delta
                if not isinstance(full, str):
                    continue
                delta = full[len(prev) :]
                if delta:
                    writer({"type": "token", "delta": delta})
                    prev = full

        return {"prompt": prompt, "response": prev}

    graph = (
        StateGraph(ChatState)
        .add_node("respond", respond_node)
        .add_edge(START, "respond")
        .add_edge("respond", END)
        .compile()
    )

    return ChatRuntime(agent=agent, graph=graph)
