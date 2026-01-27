export async function fetchSpeechWav(args: {
  input: string;
  voice: string;
  speed: number;
  model?: string;
  signal?: AbortSignal;
}): Promise<Blob> {
  const res = await fetch("/v1/audio/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: args.model ?? "kokoro-82m",
      input: args.input,
      voice: args.voice,
      response_format: "wav",
      speed: args.speed,
    }),
    signal: args.signal,
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`audio/speech failed: ${res.status} ${t}`);
  }
  return await res.blob();
}
