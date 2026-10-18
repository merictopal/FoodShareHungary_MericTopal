"""
Writes (opt-in): full forgot-password -> reset -> login flow and student self-deletion.

NOT part of the gate (marker `writes`, and skipped unless FS_ALLOW_WRITES=1). Every row it creates uses the
`@fs-test.local` / "[TEST]" convention and is removed in the fixture teardown. No real e-mail is sent:
smtplib.SMTP is replaced by a fake that captures the message.
"""
import os
import re
import uuid
from datetime import datetime, timedelta

import pytest
from sqlalchemy import text

from helpers import LEAK_MARKERS, auth

pytestmark = [
    pytest.mark.writes,
    pytest.mark.skipif(os.environ.get("FS_ALLOW_WRITES") != "1", reason="set FS_ALLOW_WRITES=1 to run write tests"),
]

OLD_PASSWORD = "OldPass123!"
NEW_PASSWORD = "NewPass456!"


class FakeSMTP:
    sent = []

    def __init__(self, *args, **kwargs):
        pass

    def starttls(self):
        pass

    def login(self, *args):
        pass

    def send_message(self, msg):
        FakeSMTP.sent.append(msg)

    def quit(self):
        pass


def _code_from_last_mail():
    html = FakeSMTP.sent[-1].get_payload()[0].get_payload(decode=True).decode()
    return re.search(r">(\d{6})<", html).group(1)


@pytest.fixture()
def fake_smtp(monkeypatch):
    import app.services.auth_service as auth_service
    FakeSMTP.sent = []
    monkeypatch.setattr(auth_service.smtplib, "SMTP", FakeSMTP)
    monkeypatch.setenv("SMTP_EMAIL", "sender@fs-test.local")
    monkeypatch.setenv("SMTP_APP_PASSWORD", "not-a-real-password")
    return FakeSMTP


@pytest.fixture()
def test_world(app):
    """A [TEST] restaurant with one offer (quantity 2) and a [TEST] student holding a pending claim on it."""
    from app.extensions import db
    from app.models import User, RestaurantProfile
    from app.models.offer import Offer, Claim
    from app.models.stats import Notification

    tag = uuid.uuid4().hex[:8]
    with app.app_context():
        rest_user = User(name="[TEST] Reset Rest", email=f"rest-{tag}@fs-test.local", role="restaurant",
                         verification_status="verified")
        rest_user.password = OLD_PASSWORD
        student = User(name="[TEST] Reset Student", email=f"student-{tag}@fs-test.local", role="student",
                       verification_status="unverified")
        student.password = OLD_PASSWORD
        db.session.add_all([rest_user, student])
        db.session.flush()
        profile = RestaurantProfile(owner_user_id=rest_user.id, name="[TEST] Reset Rest", lat=47.5, lng=19.05)
        db.session.add(profile)
        db.session.flush()
        # Quantity 1 left of 2: one portion is reserved by the pending claim below
        offer = Offer(restaurant_id=profile.id, title="[TEST] Reset Offer", description="[TEST]", type="free",
                      original_quantity=2, quantity=1, status="active")
        db.session.add(offer)
        db.session.flush()
        db.session.add(Claim(user_id=student.id, offer_id=offer.id, qr_code=f"TEST-{tag}", status="pending"))
        db.session.add(Notification(user_id=student.id, title="[TEST]", message="[TEST] reset flow"))
        db.session.commit()
        world = {"student_id": student.id, "email": student.email, "rest_user_id": rest_user.id,
                 "profile_id": profile.id, "offer_id": offer.id}

    yield world

    with app.app_context():
        ids = {"s": world["student_id"], "r": world["rest_user_id"]}
        db.session.execute(text("DELETE FROM claims WHERE offer_id = :o OR user_id = :s"), {"o": world["offer_id"], "s": ids["s"]})
        db.session.execute(text("DELETE FROM notifications WHERE user_id IN (:s, :r)"), ids)
        db.session.execute(text("DELETE FROM offers WHERE id = :o"), {"o": world["offer_id"]})
        db.session.execute(text("DELETE FROM restaurant_profiles WHERE id = :p"), {"p": world["profile_id"]})
        db.session.execute(text("DELETE FROM audit_logs WHERE user_id IN (:s, :r) OR id = ANY(:extra) "
                                "OR (action = 'ACCOUNT_DELETED' AND details = :d) "
                                "OR (user_id IS NULL AND details LIKE :mail)"),
                           {**ids, "extra": world.get("unlinked_audit_ids", []), "d": f"user #{ids['s']}",
                            "mail": f"%{world['email']}%"})
        db.session.execute(text("DELETE FROM users WHERE id IN (:s, :r)"), ids)
        db.session.commit()


