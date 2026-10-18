"""
Writes (opt-in): same-day offer expiry (Fix 5) end to end with [TEST] rows.

NOT part of the gate (marker `writes`, skipped unless FS_ALLOW_WRITES=1). Creates a [TEST] restaurant with one
offer from today and one from yesterday (created_at moved before the Budapest cutoff) and a verified [TEST]
student; everything is removed in teardown. No notifications are sent (offers are inserted directly).
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


@pytest.fixture()
def world(app):
    from app.extensions import db
    from app.models import User, RestaurantProfile
    from app.models.offer import Offer
    from app.services.qr_service import offer_cutoff_utc

    tag = uuid.uuid4().hex[:8]
    cutoff = offer_cutoff_utc()
    with app.app_context():
        rest = User(name="[TEST] Expiry R", email=f"expiry-r-{tag}@fs-test.local", role="restaurant",
                    verification_status="verified")
        rest.password = "Valid123!"
        student = User(name="[TEST] Expiry S", email=f"expiry-s-{tag}@fs-test.local", role="student",
                       verification_status="verified")
        student.password = "Valid123!"
        db.session.add_all([rest, student])
        db.session.flush()
        profile = RestaurantProfile(owner_user_id=rest.id, name="[TEST] Expiry Bistro", lat=47.5, lng=19.05)
        db.session.add(profile)
        db.session.flush()
        offers = {
            "today": Offer(restaurant_id=profile.id, title="[TEST] today", description="[TEST] today", type="free",
                           original_quantity=2, quantity=2, status="active"),
            "boundary": Offer(restaurant_id=profile.id, title="[TEST] boundary", description="[TEST] boundary",
                              type="free", original_quantity=2, quantity=2, status="active", created_at=cutoff),
            "yesterday": Offer(restaurant_id=profile.id, title="[TEST] yesterday", description="[TEST] yesterday",
                               type="free", original_quantity=2, quantity=2, status="active",
                               created_at=cutoff - timedelta(minutes=1)),
        }
        db.session.add_all(offers.values())
        db.session.commit()
        state = {"rest_id": rest.id, "student_id": student.id, "profile_id": profile.id,
                 **{name: o.id for name, o in offers.items()}}

    yield state

    with app.app_context():
        ids = {"r": state["rest_id"], "s": state["student_id"], "p": state["profile_id"]}
        db.session.execute(text("DELETE FROM claims WHERE user_id = :s OR offer_id IN "
                                "(SELECT id FROM offers WHERE restaurant_id = :p)"), ids)
        db.session.execute(text("DELETE FROM offers WHERE restaurant_id = :p"), ids)
        db.session.execute(text("DELETE FROM restaurant_profiles WHERE id = :p"), ids)
        db.session.execute(text("DELETE FROM audit_logs WHERE user_id IN (:r, :s)"), ids)
        db.session.execute(text("DELETE FROM users WHERE id IN (:r, :s)"), ids)
        db.session.commit()


def _token(app, user_id, role):
    return auth(jwt.encode({"user_id": user_id, "role": role, "type": "access",
                            "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
                           app.config["JWT_SECRET_KEY"], algorithm="HS256"))


def _quantity(app, offer_id):
    from app.extensions import db
    with app.app_context():
        return db.session.execute(text("SELECT quantity FROM offers WHERE id = :i"), {"i": offer_id}).scalar()


def test_listings_show_only_todays_offers(app, client, world):
    listed = {o["id"] for o in client.get("/api/offers?lat=47.5&lng=19.05").get_json()}
    assert world["today"] in listed and world["boundary"] in listed
    assert world["yesterday"] not in listed

    mine = {o["id"] for o in client.get("/api/offers/my-offers", headers=_token(app, world["rest_id"], "restaurant"))
            .get_json()["offers"]}
    assert mine == {world["today"], world["boundary"]}

    # Recommendations (fallback or CF) never return yesterday's offer
    recs = client.get(f"/api/recommendations/{world['student_id']}",
                      headers=_token(app, world["student_id"], "student")).get_json()
    assert world["yesterday"] not in {o["id"] for o in recs}


def test_expired_offer_cannot_be_claimed_and_keeps_its_quantity(app, client, world):
    headers = _token(app, world["student_id"], "student")
    res = client.post("/api/offers/claim", json={"offer_id": world["yesterday"]}, headers=headers)
    assert res.status_code == 400
    assert res.get_json()["message"] == "This offer has expired."
    assert _quantity(app, world["yesterday"]) == 2

    res = client.post("/api/offers/claim", json={"offer_id": world["today"]}, headers=headers)
    assert res.status_code == 201, res.get_json()
    assert _quantity(app, world["today"]) == 1

    # Duplicate rule unchanged: 409 for a second claim of the same (live) offer
    assert client.post("/api/offers/claim", json={"offer_id": world["today"]}, headers=headers).status_code == 409
