"""
Writes (opt-in): pickup-location fields behind the mobile Home map card and "Open in Google Maps".
NOT part of the gate (marker `writes`, skipped unless FS_ALLOW_WRITES=1). Creates two [TEST] restaurants (one with a
NULL address and two offers, one with an address) and a verified [TEST] student; everything is removed in teardown.
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

    tag = uuid.uuid4().hex[:8]
    with app.app_context():
        owners = [User(name=f"[TEST] Map R{i}", email=f"map-r{i}-{tag}@fs-test.local", role="restaurant",
                       verification_status="verified") for i in (1, 2)]
        student = User(name="[TEST] Map S", email=f"map-s-{tag}@fs-test.local", role="student",
                       verification_status="verified")
        for u in (*owners, student):
            u.password = "Valid123!"
        db.session.add_all([*owners, student])
        db.session.flush()
        no_addr = RestaurantProfile(owner_user_id=owners[0].id, name="[TEST] Map NoAddr", lat=47.501, lng=19.051,
                                    address=None)
        with_addr = RestaurantProfile(owner_user_id=owners[1].id, name="[TEST] Map Addr", lat=47.51, lng=19.06,
                                      address="[TEST] Fő utca 1, Budapest")
        db.session.add_all([no_addr, with_addr])
        db.session.flush()
        offers = [Offer(restaurant_id=p.id, title=f"[TEST] map {n}", description=f"[TEST] map {n}", type="free",
                        original_quantity=2, quantity=2, status="active")
                  for p, n in ((no_addr, "a"), (no_addr, "b"), (with_addr, "c"))]
        db.session.add_all(offers)
        db.session.commit()
        state = {"owners": [o.id for o in owners], "student": student.id,
                 "no_addr": no_addr.id, "with_addr": with_addr.id, "offers": [o.id for o in offers]}
    yield state
    with app.app_context():
        params = {"p1": state["no_addr"], "p2": state["with_addr"], "s": state["student"],
                  "r1": state["owners"][0], "r2": state["owners"][1]}
        db.session.execute(text("DELETE FROM claims WHERE user_id = :s OR offer_id IN "
                                "(SELECT id FROM offers WHERE restaurant_id IN (:p1, :p2))"), params)
        db.session.execute(text("DELETE FROM notifications WHERE user_id IN (:r1, :r2, :s)"), params)
        db.session.execute(text("DELETE FROM offers WHERE restaurant_id IN (:p1, :p2)"), params)
        db.session.execute(text("DELETE FROM restaurant_profiles WHERE id IN (:p1, :p2)"), params)
        db.session.execute(text("DELETE FROM audit_logs WHERE user_id IN (:r1, :r2, :s)"), params)
        db.session.execute(text("DELETE FROM users WHERE id IN (:r1, :r2, :s)"), params)
        db.session.commit()


def _token(app, user_id, role):
    return auth(jwt.encode({"user_id": user_id, "role": role, "type": "access",
                            "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
                           app.config["JWT_SECRET_KEY"], algorithm="HS256"))


def test_offers_carry_restaurant_id_and_nullable_address(client, world):
    listed = [o for o in client.get("/api/offers?lat=47.5&lng=19.05").get_json() if o["id"] in world["offers"]]
    assert len(listed) == 3
    by_rest = {}
    for o in listed:
        by_rest.setdefault(o["restaurant_id"], []).append(o)
    # Two offers of one restaurant → one map group with one shared location
    assert len(by_rest[world["no_addr"]]) == 2
    assert {(o["lat"], o["lng"], o["address"]) for o in by_rest[world["no_addr"]]} == {(47.501, 19.051, None)}
    assert by_rest[world["with_addr"]][0]["address"] == "[TEST] Fő utca 1, Budapest"


def test_claim_history_carries_pickup_location(app, client, world):
    headers = _token(app, world["student"], "student")
    for offer_id in (world["offers"][0], world["offers"][2]):
        res = client.post("/api/offers/claim", json={"offer_id": offer_id}, headers=headers)
        assert res.status_code == 201, res.get_json()
    history = client.get(f"/api/student/history/{world['student']}", headers=headers).get_json()["history"]
    pickups = {h["restaurant_name"]: (h["restaurant_address"], h["lat"], h["lng"]) for h in history}
    assert pickups["[TEST] Map NoAddr"] == (None, 47.501, 19.051)
    assert pickups["[TEST] Map Addr"] == ("[TEST] Fő utca 1, Budapest", 47.51, 19.06)
