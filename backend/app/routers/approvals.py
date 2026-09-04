"""
Approval Queue router — Human-in-the-Loop REQUIRE_APPROVAL workflow.
"""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.db.models import ScreenEventDB
from app.db.session import SessionLocal
from app.middleware.auth import get_current_user
from app.db.models import UserDB

router = APIRouter(tags=["approvals"])

class ApprovalDecision(BaseModel):
    approved: bool
    reason: str = ""

@router.get("/approvals/pending")
async def get_pending_approvals(
    current_user: Optional[UserDB] = Depends(get_current_user),
) -> dict:
    """Returns all events with verdict=require_approval that haven't been actioned."""
    with SessionLocal() as db:
        query = db.query(ScreenEventDB).filter(
            ScreenEventDB.verdict == "require_approval"
        ).order_by(ScreenEventDB.id.desc()).limit(100)
        rows = query.all()
        events = []
        for r in rows:
            import json
            signals = []
            try:
                signals = json.loads(r.matched_signals_json) if r.matched_signals_json else []
            except Exception:
                signals = []
            events.append({
                "id": r.id,
                "timestamp": r.timestamp.isoformat() if r.timestamp else None,
                "agent_id": r.agent_id,
                "tool_name": r.tool_name,
                "risk_score": r.risk_score,
                "explanation": r.explanation,
                "matched_signals": signals,
                "llm_reasoning": getattr(r, 'llm_reasoning', None),
                "attack_category": getattr(r, 'attack_category', None),
                "user_email": r.user_email,
                "user_role": r.user_role,
            })
        return {"pending": events, "count": len(events)}


@router.post("/approvals/{event_id}/decide")
async def decide_approval(
    event_id: int,
    decision: ApprovalDecision,
    current_user: Optional[UserDB] = Depends(get_current_user),
) -> dict:
    """Approve or deny a pending REQUIRE_APPROVAL event. Records the human decision."""
    with SessionLocal() as db:
        event = db.query(ScreenEventDB).filter(ScreenEventDB.id == event_id).first()
        if not event:
            raise HTTPException(status_code=404, detail=f"Event {event_id} not found")
        
        # Record the human decision by updating the verdict
        new_verdict = "allow" if decision.approved else "block"
        event.verdict = f"human_{'approved' if decision.approved else 'denied'}"
        event.explanation = event.explanation + f" | Human decision: {'APPROVED' if decision.approved else 'DENIED'} by {current_user.email if current_user else 'operator'}. Reason: {decision.reason or 'No reason given.'}"
        db.commit()
        
        return {
            "event_id": event_id,
            "decision": "approved" if decision.approved else "denied",
            "decided_by": current_user.email if current_user else "operator",
            "new_verdict": event.verdict,
        }
