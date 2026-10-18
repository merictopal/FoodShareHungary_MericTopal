"""
Shared fixtures for the smoke + edge suites.

Rules for everything under tests/ (see tests/CLAUDE.md):
- In-process only (Flask test client). No live server, no network.
- READ-ONLY against the dev database. Tests may SELECT existing rows but must never
  INSERT/UPDATE/DELETE. Anything that needs writes belongs in a separate, opt-in suite
  that uses the `@fs-test.local` / "[TEST]" convention and cleans up after itself.
- Tokens are minted locally with JWT_SECRET_KEY so we never hit /api/auth/login
  (which is rate limited to 5/min).
"""
import os
import sys
from datetime import datetime, timedelta, timezone

import jwt
import pytest

# Make `import app` / `import config` work when pytest is launched from any cwd.
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)


@pytest.fixture(scope="session")
def app():
    from app import create_app, limiter

    try:
        application = create_app("development")
    except Exception as exc:  # DB down, missing .env, etc.
        pytest.exit(f"Backend could not boot for tests: {exc}", returncode=3)

    # The global 50/hour limit would otherwise trip mid-suite (all requests come from 127.0.0.1).
    limiter.enabled = False
    application.config["TESTING"] = True
    # Dev config has DEBUG=True, which re-raises unhandled errors inside the test client.
    # We want to assert on what a real client receives (the sanitized 500 handler), so turn that off.
    application.config["PROPAGATE_EXCEPTIONS"] = False
    return application


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture(scope="session")
def mint_token(app):
    """mint_token(user_id, role, type='access', expires_in=timedelta(minutes=5), secret=None) -> str"""

    def _mint(user_id, role, type="access", expires_in=timedelta(minutes=5), secret=None):
        payload = {
            "user_id": user_id,
            "role": role,
            "type": type,
            "exp": datetime.now(timezone.utc) + expires_in,
        }
        return jwt.encode(payload, secret or app.config["JWT_SECRET_KEY"], algorithm="HS256")

    return _mint


def _first_user(app, **filters):
    from app.models import User

    with app.app_context():
        user = User.query.filter_by(**filters).order_by(User.id).first()
        return (user.id, user.role) if user else None


@pytest.fixture(scope="session")
def student(app):
    found = _first_user(app, role="student")
    if not found:
        pytest.skip("No student user in the dev DB")
    return found


@pytest.fixture(scope="session")
def admin(app):
    found = _first_user(app, role="admin")
    if not found:
        pytest.skip("No admin user in the dev DB")
    return found


@pytest.fixture(scope="session")
def verified_restaurant(app):
    found = _first_user(app, role="restaurant", verification_status="verified")
    if not found:
        pytest.skip("No verified restaurant user in the dev DB")
    return found


@pytest.fixture(scope="session")
def other_user_id(app, student):
    """An existing user id that is NOT the `student` fixture (for IDOR checks)."""
    from app.models import User

    with app.app_context():
        other = User.query.filter(User.id != student[0]).order_by(User.id).first()
        if not other:
            pytest.skip("Need at least two users for IDOR checks")
        return other.id
