import { createClientOnlyFn } from "@tanstack/react-start";
import type { ChatMessage } from "@/lib/api/types";

const LS_KEY = "local_chat_history_v1";

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

export const saveChatHistory = createClientOnlyFn((msgs: ChatMessage[]) => {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(msgs));
    } catch { }
});

export const clearChatHistory = createClientOnlyFn(() => {
    try {
        localStorage.removeItem(LS_KEY);
    } catch { }
});
