import { useCallback, useEffect, useRef, useState } from "react";

export function useAudioQueue() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const queueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const currentUrlRef = useRef<string | null>(null);

  const [playing, setPlaying] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);

  const revokeUrl = (url: string | null) => {
    if (!url) return;
    try {
      URL.revokeObjectURL(url);
    } catch {}
  };

  const startNext = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;

    // Already playing
    if (isPlayingRef.current) return;

    const next = queueRef.current.shift();
    setQueuedCount(queueRef.current.length);

    if (!next) {
      setPlaying(false);
      return;
    }

    // Cleanup
    revokeUrl(currentUrlRef.current);
    currentUrlRef.current = next;

    isPlayingRef.current = true;
    setPlaying(true);

    a.src = next;
    a.currentTime = 0;

    void a.play().catch(() => {
      isPlayingRef.current = false;
      setPlaying(false);
      startNext();
    });
  }, []);

  useEffect(() => {
    const a = new Audio();
    audioRef.current = a;

    const onEndedOrError = () => {
      isPlayingRef.current = false;
      setPlaying(false);

      revokeUrl(currentUrlRef.current);
      currentUrlRef.current = null;

      startNext();
    };

    a.addEventListener("ended", onEndedOrError);
    a.addEventListener("error", onEndedOrError);

    return () => {
      a.removeEventListener("ended", onEndedOrError);
      a.removeEventListener("error", onEndedOrError);

      try {
        a.pause();
      } catch {}

      revokeUrl(currentUrlRef.current);
      currentUrlRef.current = null;

      queueRef.current.forEach(revokeUrl);
      queueRef.current = [];
      setQueuedCount(0);

      audioRef.current = null;
      isPlayingRef.current = false;
      setPlaying(false);
    };
  }, [startNext]);

  const enqueue = useCallback(
    (objectUrl: string) => {
      queueRef.current.push(objectUrl);
      setQueuedCount(queueRef.current.length);

      if (!isPlayingRef.current) {
        startNext();
      }
    },
    [startNext]
  );

  const stop = useCallback(() => {
    const a = audioRef.current;

    if (a) {
      try {
        a.pause();
        a.currentTime = 0;
        a.removeAttribute("src");
        a.load();
      } catch {}
    }

    revokeUrl(currentUrlRef.current);
    currentUrlRef.current = null;

    queueRef.current.forEach(revokeUrl);
    queueRef.current = [];
    setQueuedCount(0);

    isPlayingRef.current = false;
    setPlaying(false);
  }, []);

  return {
    enqueue,
    stop,
    playing,
    queuedCount,
  };
}
