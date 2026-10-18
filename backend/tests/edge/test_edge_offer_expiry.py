"""
Edge: same-day offer expiry (Fix 5). Read-only: the cutoff helper is pure; the listing checks compare the
API output against existing rows (e.g. real offers created on earlier days must no longer be listed).
"""
from datetime import datetime, timezone

import pytest
from sqlalchemy import text

from helpers import auth

pytestmark = pytest.mark.edge


@pytest.mark.parametrize("now_utc, expected_cutoff_utc", [
    # Winter time (CET, UTC+1)
    ("2026-01-15T10:00", "2026-01-14T23:00"),
    # Summer time (CEST, UTC+2)
    ("2026-07-15T10:00", "2026-07-14T22:00"),
    # 00:30 Budapest = already the new day; 23:59 Budapest = still the previous day
    ("2026-07-14T22:30", "2026-07-14T22:00"),
    ("2026-07-14T21:59", "2026-07-13T22:00"),
    # DST start (29 Mar 2026, 02:00 -> 03:00): that day's midnight was still CET
    ("2026-03-29T12:00", "2026-03-28T23:00"),
    # DST end (25 Oct 2026, 03:00 -> 02:00): that day's midnight was still CEST
    ("2026-10-25T12:00", "2026-10-24T22:00"),
    # Day after DST end: CET again
    ("2026-10-26T06:00", "2026-10-25T23:00"),
])
def test_cutoff_is_budapest_midnight_in_utc(now_utc, expected_cutoff_utc):
    from app.services.qr_service import offer_cutoff_utc
    now = datetime.fromisoformat(now_utc).replace(tzinfo=timezone.utc)
    assert offer_cutoff_utc(now) == datetime.fromisoformat(expected_cutoff_utc)


def _expired_active_offer_ids(app):
    from app.extensions import db
    from app.services.qr_service import offer_cutoff_utc
    with app.app_context():
        return {r[0] for r in db.session.execute(
            text("SELECT id FROM offers WHERE status = 'active' AND quantity > 0 AND created_at < :c"),
            {"c": offer_cutoff_utc()})}


def test_offers_list_contains_no_expired_offer(app, client):
    expired = _expired_active_offer_ids(app)
    listed = {o["id"] for o in client.get("/api/offers?lat=47.5&lng=19.04").get_json()}
    assert not (expired & listed)


def test_recommendations_contain_no_expired_offer(app, client, mint_token, student):
    expired = _expired_active_offer_ids(app)
    res = client.get(f"/api/recommendations/{student[0]}", headers=auth(mint_token(*student)))
    assert res.status_code == 200
    assert not (expired & {o["id"] for o in res.get_json()})


def test_my_offers_contain_no_expired_offer(app, client, mint_token, verified_restaurant):
    expired = _expired_active_offer_ids(app)
    res = client.get("/api/offers/my-offers", headers=auth(mint_token(*verified_restaurant)))
    assert res.status_code == 200
    assert not (expired & {o["id"] for o in res.get_json()["offers"]})
