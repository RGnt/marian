import asyncio
from typing import AsyncIterator
from schemas.openai_chat import ChatCompletionRequest


class ChatRuntime:
    def __init__(self, agent, graph):
        self.agent = agent
        self.graph = graph

    async def complete(self, req: ChatCompletionRequest) -> str:
        result = await self.graph.ainvoke(
            {"messages": [m.model_dump() for m in req.messages]}
        )
        return result["output_text"]

    async def stream(
        self, req: ChatCompletionRequest, disconnect_check=None
    ) -> AsyncIterator[str]:
        q: asyncio.Queue[str | None] = asyncio.Queue()

        async def producer():
            try:
                async for token in self._agent_stream_tokens(req):
                    await q.put(token)
            finally:
                await q.put(None)

        task = asyncio.create_task(producer())

        try:
            while True:
                if (
                    disconnect_check is not None
                    and await disconnect_check.is_disconnected()
                ):
                    task.cancel()
                    break

                item = await q.get()
                if item is None:
                    break
                yield item
        finally:
            if not task.done():
                task.cancel()

    async def _agent_stream_tokens(
        self, req: ChatCompletionRequest
    ) -> AsyncIterator[str]:
        ...
        yield "token"
