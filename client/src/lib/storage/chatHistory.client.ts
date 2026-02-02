import { createClientOnlyFn } from "@tanstack/react-start";
import type { ChatMessage } from "@/lib/api/types";

const LS_KEY = "local_chat_history_v1";

/**
 * Purpose: Load chat history from localStorage on the client.
 * How: Reads the storage key and parses JSON into ChatMessage objects.
 * Parameters: None.
 * @returns ChatMessage[] - Parsed messages or an empty array on error.
 */
export const loadChatHistory = createClientOnlyFn((): ChatMessage[] => {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as ChatMessage[]) : [];
    } catch {
        return [];
    }
});

/**
 * Purpose: Persist chat history to localStorage on the client.
 * How: Serializes messages to JSON and writes to a fixed storage key.
 * @param msgs - Messages to persist.
 * @returns void - Side effects only.
 */
export const saveChatHistory = createClientOnlyFn((msgs: ChatMessage[]) => {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(msgs));
    } catch { }
});

/**
 * Purpose: Clear chat history from localStorage on the client.
 * How: Removes the fixed storage key.
 * Parameters: None.
 * @returns void - Side effects only.
 */
export const clearChatHistory = createClientOnlyFn(() => {
    try {
        localStorage.removeItem(LS_KEY);
    } catch { }
});
