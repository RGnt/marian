# System Architecture

## Overview

The Local AI Assistant is a full-stack application designed to run locally with optional integrations for long-term memory and observability. It consists of:

-   **Frontend**: A TanStack Start application (React) served by Bun.
-   **Backend**: A FastAPI application (Python) managed by `uv`.

## Backend Architecture (`server/`)

The backend is organized using a layered architecture:

-   **API Layer (`app/api/`)**: Defines the REST endpoints.
-   **Service Layer (`app/services/`)**: Contains the business logic and integrations.
-   **Core (`app/core/`)**: Configuration and settings.

### Key Components

1.  **Chat Runtime (`app/services/chat_runtime.py`)**
    -   Orchestrates the chat interaction using LangGraph.
    -   Manages the flow of data between the User, LLM, Short-term History, and Long-term Memory.
    -   Streams responses token-by-token to the client.

2.  **Memory Service (`app/services/memory.py`)**
    -   **Abstraction**: A `MemoryClient` protocol defines the interface for long-term memory operations (`search`, `add_turn`).
    -   **Implementations**:
        -   `GraphitiMemoryClient`: Wraps the `graphiti_core` library to interact with Memgraph/Neo4j. Handles entity extraction and fact retrieval.
        -   `NoOpMemoryClient`: A placeholder implementation used when memory is disabled.
    -   **Maintainability**: This abstraction decouples the core chat logic from the specific memory backend, preventing crashes if dependencies are missing or services are down.

3.  **History Service (`app/services/history.py`)**
    -   Manages short-term conversation history using SQLite (`chat_history.db`).
    -   Ensures immediate context is preserved across restarts.

4.  **Factory (`app/services/factory.py`)**
    -   Responsible for initializing external services (Graphiti, Langfuse).
    -   Handles safe-failures and configuration checks (Feature Flags).

### Configuration & Feature Flags

The application uses `pydantic-settings` (`app/core/settings.py`) to manage configuration via environment variables.

**Feature Flags:**

-   `ENABLE_GRAPHITI` (Default: `False`): detailed control over enabling the long-term memory module.
-   `ENABLE_LANGFUSE` (Default: `False`): detailed control over enabling observability.

**Why these flags?**
Previous versions attempted to infer enablement based on the presence of URLs or Keys. This led to issues where default values caused the server to hang while trying to connect to non-existent services. Explicit flags ensure the server only attempts connections when intended.

### Data Flow

1.  **User Input**: Received via `/v1/chat/completions`.
2.  **Context Assembly**:
    -   `HistoryService` fetches recent messages from SQLite.
    -   `MemoryService` (if enabled) searches for relevant facts based on the user query.
3.  **LLM Generation**: The assembled prompt (Context + History + Input) is sent to the LLM.
4.  **Response Streaming**: The LLM response is streamed back to the client.
5.  **Background Persistence**:
    -   The interaction is saved to SQLite.
    -   The interaction is asynchronously processed by `MemoryService` (Graphiti) to extract and store facts (if enabled).

## Frontend Architecture (`client/`)

-   **Framework**: TanStack Start (SSR/ISR capabilities).
-   **State Management**: React Query (via TanStack Start).
-   **Styling**: Tailwind CSS + DaisyUI.
-   **API Integration**: Proxies requests to the FastAPI backend.
