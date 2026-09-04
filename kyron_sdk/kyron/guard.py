"""
KyronGuard — core runtime firewall middleware for autonomous agent tool calls.
"""
import os
from typing import Any, Callable, Optional
import httpx

from kyron.exceptions import (
    KyronBlocked,
    KyronConnectionError,
    KyronTokenExpired,
)


class KyronGuard:
    """
    Drop-in security middleware for Python agents.

    Intercepts and screens proposed tool calls against:
    - Stage 0: Token RBAC & Per-Tool Permissions
    - Stage 1: Fast Rule & Signature Engine
    - Stage 2: TurboQuant Semantic ML Vector Classifier
    - Stage 3: Selective LLM-Judge Escalation
    - Hard Policy: YAML Path, Domain, and Rate Limits

    Example:
        guard = KyronGuard(
            endpoint="https://your-gateway.onrender.com",
            token=os.environ["KYRON_TOKEN"],
            agent_id="finance_bot"
        )

        result = guard.run_tool(
            tool_name="write_file",
            arguments={"path": "/sandbox/report.txt", "content": "data"},
            incoming_text=user_query,
            tool_fn=actual_write_function
        )
    """

    def __init__(
        self,
        endpoint: str = "http://localhost:8000",
        token: Optional[str] = None,
        agent_id: str = "kyron_sdk_agent",
        session_id: Optional[str] = None,
        timeout: float = 10.0,
    ):
        self.endpoint = endpoint.rstrip("/")
        self.token = token or os.environ.get("KYRON_TOKEN") or os.environ.get("SENTINEL_TOKEN", "")
        self.agent_id = agent_id
        self.session_id = session_id or f"sdk_session_{os.getpid()}"
        self.timeout = timeout

        if not self.token:
            raise ValueError(
                "No Kyron token provided. Set KYRON_TOKEN env var or pass token= argument.\n"
                "Generate a token via: POST /tokens/agent or the Kyron SOC Dashboard."
            )

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.token}",
            "X-Sentinel-Token": self.token,
            "Content-Type": "application/json",
        }

    def screen(
        self,
        tool_name: str,
        arguments: dict[str, Any],
        incoming_text: str,
        incoming_source: str = "user_input",
    ) -> dict:
        """
        Screen a proposed tool call through the Kyron Gateway.
        Returns the screening decision dictionary.
        Raises KyronBlocked if the verdict is 'block'.
        """
        payload = {
            "incoming_content": {"source": incoming_source, "text": incoming_text},
            "proposed_tool_call": {"tool_name": tool_name, "arguments": arguments},
            "agent_context": {"agent_id": self.agent_id, "session_id": self.session_id},
        }

        try:
            resp = httpx.post(
                f"{self.endpoint}/screen",
                json=payload,
                headers=self._headers(),
                timeout=self.timeout,
            )
        except httpx.ConnectError as err:
            raise KyronConnectionError(f"Cannot reach Kyron Gateway at {self.endpoint}: {err}") from err

        if resp.status_code == 401:
            raise KyronTokenExpired("Kyron session token is invalid or expired.")

        resp.raise_for_status()
        result = resp.json()

        if result.get("verdict") == "block":
            raise KyronBlocked(
                verdict=result["verdict"],
                risk_score=result.get("risk_score", 0.0),
                explanation=result.get("explanation", ""),
                matched_signals=result.get("matched_signals", []),
                policy_check=result.get("policy_check", {}),
            )

        return result

    def run_tool(
        self,
        tool_name: str,
        arguments: Optional[dict[str, Any]] = None,
        incoming_text: str = "",
        incoming_source: str = "user_input",
        tool_fn: Optional[Callable[..., Any]] = None,
        **kwargs: Any,
    ) -> Any:
        """
        Screen and conditionally execute a tool function.
        """
        final_args = {}
        if arguments and isinstance(arguments, dict):
            final_args.update(arguments)
        if kwargs:
            final_args.update(kwargs)

        if "source" in final_args:
            incoming_source = final_args.pop("source")
        if "incoming_source" in final_args:
            incoming_source = final_args.pop("incoming_source")
        if "incoming_text" in final_args:
            incoming_text = final_args.pop("incoming_text")

        screen_result = self.screen(tool_name, final_args, incoming_text, incoming_source)

        if tool_fn is not None:
            return tool_fn(**final_args)

        return screen_result

    def screen_content_only(self, text: str, tool_name: str = "none", source: str = "retrieved_document") -> dict:
        """Pre-screens raw text before the agent plans tool execution."""
        return self.screen(tool_name, {}, text, source)


# Backward compatibility
SentinelGuard = KyronGuard
