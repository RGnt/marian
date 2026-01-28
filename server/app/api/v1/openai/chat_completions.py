from __future__ import annotations

import json
import time
import asyncio
from typing import AsyncIterator

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from app.schemas.openai_chat import ChatCompletionRequest

router = APIRouter()


def _sse(obj: dict) -> str:
    return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"


@router.post("/chat/completions")
async def chat_completions(req: ChatCompletionRequest, request: Request):
    chat = request.app.state.chat
    created = int(time.time())
    resp_id = f"chatcmpl_{int(time.time() * 1000)}"
    model = req.model or request.app.state.settings.llm_model

    if not req.stream:
        # Optional non-streaming: collect deltas
        out = []
        async for d in chat.stream_deltas(req.messages):
            out.append(d)
        text = "".join(out)
        return {
            "id": resp_id,
            "object": "chat.completion",
            "created": created,
            "model": model,
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": text},
                    "finish_reason": "stop",
                }
            ],
        }

    async def event_gen() -> AsyncIterator[str]:
        # First chunk with role
        yield _sse(
            {
                "id": resp_id,
                "object": "chat.completion.chunk",
                "created": created,
                "model": model,
                "choices": [{"index": 0, "delta": {"role": "assistant"}, "finish_reason": None}],
            }
        )

        try:
            async for delta in chat.stream_deltas(req.messages):
                if await request.is_disconnected():
                    break

                yield _sse(
                    {
                        "id": resp_id,
                        "object": "chat.completion.chunk",
                        "created": created,
                        "model": model,
                        "choices": [{"index": 0, "delta": {"content": delta}, "finish_reason": None}],
                    }
                )

            # Final chunk
            yield _sse(
                {
                    "id": resp_id,
                    "object": "chat.completion.chunk",
                    "created": created,
                    "model": model,
                    "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
                }
            )
            yield "data: [DONE]\n\n"

        except asyncio.CancelledError:
            return

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
