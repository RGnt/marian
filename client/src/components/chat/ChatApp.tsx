import * as React from "react";
import type { ChatMessage } from "@/lib/api/types";
import { MessageList } from "./MessageList";
import { Composer } from "./Composer";

import { useBrowserSpeechRecognition } from "@/lib/speech/useBrowserSpeechRecognition";
import { streamChatCompletion } from "@/lib/api/openaiStream";
import { fetchSpeechWav } from "@/lib/api/tts";

import { useAudioQueue } from "@/lib/audio/useAudioQueue";
import { blobToObjectUrl } from "@/lib/audio/bytes";
import { StreamingTtsSegmenter } from "@/lib/audio/StreamingTtsSegmenter";

import { loadChatHistory, saveChatHistory, clearChatHistory } from "@/lib/storage/chatHistory.client";

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function toOpenAIMessages(history: ChatMessage[]) {
  return history.map((m) => ({ role: m.role, content: m.content }));
}

type TtsController = {
  messageId: string;
  enabled: boolean;
  segmenter: StreamingTtsSegmenter;
  abort: AbortController;
  runId: string;
  chain: Promise<void>;
  fastStartTimer: number | null;
};

export function ChatApp() {
  const modelName = import.meta.env.VITE_MODEL_NAME ?? "local-model";

  // deterministic initial render (SSR-safe)
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const [streamingAssistantId, setStreamingAssistantId] = React.useState<string | null>(null);

  const [ttsEnabledFor, setTtsEnabledFor] = React.useState<string | null>(null);
  const [ttsBusyFor, setTtsBusyFor] = React.useState<string | null>(null);

  const abortChatRef = React.useRef<AbortController | null>(null);
  const audioQ = useAudioQueue();
  const ttsRef = React.useRef<TtsController | null>(null);
  const didLoadHistoryRef = React.useRef(false);

  const sr = useBrowserSpeechRecognition({
    lang: "en-US",
    continuous: false,
    interimResults: true,
  });

  // load history after hydration
  React.useEffect(() => {
    const hist = loadChatHistory();
    setMessages(hist);
    didLoadHistoryRef.current = true;
  }, []);

  React.useEffect(() => {
    if (!didLoadHistoryRef.current) return;
    saveChatHistory(messages);
  }, [messages]);

  React.useEffect(() => {
    if (sr.finalText) setText(sr.finalText);
  }, [sr.finalText]);

  const appendMessage = React.useCallback((m: ChatMessage) => {
    setMessages((prev) => [...prev, m]);
  }, []);

  const updateAssistantMessage = React.useCallback((assistantId: string, delta: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + delta } : m)),
    );
  }, []);

  const stopTtsController = React.useCallback(() => {
    const ctl = ttsRef.current;
    if (!ctl) return;

    ctl.enabled = false;
    try {
      ctl.abort.abort();
    } catch {}

    if (ctl.fastStartTimer != null) {
      window.clearTimeout(ctl.fastStartTimer);
      ctl.fastStartTimer = null;
    }

    ttsRef.current = null;
    setTtsEnabledFor(null);
    setTtsBusyFor(null);
    audioQ.stop();
  }, [audioQ]);

  const scheduleTtsSegment = React.useCallback(
    (ctl: TtsController, segmentText: string) => {
      const localRunId = ctl.runId;

      ctl.chain = ctl.chain
        .then(async () => {
          if (!ttsRef.current || ttsRef.current.runId !== localRunId || !ttsRef.current.enabled) {
            return;
          }

          setTtsBusyFor(ctl.messageId);

          const wavBlob = await fetchSpeechWav({
            input: segmentText,
            voice: "af_heart",
            speed: 1.0,
            model: "kokoro-82m",
            signal: ctl.abort.signal,
          });

          if (!ttsRef.current || ttsRef.current.runId !== localRunId || !ttsRef.current.enabled) {
            return;
          }

          audioQ.enqueue(blobToObjectUrl(wavBlob));
        })
        .catch((e) => {
          if (e?.name === "AbortError") return;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === ctl.messageId
                ? { ...m, content: m.content + `\n\n[tts error] ${e?.message ?? String(e)}` }
                : m,
            ),
          );
        })
        .finally(() => {
          if (ttsRef.current && ttsRef.current.messageId === ctl.messageId) setTtsBusyFor(null);
        });
    },
    [audioQ],
  );

  const enableSpeechForMessage = React.useCallback(
    (messageId: string) => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg || msg.role !== "assistant" || !msg.content.trim()) return;

      stopTtsController();

      const ctl: TtsController = {
        messageId,
        enabled: true,
        segmenter: new StreamingTtsSegmenter(20, 240, 60),
        abort: new AbortController(),
        runId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        chain: Promise.resolve(),
        fastStartTimer: null,
      };

      ttsRef.current = ctl;
      setTtsEnabledFor(messageId);

      // prime from existing content
      const initialSegments = ctl.segmenter.feed(msg.content);
      for (const seg of initialSegments) scheduleTtsSegment(ctl, seg);

      // fast-start partial flush
      ctl.fastStartTimer = window.setTimeout(() => {
        const c = ttsRef.current;
        if (!c || !c.enabled || c.messageId !== messageId) return;
        const segs = c.segmenter.flushPartialForFastStart();
        for (const s of segs) scheduleTtsSegment(c, s);
      }, 350);
    },
    [messages, scheduleTtsSegment, stopTtsController],
  );

  const stopSpeechForMessage = React.useCallback(
    (messageId: string) => {
      const ctl = ttsRef.current;
      if (ctl && ctl.messageId === messageId) stopTtsController();
    },
    [stopTtsController],
  );

  const runChat = React.useCallback(
    async (userText: string, inputMode: "text" | "voice") => {
      const trimmed = userText.trim();
      if (!trimmed) return;

      abortChatRef.current?.abort();
      const ac = new AbortController();
      abortChatRef.current = ac;

      setBusy(true);

      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: trimmed,
        createdAt: Date.now(),
        inputMode,
      };
      appendMessage(userMsg);

      const assistantId = uid();
      setStreamingAssistantId(assistantId);

      appendMessage({
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: Date.now(),
      });

      const openaiMessages = toOpenAIMessages([...messages, userMsg]);

      try {
        for await (const delta of streamChatCompletion({
          model: modelName,
          messages: openaiMessages,
          signal: ac.signal,
        })) {
          updateAssistantMessage(assistantId, delta);

          const ctl = ttsRef.current;
          if (ctl && ctl.enabled && ctl.messageId === assistantId) {
            const segs = ctl.segmenter.feed(delta);
            for (const s of segs) scheduleTtsSegment(ctl, s);
          }
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          updateAssistantMessage(assistantId, `\n[error] ${e?.message ?? String(e)}`);
        }
      } finally {
        setBusy(false);
        setStreamingAssistantId((cur) => (cur === assistantId ? null : cur));

        const ctl = ttsRef.current;
        if (ctl && ctl.enabled && ctl.messageId === assistantId) {
          const segs = ctl.segmenter.flushAll();
          for (const s of segs) scheduleTtsSegment(ctl, s);
        }
      }
    },
    [appendMessage, messages, modelName, scheduleTtsSegment, updateAssistantMessage],
  );

  const clear = () => {
    abortChatRef.current?.abort();
    stopTtsController();
    setStreamingAssistantId(null);
    setMessages([]);
    setText("");
    clearChatHistory();
  };

  return (
    <div className="mx-auto max-w-4xl p-4">
      <div className="navbar bg-base-100 rounded-box shadow-sm">
        <div className="flex-1">
          <span className="text-lg font-semibold">Marian</span>
          <span className="ml-3 text-sm opacity-70">Base Interface</span>
        </div>

        <div className="flex-none gap-2 items-center">
          {(audioQ.playing || audioQ.queuedCount > 0) && (
            <span className="text-sm opacity-70">
              Audio: {audioQ.playing ? "playing" : "idle"} • queued {audioQ.queuedCount}
            </span>
          )}

          <button
            className="btn btn-outline btn-sm"
            onClick={stopTtsController}
            disabled={!ttsEnabledFor && !ttsBusyFor && !audioQ.playing && audioQ.queuedCount === 0}
          >
            Stop audio
          </button>

          <button className="btn btn-ghost btn-sm" onClick={clear} disabled={busy}>
            Clear
          </button>
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm mt-4">
        <div className="card-body">
          <MessageList
            messages={messages}
            onPlayAssistant={enableSpeechForMessage}
            onStopAssistant={stopSpeechForMessage}
            ttsEnabledFor={ttsEnabledFor}
            ttsBusyFor={ttsBusyFor}
          />
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm mt-3">
        <div className="card-body">
          <Composer
            text={text}
            setText={setText}
            onSendText={() => {
              const t = text;
              setText("");
              void runChat(t, "text");
            }}
            onVoiceStart={() => {
              sr.reset();
              sr.start();
            }}
            onVoiceStop={sr.stop}
            listening={sr.listening}
            supported={sr.supported}
            interim={sr.interimText}
            error={sr.error}
            busy={busy}
          />

          {streamingAssistantId && (
            <div className="mt-2 text-xs opacity-70">
              Streaming response…{ttsEnabledFor === streamingAssistantId ? " (speech enabled)" : ""}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
