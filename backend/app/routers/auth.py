"""
routers/auth.py — Authentication endpoints.

TODO: Replace mock validation with real JWT token generation and a database
      user lookup (e.g., SELECT * FROM users WHERE username = :username).
      Consider using python-jose for JWT and passlib for password hashing.
"""
from fastapi import APIRouter, HTTPException, status
from app.schemas import LoginRequest, LoginResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])

# ---------------------------------------------------------------------------
# TODO: Replace this hardcoded user dictionary with a real database query.
#       Add password hashing (bcrypt via passlib) before production use.
# ---------------------------------------------------------------------------
MOCK_USERS = {
    "admin": {
        "password": "admin123",   # plaintext — NEVER do this in production
        "name": "Dr. Admin User",
        "role": "Biomedical Engineer",
    },
    "technician": {
        "password": "tech123",
        "name": "Lab Technician",
        "role": "Calibration Technician",
    },
}


@router.post("/login", response_model=LoginResponse)
async def login(credentials: LoginRequest):
    """
    Mock login endpoint.
    Any username/password matching MOCK_USERS succeeds.
    Returns a fake bearer token.

    TODO: Implement real JWT issuance using python-jose:
        1. Verify hashed password with passlib
        2. Generate access_token = jwt.encode({"sub": username, "exp": ...}, SECRET_KEY)
        3. Return token with appropriate expiry
    """
    user = MOCK_USERS.get(credentials.username)
    if not user or user["password"] != credentials.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    return LoginResponse(
        # TODO: Replace "mock-token-12345" with a real JWT access token
        access_token="mock-token-12345",
        token_type="bearer",
        user_name=user["name"],
        role=user["role"],
    )
