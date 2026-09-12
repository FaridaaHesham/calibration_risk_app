"""
routers/users.py — User management & Audit logging endpoints.

All endpoints here require an authenticated ADMIN (see app.routers.auth).
User management and audit-log visibility are the most sensitive parts of
this API, so they get the strictest gate: `require_admin` both rejects
unauthenticated callers AND rejects authenticated-but-non-admin callers.

Every mutating endpoint also uses the *actual* logged-in admin's identity
for the audit trail, instead of a hardcoded "admin" string — previously
every log entry said the action was performed by "admin" no matter who was
really logged in, which made the audit trail useless for accountability.
"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from passlib.context import CryptContext

from app.database import get_db
from app.models import User, AuditLog
from app.schemas import (
    UserSchema, UserCreateRequest, UserUpdateRequest,
    UserPasswordResetRequest, AuditLogSchema
)
from app.routers.auth import require_admin

router = APIRouter(prefix="/api/users", tags=["users"])
_log = logging.getLogger(__name__)
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def log_action(db: AsyncSession, user_name: str, action: str, entity_type: str = None, details: str = None):
    """Helper to record an activity in the audit trail."""
    try:
        entry = AuditLog(
            user_name=user_name,
            action=action,
            entity_type=entity_type,
            details=details,
        )
        db.add(entry)
        await db.commit()
    except Exception as exc:
        _log.warning("Failed to record audit log: %s", exc)


def _actor_name(user: User) -> str:
    """Best-effort human-readable name for the audit trail."""
    return user.full_name or user.username


@router.get("", response_model=list[UserSchema])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Return list of all registered staff accounts. Admins only."""
    result = await db.execute(select(User).order_by(User.id))
    users = result.scalars().all()
    return [
        UserSchema(
            id=u.id,
            username=u.username,
            full_name=u.full_name,
            role=u.role,
            is_active=u.is_active,
            created_at=u.created_at.isoformat() if u.created_at else None,
        )
        for u in users
    ]


@router.post("", response_model=UserSchema, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreateRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Register a new user (Biomedical Engineer, Admin, Technician). Admins only."""
    existing = await db.execute(select(User).where(User.username == payload.username.strip()))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username '{payload.username}' already exists.",
        )

    hashed = pwd_ctx.hash(payload.password)
    user = User(
        username=payload.username.strip(),
        password_hash=hashed,
        full_name=payload.full_name.strip() if payload.full_name else None,
        role=payload.role.strip() if payload.role else "Biomedical Engineer",
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    await log_action(db, _actor_name(admin), "CREATE_USER", "User", f"Created user '{user.username}' with role '{user.role}'")

    return UserSchema(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at.isoformat() if user.created_at else None,
    )


@router.put("/{user_id}", response_model=UserSchema)
async def update_user(
    user_id: int,
    payload: UserUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Update user role, full name, or active status. Admins only."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
    if payload.role is not None:
        user.role = payload.role.strip()
    if payload.is_active is not None:
        user.is_active = payload.is_active

    await db.commit()
    await db.refresh(user)

    await log_action(db, _actor_name(admin), "UPDATE_USER", "User", f"Updated user '{user.username}'")

    return UserSchema(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at.isoformat() if user.created_at else None,
    )


@router.put("/{user_id}/password")
async def reset_password(
    user_id: int,
    payload: UserPasswordResetRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin reset password for a staff member. Admins only."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if not payload.new_password or len(payload.new_password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 6 characters.")

    user.password_hash = pwd_ctx.hash(payload.new_password)
    await db.commit()

    await log_action(db, _actor_name(admin), "RESET_PASSWORD", "User", f"Reset password for user '{user.username}'")
    return {"success": True, "message": f"Password for '{user.username}' has been successfully updated."}


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Delete a staff user account. Admins only."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account while logged in as it.",
        )

    await db.delete(user)
    await db.commit()
    await log_action(db, _actor_name(admin), "DELETE_USER", "User", f"Deleted user '{user.username}'")
    return None


# ---------------------------------------------------------------------------
# Audit Logs Endpoints
# ---------------------------------------------------------------------------

@router.get("/audit-logs", response_model=list[AuditLogSchema])
async def list_audit_logs(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Return the recent activity audit trail. Admins only."""
    result = await db.execute(
        select(AuditLog).order_by(desc(AuditLog.id)).limit(limit)
    )
    logs = result.scalars().all()
    return [
        AuditLogSchema(
            id=log.id,
            user_name=log.user_name,
            action=log.action,
            entity_type=log.entity_type,
            details=log.details,
            created_at=log.created_at.strftime("%Y-%m-%d %H:%M:%S") if log.created_at else None,
        )
        for log in logs
    ]