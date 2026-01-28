# Local Chat (TanStack Start + FastAPI)

A local-first chat app with streamed text responses and optional text-to-speech playback.

Quick video to showcase, and few words about it, https://www.youtube.com/watch?v=JrIQ3nIqS6I

## Features

- **Chat UI** with message history
- **Markdown rendering** for assistant messages (GFM support)
- **Streaming text responses** from an OpenAI-compatible endpoint (`/v1/chat/completions`)
- **Speech input** via Browser Speech API (optional)
- **Text-to-speech** via OpenAI-compatible endpoint (`/v1/audio/speech`) using Kokoro
- **Play while streaming**: enable speech on a message and it will start speaking as soon as segments are available
- **Stop playback** (clears queued audio)

## Project Layout

- `client/` — TanStack Start app (Bun + Vite)
- `server/` — FastAPI backend (OpenAI-compatible routes + Kokoro TTS)

## Prerequisites

- **Bun** (for the client)
- **Python 3.12+** and **uv** (for the server)
- Optional: a local LLM server compatible with OpenAI Chat Completions (e.g. `llama-server` from llama.cpp)

## Start the Server (FastAPI)

From `server/`:

```bash
uv sync
uv run uvicorn main:app --reload --host 127.0.0.1 --port 8000
````

Environment (example):

```bash
# OpenAI-compatible upstream (llama-server etc.)
export OPENAI_BASE_URL="http://127.0.0.1:8080/v1"
export OPENAI_API_KEY="local"

# If your server uses these:
export MODEL_NAME="local-model"
```

## Start the Client (TanStack Start)

From `client/`:

```bash
bun install
bun --bun run dev
```

Environment (example):

```bash
# Used by the client for the model name in /v1/chat/completions requests
export VITE_MODEL_NAME="local-model"

# If you proxy via Start server routes to FastAPI:
export FASTAPI_BASE_URL="http://127.0.0.1:8000"
```

Open the client at the URL shown in the terminal (typically `http://localhost:3000`).

## Usage

1. Type a message (or use the mic if supported) and send.
2. Assistant responses stream in as markdown.
3. Click **Play** on an assistant message to start TTS (can be enabled while the message is still streaming).
4. Click **Stop** to cancel generation and stop playback.


# Troubleshooting

### “No module named pip” (uv venv)

* Fix: `uv venv --seed` OR `uv pip install pip`.
* Avoid copying pip between venvs unless you’re unblocking yourself temporarily.

### Kokoro startup fails with spaCy download / SystemExit

* Install `en_core_web_sm` ahead of time (wheel install is most reliable).
* Then restart the server.

### Browser Speech API not working

* Some browsers/OS setups don’t support `SpeechRecognition`.
* Check your browser devtools console for permission or “not supported” errors.

### CORS errors

* Ensure the exact origin in the browser address bar is in `allow_origins`:

  * `localhost` vs `127.0.0.1` matters
  * port matters (`5173` vs `3000`)

