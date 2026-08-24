import asyncio
import traceback
from sqlalchemy import select
from app.database import get_db, engine
from app.models import Device
from app.routers.devices import _build_prediction_for_device

async def test_all():
    async with engine.begin() as conn:
        pass # just to init

    # Create a session manually
    from sqlalchemy.ext.asyncio import async_sessionmaker
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    
    async with SessionLocal() as db:
        res = await db.execute(select(Device))
        devices = res.scalars().all()
        print(f"Total devices: {len(devices)}")
        for dev in devices:
            try:
                scores, pred = await _build_prediction_for_device(dev, db)
                print(f"OK: {dev.serial_number}")
            except Exception as e:
                print(f"ERROR on {dev.serial_number}: {e}")
                traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_all())
