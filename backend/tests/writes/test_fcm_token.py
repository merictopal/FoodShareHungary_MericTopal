"""
Writes (opt-in): FCM token link / device dedup / unlink on logout.

NOT part of the gate (marker `writes`, and skipped unless FS_ALLOW_WRITES=1). Uses two `@fs-test.local` / "[TEST]"
students created and removed by the fixture; tokens are fake strings, nothing is sent to Firebase.
"""
import os
import uuid

import pytest
from sqlalchemy import text

from helpers import auth

pytestmark = [
    pytest.mark.writes,
    pytest.mark.skipif(os.environ.get("FS_ALLOW_WRITES") != "1", reason="set FS_ALLOW_WRITES=1 to run write tests"),
]


@pytest.fixture()
def two_students(app):
    from app.extensions import db
    from app.models import User

    tag = uuid.uuid4().hex[:8]
    with app.app_context():
        users = [User(name=f"[TEST] FCM {n}", email=f"fcm-{n}-{tag}@fs-test.local", role="student",
                      verification_status="unverified") for n in ("a", "b")]
        for u in users:
            u.password = "FcmPass123!"
        db.session.add_all(users)
        db.session.commit()
        ids = [u.id for u in users]

    yield ids, f"fs-test-device-{tag}"

    with app.app_context():
        db.session.execute(text("DELETE FROM audit_logs WHERE user_id = ANY(:ids)"), {"ids": ids})
        db.session.execute(text("DELETE FROM users WHERE id = ANY(:ids)"), {"ids": ids})
        db.session.commit()


def _token_of(app, user_id):
    from app.extensions import db
    with app.app_context():
        return db.session.execute(text("SELECT fcm_token FROM users WHERE id = :id"), {"id": user_id}).scalar()


def _link(client, mint_token, user_id, token):
    return client.post("/api/auth/fcm-token", json={"fcm_token": token}, headers=auth(mint_token(user_id, "student")))


def _unlink(client, mint_token, user_id, token):
    return client.delete("/api/auth/fcm-token", json={"fcm_token": token}, headers=auth(mint_token(user_id, "student")))


def test_link_still_works(app, client, mint_token, two_students):
    (a, _), device = two_students
    assert _link(client, mint_token, a, device).status_code == 200
    assert _token_of(app, a) == device


def test_unlink_clears_own_token_and_is_idempotent(app, client, mint_token, two_students):
    (a, _), device = two_students
    _link(client, mint_token, a, device)
    res = _unlink(client, mint_token, a, device)
    assert res.status_code == 200 and res.get_json()["success"] is True
    assert _token_of(app, a) is None
    assert _unlink(client, mint_token, a, device).status_code == 200


def test_unlink_with_mismatched_token_keeps_stored_token(app, client, mint_token, two_students):
    # Logging out on an old device must not remove the token of the account's newer device
    (a, _), device = two_students
    _link(client, mint_token, a, device)
    assert _unlink(client, mint_token, a, device + "-old").status_code == 200
    assert _token_of(app, a) == device


def test_unlink_only_touches_the_caller(app, client, mint_token, two_students):
    (a, b), device = two_students
    _link(client, mint_token, a, device)
    # b sends a's device token: no body/user id can reach another account
    assert _unlink(client, mint_token, b, device).status_code == 200
    assert _token_of(app, a) == device


def test_linking_device_to_b_unlinks_it_from_a(app, client, mint_token, two_students):
    (a, b), device = two_students
    _link(client, mint_token, a, device)
    assert _link(client, mint_token, b, device).status_code == 200
    assert _token_of(app, b) == device
    assert _token_of(app, a) is None
    # And back again
    _link(client, mint_token, a, device)
    assert (_token_of(app, a), _token_of(app, b)) == (device, None)
