import * as React from "react";
import { fetchSessions, fetchSessionMessages, deleteSession } from "@/lib/api/history";
import type { ChatSession, ChatMessage } from "@/lib/api/types";

export function useChatSession() {
    const [sessions, setSessions] = React.useState<ChatSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = React.useState<string>(() =>
        Math.random().toString(36).slice(2)
    );
    const [messages, setMessages] = React.useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);

    const refreshSessions = React.useCallback(() => {
        fetchSessions().then(setSessions);
    }, []);

    const selectSession = React.useCallback(async (id: string) => {
        setCurrentSessionId(id);
        setIsLoading(true);
        try {
            const msgs = await fetchSessionMessages(id);
            setMessages(msgs);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createNewSession = React.useCallback(() => {
        // Generate a fresh ID
        const newId = Math.random().toString(36).slice(2);
        setCurrentSessionId(newId);
        setMessages([]);
    }, []);

    const removeSession = React.useCallback(async (id: string) => {
        await deleteSession(id);
        setSessions(prev => prev.filter(s => s.id !== id));
        if (id === currentSessionId) createNewSession();
    }, [currentSessionId, createNewSession]);

    React.useEffect(() => {
        refreshSessions();
    }, []);

    return {
        sessions,
        messages,
        setMessages, // Exposed for optimistic updates
        currentSessionId,
        isLoading,
        refreshSessions,
        selectSession,
        createNewSession,
        removeSession
    };
}