// routes/v1/sessions/$sessionId.ts
import { createFileRoute } from "@tanstack/react-router";

const FASTAPI_BASE_URL = process.env.FASTAPI_BASE_URL ?? "http://127.0.0.1:8000";

export const Route = createFileRoute("/v1/sessions/$sessionId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { sessionId } = params;
        const upstream = await fetch(`${FASTAPI_BASE_URL}/v1/sessions/${sessionId}`, { signal: request.signal });
        return new Response(upstream.body, { status: upstream.status, headers: upstream.headers });
      },
      DELETE: async ({ request, params }) => {
        const { sessionId } = params;
        const upstream = await fetch(`${FASTAPI_BASE_URL}/v1/sessions/${sessionId}`, {
          method: 'DELETE',
          signal: request.signal
        });
        return new Response(upstream.body, { status: upstream.status, headers: upstream.headers });
      }
    },
  },
});