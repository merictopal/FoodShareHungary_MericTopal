"""Edge: authentication / authorization abuse (Dimension 6 of the edge-case-hunting skill)."""
from datetime import timedelta

import pytest

from helpers import ADMIN_ONLY_GET_ROUTES, auth

pytestmark = pytest.mark.edge


@pytest.mark.parametrize("header", [
    "Bearer",                      # scheme with no token
    "Bearer ",                     # scheme + blank
    "Basic abc123",                # wrong scheme
    "bearer x.y.z",                # wrong case
    "Bearer a b",                  # too many parts
    "Bearer not-a-jwt",
    "Bearer eyJhbGciOiJub25lIn0.eyJ1c2VyX2lkIjoxfQ.",  # alg=none token
])
def test_malformed_authorization_header_is_401(client, header):
    res = client.get("/api/admin/stats", headers={"Authorization": header})
    assert res.status_code == 401


def test_expired_token_is_401(client, mint_token, admin):
    token = mint_token(admin[0], admin[1], expires_in=timedelta(seconds=-5))
    res = client.get("/api/admin/stats", headers=auth(token))
    assert res.status_code == 401
    assert res.get_json()["error"] == "Token Expired"


def test_token_signed_with_wrong_secret_is_401(client, mint_token, admin):
    token = mint_token(admin[0], admin[1], secret="not-the-real-secret-" + "x" * 32)
    assert client.get("/api/admin/stats", headers=auth(token)).status_code == 401


def test_refresh_token_cannot_access_api(client, mint_token, admin):
    token = mint_token(admin[0], admin[1], type="refresh")
    res = client.get("/api/admin/stats", headers=auth(token))
    assert res.status_code == 401
    assert res.get_json()["error"] == "Invalid Token Type"


def test_token_for_deleted_user_is_rejected(client, mint_token):
    token = mint_token(2_000_000_000, "admin")
    assert client.get("/api/admin/stats", headers=auth(token)).status_code in (401, 404)


def test_role_claim_in_token_is_not_trusted(client, mint_token, student):
    """A student forging role='admin' in the payload must still be blocked: role comes from the DB."""
    token = mint_token(student[0], "admin")
    assert client.get("/api/admin/stats", headers=auth(token)).status_code == 403


@pytest.mark.parametrize("path", ADMIN_ONLY_GET_ROUTES)
def test_student_cannot_reach_admin_routes(client, mint_token, student, path):
    res = client.get(path, headers=auth(mint_token(*student)))
    assert res.status_code == 403, f"student got {res.status_code} on {path}"


def test_student_cannot_reach_restaurant_routes(client, mint_token, student):
    res = client.get("/api/offers/my-offers", headers=auth(mint_token(*student)))
    assert res.status_code == 403


def test_idor_profile_of_other_user_is_403(client, mint_token, student, other_user_id):
    res = client.get(f"/api/auth/me/{other_user_id}", headers=auth(mint_token(*student)))
    assert res.status_code == 403


def test_idor_history_of_other_user_is_403(client, mint_token, student, other_user_id):
    res = client.get(f"/api/student/history/{other_user_id}", headers=auth(mint_token(*student)))
    assert res.status_code == 403


def test_idor_recommendations_of_other_user_is_403(client, mint_token, student, other_user_id):
    res = client.get(f"/api/recommendations/{other_user_id}", headers=auth(mint_token(*student)))
    assert res.status_code == 403


def test_admin_can_read_other_profiles(client, mint_token, admin, student):
    res = client.get(f"/api/auth/me/{student[0]}", headers=auth(mint_token(*admin)))
    assert res.status_code == 200


# --- NOTIFICATION INBOX ---

def test_notifications_ignore_client_supplied_user_id(client, mint_token, student, other_user_id):
    """The inbox is keyed on the JWT identity; a user_id query parameter must not switch the owner."""
    headers = auth(mint_token(*student))
    own = client.get("/api/notifications", headers=headers).get_json()
    spoofed = client.get(f"/api/notifications?user_id={other_user_id}", headers=headers).get_json()
    assert spoofed == own


def test_refresh_token_cannot_read_notifications(client, mint_token, student):
    res = client.get("/api/notifications", headers=auth(mint_token(*student, type="refresh")))
    assert res.status_code == 401


# --- ACCOUNT SUSPENSION ---

@pytest.mark.parametrize("role,status,expected", [
    ("student", "suspended", True),
    ("user", "suspended", True),
    ("restaurant", "suspended", True),
    ("admin", "suspended", False),   # admins are exempt; /admin/suspend refuses admin targets
    ("student", "verified", False),
    ("user", "unverified", False),
    ("restaurant", "pending", False),
    ("student", None, False),
])
def test_is_account_suspended_truth_table(role, status, expected):
    from types import SimpleNamespace
    from app.utils.decorators import is_account_suspended

    assert is_account_suspended(SimpleNamespace(role=role, verification_status=status)) is expected


def test_is_account_suspended_handles_missing_user():
    from app.utils.decorators import is_account_suspended

    assert is_account_suspended(None) is False
