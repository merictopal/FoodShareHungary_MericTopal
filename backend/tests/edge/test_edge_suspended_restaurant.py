"""Edge (read-only): no student-facing listing returns an offer of a suspended restaurant (M2)."""
import pytest
from sqlalchemy import text

from helpers import auth

pytestmark = pytest.mark.edge


def _suspended_offer_ids(app):
    from app.extensions import db
    with app.app_context():
        return set(db.session.execute(text(
            "SELECT o.id FROM offers o JOIN restaurant_profiles r ON r.id = o.restaurant_id "
            "JOIN users u ON u.id = r.owner_user_id WHERE u.verification_status = 'suspended'")).scalars())


def test_offer_listing_hides_suspended_restaurants(app, client):
    listed = {o["id"] for o in client.get("/api/offers?lat=47.4979&lng=19.0402").get_json()}
    assert not listed & _suspended_offer_ids(app)


def test_recommendations_hide_suspended_restaurants(app, client, mint_token, student):
    res = client.get(f"/api/recommendations/{student[0]}", headers=auth(mint_token(*student)))
    assert res.status_code == 200
    assert not {o["id"] for o in res.get_json()} & _suspended_offer_ids(app)