def _login(client, email, password):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def test_forgot_reset_login_flow(app, client, fake_smtp, test_world):
    from app.extensions import db
    from app.models import User

    email = test_world["email"]
    res = client.post("/api/auth/forgot-password", json={"email": email})
    assert res.status_code == 200
    code = _code_from_last_mail()
    assert code not in res.get_data(as_text=True)

    with app.app_context():
        user = User.query.get(test_world["student_id"])
        assert user.reset_code_hash and code not in user.reset_code_hash
        assert user.reset_code_expires_at > datetime.utcnow()

    wrong = "000000" if code != "000000" else "111111"
    res = client.post("/api/auth/reset-password", json={"email": email, "code": wrong, "new_password": NEW_PASSWORD})
    assert res.status_code == 400
    with app.app_context():
        assert User.query.get(test_world["student_id"]).reset_code_attempts == 1

    res = client.post("/api/auth/reset-password", json={"email": email, "code": code, "new_password": NEW_PASSWORD})
    assert res.status_code == 200, res.get_json()
    body = res.get_data(as_text=True)
    assert code not in body and NEW_PASSWORD not in body
    assert not any(m in body for m in LEAK_MARKERS)

    assert _login(client, email, OLD_PASSWORD).status_code == 401
    assert _login(client, email, NEW_PASSWORD).status_code == 200

    # Single use
    res = client.post("/api/auth/reset-password", json={"email": email, "code": code, "new_password": "Another789!"})
    assert res.status_code == 400
    with app.app_context():
        user = User.query.get(test_world["student_id"])
        assert user.reset_code_hash is None and user.reset_code_expires_at is None


def test_expired_code_is_rejected(app, client, fake_smtp, test_world):
    from app.extensions import db
    from app.models import User

    email = test_world["email"]
    client.post("/api/auth/forgot-password", json={"email": email})
    code = _code_from_last_mail()
    with app.app_context():
        user = User.query.get(test_world["student_id"])
        user.reset_code_expires_at = datetime.utcnow() - timedelta(seconds=1)
        db.session.commit()

    res = client.post("/api/auth/reset-password", json={"email": email, "code": code, "new_password": NEW_PASSWORD})
    assert res.status_code == 400
    assert _login(client, email, OLD_PASSWORD).status_code == 200


def test_too_many_wrong_codes_burn_the_code(app, client, fake_smtp, test_world):
    email = test_world["email"]
    client.post("/api/auth/forgot-password", json={"email": email})
    code = _code_from_last_mail()
    wrong = "000000" if code != "000000" else "111111"
    for _ in range(5):
        client.post("/api/auth/reset-password", json={"email": email, "code": wrong, "new_password": NEW_PASSWORD})

    # The right code no longer works after 5 failures
    res = client.post("/api/auth/reset-password", json={"email": email, "code": code, "new_password": NEW_PASSWORD})
    assert res.status_code == 400
    assert _login(client, email, OLD_PASSWORD).status_code == 200


def test_student_self_delete(app, client, mint_token, test_world):
    from app.models import User
    from app.models.offer import Offer, Claim
    from app.models.stats import Notification
    from app.models.user import AuditLog
    from app.extensions import db

    sid = test_world["student_id"]
    login = _login(client, test_world["email"], OLD_PASSWORD).get_json()
    access, refresh = login["token"], login["refresh_token"]
    with app.app_context():
        test_world["unlinked_audit_ids"] = [a.id for a in AuditLog.query.filter_by(user_id=sid).all()]
        assert test_world["unlinked_audit_ids"]

    res = client.delete("/api/auth/account", headers=auth(access))
    assert res.status_code == 200, res.get_json()
    assert res.get_json()["success"] is True

    with app.app_context():
        assert User.query.get(sid) is None
        assert Claim.query.filter_by(user_id=sid).count() == 0
        assert Notification.query.filter_by(user_id=sid).count() == 0
        assert AuditLog.query.filter_by(user_id=sid).count() == 0
        # Audit rows survive, unlinked
        assert db.session.execute(text("SELECT count(*) FROM audit_logs WHERE id = ANY(:ids) AND user_id IS NULL"),
                                  {"ids": test_world["unlinked_audit_ids"]}).scalar() == len(test_world["unlinked_audit_ids"])
        # The pending claim's reserved portion went back to the offer
        assert Offer.query.get(test_world["offer_id"]).quantity == 2
        # The restaurant (shared data) is untouched
        assert User.query.get(test_world["rest_user_id"]) is not None

    # Old session is dead
    assert client.get(f"/api/auth/me/{sid}", headers=auth(access)).status_code == 401  # Fix 8: deleted account = no session
    assert client.post("/api/auth/refresh", json={"refresh_token": refresh}).status_code == 404
    assert _login(client, test_world["email"], OLD_PASSWORD).status_code == 401
    # Deleting twice is not possible
    assert client.delete("/api/auth/account", headers=auth(access)).status_code == 401
