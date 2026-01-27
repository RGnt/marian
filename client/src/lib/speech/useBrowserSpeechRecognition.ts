import { useEffect, useMemo, useRef, useState } from "react";

function getCtor(): any | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useBrowserSpeechRecognition(opts?: {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
}) {
  const Ctor = useMemo(() => getCtor(), []);
  const recRef = useRef<any | null>(null);

  const [supported] = useState<boolean>(!!Ctor);
  const [listening, setListening] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Ctor) return;

    const rec = new Ctor();
    recRef.current = rec;

    rec.lang = opts?.lang ?? "en-US";
    rec.continuous = opts?.continuous ?? false;
    rec.interimResults = opts?.interimResults ?? true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setError(null);
      setListening(true);
    };

    rec.onend = () => {
      setListening(false);
      setInterimText("");
    };

    rec.onerror = (e: any) => {
      setError(e?.error ?? "speech_recognition_error");
    };

    rec.onresult = (event: any) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const text = res?.[0]?.transcript ?? "";
        if (res.isFinal) final += text;
        else interim += text;
      }

      if (final) setFinalText((prev) => (prev + " " + final).trim());
      setInterimText(interim.trim());
    };

    return () => {
      try { rec.stop(); } catch {}
      recRef.current = null;
    };
  }, [Ctor, opts?.lang, opts?.continuous, opts?.interimResults]);

  const start = () => {
    setFinalText("");
    setInterimText("");
    setError(null);
    const rec = recRef.current;
    if (!rec) return;
    try { rec.start(); } catch {}
  };

  const stop = () => {
    const rec = recRef.current;
    if (!rec) return;
    try { rec.stop(); } catch {}
  };

  const reset = () => {
    setFinalText("");
    setInterimText("");
    setError(null);
  };

  return { supported, listening, finalText, interimText, error, start, stop, reset };
}
