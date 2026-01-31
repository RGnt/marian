from __future__ import annotations

import json
import time
import asyncio
from typing import AsyncIterator, Optional

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse

from app.schemas.openai_chat import ChatCompletionRequest
from app.core.dependencies import get_chat_runtime
from app.services.chat_runtime import ChatRuntime

router = APIRouter()


def _sse(obj: dict) -> str:
    """
    Helper to format a dict as a Server-Sent Events data line.
    """
    return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"


@router.post("/chat/completions")
async def chat_completions(
    req: ChatCompletionRequest,
    request: Request,
    session_id: Optional[str] = Query(
        None, description="Session ID for conversation history"
    ),
    chat: ChatRuntime = Depends(get_chat_runtime),
):
    """
    OpenAI-compatible Chat Completions endpoint.
    Support streaming and non-streaming responses.
    """
    # -- DEBUGGIES! ---
    print(f"DEBUG INCOMING: Query session_id='{session_id}")
    print(f"DEBUG INCOMING: URL='{request.url}")
    # -- -- -- -- -- --
    created = int(time.time())
    resp_id = f"chatcmpl_{int(time.time() * 1000)}"
    model = req.model or "local-model"

    actual_session_id = (
        session_id or request.headers.get("X-Session-ID") or "default_session"
    )
    print(f"DEBUG INCOMING: Actual session_id='{actual_session_id}")
    # Non streaming
    if not req.stream:
        # Optional non-streaming: collect deltas
        out = []
        async for delta in chat.stream_deltas(
            req.messages, session_id=actual_session_id
        ):
            out.append(delta)
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
            "usage": {
                # Dummy
                "prompt_tokens": 0,
                "completion_tokens": len(out),
                "total_tokens": len(out),
            },
        }

    async def event_gen() -> AsyncIterator[str]:
        # First chunk with role
        yield _sse(
            {
                "id": resp_id,
                "object": "chat.completion.chunk",
                "created": created,
                "model": model,
                "choices": [
                    {"index": 0, "delta": {"role": "assistant"}, "finish_reason": None}
                ],
            }
        )

        try:
            async for delta in chat.stream_deltas(
                req.messages, session_id=actual_session_id, disconnect_check=request
            ):
                if await request.is_disconnected():
                    break

                yield _sse(
                    {
                        "id": resp_id,
                        "object": "chat.completion.chunk",
                        "created": created,
                        "model": model,
                        "choices": [
                            {
                                "index": 0,
                                "delta": {"content": delta},
                                "finish_reason": None,
                            }
                        ],
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
        except Exception as e:
            print(f"Stream error: {e}")
            return

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
