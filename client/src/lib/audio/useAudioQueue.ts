import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Purpose: Manage a simple audio playback queue for object URLs.
 * How: Maintains an internal queue, plays sequentially via an Audio element,
 * and exposes enqueue/stop controls plus state flags.
 * Parameters: None.
 * @returns Object with enqueue/stop functions and playback state.
 */
export function useAudioQueue() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const queueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const currentUrlRef = useRef<string | null>(null);

  const [playing, setPlaying] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);

  /**
   * Purpose: Revoke an object URL if present.
   * How: Calls `URL.revokeObjectURL` with basic error suppression.
   * @param url - Object URL to revoke.
   * @returns void - Side effects only.
   */
  const revokeUrl = (url: string | null) => {
    if (!url) return;
    try {
      URL.revokeObjectURL(url);
    } catch {}
  };

  /**
   * Purpose: Start playback of the next queued audio URL.
   * How: Dequeues a URL, configures the Audio element, and handles playback
   * errors by advancing to the next item.
   * Parameters: None.
   * @returns void - Side effects only.
   */
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

    /**
     * Purpose: Handle audio end/error events and advance the queue.
     * How: Resets playback flags, revokes the current URL, and starts next.
     * Parameters: None.
     * @returns void - Side effects only.
     */
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

  /**
   * Purpose: Add an audio URL to the playback queue.
   * How: Pushes the URL into the queue and starts playback if idle.
   * @param objectUrl - Object URL to enqueue.
   * @returns void - Side effects only.
   */
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

  /**
   * Purpose: Stop playback and clear the queue.
   * How: Pauses the Audio element, clears sources, revokes URLs, and resets
   * playback state.
   * Parameters: None.
   * @returns void - Side effects only.
   */
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
