import * as React from "react";
import { useChatSession } from "./hooks/useChatSession";
import { useTtsController } from "./hooks/useTtsController";
import { useAudioQueue } from "@/lib/audio/useAudioQueue";
import { useBrowserSpeechRecognition } from "@/lib/speech/useBrowserSpeechRecognition";
import { streamChatCompletion } from "@/lib/api/openaiStream";
import type { ChatMessage } from "@/lib/api/types";

// Components
import { ChatLayout } from "./ChatLayout";
import { ChatNavbar } from "./ChatNavbar";
import { ChatSidebar } from "./ChatSidebar";
import { ChatEmptyState } from "./ChatEmptyState";
import { MessageList } from "./MessageList";
import { Composer } from "./Composer";

function toOpenAIMessages(history: ChatMessage[]) {
  return history.map((m) => ({ role: m.role, content: m.content }));
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function ChatApp() {
  const modelName = import.meta.env.VITE_MODEL_NAME ?? "local-model";

  // --- State & Hooks ---
  const session = useChatSession();
  const audioQ = useAudioQueue();
  const tts = useTtsController(audioQ, session.setMessages);

  // UI State
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [streamingAssistantId, setStreamingAssistantId] = React.useState<string | null>(null);

  const abortChatRef = React.useRef<AbortController | null>(null);

  const sr = useBrowserSpeechRecognition({
    lang: "en-US",
    continuous: false,
    interimResults: true,
  });

  // --- Effects ---

  // Sync Speech-to-Text result to input
  React.useEffect(() => {
    if (sr.finalText) setText(sr.finalText);
  }, [sr.finalText]);

  // --- Handlers ---

  const handleNewChat = () => {
    tts.stop();
    abortChatRef.current?.abort();
    setBusy(false);
    setText("");
    session.createNewSession();
    setSidebarOpen(false); // Close sidebar on mobile
  };

  const handleSelectSession = (id: string) => {
    if (id === session.currentSessionId) return;
    tts.stop();
    abortChatRef.current?.abort();
    setBusy(false);
    session.selectSession(id);
    setSidebarOpen(false);
  };

  const handleRunChat = async () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    // 1. Prepare UI
    setText("");
    setBusy(true);
    tts.stop();
    abortChatRef.current?.abort();

    const ac = new AbortController();
    abortChatRef.current = ac;

    // 2. Add User Message (Optimistic)
    const userMsg: ChatMessage = {
      id: uid(),
      role: "user",
      content: trimmed,
      createdAt: Date.now(),
      inputMode: "text", // Could be dynamic if sr.listening was true
    };
    session.setMessages((prev) => [...prev, userMsg]);

    // 3. Add Placeholder Assistant Message
    const assistantId = uid();
    setStreamingAssistantId(assistantId);
    session.setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", createdAt: Date.now() },
    ]);

    // 4. Stream Response
    const openaiMessages = toOpenAIMessages([...session.messages, userMsg]);

    // Auto-enable TTS if voice mode was used (optional logic, disabled by default here)
    // const shouldSpeak = false; 
    // if (shouldSpeak) tts.playMessage(assistantId, ""); 

    try {
      for await (const delta of streamChatCompletion({
        model: modelName,
        messages: openaiMessages,
        sessionId: session.currentSessionId,
        signal: ac.signal,
      })) {
        // Update Message Content
        session.setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + delta } : m
          )
        );

        // Feed TTS Stream (if enabled)
        tts.feedStream(assistantId, delta);
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        session.setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content + `\n\n*[Error: ${e.message}]*` }
              : m
          )
        );
      }
    } finally {
      setBusy(false);
      setStreamingAssistantId(null);
      tts.flushStream(assistantId);

      // Refresh session list to update titles/timestamps
      session.refreshSessions();
    }
  };

  return (
    <ChatLayout
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}

      navbar={
        <ChatNavbar
          audioQ={audioQ}
          onStopAudio={tts.stop}
        />
      }

      sidebar={
        <ChatSidebar
          sessions={session.sessions}
          currentSessionId={session.currentSessionId}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          onDeleteSession={session.removeSession}
        />
      }

      footer={
        <>
          <Composer
            text={text}
            setText={setText}
            onSendText={handleRunChat}

            // Voice Controls
            onVoiceStart={() => { sr.reset(); sr.start(); }}
            onVoiceStop={sr.stop}
            listening={sr.listening}
            supported={sr.supported}
            interim={sr.interimText}
            error={sr.error}

            busy={busy || session.isLoading}
          />
          {streamingAssistantId && (
            <div className="mt-2 text-xs opacity-50 text-center animate-pulse">
              Generating response...
            </div>
          )}
        </>
      }
    >
      {/* Main Content Body */}
      {session.isLoading ? (
        <div className="flex h-full items-center justify-center opacity-50">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : session.messages.length === 0 ? (
        <ChatEmptyState />
      ) : (
        <MessageList
          messages={session.messages}
          // TTS Controls passed to individual messages
          onPlayAssistant={(id) => {
            // Find content to play
            const m = session.messages.find(msg => msg.id === id);
            if (m) tts.playMessage(id, m.content);
          }}
          onStopAssistant={() => tts.stop()}
          ttsEnabledFor={tts.enabledFor}
          ttsBusyFor={tts.busyFor}
        />
      )}
    </ChatLayout>
  );
}