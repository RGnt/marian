import asyncio
import json
import os
import time
from typing import Any, Dict, List, Literal, Optional, TypedDict
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel
from pydantic_ai import Agent
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.models.openai import OpenAIChatModel

from langgraph.graph import StateGraph, START, END
from tts_kokoro import router as tts_router

OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
LOCAL_MODEL_NAME = "your-model-name"  # optional; otherwise request.model is used

Role = Literal["system", "user", "assistant", "tool"]


class ChatMessage(BaseModel):
    role: Role
    content: str
    name: Optional[str] = None


class ChatCompletionRequest(BaseModel):
    model: str
    messages: List[ChatMessage]
    stream: bool = False

    temperature: Optional[float] = None
    max_tokens: Optional[int] = None


class GraphState(TypedDict):
    request_id: str
    model: str
    messages: List[Dict[str, Any]]

    prompt: str

    # Streaming plumbing
    stream_queue: "asyncio.Queue[Optional[str]]"  # deltas, then None sentinel

    # Final
    assistant_text: str


def message_to_prompt(messages: List[Dict[str, Any]]) -> str:
    """
    Simple prompt linearization. Good enough for now.
    Later you can preserve full role structure by using a chat-native interface.
    """
    parts: List[str] = []
    for m in messages:
        role = m.get("role", "user")
        content = (m.get("content") or "").strip()
        if not content:
            continue
        parts.append(f"{role.upper()}: {content}")
    parts.append("ASSISTANT:")
    return "\n".join(parts).strip()


def sse_data(payload: Any) -> bytes:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n".encode("utf-8")


def sse_done() -> bytes:
    return b"data: [DONE]\n\n"


def openai_chunk(
    *,
    chunk_id: str,
    created: int,
    model: str,
    delta: Dict[str, Any],
    finish_reason: Optional[str] = None,
) -> Dict[str, Any]:
    return {
        "id": chunk_id,
        "object": "chat.completion.chunk",
        "created": created,
        "model": model,
        "choices": [{"index": 0, "delta": delta, "finish_reason": finish_reason}],
    }


def openai_full_response(
    *, completion_id: str, created: int, model: str, content: str
) -> Dict[str, Any]:
    return {
        "id": completion_id,
        "object": "chat.completion",
        "created": created,
        "model": model,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": content},
                "finish_reason": "stop",
            }
        ],
    }


def build_agent(model_name: str) -> Agent:
    provider = OpenAIProvider(
        base_url="http://localhost:8080", api_key="llama.cpp"
    )
    model = OpenAIChatModel(model_name, provider=provider)
    return Agent(
        model,
        system_prompt=(
            "You are a helpful assistant. Keep responses concise and correct."
        ),
    )


def build_graph(agent: Agent):
    async def prepare_prompt(state: GraphState) -> Dict[str, Any]:
        prompt = message_to_prompt(state["messages"])
        return {"prompt": prompt}

    async def agent_respond(state: GraphState) -> Dict[str, Any]:
        q = state["stream_queue"]
        assistant_text = ""

        try:
            async with agent.run_stream(state["prompt"]) as run:
                async for delta in run.stream_text(delta=True):
                    if not delta:
                        continue
                    assistant_text += delta
                    await q.put(delta)
        except Exception as e:
            await q.put(f"\n[error] {type(e).__name__}: {e}")
        finally:
            await q.put(None)

        return {"assistant_text": assistant_text}

    g = StateGraph(GraphState)
    g.add_node("prepare_prompt", prepare_prompt)
    g.add_node("agent_respond", agent_respond)

    g.add_edge(START, "prepare_prompt")
    g.add_edge("prepare_prompt", "agent_respond")
    g.add_edge("agent_respond", END)

    return g.compile()


app = FastAPI()
app.include_router(tts_router)

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.post("/v1/chat/completions")
async def chat_completions(req: ChatCompletionRequest):
    if not req.messages:
        raise HTTPException(status_code=400, detail="message is required")

    # Choose model
    model_name = os.getenv("LOCAL_MODEL_NAME") or req.model

    agent = build_agent(model_name)
    graph = build_graph(agent)

    created = int(time.time())
    completion_id = f"chatcmpl-{uuid.uuid4()}.hex"

    q: asyncio.Queue[Optional[str]] = asyncio.Queue()

    state: GraphState = {
        "request_id": completion_id,
        "model": model_name,
        "messages": [m.model_dump() for m in req.messages],
        "prompt": "",
        "stream_queue": q,
        "assistant_text": "",
    }

    task = asyncio.create_task(graph.ainvoke(state))

    if req.stream:

        async def event_get():
            yield sse_data(
                openai_chunk(
                    chunk_id=completion_id,
                    created=created,
                    model=model_name,
                    delta={"role": "assistant"},
                )
            )

            while True:
                item = await q.get()
                if item is None:
                    break
                yield sse_data(
                    openai_chunk(
                        chunk_id=completion_id,
                        created=created,
                        model=model_name,
                        delta={"content": item},
                    )
                )

            await task

            yield sse_data(
                openai_chunk(
                    chunk_id=completion_id,
                    created=created,
                    model=model_name,
                    delta={},
                    finish_reason="stop",
                )
            )
            yield sse_done()

        return StreamingResponse(event_get(), media_type="text/event-stream")

    final_state = await task
    content = final_state.get("assistant_text", "")
    return JSONResponse(
        openai_full_response(
            completion_id=completion_id,
            created=created,
            model=model_name,
            content=content,
        )
    )
