"""
Google + GitHub OAuth router for Sentinel Layer Phase 10.

Flow:
  GET /auth/google          → redirect to Google consent page
  GET /auth/google/callback → exchange code → create/find user → issue JWT → redirect frontend
  GET /auth/github          → redirect to GitHub consent page
  GET /auth/github/callback → same flow for GitHub
  GET /auth/me              → returns current user profile (Bearer JWT)
"""
import logging
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from app.config import get_settings
from app.db.models import UserDB
from app.db.session import SessionLocal
from app.middleware.auth import get_current_user
from app.services.auth import create_access_token, resolve_permissions

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["authentication"])
settings = get_settings()

# ── Helpers ───────────────────────────────────────────────────────────────────

def _find_or_activate_user(db, email: str, name: str, avatar_url: str, provider: str, sub: str):
    """
    Find a user by email.
    - If admin: update OAuth info + activate.
    - If invited (is_active=False): activate + set OAuth info.
    - If not found: return None (not invited).
    """
    user = db.query(UserDB).filter(UserDB.email == email).first()
    if not user:
        return None

    # First login: activate the account
    if not user.is_active:
        user.is_active = True

    # Update OAuth identity fields
    user.oauth_provider = provider
    user.oauth_sub = sub
    if name and not user.name:
        user.name = name
    if avatar_url:
        user.avatar_url = avatar_url

    db.commit()
    db.refresh(user)
    return user


def _get_user_permissions(user: UserDB) -> dict[str, bool]:
    overrides = [(p.action, p.allowed) for p in user.permissions]
    return resolve_permissions(user.role, overrides)


# ── Google OAuth ──────────────────────────────────────────────────────────────

@router.get("/google")
async def google_login():
    """Redirect to Google OAuth consent page."""
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
    }
    url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    return RedirectResponse(url)


@router.get("/google/callback")
async def google_callback(code: str | None = None, error: str | None = None):
    """Exchange Google auth code for user profile, issue JWT, redirect to frontend."""
    if error or not code:
        return RedirectResponse(f"{settings.frontend_url}/login?error=oauth_denied")

    try:
        async with httpx.AsyncClient() as client:
            # Exchange code for tokens
            token_resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "redirect_uri": settings.google_redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            token_resp.raise_for_status()
            tokens = token_resp.json()

            # Fetch user profile
            profile_resp = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {tokens['access_token']}"},
            )
            profile_resp.raise_for_status()
            profile = profile_resp.json()

    except Exception as exc:
        logger.error("Google OAuth error: %s", exc)
        return RedirectResponse(f"{settings.frontend_url}/login?error=oauth_failed")

    email = profile.get("email", "")
    name = profile.get("name", email)
    avatar = profile.get("picture", "")
    sub = profile.get("sub", "")

    with SessionLocal() as db:
        user = _find_or_activate_user(db, email, name, avatar, "google", sub)
        if not user:
            logger.warning("Unrecognized Google login attempt: %s", email)
            return RedirectResponse(f"{settings.frontend_url}/login?error=not_invited")

        jwt_token = create_access_token(user.id, user.email, user.role)

    return RedirectResponse(f"{settings.frontend_url}/?token={jwt_token}")


# ── GitHub OAuth ──────────────────────────────────────────────────────────────

@router.get("/github")
async def github_login():
    """Redirect to GitHub OAuth consent page."""
    params = {
        "client_id": settings.github_client_id,
        "redirect_uri": settings.github_redirect_uri,
        "scope": "read:user user:email",
    }
    url = f"https://github.com/login/oauth/authorize?{urlencode(params)}"
    return RedirectResponse(url)


