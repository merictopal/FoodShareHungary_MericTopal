"""Edge: self-service account deletion and password reset (read-only: every request here is rejected before any write)."""
import pytest

from helpers import LEAK_MARKERS, auth

pytestmark = pytest.mark.edge

UNKNOWN_EMAIL = "nobody-reset@fs-test.local"


# --- DELETE /api/auth/account ---

def test_admin_cannot_self_delete(app, client, mint_token, admin):
    res = client.delete("/api/auth/account", headers=auth(mint_token(*admin)))
    assert res.status_code == 403
    from app.models import User
    with app.app_context():
        assert User.query.get(admin[0]) is not None


def test_restaurant_cannot_self_delete(app, client, mint_token, verified_restaurant):
    # Restaurant offers carry other students' claims, so self-deletion is refused
    res = client.delete("/api/auth/account", headers=auth(mint_token(*verified_restaurant)))
    assert res.status_code == 403
    from app.models import User
    with app.app_context():
        assert User.query.get(verified_restaurant[0]) is not None


def test_refresh_token_cannot_delete_account(client, mint_token, student):
    res = client.delete("/api/auth/account", headers=auth(mint_token(*student, type="refresh")))
    assert res.status_code == 401


def test_role_claim_cannot_unlock_deletion_for_admin(client, mint_token, admin):
    # Role is re-read from the DB: an admin token claiming "student" is still refused
    res = client.delete("/api/auth/account", headers=auth(mint_token(admin[0], "student")))
    assert res.status_code == 403


def test_delete_account_has_no_id_based_variant(client, mint_token, student, other_user_id):
    res = client.delete(f"/api/auth/account/{other_user_id}", headers=auth(mint_token(*student)))
    assert res.status_code in (404, 405)


# --- DELETE /api/auth/fcm-token ---

@pytest.mark.parametrize("body", [{}, {"fcm_token": ""}, {"fcm_token": "   "}, {"fcm_token": None}, {"fcm_token": 123}])
def test_fcm_unlink_without_token_is_400(client, mint_token, student, body):
    res = client.delete("/api/auth/fcm-token", json=body, headers=auth(mint_token(*student)))
    assert res.status_code == 400
    assert res.get_json()["success"] is False


def test_fcm_unlink_non_json_body_is_400(client, mint_token, student):
    res = client.delete("/api/auth/fcm-token", data="not json", content_type="text/plain",
                        headers=auth(mint_token(*student)))
    assert res.status_code == 400


def test_fcm_unlink_with_refresh_token_is_401(client, mint_token, student):
    res = client.delete("/api/auth/fcm-token", json={"fcm_token": "x"},
                        headers=auth(mint_token(*student, type="refresh")))
    assert res.status_code == 401


# --- POST /api/auth/reset-password ---

@pytest.mark.parametrize("body", [
    {},
    {"email": UNKNOWN_EMAIL},
    {"email": UNKNOWN_EMAIL, "code": "123456"},
    {"code": "123456", "new_password": "secret123"},
    {"email": "", "code": "", "new_password": ""},
])
def test_reset_password_missing_fields_is_400(client, body):
    res = client.post("/api/auth/reset-password", json=body)
    assert res.status_code == 400
    assert res.get_json()["success"] is False


def test_reset_password_non_json_body_is_400(client):
    res = client.post("/api/auth/reset-password", data="not json", content_type="text/plain")
    assert res.status_code == 400


@pytest.mark.parametrize("pw", ["12345", "", 123456, ["x" * 10]])
def test_reset_password_rejects_short_or_non_string_password(client, pw):
    res = client.post("/api/auth/reset-password", json={"email": UNKNOWN_EMAIL, "code": "123456", "new_password": pw})
    assert res.status_code == 400


def test_reset_password_unknown_email_is_generic_400(client):
    res = client.post("/api/auth/reset-password",
                      json={"email": UNKNOWN_EMAIL, "code": "123456", "new_password": "secret123"})
    body = res.get_json()
    assert res.status_code == 400
    # Same message as a wrong/expired code, so the endpoint does not reveal whether the email exists
    assert body["message"] == "Invalid or expired reset code."
    assert not any(m in res.get_data(as_text=True) for m in LEAK_MARKERS)


def test_user_dict_never_exposes_reset_fields(app, student):
    from app.models import User
    with app.app_context():
        data = User.query.get(student[0]).to_dict()
    assert not any(k.startswith("reset_code") for k in data)
