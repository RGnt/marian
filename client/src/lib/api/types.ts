export type Role = "system" | "user" | "assistant" | "tool";
export type InputMode = "text" | "voice";

export type ChatMessage = {
  id: string;
  role: Role;
  content: string; // markdown as-generated
  createdAt: number;
  inputMode?: InputMode;
};

export type ChatSession = {
  id: string;
  title: string;
  updatedAt: number;
}