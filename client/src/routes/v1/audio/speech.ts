import { createFileRoute } from "@tanstack/react-router";

const FASTAPI_BASE_URL = process.env.FASTAPI_BASE_URL ?? "http://127.0.0.1:8000";

export const Route = createFileRoute("/v1/audio/speech")({
    server: {
        handlers: {
            POST: async ({ request }) => {
                const incomingUrl = new URL(request.url);
                const targetUrl = new URL(`${FASTAPI_BASE_URL}/v1/audio/speech`);
                targetUrl.search = incomingUrl.search;

                const upstream = await fetch(targetUrl, {
                    method: "POST",
                    headers: {
                        "content-type": request.headers.get("content-type") ?? "application/json",
                        accept: request.headers.get("accept") ?? "*/*",
                    },
                    body: request.body,
                    // @ts-expect-error fetch duplex is runtime-dependent
                    duplex: "half",
                    signal: request.signal,
                });

                const headers = new Headers(upstream.headers);
                return new Response(upstream.body, {
                    status: upstream.status,
                    headers,
                });
            },
        },
    },
});