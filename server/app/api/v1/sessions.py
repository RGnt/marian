from __future__ import annotations

from typing import List
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.services.history import SQLiteChatHistory
from app.core.dependencies import get_history_service

router = APIRouter()

class SessionResponse(BaseModel):
    id: str
    title: str
    updatedAt: float  # Matching frontend CamelCase expectation


class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    createdAt: float


@router.get("/sessions", response_model=List[SessionResponse])
async def list_sessions(history: SQLiteChatHistory = Depends(get_history_service)):
    """
    List all chat sessions.
    """
    sessions = await history.get_sessions()
    return [
        SessionResponse(id=s.id, title=s.title, updatedAt=s.updated_at)
        for s in sessions
    ]


@router.get("/sessions/{session_id}", response_model=List[MessageResponse])
async def get_session(
    session_id: str, history: SQLiteChatHistory = Depends(get_history_service)
):
    """
    Get full message history for a specific session.
    """
    msgs = await history.get_messages(session_id)
    return [
        MessageResponse(id=m.id, role=m.role, content=m.content, createdAt=m.created_at)
        for m in msgs
    ]


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str, history: SQLiteChatHistory = Depends(get_history_service)
):
    """
    Delete a session and all its messages.
    """
    await history.delete_session(session_id)
    return {"ok": True, "deleted": session_id}
