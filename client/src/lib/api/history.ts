import type { ChatMessage, ChatSession } from "./types";

// These fetches will be proxied by TanStack Start server functions 
// or standard fetch if you configured the proxy in vite.config.ts

export async function fetchSessions(): Promise<ChatSession[]> {
  const res = await fetch("/v1/sessions");
  if (!res.ok) return [];
  return res.json();
}

export async function fetchSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  const res = await fetch(`/v1/sessions/${sessionId}`);
  if (!res.ok) return [];
  return res.json();
}

export async function deleteSession(sessionId: string): Promise<void> {
  await fetch(`/v1/sessions/${sessionId}`, { method: "DELETE" });
}