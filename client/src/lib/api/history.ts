import type { ChatMessage, ChatSession } from "./types";

// These fetches will be proxied by TanStack Start server functions 
// or standard fetch if you configured the proxy in vite.config.ts

/**
 * Purpose: Fetch the list of chat sessions from the backend.
 * How: Issues a GET request to `/v1/sessions` and returns parsed JSON.
 * Parameters: None.
 * @returns Promise<ChatSession[]> - Session list (empty on non-OK response).
 */
export async function fetchSessions(): Promise<ChatSession[]> {
  const res = await fetch("/v1/sessions");
  if (!res.ok) return [];
  return res.json();
}

/**
 * Purpose: Fetch all messages for a specific session.
 * How: Issues a GET request to `/v1/sessions/{sessionId}` and returns JSON.
 * @param sessionId - Session identifier to load.
 * @returns Promise<ChatMessage[]> - Messages (empty on non-OK response).
 */
export async function fetchSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  const res = await fetch(`/v1/sessions/${sessionId}`);
  if (!res.ok) return [];
  return res.json();
}

/**
 * Purpose: Delete a session and its messages on the backend.
 * How: Issues a DELETE request to `/v1/sessions/{sessionId}`.
 * @param sessionId - Session identifier to delete.
 * @returns Promise<void> - Resolves when the request completes.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await fetch(`/v1/sessions/${sessionId}`, { method: "DELETE" });
}
