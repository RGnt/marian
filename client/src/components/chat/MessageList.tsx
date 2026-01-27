import type { ChatMessage } from "@/lib/api/types";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MessageList(props: {
  messages: ChatMessage[];
  onPlayAssistant?: (messageId: string) => void;
  onStopAssistant?: (messageId: string) => void;
  ttsEnabledFor?: string | null;
  ttsBusyFor?: string | null;
}) {
  return (
    <div className="space-y-3">
      {props.messages.map((m) => {
        const isUser = m.role === "user";
        const isAssistant = m.role === "assistant";
        const enabled = props.ttsEnabledFor === m.id;
        const busy = props.ttsBusyFor === m.id;

        return (
          <div key={m.id} className={`chat ${isUser ? "chat-end" : "chat-start"}`}>
            <div className="chat-header text-xs opacity-70 flex items-center gap-2">
              <span>
                {m.role.toUpperCase()}
                {m.inputMode ? ` • ${m.inputMode}` : ""}
              </span>

              {isAssistant && props.onPlayAssistant && props.onStopAssistant ? (
                <div className="flex items-center gap-2">
                  <button
                    className={`btn btn-xs ${enabled ? "btn-secondary" : "btn-outline"}`}
                    onClick={() => props.onPlayAssistant?.(m.id)}
                    disabled={busy || !m.content.trim()}
                  >
                    {busy ? "Generating…" : enabled ? "Speech on" : "Play"}
                  </button>

                  <button
                    className="btn btn-xs btn-ghost"
                    onClick={() => props.onStopAssistant?.(m.id)}
                    disabled={!enabled && !busy}
                  >
                    Stop
                  </button>
                </div>
              ) : null}
            </div>

            <div className={`chat-bubble ${isUser ? "chat-bubble-primary" : ""}`}>
              {m.content ? (
                <div className="prose prose-sm max-w-none prose-pre:overflow-x-auto prose-pre:whitespace-pre-wrap prose-code:break-words">
                  <Markdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // Ensure code blocks don't break layout
                      pre: ({ children, ...rest }) => (
                        <pre {...rest} className="overflow-x-auto whitespace-pre-wrap">
                          {children}
                        </pre>
                      ),
                      // Optionally keep inline code readable
                      code: ({ children, className, ...rest }) => (
                        <code {...rest} className={className}>
                          {children}
                        </code>
                      ),
                    }}
                  >
                    {m.content}
                  </Markdown>
                </div>
              ) : isAssistant ? (
                <span className="opacity-60">…</span>
              ) : (
                ""
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
