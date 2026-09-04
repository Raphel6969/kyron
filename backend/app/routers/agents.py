"""
Agent Registry router — per-agent analytics and leaderboard.
"""
import json
from collections import defaultdict
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy import func
from app.db.models import ScreenEventDB
from app.db.session import SessionLocal
from app.middleware.auth import get_optional_current_user
from app.db.models import UserDB

router = APIRouter(tags=["agents"])

@router.get("/agents/registry")
async def get_agent_registry(
    current_user: Optional[UserDB] = Depends(get_optional_current_user),
) -> dict:
    """Returns all unique agent IDs with analytics."""
    with SessionLocal() as db:
        rows = db.query(
            ScreenEventDB.agent_id,
            func.count(ScreenEventDB.id).label("total"),
            func.max(ScreenEventDB.timestamp).label("last_seen"),
            func.avg(ScreenEventDB.risk_score).label("avg_risk"),
        ).group_by(ScreenEventDB.agent_id).all()
        
        agents = []
        for r in rows:
            # Get block count separately
            block_count = db.query(func.count(ScreenEventDB.id)).filter(
                ScreenEventDB.agent_id == r.agent_id,
                ScreenEventDB.verdict == "block"
            ).scalar() or 0
            
            agents.append({
                "agent_id": r.agent_id,
                "total_calls": r.total,
                "blocked_calls": block_count,
                "block_rate": round(block_count / r.total * 100, 1) if r.total > 0 else 0.0,
                "avg_risk_score": round(float(r.avg_risk or 0), 3),
                "last_seen": r.last_seen.isoformat() if r.last_seen else None,
            })
        
        return {"agents": agents, "total": len(agents)}


@router.get("/agents/leaderboard")
async def get_agent_leaderboard(
    current_user: Optional[UserDB] = Depends(get_optional_current_user),
) -> dict:
    """Returns agents ranked by block_rate descending (most dangerous first)."""
    result = await get_agent_registry(current_user)
    leaderboard = sorted(result["agents"], key=lambda x: x["block_rate"], reverse=True)
    return {"leaderboard": leaderboard[:20], "total": len(leaderboard)}
