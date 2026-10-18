"""Edge: pickup-location fields used by the mobile Home map card and "Open in Google Maps" (read-only)."""
import pytest

from helpers import auth

pytestmark = pytest.mark.edge


def _offers(client):
    return client.get("/api/offers?lat=47.4979&lng=19.0402").get_json()


def test_offers_of_one_restaurant_share_one_location(client):
    # The mobile app draws ONE marker per restaurant_id from the first offer's coordinates:
    # every offer of that restaurant must report identical lat/lng/address/name.
    seen = {}
    for offer in _offers(client):
        loc = (offer["restaurant"], offer["lat"], offer["lng"], offer["address"])
        assert seen.setdefault(offer["restaurant_id"], loc) == loc


def test_offer_address_is_string_or_null(client):
    # NULL addresses must reach the client as null (the app then falls back to coordinates), never crash.
    for offer in _offers(client):
        assert offer["address"] is None or isinstance(offer["address"], str)
        assert isinstance(offer["lat"], (int, float)) and isinstance(offer["lng"], (int, float))


def test_history_pickup_fields_are_typed(client, mint_token, student):
    for item in client.get(f"/api/student/history/{student[0]}", headers=auth(mint_token(*student))).get_json()["history"]:
        assert item["restaurant_address"] is None or isinstance(item["restaurant_address"], str)
        assert item["lat"] is None or isinstance(item["lat"], (int, float))
        assert item["lng"] is None or isinstance(item["lng"], (int, float))
