"""
seed_users.py — One-time script to create the users table and seed the initial admin account.

Run from the backend/ directory with the venv activated:
    python seed_users.py

The script is idempotent: running it twice will not create duplicate users.
"""
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from passlib.context import CryptContext

# ── Config (reads from .env automatically) ────────────────────────────────
from app.config import settings

# ── Password hasher ───────────────────────────────────────────────────────
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── Initial admin account ─────────────────────────────────────────────────
ADMIN_USERNAME  = "adam_admin"
ADMIN_PASSWORD  = "@9112345691@"
ADMIN_FULL_NAME = "Adam International Hospital Admin"
ADMIN_ROLE      = "Biomedical Engineer"


CREATE_USERS_TABLE = """
CREATE TABLE IF NOT EXISTS users (
    id           SERIAL PRIMARY KEY,
    username     VARCHAR UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name    VARCHAR,
    role         VARCHAR,
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMPTZ DEFAULT now()
);
"""


async def seed():
    engine = create_async_engine(settings.database_url, echo=False)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.execute(text(CREATE_USERS_TABLE))
        print("[OK] users table ready")

    async with SessionLocal() as session:
        # Check if admin already exists
        result = await session.execute(
            text("SELECT id FROM users WHERE username = :u"),
            {"u": ADMIN_USERNAME},
        )
        existing = result.scalar_one_or_none()
        if existing:
            print(f"[OK] User '{ADMIN_USERNAME}' already exists -- no changes made.")
        else:
            hashed = pwd_ctx.hash(ADMIN_PASSWORD)
            await session.execute(
                text(
                    "INSERT INTO users (username, password_hash, full_name, role) "
                    "VALUES (:u, :h, :fn, :r)"
                ),
                {
                    "u":  ADMIN_USERNAME,
                    "h":  hashed,
                    "fn": ADMIN_FULL_NAME,
                    "r":  ADMIN_ROLE,
                },
            )
            await session.commit()
            print(f"[OK] Admin user '{ADMIN_USERNAME}' created successfully.")

    await engine.dispose()
    print("\nDone. You can now log in with:")
    print(f"  Username : {ADMIN_USERNAME}")
    print(f"  Password : {ADMIN_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(seed())
