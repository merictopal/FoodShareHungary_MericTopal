"""
Writes (opt-in): the short `error` titles the mobile app maps to translations (Fix 9), plus the verify fields.

NOT part of the gate (marker `writes`, skipped unless FS_ALLOW_WRITES=1). [TEST] / @fs-test.local rows only,
inserted directly (no notifications, no pushes: the [TEST] restaurant has no FCM token); removed in teardown.
"""
import os
import uuid
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from sqlalchemy import text

from helpers import auth

pytestmark = [
    pytest.mark.writes,
    pytest.mark.skipif(os.environ.get("FS_ALLOW_WRITES") != "1", reason="set FS_ALLOW_WRITES=1 to run write tests"),
]

PASSWORD = "Valid123!"


@pytest.fixture()
def world(app):
    from app.extensions import db
    from app.models import User, RestaurantProfile
    from app.models.offer import Offer
    from app.services.qr_service import offer_cutoff_utc

    tag = uuid.uuid4().hex[:8]
    with app.app_context():
        def user(name, role, status):
            u = User(name=f"[TEST] Titles {name}", email=f"titles-{name}-{tag}@fs-test.local", role=role,
                     verification_status=status)
            u.password = PASSWORD
            db.session.add(u)
            db.session.flush()
            return u

        rest, other = user("rest", "restaurant", "verified"), user("other", "restaurant", "verified")
        pending = user("pending", "restaurant", "pending")
        student, suspended = user("student", "student", "verified"), user("suspended", "student", "suspended")
        profile = RestaurantProfile(owner_user_id=rest.id, name="[TEST] Titles Bistro", lat=47.5, lng=19.05)
        other_profile = RestaurantProfile(owner_user_id=other.id, name="[TEST] Titles Other", lat=47.5, lng=19.05)
        db.session.add_all([profile, other_profile])
        db.session.flush()
        last = Offer(restaurant_id=profile.id, title="[TEST] last", description="[TEST]", type="free",
                     original_quantity=1, quantity=1, status="active")
        plenty = Offer(restaurant_id=profile.id, title="[TEST] plenty", description="[TEST]", type="free",
                       original_quantity=5, quantity=5, status="active")
        old = Offer(restaurant_id=profile.id, title="[TEST] old", description="[TEST]", type="free",
                    original_quantity=1, quantity=1, status="active", created_at=offer_cutoff_utc() - timedelta(hours=1))
        db.session.add_all([last, plenty, old])
        db.session.commit()
        state = {"tag": tag, "rest": rest.id, "other": other.id, "student": student.id,
                 "emails": {n: f"titles-{n}-{tag}@fs-test.local" for n in ("pending", "suspended", "student")},
                 "last": last.id, "plenty": plenty.id, "old": old.id,
                 "users": [rest.id, other.id, pending.id, student.id, suspended.id],
                 "profiles": [profile.id, other_profile.id]}

    yield state

    with app.app_context():
        ids = {"u": state["users"], "p": state["profiles"]}
        db.session.execute(text("DELETE FROM claims WHERE user_id = ANY(:u) OR offer_id IN "
                                "(SELECT id FROM offers WHERE restaurant_id = ANY(:p))"), ids)
        db.session.execute(text("DELETE FROM leaderboard WHERE restaurant_id = ANY(:p)"), ids)
        db.session.execute(text("DELETE FROM offers WHERE restaurant_id = ANY(:p)"), ids)
        db.session.execute(text("DELETE FROM restaurant_profiles WHERE id = ANY(:p)"), ids)
        db.session.execute(text("DELETE FROM audit_logs WHERE user_id = ANY(:u) OR details LIKE :m"),
                           {**ids, "m": f"%titles-%{state['tag']}@fs-test.local%"})
        db.session.execute(text("DELETE FROM users WHERE id = ANY(:u)"), ids)
        db.session.commit()


def _h(app, user_id, role):
    return auth(jwt.encode({"user_id": user_id, "role": role, "type": "access",
                            "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
                           app.config["JWT_SECRET_KEY"], algorithm="HS256"))


def _title(res, status):
    assert res.status_code == status, res.get_json()
    return res.get_json()["error"]


def test_login_titles(client, world):
    login = lambda email, pw: client.post("/api/auth/login", json={"email": email, "password": pw})
    assert _title(login(world["emails"]["student"], "wrong-password"), 401) == "Invalid Credentials"
    assert _title(login(world["emails"]["suspended"], PASSWORD), 403) == "Account Suspended"
    assert _title(login(world["emails"]["pending"], PASSWORD), 403) == "Account Pending"


def test_claim_and_verify_titles(app, client, world):
    s = _h(app, world["student"], "student")
    claim = lambda oid: client.post("/api/offers/claim", json={"offer_id": oid}, headers=s)

    res = claim(world["plenty"])
    assert res.status_code == 201
    qr = res.get_json()["qr_code"]
    assert _title(claim(world["plenty"]), 409) == "Already Claimed"
    assert _title(claim(world["old"]), 400) == "Offer Expired"
    assert _title(claim(2_000_000_000), 404) == "Not Found"

    # Sold out: the last unit goes to a second student first
    from app.extensions import db
    from app.models import User
    with app.app_context():
        other_student = User(name="[TEST] Titles s2", email=f"titles-s2-{world['tag']}@fs-test.local",
                             role="student", verification_status="verified")
        other_student.password = PASSWORD
        db.session.add(other_student)
        db.session.commit()
        world["users"].append(other_student.id)
    assert client.post("/api/offers/claim", json={"offer_id": world["last"]},
                       headers=_h(app, other_student.id, "student")).status_code == 201
    assert _title(claim(world["last"]), 400) == "Sold Out"

    verify = lambda code, owner: client.post("/api/claims/verify", json={"qr_code": code},
                                             headers=_h(app, owner, "restaurant"))
    assert _title(verify("NOPE-" + world["tag"], world["rest"]), 404) == "Invalid Code"
    assert _title(verify(qr, world["other"]), 403) == "Wrong Restaurant"

    res = verify(qr, world["rest"])
    assert res.status_code == 200
    body = res.get_json()
    assert body["student_xp"] == 50 and body["restaurant_points"] == 20 and body["new_level"] is None

    assert _title(verify(qr, world["rest"]), 400) == "Already Used"
