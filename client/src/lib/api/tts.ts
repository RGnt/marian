/**
 * Purpose: Request TTS audio from the backend and return WAV data.
 * How: Sends a POST to the `/v1/audio/speech` proxy with model, input, voice,
 * and speed, then validates the response.
 * @param args - Request parameters for speech synthesis.
 * @param args.input - Text or markdown input to synthesize.
 * @param args.voice - Voice identifier to use.
 * @param args.speed - Playback speed multiplier.
 * @param args.model - Optional model override.
 * @param args.signal - Optional AbortSignal to cancel the request.
 * @returns Promise<Blob> - WAV audio data as a Blob.
 */
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
