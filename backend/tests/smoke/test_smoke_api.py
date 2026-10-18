"""Smoke: does the app boot and do the core, read-only endpoints answer with the expected shape?"""
from collections import Counter

import pytest

from helpers import PROTECTED_ROUTES, auth

pytestmark = pytest.mark.smoke


def test_app_boots_and_registers_blueprints(app):
    rules = {r.rule for r in app.url_map.iter_rules()}
    for prefix in ("/api/auth/", "/api/admin/", "/api/upload/", "/api/offers"):
        assert any(r.startswith(prefix) for r in rules), f"no routes under {prefix}"


def test_unknown_endpoint_returns_json_404(client):
    res = client.get("/api/definitely-not-a-route")
    assert res.status_code == 404
    body = res.get_json()
    assert body["success"] is False
    assert body["error"] == "Not Found"


def test_public_offers_list_shape(client):
    res = client.get("/api/offers?lat=47.4979&lng=19.0402")
    assert res.status_code == 200
    offers = res.get_json()
    assert isinstance(offers, list)
    for offer in offers[:5]:
        for key in ("id", "restaurant", "type", "quantity", "distance", "lat", "lng"):
            assert key in offer, f"offer missing '{key}'"
        assert offer["quantity"] > 0


def test_public_offers_sorted_by_distance(client):
    offers = client.get("/api/offers?lat=47.4979&lng=19.0402").get_json()
    distances = [o["distance"] for o in offers]
    assert distances == sorted(distances)


def test_public_offers_carry_pickup_location(client):
    # The Home map groups markers by restaurant_id and the card / "Open in Google Maps" use address + lat/lng.
    offers = client.get("/api/offers?lat=47.4979&lng=19.0402").get_json()
    for offer in offers[:5]:
        assert isinstance(offer["restaurant_id"], int)
        assert "address" in offer


def test_student_history_carries_pickup_location(client, mint_token, student):
    res = client.get(f"/api/student/history/{student[0]}", headers=auth(mint_token(*student)))
    assert res.status_code == 200
    for item in res.get_json()["history"][:5]:
        assert {"restaurant_name", "restaurant_address", "lat", "lng"} <= item.keys()


def test_public_leaderboard_shape(client):
    res = client.get("/api/leaderboard")
    assert res.status_code == 200
    rows = res.get_json()
    assert isinstance(rows, list)
    for row in rows:
        assert {"restaurant", "points", "meals"} <= row.keys()


@pytest.mark.parametrize("method,path", PROTECTED_ROUTES)
def test_protected_routes_reject_anonymous(client, method, path):
    res = client.open(path, method=method)
    assert res.status_code == 401, f"{method} {path} answered {res.status_code} without a token"


def test_student_can_read_own_profile(client, mint_token, student):
    user_id, role = student
    res = client.get(f"/api/auth/me/{user_id}", headers=auth(mint_token(user_id, role)))
    assert res.status_code == 200
    assert res.get_json()["success"] is True


def test_fcm_unlink_with_foreign_token_is_200_noop(app, client, mint_token, student):
    # Read-only: a token that is not the stored one matches no row, so nothing (not even an audit row) is written
    from app.models import User
    user_id, role = student
    with app.app_context():
        before = User.query.get(user_id).fcm_token
    res = client.delete("/api/auth/fcm-token", json={"fcm_token": "fs-test-not-a-real-device-token"},
                        headers=auth(mint_token(user_id, role)))
    assert res.status_code == 200
    assert res.get_json()["success"] is True
    with app.app_context():
        assert User.query.get(user_id).fcm_token == before


def test_student_can_list_own_notifications(client, mint_token, student):
    user_id, role = student
    res = client.get("/api/notifications", headers=auth(mint_token(user_id, role)))
    assert res.status_code == 200
    body = res.get_json()
    assert body["success"] is True
    items = body["notifications"]
    assert isinstance(items, list)
    for item in items:
        assert {"id", "title", "message", "is_read", "date"} <= item.keys()
    # Newest first (ids are assigned in insertion order)
    ids = [n["id"] for n in items]
    assert ids == sorted(ids, reverse=True)


def test_admin_can_read_stats(client, mint_token, admin):
    user_id, role = admin
    res = client.get("/api/admin/stats", headers=auth(mint_token(user_id, role)))
    assert res.status_code == 200


@pytest.mark.xfail(reason="KNOWN BUG: GET /api/leaderboard is registered by both student_bp and "
                          "restaurant_bp; restaurant_routes.get_leaderboard (top 10 + rank) is unreachable.")
def test_no_duplicate_url_rules(app):
    counts = Counter(
        (rule.rule, method)
        for rule in app.url_map.iter_rules()
        for method in rule.methods - {"HEAD", "OPTIONS"}
    )
    duplicates = [key for key, n in counts.items() if n > 1]
    assert duplicates == []


def test_reset_password_endpoint_answers_with_error_shape(client):
    res = client.post("/api/auth/reset-password",
                      json={"email": "smoke-reset@fs-test.local", "code": "000000", "new_password": "secret123"})
    assert res.status_code == 400
    body = res.get_json()
    assert body["success"] is False and body["error"] and body["message"]
