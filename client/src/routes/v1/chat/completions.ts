// routes/v1/chat/completions.ts
import { createFileRoute } from "@tanstack/react-router";

const FASTAPI_BASE_URL = process.env.FASTAPI_BASE_URL ?? "http://127.0.0.1:8000";

export const Route = createFileRoute("/v1/chat/completions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const targetUrl = `${FASTAPI_BASE_URL}/v1/chat/completions`;

        // 1. Copy all incoming headers
        const forwardHeaders = new Headers(request.headers);

        // 2. Clean up host headers to avoid confusion (optional but good practice)
        forwardHeaders.delete("host");
        forwardHeaders.delete("connection");

        const upstream = await fetch(targetUrl, {
          method: "POST",
          headers: forwardHeaders, // <--- Send everything!
          body: request.body,
          // @ts-expect-error fetch duplex is runtime-dependent
          duplex: "half",
          signal: request.signal,
        });

        // 3. Return upstream response
        const responseHeaders = new Headers(upstream.headers);
        if (responseHeaders.get("content-type")?.includes("text/event-stream")) {
          responseHeaders.set("cache-control", "no-cache");
        }

        return new Response(upstream.body, {
          status: upstream.status,
          headers: responseHeaders,
        });
      },
    },
  },
});