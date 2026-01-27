import { createFileRoute } from "@tanstack/react-router";

const FASTAPI_BASE_URL = process.env.FASTAPI_BASE_URL ?? "http://127.0.0.1:8000";

export const Route = createFileRoute("/v1/chat/completions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const upstream = await fetch(`${FASTAPI_BASE_URL}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "content-type": request.headers.get("content-type") ?? "application/json",
            accept: request.headers.get("accept") ?? "text/event-stream",
          },
          body: request.body,
          // Bun/Node fetch: allow streaming request bodies where applicable
          // @ts-expect-error fetch duplex is runtime-dependent
          duplex: "half",
          signal: request.signal,
        });

        const headers = new Headers(upstream.headers);
        // Ensure SSE isn't buffered by intermediaries (helps dev/proxy situations)
        if (headers.get("content-type")?.includes("text/event-stream")) {
          headers.set("cache-control", "no-cache");
        }

        return new Response(upstream.body, {
          status: upstream.status,
          headers,
        });
      },
    },
  },
});
