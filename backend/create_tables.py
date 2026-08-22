import asyncio
from app.database import engine, Base
from app import models  # noqa: F401 — ensures models are registered

async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Tables created.")

asyncio.run(main())