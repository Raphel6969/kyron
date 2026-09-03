"""
Settings/config loading for Kyron Layer.

Phases 0–10: env-driven config loaded via python-dotenv.
Hot Storage: Local SQLite for sub-millisecond screening & dashboard operations.
Cold Storage: Neon / PostgreSQL for cloud analytics & long-term persistence.
"""
import os
from functools import lru_cache
from dotenv import load_dotenv

load_dotenv()  # loads .env from project root at import time


class Settings:
    app_name: str = "Kyron — Agent Runtime Security Gateway"
    version: str = "1.0.0"
    environment: str = os.getenv("ENVIRONMENT", "development")

    # Demo / deployment mode
    demo_mode: bool = os.getenv("DEMO_MODE", "false").lower() == "true"

    # CORS — comma-separated list, or "*" for open demo
    allowed_origins_raw: str = os.getenv("ALLOWED_ORIGINS", "*")

    @property
    def allowed_origins(self) -> list[str]:
        raw = self.allowed_origins_raw.strip()
        if raw == "*":
            return ["*"]
        return [o.strip() for o in raw.split(",") if o.strip()]

    # Phase 4 — Groq LLM-Judge settings
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    groq_model: str = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
    groq_timeout_seconds: float = float(os.getenv("GROQ_TIMEOUT_SECONDS", "3.0"))

    # Phase 5 — Policy Engine
    policy_file_path: str = os.getenv("POLICY_FILE_PATH", "policy/policy.example.yaml")

    # Hot/Cold Database Architecture
    # Hot Storage: Fast local SQLite for sub-millisecond runtime ops & UI polling
    hot_database_url: str = os.getenv("HOT_DATABASE_URL", "sqlite:///./sentinel.db")
    database_url: str = os.getenv("HOT_DATABASE_URL", "sqlite:///./sentinel.db")

    # Cold Storage: Neon / PostgreSQL for cloud persistence & async sync
    cold_database_url: str = os.getenv(
        "COLD_DATABASE_URL",
        os.getenv("NEON_DATABASE_URL", os.getenv("DATABASE_URL", ""))
    )

    # Phase 10 — JWT Auth
    jwt_secret: str = os.getenv("JWT_SECRET", "change-me-in-production")
    jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    jwt_access_token_expire_minutes: int = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
    jwt_agent_token_expire_hours: int = int(os.getenv("JWT_AGENT_TOKEN_EXPIRE_HOURS", "8"))
    jwt_guest_token_expire_minutes: int = int(os.getenv("JWT_GUEST_TOKEN_EXPIRE_MINUTES", "30"))

    # Phase 10 — Google OAuth
    google_client_id: str = os.getenv("GOOGLE_CLIENT_ID", "")
    google_client_secret: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    google_redirect_uri: str = os.getenv("OAUTH_CALLBACK_URL", "http://localhost:8000/auth/google/callback")

    # Phase 10 — GitHub OAuth
    github_client_id: str = os.getenv("GITHUB_CLIENT_ID", "")
    github_client_secret: str = os.getenv("GITHUB_CLIENT_SECRET", "")
    github_redirect_uri: str = os.getenv("GITHUB_REDIRECT_URI", "http://localhost:8000/auth/github/callback")

    # Phase 10 — Frontend URL (OAuth post-login redirect)
    frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:5173")


@lru_cache
def get_settings() -> Settings:
    return Settings()
