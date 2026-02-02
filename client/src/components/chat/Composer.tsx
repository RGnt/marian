import * as React from "react";

/**
 * Purpose: Render the chat input composer with text and voice controls.
 * How: Shows speech state, captures input text, and triggers send/voice actions.
 * @param props - Input state and handlers.
 * @returns JSX.Element - Rendered composer UI.
 */
export function Composer(props: {
  text: string;
  setText: (v: string) => void;
  onSendText: () => void;

  onVoiceStart: () => void;
  onVoiceStop: () => void;

  listening: boolean;
  supported: boolean;
  interim: string;
  error: string | null;
  busy: boolean;
}) {
  /**
   * Purpose: Send on Enter while allowing Shift+Enter for newlines.
   * How: Intercepts keydown, prevents default newline, and calls onSendText.
   * @param e - Keyboard event from the textarea.
   * @returns void - Side effects only.
   */
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      props.onSendText();
    }
  };

  return (
    <div className="space-y-2">
      {props.supported ? (
        <div className="text-xs opacity-70">
          Speech: {props.listening ? "listening…" : "idle"}
          {props.interim ? ` • interim: "${props.interim}"` : ""}
          {props.error ? ` • error: ${props.error}` : ""}
        </div>
      ) : (
        <div className="text-xs opacity-70">SpeechRecognition not supported in this browser.</div>
      )}

      <div className="flex gap-2 items-end">
        <textarea
          className="textarea textarea-bordered w-full"
          rows={3}
          value={props.text}
          onChange={(e) => props.setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a message…"
          disabled={props.busy}
        />

        <div className="flex flex-col gap-2">
          <button
            className={`btn btn-outline ${props.listening ? "btn-secondary" : ""}`}
            onClick={props.listening ? props.onVoiceStop : props.onVoiceStart}
            disabled={!props.supported || props.busy}
          >
            {props.listening ? "Stop" : "Mic"}
          </button>

          <button className="btn btn-primary" onClick={props.onSendText} disabled={props.busy}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
