"""
KyronClient — developer-friendly client for manual or framework-level screening.
"""
from dataclasses import dataclass
from typing import Any, Optional
import httpx

from kyron.exceptions import KyronBlocked, KyronConnectionError, KyronTokenExpired


@dataclass
class KyronScreenResult:
    verdict: str  # "ALLOW", "BLOCK", "REQUIRE_APPROVAL"
    risk_score: float
    explanation: str
    matched_signals: list
    policy_check: dict
    session_id: str
    is_blocked: bool
    is_allowed: bool
    requires_approval: bool


class KyronClient:
    """
    High-level Kyron API client for custom agent workflows.

    Usage:
        kyron = KyronClient(base_url="http://localhost:8000", token="...")
        result = kyron.screen(
            tool="write_file",
            params={"path": "/sandbox/out.txt"},
            untrusted_context="user prompt..."
        )
        if result.is_blocked:
            print(f"Blocked: {result.explanation}")
    """

    def __init__(
        self,
        base_url: str = "http://localhost:8000",
        token: Optional[str] = None,
        timeout: float = 10.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.token = token or ""
        self.timeout = timeout

    def _headers(self) -> dict:
        h = {"Content-Type": "application/json"}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
            h["X-Sentinel-Token"] = self.token
        return h

    def screen(
        self,
        tool: str,
        params: Optional[dict[str, Any]] = None,
        untrusted_context: str = "",
        agent_id: str = "kyron_agent",
        session_id: str = "session_default",
        source: str = "user_input",
    ) -> KyronScreenResult:
        """Screens proposed tool call synchronously."""
        payload = {
            "incoming_content": {"source": source, "text": untrusted_context},
            "proposed_tool_call": {"tool_name": tool, "arguments": params or {}},
            "agent_context": {"agent_id": agent_id, "session_id": session_id},
        }

        try:
            resp = httpx.post(
                f"{self.base_url}/screen",
                json=payload,
                headers=self._headers(),
                timeout=self.timeout,
            )
        except httpx.ConnectError as e:
            raise KyronConnectionError(f"Cannot reach Kyron Gateway at {self.base_url}: {e}") from e

        if resp.status_code == 401:
            raise KyronTokenExpired("Invalid or expired Kyron authentication token.")

        resp.raise_for_status()
        data = resp.json()

        v_upper = data.get("verdict", "allow").upper()
        return KyronScreenResult(
            verdict=v_upper,
            risk_score=float(data.get("risk_score", 0.0)),
            explanation=data.get("explanation", ""),
            matched_signals=data.get("matched_signals", []),
            policy_check=data.get("policy_check", {}),
            session_id=session_id,
            is_blocked=(v_upper == "BLOCK"),
            is_allowed=(v_upper == "ALLOW"),
            requires_approval=(v_upper == "REQUIRE_APPROVAL"),
        )

    # Alias for explicit synchronous naming
    screen_sync = screen


SentinelClient = KyronClient
