"""
Edge: Fix 8 group A (remaining P3 findings). Read-only: every request is rejected before anything is written;
commits are turned into failures as a safety net.
"""
import pytest

from helpers import LEAK_MARKERS, auth

pytestmark = pytest.mark.edge


@pytest.fixture()
def no_commit(monkeypatch):
    from app.extensions import db

    def boom(*args, **kwargs):
        raise AssertionError("a rejected request must not commit")

    monkeypatch.setattr(db.session, "commit", boom)


def _json_error(res, status):
    assert res.status_code == status
    assert res.is_json, res.get_data(as_text=True)[:200]
    body = res.get_json()
    assert body["success"] is False and body["message"]
    assert not any(m in res.get_data(as_text=True) for m in LEAK_MARKERS)


# --- 1. JSON errors instead of HTML ---

def test_non_json_body_is_json_415(client):
    _json_error(client.post("/api/auth/login", data="email=x", content_type="text/plain"), 415)


def test_malformed_json_is_json_400(client):
    _json_error(client.post("/api/auth/login", data="{not json", content_type="application/json"), 400)


def test_wrong_method_is_json_405(client):
    _json_error(client.delete("/api/leaderboard"), 405)


# --- 3. Non-numeric ids ---

@pytest.mark.parametrize("path, key", [
    ("/api/admin/approve", "user_id"),
    ("/api/admin/reject", "user_id"),
    ("/api/admin/suspend", "user_id"),
    ("/api/admin/offer/cancel", "offer_id"),
])
@pytest.mark.parametrize("value", ["abc", None, -1, 0, 1.5, True])
def test_admin_actions_reject_non_numeric_ids(client, mint_token, admin, no_commit, path, key, value):
    _json_error(client.post(path, json={key: value}, headers=auth(mint_token(*admin))), 400)


@pytest.mark.parametrize("value", ["abc", None, -1, "1 OR 1=1"])
def test_claim_rejects_non_numeric_offer_id(client, mint_token, student, no_commit, value):
    _json_error(client.post("/api/offers/claim", json={"offer_id": value}, headers=auth(mint_token(*student))), 400)


# --- 4. Coordinates ---

@pytest.mark.parametrize("query", ["lat=999&lng=999", "lat=91&lng=0", "lat=0&lng=-181", "lat=nan&lng=0"])
def test_offers_rejects_out_of_range_coordinates(client, query):
    _json_error(client.get(f"/api/offers?{query}"), 400)


@pytest.mark.parametrize("query", ["lat=abc&lng=19", "lat=999&lng=19"])
def test_recommendations_reject_bad_coordinates(client, mint_token, student, query):
    _json_error(client.get(f"/api/recommendations/{student[0]}?{query}", headers=auth(mint_token(*student))), 400)


# --- 5. No hard-coded pickup label ---

def test_offer_to_dict_has_no_hardcoded_pickup_label(app):
    from app.models.offer import Offer
    with app.app_context():
        offer = Offer.query.filter(Offer.pickup_start.is_(None)).first()
        if offer is None:
            pytest.skip("no offer without pickup times in the dev DB")
        assert offer.to_dict()["pickup_window"] is None


# --- 9. Token of a deleted / unknown account ---

def test_token_of_missing_account_is_401(client, mint_token):
    res = client.get("/api/notifications", headers=auth(mint_token(2_000_000_000, "student")))
    _json_error(res, 401)
