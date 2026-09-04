"""
Kyron SDK Exception Definitions.
"""

class KyronSecurityException(Exception):
    """Base exception for all Kyron SDK errors."""
    pass


class KyronBlocked(KyronSecurityException):
    """Raised when Kyron Layer blocks a proposed tool call or prompt content."""
    def __init__(
        self,
        verdict: str,
        risk_score: float,
        explanation: str,
        matched_signals: list = None,
        policy_check: dict = None,
    ):
        self.verdict = verdict
        self.risk_score = risk_score
        self.explanation = explanation
        self.matched_signals = matched_signals or []
        self.policy_check = policy_check or {}
        super().__init__(f"[{verdict.upper()}] Risk {risk_score:.2f} — {explanation}")


class KyronTokenExpired(KyronSecurityException):
    """Raised when the provided agent token is invalid or has expired."""
    pass


class KyronConnectionError(KyronSecurityException):
    """Raised when the Kyron gateway endpoint is unreachable."""
    pass


# Backward compatibility aliases
SentinelBlocked = KyronBlocked
SentinelTokenExpired = KyronTokenExpired
SentinelConnectionError = KyronConnectionError
