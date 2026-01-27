import * as React from "react";

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
