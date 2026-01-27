import { useCallback, useEffect, useRef, useState } from "react";

export function useAudioQueue() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<string[]>([]);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const a = new Audio();
    audioRef.current = a;

    const onEnded = () => {
      setPlaying(false);
      playNext();
    };

    a.addEventListener("ended", onEnded);
    a.addEventListener("error", onEnded);

    return () => {
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("error", onEnded);
      a.pause();
      audioRef.current = null;
      // cleanup URLs
      queueRef.current.forEach((u) => URL.revokeObjectURL(u));
      queueRef.current = [];
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playNext = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;

    const next = queueRef.current.shift();
    if (!next) return;

    a.src = next;
    setPlaying(true);
    void a.play().catch(() => {
      setPlaying(false);
      playNext();
    });
  }, []);

  const enqueue = useCallback(
    (objectUrl: string) => {
      queueRef.current.push(objectUrl);
      if (!playing) playNext();
    },
    [playNext, playing]
  );

  const stop = useCallback(() => {
    const a = audioRef.current;
    if (a) a.pause();
    setPlaying(false);
    // cleanup queued URLs
    queueRef.current.forEach((u) => URL.revokeObjectURL(u));
    queueRef.current = [];
  }, []);

  return { enqueue, stop, playing };
}
