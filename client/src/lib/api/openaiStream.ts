export async function* streamChatCompletion(args: {
    model: string;
    messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string }>;
    signal?: AbortSignal;
}): AsyncGenerator<string> {
    const res = await fetch("/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
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
