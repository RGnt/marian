import type { ChatMessage } from "@/lib/api/types";

export function MessageList(props: { messages: ChatMessage[] }) {
  return (
    <div className="space-y-3">
      {props.messages.map((m) => {
        const isUser = m.role === "user";
        return (
          <div key={m.id} className={`chat ${isUser ? "chat-end" : "chat-start"}`}>
            <div className="chat-header text-xs opacity-70">
              {m.role.toUpperCase()}
              {m.inputMode ? ` • ${m.inputMode}` : ""}
            </div>

            <div
              className={`chat-bubble whitespace-pre-wrap ${
                isUser ? "chat-bubble-primary" : ""
              }`}
            >
              {m.content || (m.role === "assistant" ? <span className="opacity-60">…</span> : "")}
            </div>
          </div>
        );
      })}
    </div>
  );
}
