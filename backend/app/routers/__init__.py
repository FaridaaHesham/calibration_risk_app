"""
backend/app/routers/__init__.py
Registers all routers so they can be imported in main.py.
"""
from app.routers import auth, devices, calibrations, risk, tolerances, users

__all__ = ["auth", "devices", "calibrations", "risk", "tolerances", "users"]