@router.get("/github/callback")
async def github_callback(code: str | None = None, error: str | None = None):
    """Exchange GitHub auth code for user profile, issue JWT, redirect to frontend."""
    if error or not code:
        return RedirectResponse(f"{settings.frontend_url}/login?error=oauth_denied")

    try:
        async with httpx.AsyncClient() as client:
            # Exchange code for access token
            token_resp = await client.post(
                "https://github.com/login/oauth/access_token",
                data={
                    "client_id": settings.github_client_id,
                    "client_secret": settings.github_client_secret,
                    "code": code,
                    "redirect_uri": settings.github_redirect_uri,
                },
                headers={"Accept": "application/json"},
            )
            token_resp.raise_for_status()
            access_token = token_resp.json().get("access_token", "")

            # Fetch user profile
            profile_resp = await client.get(
                "https://api.github.com/user",
                headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
            )
            profile_resp.raise_for_status()
            profile = profile_resp.json()

            # GitHub may not expose primary email in profile — fetch separately
            email = profile.get("email") or ""
            if not email:
                emails_resp = await client.get(
                    "https://api.github.com/user/emails",
                    headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
                )
                if emails_resp.status_code == 200:
                    emails = emails_resp.json()
                    primary = next((e["email"] for e in emails if e.get("primary") and e.get("verified")), None)
                    email = primary or (emails[0]["email"] if emails else "")

    except Exception as exc:
        logger.error("GitHub OAuth error: %s", exc)
        return RedirectResponse(f"{settings.frontend_url}/login?error=oauth_failed")

    if not email:
        return RedirectResponse(f"{settings.frontend_url}/login?error=no_email")

    name = profile.get("name") or profile.get("login", email)
    avatar = profile.get("avatar_url", "")
    sub = str(profile.get("id", ""))

    with SessionLocal() as db:
        user = _find_or_activate_user(db, email, name, avatar, "github", sub)
        if not user:
            logger.warning("Unrecognized GitHub login attempt: %s", email)
            return RedirectResponse(f"{settings.frontend_url}/login?error=not_invited")

        jwt_token = create_access_token(user.id, user.email, user.role)

    return RedirectResponse(f"{settings.frontend_url}/?token={jwt_token}")


# ── /auth/demo-login ──────────────────────────────────────────────────────────

class DemoLoginRequest(BaseModel):
    role: str = "admin"  # "admin" | "tech_lead" | "developer" | "intern"


@router.post("/demo-login")
async def demo_login(req: DemoLoginRequest = DemoLoginRequest()):
    """
    1-Click Demo Login: instantly issues a signed JWT for testing any role
    without requiring third-party OAuth configuration.
    """
    valid_roles = {"admin", "tech_lead", "developer", "intern"}
    role = req.role if req.role in valid_roles else "admin"

    demo_profiles = {
        "admin": ("saswat20061103@gmail.com", "Saswat (Admin)"),
        "tech_lead": ("lead@sentinel.io", "Tech Lead"),
        "developer": ("dev@sentinel.io", "Developer Alex"),
        "intern": ("intern@sentinel.io", "Intern Sam"),
    }

    email, name = demo_profiles.get(role, demo_profiles["admin"])

    with SessionLocal() as db:
        user = db.query(UserDB).filter(UserDB.email == email).first()
        if not user:
            import uuid
            user = UserDB(
                id=str(uuid.uuid4()),
                email=email,
                name=name,
                role=role,
                is_active=True,
                oauth_provider="demo",
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        jwt_token = create_access_token(user.id, user.email, user.role)
        permissions = _get_user_permissions(user)

        return {
            "token": jwt_token,
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "role": user.role,
                "permissions": permissions,
            },
        }


# ── /auth/me ──────────────────────────────────────────────────────────────────

@router.get("/me")
async def get_me(current_user: UserDB = Depends(get_current_user)):
    """Returns the current authenticated user's profile, role, and resolved permissions."""
    permissions = _get_user_permissions(current_user)
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "avatar_url": current_user.avatar_url,
        "role": current_user.role,
        "permissions": permissions,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
    }


# ── /auth/guest ── Public guest demo session ──────────────────────────────────

@router.post("/guest")
async def create_guest_session():
    """
    Issues a temporary 30-minute read-only guest JWT.
    Allows judges and evaluators to explore the dashboard without creating an account.
    The guest role has read-only permissions: no policy edits, no token minting.
    """
    import uuid
    guest_id = f"guest_{uuid.uuid4().hex[:8]}"

    payload = {
        "sub": guest_id,
        "email": "guest@kyron.demo",
        "name": "Guest Evaluator",
        "role": "guest",
        "is_guest": True,
        "permissions": {
            # Read-only: can view audit, stats, run simulations
            "search_web": True,
            "read_file": True,
            "write_file": False,
            "execute_code": False,
            "call_http": False,
            "send_email": False,
            "delete_file": False,
            "admin_access": False,
        },
    }

    from datetime import datetime, timezone, timedelta
    from jose import jwt as jose_jwt

    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_guest_token_expire_minutes)
    payload["exp"] = expire
    payload["iat"] = datetime.now(timezone.utc)

    token = jose_jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

    return {
        "token": token,
        "user": {
            "id": guest_id,
            "email": "guest@kyron.demo",
            "name": "Guest Evaluator",
            "role": "guest",
            "is_guest": True,
            "badge": "🎯",
            "roleTitle": "Demo Evaluator",
            "permissions": payload["permissions"],
            "expires_in_minutes": settings.jwt_guest_token_expire_minutes,
        },
        "message": f"Guest session active for {settings.jwt_guest_token_expire_minutes} minutes. Explore freely!",
    }
