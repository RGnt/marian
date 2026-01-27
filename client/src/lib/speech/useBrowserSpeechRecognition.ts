import * as React from "react";

type SpeechRec = any;

export function useBrowserSpeechRecognition(opts: {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
}) {
  const [supported, setSupported] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const [interimText, setInterimText] = React.useState("");
  const [finalText, setFinalText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const recRef = React.useRef<SpeechRec | null>(null);

  React.useEffect(() => {
    const w = window as any;
    const Ctor = w?.SpeechRecognition ?? w?.webkitSpeechRecognition;
    if (!Ctor) {
      setSupported(false);
      return;
    }

    setSupported(true);

    const rec = new Ctor();
    rec.lang = opts.lang;
    rec.continuous = opts.continuous;
    rec.interimResults = opts.interimResults;

    rec.onstart = () => {
      setError(null);
      setListening(true);
    };

    rec.onend = () => {
      setListening(false);
      setInterimText("");
    };

    rec.onerror = (e: any) => {
      setError(e?.error ?? "speech_error");
      setListening(false);
    };

    rec.onresult = (e: any) => {
      let interim = "";
      let finals = "";

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const txt = r?.[0]?.transcript ?? "";
        if (r.isFinal) finals += txt;
        else interim += txt;
      }

      if (interim) setInterimText(interim.trim());
      if (finals) setFinalText(finals.trim());
    };

    recRef.current = rec;

    return () => {
      try {
        rec.stop();
      } catch { }
      recRef.current = null;
    };
  }, [opts.lang, opts.continuous, opts.interimResults]);

  const start = React.useCallback(() => {
    if (!recRef.current) return;
    setFinalText("");
    setInterimText("");
    setError(null);
    try {
      recRef.current.start();
    } catch { }
  }, []);

  const stop = React.useCallback(() => {
    if (!recRef.current) return;
    try {
      recRef.current.stop();
    } catch { }
  }, []);

  const reset = React.useCallback(() => {
    setFinalText("");
    setInterimText("");
    setError(null);
  }, []);

  return { supported, listening, interimText, finalText, error, start, stop, reset };
}
