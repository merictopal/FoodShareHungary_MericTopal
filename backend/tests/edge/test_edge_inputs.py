"""Edge: hostile / malformed input on read-only endpoints (Dimensions 1, 2, 4 of the edge-case-hunting skill)."""
import pytest

from helpers import LEAK_MARKERS, auth

pytestmark = pytest.mark.edge


def _assert_no_leak(res):
    text = res.get_data(as_text=True)
    for marker in LEAK_MARKERS:
        assert marker not in text, f"error body leaks internals ({marker!r}): {text[:200]}"


@pytest.mark.parametrize("query", [
    "lat=0&lng=0",
    "lat=90&lng=180",
    "lat=-90&lng=-180",
    "lat=47.4979",            # lng missing -> default
    "",                       # both missing -> defaults
])
def test_offers_accepts_boundary_coordinates(client, query):
    res = client.get(f"/api/offers?{query}")
    assert res.status_code == 200
    assert isinstance(res.get_json(), list)


@pytest.mark.parametrize("query", ["lat=abc&lng=19", "lat=&lng=", "lat=' OR 1=1 --&lng=19"])
def test_offers_rejects_non_numeric_coordinates_cleanly(client, query):
    res = client.get(f"/api/offers?{query}")
    assert res.status_code == 400
    _assert_no_leak(res)


def test_protected_int_route_with_non_int_id_is_404(client, mint_token, admin):
    res = client.get("/api/auth/me/not-a-number", headers=auth(mint_token(*admin)))
    assert res.status_code == 404
    assert res.get_json()["success"] is False


def test_recommendations_with_non_int_id_does_not_500(client, mint_token, student):
    res = client.get("/api/recommendations/abc", headers=auth(mint_token(*student)))
    assert res.status_code < 500
    _assert_no_leak(res)


def test_admin_stats_for_missing_user_does_not_500(client, mint_token, admin):
    res = client.get("/api/admin/user/2000000000/stats", headers=auth(mint_token(*admin)))
    assert res.status_code < 500
    _assert_no_leak(res)
