"""
ORM Database Models for Sentinel Layer — Phase 10 extended.

Adds: UserDB, UserPermissionDB, AgentSessionDB
Extends: ScreenEventDB with user identity columns (nullable, backward-compatible)
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text,
    ForeignKey, PrimaryKeyConstraint, UniqueConstraint
)
from sqlalchemy.orm import relationship

from app.db.session import Base


# ── Existing tables (unchanged) ───────────────────────────────────────────────

class SessionCallCountDB(Base):
    """Hot storage table tracking session tool invocation counts."""
    __tablename__ = "session_call_counts"

    session_id = Column(String(128), nullable=False)
    tool_name  = Column(String(128), nullable=False)
    call_count = Column(Integer, default=0, nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        PrimaryKeyConstraint("session_id", "tool_name", name="pk_session_tool"),
    )


class ScreenEventDB(Base):
    """
    Hot storage table for screened events audit trail.
    Phase 10: extended with nullable user identity columns.
    Prepared for batch pushing to cold storage (Postgres).
    """
    __tablename__ = "screen_events"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    timestamp        = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    agent_id         = Column(String(128), nullable=False)
    session_id       = Column(String(128), nullable=False, index=True)
    tool_name        = Column(String(128), nullable=False)
    incoming_source  = Column(String(64),  nullable=False)
    risk_score       = Column(Float,       nullable=False)
    verdict          = Column(String(32),  nullable=False)
    explanation      = Column(Text,        nullable=False)
    matched_signals_json = Column(Text,    nullable=False)
    policy_allowed   = Column(Boolean,     nullable=False)
    policy_reason    = Column(Text,        nullable=False)

    # Phase 10 — user identity (nullable: backward-compatible with tokenless calls)
    user_id    = Column(String(128), nullable=True, index=True)
    user_email = Column(String(256), nullable=True)
    user_role  = Column(String(32),  nullable=True)
    llm_reasoning = Column(Text, nullable=True)
    attack_category = Column(String(64), nullable=True)


# ── Phase 10 — Auth tables ────────────────────────────────────────────────────

def _uuid() -> str:
    return str(uuid.uuid4())


class UserDB(Base):
    """
    Registered users. Admin is manually seeded via CLI.
    All other users are invited by Admin and activated on first OAuth login.
    """
    __tablename__ = "users"

    id             = Column(String(36),  primary_key=True, default=_uuid)
    email          = Column(String(256), nullable=False, unique=True, index=True)
    name           = Column(String(256), nullable=False)
    avatar_url     = Column(String(512), nullable=True)
    role           = Column(String(32),  nullable=False, default="developer")
    oauth_provider = Column(String(32),  nullable=True)   # "google" | "github" | None (admin)
    oauth_sub      = Column(String(256), nullable=True)   # provider's user ID
    is_active      = Column(Boolean,     nullable=False, default=False)
    created_by     = Column(String(36),  nullable=True)   # user_id of inviting admin
    created_at     = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    permissions    = relationship("UserPermissionDB", back_populates="user", cascade="all, delete-orphan")
    agent_sessions = relationship("AgentSessionDB",   back_populates="user", cascade="all, delete-orphan")


class UserPermissionDB(Base):
    """
    Per-user permission overrides. Merged with role defaults at token generation time.
    Admin can toggle any action on/off for any user.
    """
    __tablename__ = "user_permissions"

    id      = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    action  = Column(String(64), nullable=False)   # e.g. "write_file", "call_http"
    allowed = Column(Boolean,    nullable=False)

    user = relationship("UserDB", back_populates="permissions")

    __table_args__ = (
        UniqueConstraint("user_id", "action", name="uq_user_action"),
    )


class AgentSessionDB(Base):
    """
    Issued agent session tokens. Used for revocation checking.
    jti (JWT ID) is the unique identifier referenced in the JWT payload.
    """
    __tablename__ = "agent_sessions"

    id               = Column(Integer,    primary_key=True, autoincrement=True)
    session_id       = Column(String(36), nullable=False, default=_uuid, index=True)
    user_id          = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    jti              = Column(String(64), nullable=False, unique=True, index=True)
    role_at_issue    = Column(String(32), nullable=False)
    permissions_json = Column(Text,       nullable=False)  # JSON snapshot of permissions at issue time
    issued_at        = Column(DateTime,   default=lambda: datetime.now(timezone.utc), nullable=False)
    expires_at       = Column(DateTime,   nullable=False)
    is_revoked       = Column(Boolean,    nullable=False, default=False)

    user = relationship("UserDB", back_populates="agent_sessions")
