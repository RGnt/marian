export function ChatEmptyState() {
    return (
        <div className="hero min-h-[50vh] bg-base-100">
            <div className="hero-content text-center">
                <div className="max-w-md">
                    <h1 className="text-3xl font-bold">Local AI Assistant</h1>
                    <p className="py-6 opacity-70">
                        Select a conversation from the sidebar or type a message below to start a new chat.
                        All history is stored locally.
                    </p>

                    <div className="flex flex-col gap-2 opacity-50 text-xs">
                        <div className="flex items-center justify-center gap-2">
                            <span className="badge badge-outline">TTS: Kokoro-82M</span>
                            <span className="badge badge-outline">Memory: SQLite + Graphiti</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}