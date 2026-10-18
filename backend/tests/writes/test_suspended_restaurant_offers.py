"""
Writes (opt-in): offers of a suspended restaurant are hidden from students (M2), without touching the offers.
NOT part of the gate (marker `writes`, skipped unless FS_ALLOW_WRITES=1). Creates [TEST] restaurants A (stays active),
B (gets suspended) and C, [TEST] students and a [TEST] admin; five validated claims on yesterday's offers make the
collaborative-filtering path recommend A and B to student S1. Everything is removed in teardown. No notifications are
sent (offers are inserted directly).
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
    from app.models.offer import Offer, Claim
    from app.services.qr_service import offer_cutoff_utc

    tag = uuid.uuid4().hex[:8]
    yesterday = offer_cutoff_utc() - timedelta(hours=2)
    with app.app_context():
        def user(name, role):
            u = User(name=f"[TEST] Susp {name}", email=f"susp-{name.lower()}-{tag}@fs-test.local", role=role,
                     verification_status="verified")
            u.password = "Valid123!"
            db.session.add(u)
            return u

        owners = {k: user(f"R{k}", "restaurant") for k in "ABC"}
        students = {k: user(k, "student") for k in ("S1", "S2", "S3", "S4")}
        admin = user("Admin", "admin")
        db.session.flush()
        profiles = {k: RestaurantProfile(owner_user_id=o.id, name=f"[TEST] Susp {k}", lat=47.5, lng=19.05)
                    for k, o in owners.items()}
        db.session.add_all(profiles.values())
        db.session.flush()

        def offer(key, title, created_at=None):
            o = Offer(restaurant_id=profiles[key].id, title=f"[TEST] {title}", description=f"[TEST] {title}",
                      type="free", original_quantity=5, quantity=5, status="active", created_at=created_at)
            db.session.add(o)
            return o

        past = {k: offer(k, f"past {k}", yesterday) for k in "ABC"}
        live = {k: offer(k, f"live {k}") for k in "AB"}
        db.session.flush()
        # S1 and S2 share C; S2 also used A and B -> CF recommends A and B to S1 (5 validated claims in total)
        for i, (s, r) in enumerate([("S1", "C"), ("S2", "C"), ("S2", "A"), ("S2", "B"), ("S3", "C")]):
            db.session.add(Claim(user_id=students[s].id, offer_id=past[r].id, qr_code=f"SUSP-{tag}-{i}",
                                 status="validated"))
        db.session.commit()
        state = {"owner": {k: o.id for k, o in owners.items()}, "student": {k: s.id for k, s in students.items()},
                 "admin": admin.id, "profile_ids": [p.id for p in profiles.values()],
                 "live": {k: o.id for k, o in live.items()}}
    yield state
    with app.app_context():
        ids = {"p": tuple(state["profile_ids"]),
               "u": tuple([*state["owner"].values(), *state["student"].values(), state["admin"]])}
        db.session.execute(text("DELETE FROM claims WHERE user_id IN :u OR offer_id IN "
                                "(SELECT id FROM offers WHERE restaurant_id IN :p)"), ids)
        db.session.execute(text("DELETE FROM notifications WHERE user_id IN :u"), ids)
        db.session.execute(text("DELETE FROM offers WHERE restaurant_id IN :p"), ids)
        db.session.execute(text("DELETE FROM leaderboard WHERE restaurant_id IN :p"), ids)
        db.session.execute(text("DELETE FROM restaurant_profiles WHERE id IN :p"), ids)
        db.session.execute(text("DELETE FROM audit_logs WHERE user_id IN :u"), ids)
        db.session.execute(text("DELETE FROM users WHERE id IN :u"), ids)
        db.session.commit()


def _token(app, user_id, role):
    return auth(jwt.encode({"user_id": user_id, "role": role, "type": "access",
                            "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
                           app.config["JWT_SECRET_KEY"], algorithm="HS256"))


def _listed(client):
    return {o["id"] for o in client.get("/api/offers?lat=47.5&lng=19.05").get_json()}


def _recommended(app, client, student_id):
    res = client.get(f"/api/recommendations/{student_id}", headers=_token(app, student_id, "student"))
    assert res.status_code == 200
    return {o["id"] for o in res.get_json()}


def _suspend(app, client, world, key):
    res = client.post("/api/admin/suspend", json={"user_id": world["owner"][key]}, headers=_token(app, world["admin"], "admin"))
    assert res.status_code == 200, res.get_json()


def test_suspended_restaurant_offers_leave_the_student_listing(app, client, world):
    live_a, live_b = world["live"]["A"], world["live"]["B"]
    assert {live_a, live_b} <= _listed(client)

    _suspend(app, client, world, "B")

    listed = _listed(client)
    assert live_b not in listed
    assert live_a in listed
    from app.extensions import db
    with app.app_context():
        # Hidden, not deleted or cancelled
        assert db.session.execute(text("SELECT status FROM offers WHERE id = :i"), {"i": live_b}).scalar() == "active"


def test_suspended_restaurant_offers_leave_both_recommendation_paths(app, client, world, monkeypatch):
    from app.services.recommendation_service import RecommendationService
    fallback_calls = []
    original_fallback = RecommendationService._get_fallback_offers
    monkeypatch.setattr(RecommendationService, "_get_fallback_offers",
                        staticmethod(lambda limit=5, target_user_id=None, *location: fallback_calls.append(target_user_id)
                                     or original_fallback(limit, target_user_id, *location)))

    live_a, live_b = world["live"]["A"], world["live"]["B"]
    s1, s4 = world["student"]["S1"], world["student"]["S4"]
    # S1: collaborative-filtering path (both restaurants recommended); S4: no claims -> cold-start fallback
    assert {live_a, live_b} <= _recommended(app, client, s1)
    assert {live_a, live_b} <= _recommended(app, client, s4)
    assert fallback_calls == [s4], "S1 must be served by the CF path, S4 by the fallback"

    _suspend(app, client, world, "B")

    # After the suspension S1's CF result still contains A, so S1 must stay on the CF path
    fallback_calls.clear()
    for student in (s1, s4):
        recommended = _recommended(app, client, student)
        assert live_b not in recommended
        assert live_a in recommended
    assert fallback_calls == [s4]


def test_admin_and_active_restaurant_views_and_claims_are_unchanged(app, client, world):
    live_a, live_b = world["live"]["A"], world["live"]["B"]
    _suspend(app, client, world, "B")

    admin_offers = client.get("/api/admin/offers", headers=_token(app, world["admin"], "admin"))
    assert admin_offers.status_code == 200
    assert live_b in {o["id"] for o in admin_offers.get_json()["data"]}

    mine = client.get("/api/offers/my-offers", headers=_token(app, world["owner"]["A"], "restaurant"))
    assert live_a in {o["id"] for o in mine.get_json()["offers"]}
    # The suspended owner keeps the existing rule: no access with its old token
    assert client.get("/api/offers/my-offers", headers=_token(app, world["owner"]["B"], "restaurant")).status_code == 403

    claim = client.post("/api/offers/claim", json={"offer_id": live_a}, headers=_token(app, world["student"]["S4"], "student"))
    assert claim.status_code == 201, claim.get_json()


def test_suspended_restaurant_offer_cannot_be_claimed_by_known_id(app, client, world):
    from app.extensions import db
    live_a, live_b = world["live"]["A"], world["live"]["B"]
    student = _token(app, world["student"]["S4"], "student")
    _suspend(app, client, world, "B")

    # The offer is hidden, but the student still knows its id: a direct claim must not reserve it
    res = client.post("/api/offers/claim", json={"offer_id": live_b}, headers=student)
    assert res.status_code == 404, res.get_json()
    assert res.get_json()["error"] == "Not Found"
    with app.app_context():
        row = db.session.execute(text("SELECT quantity, status FROM offers WHERE id = :i"), {"i": live_b}).one()
        assert tuple(row) == (5, "active")
        assert db.session.execute(text("SELECT count(*) FROM claims WHERE offer_id = :i"), {"i": live_b}).scalar() == 0

    # The active restaurant's live offer is claimed exactly as before (201, stock 5 -> 4, duplicate -> 409)
    ok = client.post("/api/offers/claim", json={"offer_id": live_a}, headers=student)
    assert ok.status_code == 201, ok.get_json()
    assert ok.get_json()["qr_code"]
    with app.app_context():
        assert db.session.execute(text("SELECT quantity FROM offers WHERE id = :i"), {"i": live_a}).scalar() == 4
    assert client.post("/api/offers/claim", json={"offer_id": live_a}, headers=student).status_code == 409
