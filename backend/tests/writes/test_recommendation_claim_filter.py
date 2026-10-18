"""
Writes (opt-in): recommendations exclude offers the student already holds a claim for (Fix 7).

NOT part of the gate (marker `writes`, skipped unless FS_ALLOW_WRITES=1). All rows are [TEST] / @fs-test.local and are
inserted directly (no notifications); teardown removes them. A 'rejected' claim is inserted directly to cover that status.
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


class World:
    def __init__(self, app):
        self.app = app
        self.tag = uuid.uuid4().hex[:8]
        self.users, self.profiles, self.owners = [], [], {}

    def user(self, name):
        from app.extensions import db
        from app.models import User
        with self.app.app_context():
            u = User(name=f"[TEST] Reco {name}", email=f"reco-{name.lower()}-{self.tag}@fs-test.local", role="student",
                     verification_status="verified")
            u.password = "Valid123!"
            db.session.add(u)
            db.session.commit()
            self.users.append(u.id)
            return u.id

    def restaurant(self, name, lat=47.5, lng=19.05):
        from app.extensions import db
        from app.models import User, RestaurantProfile
        with self.app.app_context():
            owner = User(name=f"[TEST] Reco {name}", email=f"reco-r{name.lower()}-{self.tag}@fs-test.local",
                         role="restaurant", verification_status="verified")
            owner.password = "Valid123!"
            db.session.add(owner)
            db.session.flush()
            profile = RestaurantProfile(owner_user_id=owner.id, name=f"[TEST] Reco {name}", lat=lat, lng=lng)
            db.session.add(profile)
            db.session.commit()
            self.users.append(owner.id)
            self.profiles.append(profile.id)
            self.owners[profile.id] = owner.id
            return profile.id

    def offer(self, restaurant_id, created_at, quantity=2, status="active", offer_type="free", discount_rate=0):
        from app.extensions import db
        from app.models.offer import Offer
        with self.app.app_context():
            o = Offer(restaurant_id=restaurant_id, title="[TEST] reco", description="[TEST] reco", type=offer_type,
                      discount_rate=discount_rate, original_quantity=2, quantity=quantity, status=status, created_at=created_at)
            db.session.add(o)
            db.session.commit()
            return o.id

    def claim(self, user_id, offer_id, status="pending"):
        from app.extensions import db
        with self.app.app_context():
            db.session.execute(text("INSERT INTO claims (user_id, offer_id, qr_code, status, created_at) "
                                    "VALUES (:u, :o, :q, :s, :t)"),
                               {"u": user_id, "o": offer_id, "q": f"TEST-RECO-{uuid.uuid4().hex}", "s": status,
                                "t": datetime.utcnow()})
            db.session.commit()

    def cleanup(self):
        from app.extensions import db
        with self.app.app_context():
            ids = {"u": self.users, "p": self.profiles}
            db.session.execute(text("DELETE FROM claims WHERE user_id = ANY(:u) OR offer_id IN "
                                    "(SELECT id FROM offers WHERE restaurant_id = ANY(:p))"), ids)
            db.session.execute(text("DELETE FROM offers WHERE restaurant_id = ANY(:p)"), ids)
            db.session.execute(text("DELETE FROM restaurant_profiles WHERE id = ANY(:p)"), ids)
            db.session.execute(text("DELETE FROM audit_logs WHERE user_id = ANY(:u)"), ids)
            db.session.execute(text("DELETE FROM users WHERE id = ANY(:u)"), ids)
            db.session.commit()


@pytest.fixture()
def world(app):
    w = World(app)
    yield w
    w.cleanup()


def _recs(app, client, user_id):
    token = jwt.encode({"user_id": user_id, "role": "student", "type": "access",
                        "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
                       app.config["JWT_SECRET_KEY"], algorithm="HS256")
    res = client.get(f"/api/recommendations/{user_id}?lat=47.5&lng=19.05", headers=auth(token))
    assert res.status_code == 200, res.get_json()
    return [o["id"] for o in res.get_json()]


def test_fallback_excludes_own_claims_in_any_status(app, client, world):
    from app.services.qr_service import offer_cutoff_utc
    now = datetime.utcnow()
    r1 = world.restaurant("R1")
    today = [world.offer(r1, now - timedelta(seconds=i)) for i in range(8)]  # newest first
    yesterday = world.offer(r1, offer_cutoff_utc() - timedelta(minutes=1))
    sold_out = world.offer(r1, now, quantity=0, status="sold_out")
    cancelled = world.offer(r1, now, status="cancelled")
    a, b, c = world.user("A"), world.user("B"), world.user("C")
    world.claim(a, today[0], "pending")
    world.claim(a, today[1], "validated")
    world.claim(a, today[2], "rejected")
    world.claim(b, today[3], "pending")

    recs_a = _recs(app, client, a)
    assert not {today[0], today[1], today[2]} & set(recs_a)
    assert recs_a == today[3:8]  # top 5 kept: claimed offers are replaced, B's claim doesn't matter to A
    assert not {yesterday, sold_out, cancelled} & set(recs_a)

    recs_b = _recs(app, client, b)
    assert today[3] not in recs_b and today[0] in recs_b

    assert _recs(app, client, c) == today[:5]  # new user: plain newest five


def test_personalised_path_excludes_own_claims(app, client, world, monkeypatch):
    from app.services.qr_service import offer_cutoff_utc
    old = offer_cutoff_utc() - timedelta(hours=1)
    r1, r2 = world.restaurant("R1"), world.restaurant("R2")
    a, b, c = world.user("A"), world.user("B"), world.user("C")
    # History (expired offers): A visited R1; B and C visited R1 and R2 -> R2 is recommended to A. 5 validated claims.
    for user, restaurant in ((a, r1), (b, r1), (b, r2), (c, r1), (c, r2)):
        world.claim(user, world.offer(restaurant, old), "validated")
    now = datetime.utcnow()
    p1, p2 = world.offer(r2, now - timedelta(seconds=1)), world.offer(r2, now)

    assert set(_recs(app, client, a)) >= {p1, p2}

    world.claim(a, p1, "pending")
    # Must come from the personalised (collaborative filtering) path, not the fallback
    from app.services.recommendation_service import RecommendationService
    real_fallback = RecommendationService._get_fallback_offers
    fallback_calls = []
    monkeypatch.setattr(RecommendationService, "_get_fallback_offers",
                        staticmethod(lambda *args: fallback_calls.append(args) or real_fallback(*args)))
    recs = _recs(app, client, a)
    assert p2 in recs and p1 not in recs
    assert fallback_calls == []

    world.claim(a, p2, "pending")
    # Every CF candidate claimed: A still has history (restaurant affinity), so the hybrid scorer keeps serving A
    # through the personalised path (no separate fallback since the hybrid upgrade), still without A's claims
    recs = _recs(app, client, a)
    assert not {p1, p2} & set(recs)
    assert fallback_calls == []


# --- HYBRID SCORING FLOWS (candidate generation -> scoring -> re-ranking) ---
def _recs_full(app, client, user_id, query="?lat=47.5&lng=19.05"):
    token = jwt.encode({"user_id": user_id, "role": "student", "type": "access",
                        "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
                       app.config["JWT_SECRET_KEY"], algorithm="HS256")
    res = client.get(f"/api/recommendations/{user_id}{query}", headers=auth(token))
    assert res.status_code == 200, res.get_json()
    return res.get_json()


def test_hybrid_cold_start_uses_distance_only_when_coordinates_are_sent(app, client, world):
    now = datetime.utcnow()
    near, far = world.restaurant("Near", lat=47.501, lng=19.05), world.restaurant("Far", lat=47.6, lng=19.05)
    near_offer = world.offer(near, now - timedelta(minutes=30))
    far_offer = world.offer(far, now)  # fresher, but ~11 km away
    student = world.user("Cold")

    with_location = [o for o in _recs_full(app, client, student) if o["id"] in (near_offer, far_offer)]
    assert [o["id"] for o in with_location] == [near_offer, far_offer]
    assert "proximity" in with_location[0]["reco_reasons"]

    without_location = [o for o in _recs_full(app, client, student, query="")
                        if o["id"] in (near_offer, far_offer)]
    assert [o["id"] for o in without_location] == [far_offer, near_offer]  # freshness decides, not a fake position
    assert all("proximity" not in o["reco_reasons"] for o in without_location)


def test_hybrid_recommends_visited_restaurant_but_never_the_claimed_offer(app, client, world):
    from app.services.qr_service import offer_cutoff_utc
    old = offer_cutoff_utc() - timedelta(hours=1)
    r1, r2 = world.restaurant("Fav"), world.restaurant("Other")
    student = world.user("Regular")
    for _ in range(2):
        world.claim(student, world.offer(r1, old), "validated")  # history at R1 (expired offers)
    now = datetime.utcnow()
    claimed, other_r1, r2_offer = world.offer(r1, now), world.offer(r1, now), world.offer(r2, now)
    world.claim(student, claimed, "pending")

    recs = {o["id"]: o for o in _recs_full(app, client, student)}
    assert claimed not in recs
    assert other_r1 in recs and "restaurant_affinity" in recs[other_r1]["reco_reasons"]
    ids = list(recs)
    assert r2_offer not in ids or ids.index(other_r1) < ids.index(r2_offer)


def test_hybrid_never_returns_expired_sold_out_cancelled_or_suspended_offers(app, client, world):
    from app.extensions import db
    from app.services.qr_service import offer_cutoff_utc
    now = datetime.utcnow()
    ok_r, susp_r = world.restaurant("Ok"), world.restaurant("Susp")
    valid = world.offer(ok_r, now)
    invalid = {
        world.offer(ok_r, offer_cutoff_utc() - timedelta(minutes=1)),        # expired (yesterday)
        world.offer(ok_r, now, quantity=0, status="sold_out"),
        world.offer(ok_r, now, quantity=0),                                   # active but no stock
        world.offer(ok_r, now, status="cancelled"),
        world.offer(susp_r, now),
    }
    with app.app_context():
        db.session.execute(text("UPDATE users SET verification_status = 'suspended' WHERE id = :i"),
                           {"i": world.owners[susp_r]})
        db.session.commit()
    new_user, regular = world.user("New"), world.user("Hist")
    world.claim(regular, world.offer(susp_r, offer_cutoff_utc() - timedelta(hours=1)), "validated")

    for student in (new_user, regular):
        for query in ("?lat=47.5&lng=19.05", ""):
            ids = {o["id"] for o in _recs_full(app, client, student, query)}
            assert valid in ids
            assert not invalid & ids


def test_hybrid_diversifies_restaurants_and_returns_claimable_offers(app, client, world):
    now = datetime.utcnow()
    busy, quiet = world.restaurant("Busy"), world.restaurant("Quiet")
    busy_offers = [world.offer(busy, now - timedelta(seconds=i)) for i in range(3)]
    quiet_offer = world.offer(quiet, now - timedelta(minutes=20))
    student = world.user("Diverse")

    recs = [o for o in _recs_full(app, client, student) if o["id"] in set(busy_offers) | {quiet_offer}]
    assert [o["id"] for o in recs][:2] == [busy_offers[0], quiet_offer]  # one per restaurant first
    for o in recs:  # backward-compatible shape + additive, bounded score
        assert {"id", "restaurant", "title", "type", "lat", "lng", "distance", "is_recommended", "location"} <= set(o)
        assert 0 <= o["reco_score"] <= 1 and isinstance(o["reco_reasons"], list)

    token = jwt.encode({"user_id": student, "role": "student", "type": "access",
                        "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
                       app.config["JWT_SECRET_KEY"], algorithm="HS256")
    for o in recs:  # only this test's own offers are claimed
        res = client.post("/api/offers/claim", json={"offer_id": o["id"]}, headers=auth(token))
        assert res.status_code == 201, res.get_json()
    assert not {o["id"] for o in recs} & {o["id"] for o in _recs_full(app, client, student)}
