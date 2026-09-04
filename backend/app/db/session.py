"""
Dual Hot-Cold Storage Database Engine for Sentinel Layer.

- Hot Storage (SQLite / In-Memory): Delivers sub-millisecond (<1ms) latency for all
  real-time screening, token checks, policy evaluations, and dashboard telemetry.
- Cold Storage (Neon / PostgreSQL): Cloud analytics, disaster recovery, and long-term
  audit persistence, synchronized asynchronously in the background.
"""
import logging
from pathlib import Path
from typing import Generator, Optional
from sqlalchemy import create_engine, text, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

Base = declarative_base()

# ── Hot Storage Engine (Local Fast SQLite) ────────────────────────────────────
hot_url = settings.hot_database_url or "sqlite:///./sentinel.db"

# Ensure hot DB directory exists
if hot_url.startswith("sqlite:///"):
    sqlite_file = hot_url.replace("sqlite:///", "")
    if sqlite_file != ":memory:" and not sqlite_file.startswith("./"):
        Path(sqlite_file).parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    hot_url,
    connect_args={"check_same_thread": False} if hot_url.startswith("sqlite") else {},
    echo=False,
)

# Enable WAL (Write-Ahead Logging) and normal sync for ultra-fast SQLite concurrency
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if hot_url.startswith("sqlite"):
        try:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL;")
            cursor.execute("PRAGMA synchronous=NORMAL;")
            cursor.execute("PRAGMA cache_size=-64000;")  # 64MB cache in RAM
            cursor.close()
        except Exception:
            pass

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ── Cold Storage Engine (Neon PostgreSQL Cloud) ───────────────────────────────
cold_url = settings.cold_database_url
cold_engine: Optional[Engine] = None
ColdSessionLocal: Optional[sessionmaker] = None

if cold_url and ("postgresql://" in cold_url or "postgres://" in cold_url):
    if cold_url.startswith("postgres://"):
        cold_url = cold_url.replace("postgres://", "postgresql://", 1)
    try:
        cold_engine = create_engine(
            cold_url,
            pool_pre_ping=True,
            pool_recycle=300,
            echo=False,
        )
        ColdSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=cold_engine)
        logger.info("Cold Storage (Neon PostgreSQL) configured.")
    except Exception as e:
        logger.warning("Could not initialize Cold Storage engine: %s", e)


def init_db() -> None:
    """Initializes schema on Hot Storage and Cold Storage (if enabled)."""
    # 1. Initialize Hot Storage
    Base.metadata.create_all(bind=engine)
    logger.info("Hot Storage (SQLite WAL) initialized.")

    # 2. Schema check / migration for SQLite
    if hot_url.startswith("sqlite"):
        with engine.connect() as conn:
            try:
                result = conn.execute(text("PRAGMA table_info(screen_events);")).fetchall()
                existing_cols = {row[1] for row in result}
                if existing_cols:
                    if "user_id" not in existing_cols:
                        conn.execute(text("ALTER TABLE screen_events ADD COLUMN user_id VARCHAR(128);"))
                    if "user_email" not in existing_cols:
                        conn.execute(text("ALTER TABLE screen_events ADD COLUMN user_email VARCHAR(256);"))
                    if "user_role" not in existing_cols:
                        conn.execute(text("ALTER TABLE screen_events ADD COLUMN user_role VARCHAR(32);"))
                    if "llm_reasoning" not in existing_cols:
                        conn.execute(text("ALTER TABLE screen_events ADD COLUMN llm_reasoning TEXT;"))
                    if "attack_category" not in existing_cols:
                        conn.execute(text("ALTER TABLE screen_events ADD COLUMN attack_category VARCHAR(64);"))
                    conn.commit()
            except Exception as e:
                logger.debug("SQLite schema check: %s", e)

    # 3. Initialize Cold Storage schema if connected
    if cold_engine:
        try:
            Base.metadata.create_all(bind=cold_engine)
            logger.info("Cold Storage (Neon DB) tables verified.")
        except Exception as err:
            logger.warning("Cold storage schema init deferred: %s", err)


def get_db() -> Generator[Session, None, None]:
    """Yields a Hot Storage database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def sync_hot_to_cold() -> dict:
    """
    Background worker utility to copy un-synced events from Hot Storage (SQLite)
    to Cold Storage (Neon PostgreSQL) without blocking user/agent requests.
    """
    if not ColdSessionLocal:
        return {"synced": 0, "message": "Cold storage not configured"}

    from app.db.models import ScreenEventDB, UserDB

    synced_count = 0
    with SessionLocal() as hot_db, ColdSessionLocal() as cold_db:
        # Get latest event ID in cold storage
        max_cold_id = cold_db.query(ScreenEventDB.id).order_by(ScreenEventDB.id.desc()).first()
        last_id = max_cold_id[0] if max_cold_id else 0

        # Fetch new events from hot storage
        new_events = hot_db.query(ScreenEventDB).filter(ScreenEventDB.id > last_id).order_by(ScreenEventDB.id.asc()).limit(200).all()

        for ev in new_events:
            cold_ev = ScreenEventDB(
                id=ev.id,
                timestamp=ev.timestamp,
                agent_id=ev.agent_id,
                session_id=ev.session_id,
                tool_name=ev.tool_name,
                incoming_source=ev.incoming_source,
                risk_score=ev.risk_score,
                verdict=ev.verdict,
                explanation=ev.explanation,
                matched_signals_json=ev.matched_signals_json,
                policy_allowed=ev.policy_allowed,
                policy_reason=ev.policy_reason,
                user_id=ev.user_id,
                user_email=ev.user_email,
                user_role=ev.user_role,
            )
            cold_db.merge(cold_ev)
            synced_count += 1

        if synced_count > 0:
            cold_db.commit()
            logger.info("Synced %d events from Hot to Cold Storage (Neon DB).", synced_count)

    return {"synced": synced_count, "message": f"Successfully synced {synced_count} events to Neon PostgreSQL"}
