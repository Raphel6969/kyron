"""
Pydantic v2 schemas for Sentinel Layer API requests and responses.

Defines the contract for /screen (API.md).
"""
from typing import Literal, Any
from pydantic import BaseModel, Field


# ── Request Models ────────────────────────────────────────────────────────────

class AgentContext(BaseModel):
    agent_id: str
    session_id: str
    recent_tool_calls: list[str] = Field(default_factory=list)


class IncomingContent(BaseModel):
    source: Literal["user_input", "retrieved_document", "system"]
    text: str


class ProposedToolCall(BaseModel):
    tool_name: str
    arguments: dict[str, Any] = Field(default_factory=dict)


class ScreenRequest(BaseModel):
    agent_context: AgentContext
    incoming_content: IncomingContent
    proposed_tool_call: ProposedToolCall


# ── Response Models ───────────────────────────────────────────────────────────

class MatchedSignal(BaseModel):
    stage: str
    signal: str
    detail: str | None = None
    score: float | None = None


class PolicyCheck(BaseModel):
    tool_name: str
    allowed: bool
    reason: str


VerdictType = Literal["allow", "block", "require_approval"]


class ScreenResponse(BaseModel):
    risk_score: float = Field(ge=0.0, le=1.0)
    matched_signals: list[MatchedSignal] = Field(default_factory=list)
    verdict: VerdictType
    explanation: str
    policy_check: PolicyCheck
    stage_timings_ms: dict[str, float] = Field(default_factory=dict)
    llm_reasoning: str | None = None
    attack_category: str | None = None


class BatchScreenRequest(BaseModel):
    requests: list[ScreenRequest] = Field(..., max_length=50)


class BatchScreenResponse(BaseModel):
    results: list[ScreenResponse]
    total: int
    blocked_count: int
    allow_count: int
    require_approval_count: int
