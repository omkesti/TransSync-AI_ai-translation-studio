"""
auth.py
───────
Routes:
    POST /api/auth/invite        — owner/admin sends invite email
    GET  /api/auth/accept-invite — validate invite token, return org info
    POST /api/auth/accept-invite — activate membership (called after user signs up)

Manages the invitation-only onboarding flow.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone

from backend.auth.jwt_bearer import CurrentUser, get_current_user, require_role
from backend.services.supabase_client import get_client

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class InviteRequest(BaseModel):
    email: str = Field(..., description="Email to invite.")
    role:  str = Field(default="translator", description="Role to assign: translator, reviewer, viewer, admin.")


class InviteResponse(BaseModel):
    message: str
    token:   str
    email:   str
    role:    str


class AcceptInviteRequest(BaseModel):
    token:   str = Field(..., description="Invite token from the URL.")
    user_id: str = Field(..., description="Supabase Auth user_id after sign-up.")


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/auth/invite", response_model=InviteResponse)
async def send_invite(body: InviteRequest, current_user: CurrentUser = Depends(get_current_user)):
    """
    POST /api/auth/invite

    Only owner/admin can invite new users to their organization.
    Creates a row in the `invitations` table with a unique token.
    """
    require_role(current_user, "owner", "admin")

    # Validate role
    valid_roles = {"translator", "reviewer", "viewer", "admin"}
    if body.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role '{body.role}'. Must be one of: {', '.join(valid_roles)}")

    client = get_client()

    # Check if user is already a member
    existing = (
        client.table("memberships")
        .select("id")
        .eq("org_id", current_user.org_id)
        .execute()
    )
    # Check by joining with auth.users isn't easy via client, so we just check invitations
    existing_invite = (
        client.table("invitations")
        .select("id, accepted_at")
        .eq("org_id", current_user.org_id)
        .eq("email", body.email)
        .is_("accepted_at", "null")
        .execute()
    )

    if existing_invite.data:
        raise HTTPException(
            status_code=409,
            detail=f"An active invitation for '{body.email}' already exists.",
        )

    # Create invitation
    try:
        response = (
            client.table("invitations")
            .insert({
                "org_id":     current_user.org_id,
                "email":      body.email,
                "role":       body.role,
                "invited_by": current_user.user_id,
            })
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create invitation: {str(e)}")

    invite = response.data[0]

    return InviteResponse(
        message=f"Invitation sent to {body.email}",
        token=invite["token"],
        email=body.email,
        role=body.role,
    )


@router.get("/auth/accept-invite")
async def validate_invite(token: str = Query(..., description="Invite token from the URL.")):
    """
    GET /api/auth/accept-invite?token=<uuid>

    Public endpoint (no auth required). Validates the token and returns
    the org name + role so the invite page can display them.
    """
    client = get_client()

    try:
        response = (
            client.table("invitations")
            .select("*, organizations(name, slug)")
            .eq("token", token)
            .is_("accepted_at", "null")
            .limit(1)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to validate invitation: {str(e)}")

    if not response.data:
        raise HTTPException(status_code=404, detail="Invitation not found or already accepted.")

    invite = response.data[0]

    # Check expiry
    expires_at = invite.get("expires_at")
    if expires_at:
        from dateutil.parser import parse as parse_dt
        exp = parse_dt(expires_at)
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > exp:
            raise HTTPException(status_code=410, detail="This invitation has expired. Contact your admin for a new one.")

    org = invite.get("organizations", {})

    return {
        "email":    invite["email"],
        "role":     invite["role"],
        "org_name": org.get("name", "Unknown Organization"),
        "org_slug": org.get("slug", ""),
    }


@router.post("/auth/accept-invite")
async def accept_invite(body: AcceptInviteRequest):
    """
    POST /api/auth/accept-invite

    Called after the invited user completes sign-up via Supabase Auth.
    Marks the invitation as accepted and creates the membership.
    """
    client = get_client()

    # Fetch the invitation
    try:
        response = (
            client.table("invitations")
            .select("*")
            .eq("token", body.token)
            .is_("accepted_at", "null")
            .limit(1)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch invitation: {str(e)}")

    if not response.data:
        raise HTTPException(status_code=404, detail="Invitation not found or already accepted.")

    invite = response.data[0]

    # Check expiry
    expires_at = invite.get("expires_at")
    if expires_at:
        from dateutil.parser import parse as parse_dt
        exp = parse_dt(expires_at)
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > exp:
            raise HTTPException(status_code=410, detail="This invitation has expired.")

    # Create membership
    try:
        client.table("memberships").insert({
            "org_id":  invite["org_id"],
            "user_id": body.user_id,
            "role":    invite["role"],
        }).execute()
    except Exception as e:
        # Could be duplicate — user already accepted
        raise HTTPException(status_code=409, detail=f"Failed to create membership (may already exist): {str(e)}")

    # Mark invitation as accepted
    try:
        client.table("invitations").update({
            "accepted_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", invite["id"]).execute()
    except Exception:
        pass  # Non-critical — membership is already created

    return {"message": "Invitation accepted. You are now a member of the organization."}
