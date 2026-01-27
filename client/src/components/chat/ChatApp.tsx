import * as React from "react";
import type { ChatMessage } from "../../lib/api/types";
import { MessageList } from "./MessageList";
import { Composer } from "./Composer";
import { useBrowserSpeechRecognition } from "../../lib/speech/useBrowserSpeechRecognition";
import { streamChatCompletion, toOpenAIMessages } from "../../lib/api/client";

const LS_KEY = "local_chat_history_v1";

function uid() {
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function loadHistory(): ChatMessage[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = window.localStorage.getItem(LS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as ChatMessage[]) : [];
    } catch {
        return [];
    }
}

function saveHistory(msgs: ChatMessage[]) {
    try {
        window.localStorage.setItem(LS_KEY, JSON.stringify(msgs));
    } catch { }
}

export function ChatApp() {
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";
    const modelName = import.meta.env.VITE_MODEL_NAME ?? "local-model";

    const [messages, setMessages] = React.useState<ChatMessage[]>(() => loadHistory());
    const [text, setText] = React.useState("");
    const [busy, setBusy] = React.useState(false);

    const abortRef = React.useRef<AbortController | null>(null);

    const sr = useBrowserSpeechRecognition({
        lang: "en-US",
        continuous: false,
        interimResults: true,
    });

    React.useEffect(() => {
        saveHistory(messages);
    }, [messages]);

    // When browser STT finalizes, fill input.
    React.useEffect(() => {
        if (!sr.finalText) return;
        setText(sr.finalText);
    }, [sr.finalText]);

    const appendMessage = React.useCallback((m: ChatMessage) => {
        setMessages((prev) => [...prev, m]);
    }, []);

    const updateAssistantMessage = React.useCallback((assistantId: string, delta: string) => {
        setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + delta } : m))
        );
    }, []);

    const runChat = React.useCallback(
        async (userText: string) => {
            const trimmed = userText.trim();
            if (!trimmed) return;

            // cancel any in-flight request
            abortRef.current?.abort();
            const ac = new AbortController();
            abortRef.current = ac;

            setBusy(true);

            const userMsg: ChatMessage = {
                id: uid(),
                role: "user",
                content: trimmed,
                createdAt: Date.now(),
                inputMode: sr.listening ? "voice" : "text",
            };

            appendMessage(userMsg);

            const assistantId = uid();
            appendMessage({
                id: assistantId,
                role: "assistant",
                content: "",
                createdAt: Date.now(),
            });

            const historySnapshot = [...messages, userMsg];
            const openaiMessages = toOpenAIMessages(historySnapshot);

            try {
                for await (const delta of streamChatCompletion({
                    baseUrl: apiBase,
                    model: modelName,
                    messages: openaiMessages,
                    signal: ac.signal,
                })) {
                    updateAssistantMessage(assistantId, delta);
                }
            } catch (e: any) {
                updateAssistantMessage(assistantId, `\n[error] ${e?.message ?? String(e)}`);
            } finally {
                setBusy(false);
            }
        },
        [apiBase, modelName, appendMessage, messages, sr.listening, updateAssistantMessage]
    );

    const onSendText = async () => {
        const t = text;
        setText("");
        await runChat(t);
    };

    const onVoiceStart = () => {
        sr.reset();
        sr.start();
    };

    const onVoiceStop = () => {
        sr.stop();
    };

    const clear = () => {
        abortRef.current?.abort();
        setMessages([]);
        setText("");
        try {
            window.localStorage.removeItem(LS_KEY);
        } catch { }
    };

    return (
        <div className="mx-auto max-w-4xl p-4">
            <div className="navbar bg-base-100 rounded-box shadow-sm">
                <div className="flex-1">
                    <span className="text-lg font-semibold">Local Chat</span>
                    <span className="ml-3 text-sm opacity-70">Browser STT → Backend streaming text</span>
                </div>
                <div className="flex-none gap-2">
                    <button className="btn btn-ghost btn-sm" onClick={clear} disabled={busy}>
                        Clear
                    </button>
                </div>
            </div>

            <div className="card bg-base-100 shadow-sm mt-4">
                <div className="card-body">
                    <MessageList messages={messages} />
                </div>
            </div>

            <div className="card bg-base-100 shadow-sm mt-3">
                <div className="card-body">
                    <Composer
                        text={text}
                        setText={setText}
                        onSendText={onSendText}
                        onVoiceStart={onVoiceStart}
                        onVoiceStop={onVoiceStop}
                        listening={sr.listening}
                        supported={sr.supported}
                        interim={sr.interimText}
                        error={sr.error}
                        busy={busy}
                    />
                </div>
            </div>
        </div>
    );
}
