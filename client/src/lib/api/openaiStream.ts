/**
 * Purpose: Stream chat completion deltas from the backend SSE endpoint.
 * How: Performs a streaming fetch to `/v1/chat/completions`, parses SSE frames,
 * and yields `delta.content` strings as they arrive.
 * @param args - Request parameters for the stream.
 * @param args.model - Model name to pass to the backend.
 * @param args.messages - Chat history to send (OpenAI message format).
 * @param args.sessionId - Session identifier for server-side history.
 * @param args.signal - Optional AbortSignal to cancel the request.
 * @returns AsyncGenerator<string> - Yields text deltas in order.
 */
export async function* streamChatCompletion(args: {
    model: string;
    messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string }>;
    sessionId: string;
    signal?: AbortSignal;
}): AsyncGenerator<string> {
    // 2. Append session_id to the URL
    const res = await fetch(`/v1/chat/completions?session_id=${args.sessionId}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
            "X-session-ID": args.sessionId
        },
        body: JSON.stringify({
            model: args.model,
            messages: args.messages,
            stream: true,
        }),
        signal: args.signal,
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`chat/completions failed: ${res.status} ${text}`);
    }
    if (!res.body) throw new Error("No response body for streaming");

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        while (true) {
            const sep = buffer.indexOf("\n\n");
            if (sep === -1) break;

            const eventBlock = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);

            for (const line of eventBlock.split("\n")) {
                const trimmed = line.trim();
                if (!trimmed.startsWith("data:")) continue;

                const data = trimmed.slice(5).trim();
                if (!data) continue;
                if (data === "[DONE]") return;

                let payload: any;
                try {
                    payload = JSON.parse(data);
                } catch {
                    continue;
                }

                const delta = payload?.choices?.[0]?.delta?.content;
                if (typeof delta === "string" && delta.length > 0) {
                    yield delta;
                }
            }
        }
    }
}
