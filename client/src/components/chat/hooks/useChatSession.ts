import * as React from "react";
import { fetchSessions, fetchSessionMessages, deleteSession } from "@/lib/api/history";
import type { ChatSession, ChatMessage } from "@/lib/api/types";

/**
 * Purpose: Manage chat session list, active session, and message state.
 * How: Wraps session APIs, tracks loading state, and exposes helper actions.
 * Parameters: None.
 * @returns Session state, messages, and session management actions.
 */
export function useChatSession() {
    const [sessions, setSessions] = React.useState<ChatSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = React.useState<string>(() =>
        Math.random().toString(36).slice(2)
    );
    const [messages, setMessages] = React.useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);

    /**
     * Purpose: Refresh the session list from the backend.
     * How: Fetches sessions and updates local state.
     * Parameters: None.
     * @returns void - Side effects only.
     */
    const refreshSessions = React.useCallback(() => {
        fetchSessions().then(setSessions);
    }, []);

    /**
     * Purpose: Switch to a different session and load its messages.
     * How: Updates current session id, loads messages, and manages loading state.
     * @param id - Session id to activate.
     * @returns Promise<void> - Resolves when loading completes.
     */
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

    /**
     * Purpose: Create a new local session id and clear messages.
     * How: Generates a random id and resets the message list.
     * Parameters: None.
     * @returns void - Side effects only.
     */
    const createNewSession = React.useCallback(() => {
        // Generate a fresh ID
        const newId = Math.random().toString(36).slice(2);
        setCurrentSessionId(newId);
        setMessages([]);
    }, []);

    /**
     * Purpose: Delete a session and update local state.
     * How: Calls the delete API, removes the session from state, and if the
     * deleted session was active, creates a new one.
     * @param id - Session id to delete.
     * @returns Promise<void> - Resolves when deletion completes.
     */
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
