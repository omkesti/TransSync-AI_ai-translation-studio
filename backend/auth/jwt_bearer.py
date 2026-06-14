"""
jwt_bearer.py
─────────────
FastAPI dependency that authenticates every request using the Supabase JWT.

Flow:
    1. Extract Bearer token from the Authorization header.
    2. Fetch Supabase JWKS (cached in memory) and verify the JWT signature (ES256 / P-256).
    3. Extract user_id (= "sub" claim) and email from the JWT payload.
    4. Query the memberships table with the service-role client to resolve
       org_id + role for the user.
    5. Return a CurrentUser dataclass that route handlers can depend on.

This approach makes the `memberships` table the single source of truth:
role changes take effect immediately — no token refresh needed.
"""

import os
import jwt
import httpx
from typing import Optional
from pydantic import BaseModel
from fastapi import Header, HTTPException

from backend.services.supabase_client import get_client

# ── Config ────────────────────────────────────────────────────────────────────

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"

# ── Simple module-level JWKS cache (avoids lru_cache + HTTPException issues) ──

_jwks_cache: Optional[dict] = None


def _fetch_jwks() -> dict:
    """Fetch the JSON Web Key Set from Supabase, caching in module memory."""
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache
    try:
        resp = httpx.get(JWKS_URL, timeout=10)
        resp.raise_for_status()
        _jwks_cache = resp.json()
        return _jwks_cache
    except Exception as e:
        print(f"[auth] Failed to fetch JWKS from {JWKS_URL}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Authentication service unavailable (JWKS fetch failed).",
        )


def _get_signing_key(token: str):
    """Extract the correct public key from the JWKS based on the token's kid header."""
    try:
        unverified_header = jwt.get_unverified_header(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Malformed JWT token.")

    kid = unverified_header.get("kid")
    if not kid:
        raise HTTPException(status_code=401, detail="JWT missing 'kid' header.")

    jwks_data = _fetch_jwks()
    for key_data in jwks_data.get("keys", []):
        if key_data.get("kid") == kid:
            return jwt.algorithms.ECAlgorithm.from_jwk(key_data)

    # kid not found — JWKS might have rotated; clear cache and retry once
    global _jwks_cache
    _jwks_cache = None
    jwks_data = _fetch_jwks()
    for key_data in jwks_data.get("keys", []):
        if key_data.get("kid") == kid:
            return jwt.algorithms.ECAlgorithm.from_jwk(key_data)

    raise HTTPException(status_code=401, detail="JWT signing key not found in JWKS.")


# ── CurrentUser model ─────────────────────────────────────────────────────────

class CurrentUser(BaseModel):
    user_id: str
    org_id:  str
    role:    str
    email:   str


# ── Role helpers ──────────────────────────────────────────────────────────────

def require_role(user: CurrentUser, *allowed_roles: str):
    """Raise 403 if the user's role is not in the allowed list."""
    if user.role not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail=f"Role '{user.role}' is not authorized to perform this action.",
        )


# ── FastAPI Dependency ────────────────────────────────────────────────────────

async def get_current_user(
    authorization: Optional[str] = Header(default=None),
) -> CurrentUser:
    """
    FastAPI dependency: inject into any route as:
        current_user: CurrentUser = Depends(get_current_user)

    Verifies the Supabase JWT, resolves org_id + role from memberships table.
    """
    # ── 1. Extract Bearer token ───────────────────────────────────────────────
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid Authorization header. Expected 'Bearer <token>'.",
        )

    token = authorization[7:]  # strip "Bearer "

    # ── 2. Verify JWT with JWKS public key ────────────────────────────────────
    try:
        public_key = _get_signing_key(token)
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["ES256"],
            audience="authenticated",
            leeway=60,  # tolerate up to 60s clock skew between Supabase and local
            options={"verify_exp": True},
        )
    except HTTPException:
        raise  # re-raise our own 401/500 errors
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="JWT has expired. Please sign in again.")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid JWT: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"JWT verification failed: {str(e)}")


    # ── 3. Extract user_id and email ──────────────────────────────────────────
    user_id = payload.get("sub")
    email = payload.get("email", "")

    if not user_id:
        raise HTTPException(status_code=401, detail="JWT missing 'sub' claim.")

    # ── 4. Resolve org_id + role from memberships table ───────────────────────
    #    Uses the service-role client which bypasses RLS.
    try:
        client = get_client()
        response = (
            client.table("memberships")
            .select("org_id, role")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to resolve user membership: {str(e)}",
        )

    if not response.data:
        raise HTTPException(
            status_code=403,
            detail="User is not a member of any organization. Contact your admin for an invitation.",
        )

    membership = response.data[0]
    org_id = str(membership["org_id"])
    role = membership["role"]

    return CurrentUser(
        user_id=user_id,
        org_id=org_id,
        role=role,
        email=email,
    )
