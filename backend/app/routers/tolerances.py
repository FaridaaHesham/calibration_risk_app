"""
routers/tolerances.py - CRUD endpoints for per-test-label tolerance rules.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import ToleranceRule
from app.schemas import ToleranceRuleSchema, ToleranceRuleCreate

router = APIRouter(prefix="/api/tolerances", tags=["tolerances"])


@router.get("", response_model=list[ToleranceRuleSchema])
async def list_tolerance_rules(db: AsyncSession = Depends(get_db)):
    """Return all tolerance rules ordered by test label."""
    result = await db.execute(select(ToleranceRule).order_by(ToleranceRule.test_label))
    return result.scalars().all()


@router.get("/{test_label:path}", response_model=ToleranceRuleSchema)
async def get_tolerance_rule(test_label: str, db: AsyncSession = Depends(get_db)):
    """Return the tolerance rule for a specific test label."""
    result = await db.execute(
        select(ToleranceRule).where(ToleranceRule.test_label == test_label)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"No tolerance rule found for label: {test_label!r}")
    return rule


@router.post("", response_model=ToleranceRuleSchema, status_code=status.HTTP_201_CREATED)
async def create_tolerance_rule(payload: ToleranceRuleCreate, db: AsyncSession = Depends(get_db)):
    """Create a new tolerance rule."""
    existing = await db.execute(
        select(ToleranceRule).where(ToleranceRule.test_label == payload.test_label)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail=f"Tolerance rule for {payload.test_label!r} already exists.")
    rule = ToleranceRule(**payload.model_dump())
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.put("/{test_label:path}", response_model=ToleranceRuleSchema)
async def update_tolerance_rule(
    test_label: str,
    payload: ToleranceRuleCreate,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing tolerance rule."""
    result = await db.execute(
        select(ToleranceRule).where(ToleranceRule.test_label == test_label)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"No tolerance rule found for label: {test_label!r}")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.delete("/{test_label:path}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tolerance_rule(test_label: str, db: AsyncSession = Depends(get_db)):
    """Delete a tolerance rule."""
    result = await db.execute(
        select(ToleranceRule).where(ToleranceRule.test_label == test_label)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"No tolerance rule found for label: {test_label!r}")
    await db.delete(rule)
    await db.commit()
