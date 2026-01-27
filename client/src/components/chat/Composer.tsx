import * as React from "react";

export function Composer(props: {
  text: string;
  setText: (t: string) => void;

  onSendText: () => void;

  onVoiceStart: () => void;
  onVoiceStop: () => void;
  listening: boolean;
  supported: boolean;
  interim: string;
  error: string | null;

  busy: boolean;
}) {
  const placeholder = props.listening ? props.interim || "Listening…" : "Type a message…";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {!props.supported && (
          <div className="text-sm opacity-70">
            Browser Speech API not supported in this browser.
          </div>
        )}
        {props.error && (
          <div className="text-sm opacity-70">Speech error: {props.error}</div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          className="input input-bordered w-full"
          value={props.text}
          onChange={(e) => props.setText(e.target.value)}
          placeholder={placeholder}
          disabled={props.busy}
        />

        <button
          className={`btn ${props.listening ? "btn-secondary" : "btn-outline"}`}
          disabled={props.busy || !props.supported}
          onMouseDown={props.onVoiceStart}
          onMouseUp={props.onVoiceStop}
          onTouchStart={props.onVoiceStart}
          onTouchEnd={props.onVoiceStop}
          aria-pressed={props.listening}
          title="Hold to speak"
        >
          🎙️
        </button>

        <button
          className="btn btn-primary"
          disabled={props.busy || !props.text.trim()}
          onClick={props.onSendText}
        >
          Send
        </button>
      </div>
    </div>
  );
}
