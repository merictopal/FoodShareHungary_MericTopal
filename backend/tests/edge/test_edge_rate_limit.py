"""
Edge: rate-limit keys (Fix 4). Authenticated requests are counted per account, anonymous ones per IP,
credential endpoints always per IP. The limiter is switched on only inside these tests (conftest disables it)
and reset afterwards. Read-only: only GET /api/leaderboard is called for real; login/refresh handlers are stubbed.
"""
import pytest

from helpers import auth

pytestmark = pytest.mark.edge

DEFAULT_HOURLY = 50


@pytest.fixture()
def limiter_on():
    from app import limiter
    limiter.reset()
    limiter.enabled = True
    yield limiter
    limiter.enabled = False
    limiter.reset()


def _burn(client, n, headers=None):
    return [client.get("/api/leaderboard", headers=headers or {}).status_code for _ in range(n)]


def test_users_behind_one_ip_have_separate_budgets(client, mint_token, student, admin, limiter_on):
    a = auth(mint_token(*student))
    assert set(_burn(client, DEFAULT_HOURLY, a)) == {200}
    res = client.get("/api/leaderboard", headers=a)
    assert res.status_code == 429
    assert "50 per 1 hour" in res.get_json()["message"]

    # Same IP, different account / no account: unaffected
    assert client.get("/api/leaderboard", headers=auth(mint_token(*admin))).status_code == 200
    assert client.get("/api/leaderboard").status_code == 200


def test_anonymous_and_invalid_tokens_share_the_ip_budget(client, mint_token, student, limiter_on):
    assert set(_burn(client, DEFAULT_HOURLY)) == {200}
    assert client.get("/api/leaderboard").status_code == 429
    # A refresh token, a forged token or garbage must not open a fresh bucket
    for headers in (auth(mint_token(*student, type="refresh")),
                    auth(mint_token(*student, secret="not-the-real-key")),
                    {"Authorization": "Bearer garbage"}):
        assert client.get("/api/leaderboard", headers=headers).status_code == 429


def test_login_stays_per_ip_even_with_a_token(client, mint_token, student, admin, limiter_on, monkeypatch):
    from app.services.auth_service import AuthService
    monkeypatch.setattr(AuthService, "login_user",
                        staticmethod(lambda data: {"success": False, "message": "stub", "status": 401}))
    for _ in range(5):
        assert client.post("/api/auth/login", json={"email": "x@fs-test.local", "password": "x"},
                           headers=auth(mint_token(*student))).status_code == 401
    res = client.post("/api/auth/login", json={"email": "x@fs-test.local", "password": "x"},
                      headers=auth(mint_token(*admin)))
    assert res.status_code == 429
    assert "5 per 1 minute" in res.get_json()["message"]


def test_refresh_is_counted_per_account(client, mint_token, student, admin, limiter_on, monkeypatch):
    from app.services.auth_service import AuthService
    monkeypatch.setattr(AuthService, "refresh_access_token",
                        staticmethod(lambda data: {"success": True, "token": "stub", "status": 200}))
    token_a = mint_token(*student, type="refresh")
    statuses = [client.post("/api/auth/refresh", json={"refresh_token": token_a}).status_code
                for _ in range(DEFAULT_HOURLY + 1)]
    assert statuses[:DEFAULT_HOURLY] == [200] * DEFAULT_HOURLY and statuses[-1] == 429
    assert client.post("/api/auth/refresh", json={"refresh_token": mint_token(*admin, type="refresh")}).status_code == 200
