from __future__ import annotations
from datetime import datetime, timezone
import aiosqlite
import logging
from typing import List
from dataclasses import dataclass
from app.schemas.openai_chat import ChatMessage

logger = logging.getLogger(__name__)

DB_PATH = "chat_history.db"


@dataclass
class SessionSummary:
    id: str
    title: str
    updated_at: float


@dataclass
class StoredMessage:
    id: str
    role: str
    content: str
    created_at: float


@dataclass
class HistoryEntry:
    role: str
    content: str


class SQLiteChatHistory:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path

    async def initialize(self):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            await db.execute(
                "CREATE INDEX IF NOT EXISTS idx_session ON messages(session_id)"
            )
            await db.commit()

    async def add_message(self, session_id: str, role: str, content: str):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)",
                (session_id, role, content),
            )
            await db.commit()

    async def get_sessions(self) -> List[SessionSummary]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row

            query = """
                SELECT
                    session_id,
                    MAX(created_at) as last_update,
                    (SELECT content FROM messages m2
                     WHERE m2.session_id = m1.session_id
                     AND role = 'user'
                     ORDER BY id ASC LIMIT 1) as title
                FROM messages m1
                GROUP BY session_id
                ORDER BY last_update DESC
            """
            cursor = await db.execute(query)
            rows = await cursor.fetchall()

            results = []
            for r in rows:
                sid = r["session_id"]
                raw_time = r["last_update"]
                title = r["title"] or "New Conversation"

                # Truncate
                if len(title) > 60:
                    title = title[:60] + "..."

                # Parse Timestamp
                try:
                    dt = datetime.strptime(raw_time, "%Y-%m-%d %H:%M:%S")
                    dt = dt.replace(tzinfo=timezone.utc)
                    ts = dt.timestamp() * 1000  # ms for JS
                except Exception:
                    ts = float(0)

                results.append(SessionSummary(id=sid, title=title, updated_at=ts))
            return results

    async def get_messages(self, session_id: str) -> List[StoredMessage]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT id, role, content, created_at FROM messages WHERE session_id = ? ORDER BY id ASC",
                (session_id,),
            )
            rows = await cursor.fetchall()

            out = []
            for r in rows:
                try:
                    dt = datetime.strptime(r["created_at"], "%Y-%m-%d %H:%M:%S")
                    dt = dt.replace(tzinfo=timezone.utc)
                    ts = dt.timestamp() * 1000
                except Exception:
                    ts = 0

                out.append(
                    StoredMessage(
                        id=str(r["id"]),
                        role=r["role"],
                        content=r["content"],
                        created_at=ts,
                    )
                )
        return out

    async def delete_session(self, session_id: str):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
            await db.commit()

    async def get_recent_messages(
        self, session_id: str, limit: int = 10
    ) -> List[ChatMessage]:
        async with aiosqlite.connect(self.db_path) as db:
            # Get last N messages ordered by time
            cursor = await db.execute(
                """
                SELECT role, content FROM messages 
                WHERE session_id = ? 
                ORDER BY id DESC LIMIT ?
                """,
                (session_id, limit),
            )
            rows = await cursor.fetchall()
            # Reverse to return in chronological order (oldest -> newest)
            return [ChatMessage(role=r[0], content=r[1]) for r in reversed(rows)]  # pyright: ignore


# Singleton instance builder
async def build_history_service() -> SQLiteChatHistory:
    history = SQLiteChatHistory()
    await history.initialize()
    return history
