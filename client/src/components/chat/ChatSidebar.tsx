import * as React from "react";
import type { ChatSession } from "@/lib/api/types";

export function ChatSidebar(props: {
    sessions: ChatSession[];
    currentSessionId: string | null;
    onSelectSession: (id: string) => void;
    onNewChat: () => void;
    onDeleteSession: (id: string, e: React.MouseEvent) => void;
}) {
    return (
        <div className="flex flex-col h-full bg-base-200 w-64 border-r border-base-300">
            <div className="p-4">
                <button
                    className="btn btn-primary w-full gap-2 shadow-sm"
                    onClick={props.onNewChat}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    New Chat
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2">
                <ul className="menu menu-sm w-full rounded-box gap-1">
                    {props.sessions.length === 0 && (
                        <li className="disabled text-center opacity-50 mt-4">
                            <span>No history</span>
                        </li>
                    )}

                    {props.sessions.map((s) => {
                        const active = s.id === props.currentSessionId;
                        return (
                            <li key={s.id} className="relative group">
                                <a
                                    className={active ? "active font-medium" : ""}
                                    onClick={() => props.onSelectSession(s.id)}
                                >
                                    <span className="truncate max-w-[150px]">{s.title || "Untitled Chat"}</span>
                                </a>

                                {/* Delete button appears on hover or if active */}
                                <button
                                    className="absolute right-1 top-1 btn btn-ghost btn-xs btn-square opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        props.onDeleteSession(s.id, e);
                                    }}
                                >
                                    ✕
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>

            <div className="p-4 border-t border-base-300">
                <div className="text-xs text-center opacity-50">
                    Local AI Assistant
                </div>
            </div>
        </div>
    );
}