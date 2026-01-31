import * as React from "react";
import { fetchSpeechWav } from "@/lib/api/tts";
import { blobToObjectUrl } from "@/lib/audio/bytes";
import { StreamingTtsSegmenter } from "@/lib/audio/StreamingTtsSegmenter";
import { useAudioQueue } from "@/lib/audio/useAudioQueue";
import type { ChatMessage } from "@/lib/api/types";

type TtsController = {
    messageId: string;
    enabled: boolean;
    segmenter: StreamingTtsSegmenter;
    abort: AbortController;
    runId: string;
    chain: Promise<void>;
    fastStartTimer: number | null;
};

export function useTtsController(
    audioQ: ReturnType<typeof useAudioQueue>,
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
) {
    const ttsRef = React.useRef<TtsController | null>(null);
    const [ttsEnabledFor, setTtsEnabledFor] = React.useState<string | null>(null);
    const [ttsBusyFor, setTtsBusyFor] = React.useState<string | null>(null);

    const stop = React.useCallback(() => {
        const ctl = ttsRef.current;
        if (!ctl) return;
        ctl.enabled = false;
        try { ctl.abort.abort(); } catch { }
        if (ctl.fastStartTimer) clearTimeout(ctl.fastStartTimer);

        ttsRef.current = null;
        setTtsEnabledFor(null);
        setTtsBusyFor(null);
        audioQ.stop();
    }, [audioQ]);

    const scheduleSegment = React.useCallback((ctl: TtsController, text: string) => {
        const localRunId = ctl.runId;

        ctl.chain = ctl.chain
            .then(async () => {
                if (!ttsRef.current?.enabled || ttsRef.current.runId !== localRunId) return;
                setTtsBusyFor(ctl.messageId);

                const blob = await fetchSpeechWav({
                    input: text,
                    voice: "af_heart",
                    speed: 1.0,
                    signal: ctl.abort.signal
                });

                if (ttsRef.current?.enabled && ttsRef.current.runId === localRunId) {
                    audioQ.enqueue(blobToObjectUrl(blob));
                }
            })
            .catch((e: any) => {
                if (e.name === "AbortError") return;
                console.error("TTS Error", e);

                // --- FIX: Use setMessages to show error in UI ---
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === ctl.messageId
                            ? { ...m, content: m.content + `\n\n*[TTS Error: ${e.message || "Unknown"}]*` }
                            : m
                    )
                );
            })
            .finally(() => {
                if (ttsRef.current?.messageId === ctl.messageId) setTtsBusyFor(null);
            });
    }, [audioQ, setMessages]); // Added setMessages dependency

    const playMessage = React.useCallback((messageId: string, content: string) => {
        stop();

        const ctl: TtsController = {
            messageId,
            enabled: true,
            segmenter: new StreamingTtsSegmenter(20, 240, 60),
            abort: new AbortController(),
            runId: Math.random().toString(16),
            chain: Promise.resolve(),
            fastStartTimer: null
        };

        ttsRef.current = ctl;
        setTtsEnabledFor(messageId);

        // Feed existing content
        const segs = ctl.segmenter.feed(content);
        segs.forEach(s => scheduleSegment(ctl, s));

        // Fast start timer
        ctl.fastStartTimer = window.setTimeout(() => {
            if (ttsRef.current === ctl) {
                const flush = ctl.segmenter.flushPartialForFastStart();
                flush.forEach(s => scheduleSegment(ctl, s));
            }
        }, 350);
    }, [stop, scheduleSegment]);

    const feedStream = React.useCallback((messageId: string, delta: string) => {
        const ctl = ttsRef.current;
        if (ctl && ctl.enabled && ctl.messageId === messageId) {
            const segs = ctl.segmenter.feed(delta);
            segs.forEach(s => scheduleSegment(ctl, s));
        }
    }, [scheduleSegment]);

    const flushStream = React.useCallback((messageId: string) => {
        const ctl = ttsRef.current;
        if (ctl && ctl.enabled && ctl.messageId === messageId) {
            const segs = ctl.segmenter.flushAll();
            segs.forEach(s => scheduleSegment(ctl, s));
        }
    }, [scheduleSegment]);

    return {
        playMessage,
        stop,
        feedStream,
        flushStream,
        enabledFor: ttsEnabledFor,
        busyFor: ttsBusyFor
    };
}