"""
Kyron — Runtime AI Security Firewall & Guardrails for Autonomous Agents.

Website: https://github.com/Raphel6969/kyron
"""

from kyron.exceptions import (
    KyronBlocked,
    KyronConnectionError,
    KyronSecurityException,
    KyronTokenExpired,
    SentinelBlocked,
    SentinelConnectionError,
    SentinelTokenExpired,
)
from kyron.guard import KyronGuard, SentinelGuard
from kyron.client import KyronClient, KyronScreenResult, SentinelClient
from kyron.langchain import KyronToolWrapper, SentinelToolWrapper

__all__ = [
    # Kyron primary symbols
    "KyronGuard",
    "KyronClient",
    "KyronScreenResult",
    "KyronBlocked",
    "KyronConnectionError",
    "KyronTokenExpired",
    "KyronSecurityException",
    "KyronToolWrapper",
    # Backward compatibility
    "SentinelGuard",
    "SentinelClient",
    "SentinelBlocked",
    "SentinelConnectionError",
    "SentinelTokenExpired",
    "SentinelToolWrapper",
]

__version__ = "0.1.0"
