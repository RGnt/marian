import type { useAudioQueue } from "@/lib/audio/useAudioQueue";

export function ChatNavbar(props: {
    audioQ: ReturnType<typeof useAudioQueue>;
    onStopAudio: () => void;
}) {
    const { playing, queuedCount } = props.audioQ;
    const hasAudio = playing || queuedCount > 0;

    return (
        <div className="navbar bg-base-100 border-b border-base-200 min-h-[4rem]">
            <div className="flex-none md:hidden">
                <label htmlFor="chat-drawer" className="btn btn-square btn-ghost">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        className="inline-block w-5 h-5 stroke-current"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M4 6h16M4 12h16M4 18h16"
                        ></path>
                    </svg>
                </label>
            </div>

            <div className="flex-1 px-2 mx-2">
                <span className="text-lg font-bold tracking-tight">Marian</span>
                <span className="ml-2 text-xs opacity-50 hidden sm:inline-block border border-base-300 rounded px-1.5 py-0.5">
                    Local AI
                </span>
            </div>

            <div className="flex-none gap-3">
                {hasAudio && (
                    <div className="badge badge-neutral gap-2 hidden sm:flex animate-pulse">
                        <span>playing</span>
                        <span className="loading loading-bars loading-xs"></span>
                    </div>
                )}

                <button
                    className="btn btn-sm btn-outline"
                    onClick={props.onStopAudio}
                    disabled={!hasAudio}
                >
                    {hasAudio ? "Stop Audio" : "No Audio"}
                </button>
            </div>
        </div>
    );
}