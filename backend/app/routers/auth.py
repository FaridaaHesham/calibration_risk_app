"""
routers/auth.py — Real JWT authentication against the users table.

This module now does two jobs:
  1. Issue a JWT on successful login (unchanged behaviour).
  2. Provide `get_current_user` / `require_admin` FastAPI dependencies that
     every OTHER router imports and attaches to its routes. Previously the
     token was issued but never verified anywhere, so every endpoint in the
     API (device data, calibration records, risk configs, user management)
     was reachable by anyone with no token at all. These dependencies are
     what actually enforce the login.
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import User
from app.schemas import LoginRequest, LoginResponse

from passlib.context import CryptContext
from jose import jwt, JWTError

router = APIRouter(prefix="/api/auth", tags=["auth"])

# ── Password hashing ──────────────────────────────────────────────────────
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)


def hash_password(plain: str) -> str:
    return pwd_ctx.hash(plain)


# ── JWT helpers ───────────────────────────────────────────────────────────

def create_access_token(data: dict) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expire_hours)
    payload["exp"] = expire
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


# ── Login endpoint ────────────────────────────────────────────────────────

@router.post("/login", response_model=LoginResponse)
async def login(credentials: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Authenticate a user against the `users` table.
    Returns a signed JWT on success.
    """
    result = await db.execute(
        select(User).where(User.username == credentials.username)
    )
    user: User | None = result.scalar_one_or_none()

    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been disabled.",
        )

    token = create_access_token({"sub": user.username, "role": user.role})
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user_name=user.full_name or user.username,
        role=user.role or "",
    )


# ── Route-protection dependencies ────────────────────────────────────────
# Every other router (devices, calibrations, risk, tolerances, users,
# settings) depends on one of these two functions so that a request without
# a valid token is rejected with 401 before any handler code runs.

_bearer_scheme = HTTPBearer(auto_error=False)


def _is_admin_role(role: str | None) -> bool:
    """
    Single source of truth for "is this role an admin role".
    Matches by substring, case-insensitively, so it works whether a user's
    role is stored as "Admin", "ADMIN", or "Administrator" — the same
    convention the Users page in the frontend already uses to badge admins.
    """
    return bool(role) and "admin" in role.strip().lower()


async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Decode and verify the bearer token, then load the corresponding user
    from the database. Raises 401 if the token is missing, malformed,
    expired, or refers to a user that no longer exists or is disabled.
    """
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if creds is None or not creds.credentials:
        raise unauthorized

    try:
        payload = jwt.decode(
            creds.credentials,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError:
        raise unauthorized

    username = payload.get("sub")
    if not username:
        raise unauthorized

    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()

    if user is None:
        raise unauthorized

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been disabled.",
        )

    return user


async def require_admin(user: User = Depends(get_current_user)) -> User:
    """Like get_current_user, but also requires an admin role."""
    if not _is_admin_role(user.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required for this action.",
        )
    return user