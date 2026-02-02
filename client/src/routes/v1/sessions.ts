import { createFileRoute } from "@tanstack/react-router";

const FASTAPI_BASE_URL = process.env.FASTAPI_BASE_URL ?? "http://127.0.0.1:8000";

export const Route = createFileRoute("/v1/sessions")({
    server: {
        handlers: {
            /**
             * Purpose: Proxy session listing requests to the FastAPI backend.
             * How: Forwards the request with accept headers and returns JSON.
             * @param request - Incoming TanStack request.
             * @returns Response - Proxied upstream response.
             */
            GET: async ({ request }) => {
                const incomingUrl = new URL(request.url);
                const targetUrl = new URL(`${FASTAPI_BASE_URL}/v1/sessions`);
                targetUrl.search = incomingUrl.search;

                const upstream = await fetch(targetUrl, {
                    signal: request.signal,
                    headers: {
                        accept: "application/json"
                    }
                });

                return new Response(upstream.body, {
                    status: upstream.status,
                    headers: upstream.headers
                });
            },
        },
    },
});
