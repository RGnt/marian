# Local AI Assistant (TanStack Start + FastAPI)

A robust, local-first chat application featuring streaming responses, real-time Text-to-Speech (TTS), and persistent conversation history. It is designed to run offline with local LLMs (via Ollama/LM Studio) but supports external providers.

**New in v0.2:**
- **Persistent History:** Chats are saved to a local SQLite database.
- **Session Management:** Sidebar to create, switch, and delete conversations.
- **Dual Memory Architecture:**
  - **Short-term:** SQLite (immediate context).
  - **Long-term:** Graphiti/Memgraph (Knowledge Graph for fact recall) - *Optional*.
- **Observability:** Langfuse integration for tracing and metrics - *Optional*.

## Features

- **Chat UI**: Modern interface with Markdown rendering (GFM) and auto-scrolling.
- **Session Sidebar**: Manage multiple conversation threads.
- **Streaming**: Real-time token streaming for low latency.
- **Text-to-Speech**: High-quality, local neural TTS using **Kokoro** (82M model).
  - *Streaming Audio*: Plays audio segments while the text is still generating.
- **Speech-to-Text**: Browser-native speech recognition.
- **Resilient Architecture**: Falls back gracefully if Memory (Graphiti) or Observability (Langfuse) services are not available.

## Project Layout

- `client/` — Frontend (TanStack Start, React, Tailwind, DaisyUI).
- `server/` — Backend (FastAPI, SQLite, Kokoro TTS, Graphiti integration).

## Prerequisites

- **Bun** (for the client)
- **Python 3.12+** and **uv** (for the server)
- **Local LLM Server** (Optional but recommended): E.g., `llama-server`, Ollama, or LM Studio running on port 8080/11434.
- **Docker** (Optional): If you want to use Graphiti (Memgraph) or Langfuse.

---

## 1. Backend Setup (`server/`)

The backend handles the LLM orchestration, TTS generation, and database interactions.

### Installation

```bash
cd server
uv sync

```

### Configuration (.env)

Create a `.env` file in the `server/` directory.

**Minimal Setup (SQLite Only):**

```bash
# LLM Connection (Ollama/LM Studio/OpenAI)
LLM_BASE_URL="[http://127.0.0.1:8080/v1](http://127.0.0.1:8080/v1)"
LLM_API_KEY="local"
LLM_MODEL="local-model"

# TTS Configuration
KOKORO_VOICE="af_heart"

```

**Full Setup (With Memory & Observability):**

```bash
# ... (LLM settings above)

# Graphiti (Long-term Memory) - Requires Memgraph running
GRAPHITI_URL="bolt://localhost:7687"
GRAPHITI_USER=""
GRAPHITI_PASSWORD=""

# Langfuse (Observability)
LANGFUSE_SECRET_KEY="sk-lf-..."
LANGFUSE_PUBLIC_KEY="pk-lf-..."
LANGFUSE_HOST="http://localhost:3000"

```

### Run Server

```bash
uv run uvicorn main:app --reload --host 127.0.0.1 --port 8000

```

*The server will automatically initialize `chat_history.db` (SQLite) on first run.*

---

## 2. Frontend Setup (`client/`)

The frontend is a TanStack Start application that proxies API requests to the Python backend.

### Installation

```bash
cd client
bun install

```

### Configuration

Create a `.env` file in the `client/` directory:

```bash
# Backend URL (FastAPI)
FASTAPI_BASE_URL="[http://127.0.0.1:8000](http://127.0.0.1:8000)"

# Model Name (Used for UI display and API requests)
VITE_MODEL_NAME="local-model"

```

### Run Client

```bash
bun run dev

```

Open your browser to `http://localhost:3000`.

---

## Optional Services (Docker)

To enable the advanced features, run these services via Docker.

### Graphiti (Long-term Memory)

Requires a Memgraph instance.

```bash
docker run -p 7687:7687 -p 7444:7444 --name memgraph memgraph/memgraph-platform

```

### Langfuse (Observability)

Refer to the [Langfuse Self-Hosting docs](https://langfuse.com/docs/deployment/self-host) or use their cloud tier.

---

## Troubleshooting

### "Sessions are not loading / Chats stacking on 'default'"

* Ensure your client `.env` has the correct `FASTAPI_BASE_URL`.
* Check the browser network tab. Requests to `/v1/chat/completions` must have a `session_id` in the **Response Headers** or **Query Parameters** (handled automatically by the TanStack proxy).

### "Graphiti/Langfuse connection failed"

* The server logs will show a warning but **will not crash**. The app will continue to function in "SQLite-only" mode.
* Verify Docker containers are running and ports match `.env`.

### "No module named pip"

* Run `uv venv` to recreate the virtual environment or use `uv pip install pip` if managing manually.

### "Kokoro SystemExit / spaCy error"

* Kokoro requires the `en_core_web_sm` spaCy model.
* Run: `uv run python -m spacy download en_core_web_sm`
