export type Role = "system" | "user" | "assistant" | "tool";

export type InputMode = "text" | "voice";
export type SttMode = "browser" | "server";

export type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  inputMode?: InputMode;
};

export type TtsConfig = {
  voice: string;         // e.g. "af_heart"
  langCode: string;      // e.g. "a"
  speed: number;         // 1.0
  audioFormat: "wav_pcm16";
  sampleRateHz: number;  // 24000
};

export type ChatTtsRequest = {
  sessionId: string;
  message: string;
  history: ChatMessage[];
  tts: TtsConfig;

  // segmentation controls
  maxSegmentChars: number;
  minSegmentChars: number;
  flushTimeoutMs: number;
};

export type AssistantSegment = {
  type: "assistant_segment";
  segmentId: number;
  text: string;
  // base64-encoded WAV; optional in stub
  audioB64?: string;
  mime?: "audio/wav";
  sampleRateHz?: number;
};

export type AssistantDone = {
  type: "assistant_done";
  fullText: string;
};

export type ChatEvent = AssistantSegment | AssistantDone;

export type SttTranscribeResponse = {
  text: string;
};
