"""
backfill_calibration_results.py — One-time fix for calibration records whose
stored `result` column has drifted from what the tests actually show.

Run once after deploying the calibrations.py fix, to correct any records
that were created via bulk-upload (or manual override) before the fix,
where `result` doesn't match `all(min <= actual <= max for each test)`.

Usage:
    python backfill_calibration_results.py            # dry run, prints diffs
    python backfill_calibration_results.py --apply     # actually writes changes
"""
import asyncio
import sys

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import AsyncSessionLocal
from app.models import CalibrationRecord
from app.routers.calibrations import _compute_overall_result


async def main(apply: bool):
    changed = 0
    checked = 0

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(CalibrationRecord).options(selectinload(CalibrationRecord.tests))
        )
        records = result.scalars().all()

        for rec in records:
            checked += 1
            correct = _compute_overall_result(rec.tests)
            stored = rec.result or ""

            if stored.strip().lower() != correct.strip().lower():
                changed += 1
                print(
                    f"MISMATCH  device_id={rec.device_id}  year={rec.calibration_year}  "
                    f"cert={rec.certificate_num or '-'}  stored={stored!r} -> correct={correct!r}"
                )
                if apply:
                    rec.result = correct

        if apply and changed:
            await db.commit()

    print(f"\nChecked {checked} records, {changed} needed correction.")
    if changed and not apply:
        print("Dry run only — rerun with --apply to write these changes.")
    elif changed and apply:
        print("Applied and committed.")
    else:
        print("Nothing to fix.")


if __name__ == "__main__":
    asyncio.run(main(apply="--apply" in sys.argv))