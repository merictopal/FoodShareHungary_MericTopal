"""
Writes (opt-in): positive paths of the Fix 2 validation rules.

NOT part of the gate (marker `writes`, skipped unless FS_ALLOW_WRITES=1). Rows use `@fs-test.local` / "[TEST]"
and are removed in teardown. AWS keys are switched off, so uploads use the local fallback (no S3 writes);
stored files are deleted in teardown. Offer notifications are patched out (no rows/pushes for real students).
"""
import io
import os
import uuid

import jwt
import pytest
from datetime import datetime, timedelta, timezone
from sqlalchemy import text

from helpers import auth

pytestmark = [
    pytest.mark.writes,
    pytest.mark.skipif(os.environ.get("FS_ALLOW_WRITES") != "1", reason="set FS_ALLOW_WRITES=1 to run write tests"),
]

PASSWORD = "Valid123!"
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


@pytest.fixture()
def world(app, monkeypatch):
    from app.extensions import db
    from app.models import User, RestaurantProfile
    from app.services.notification_service import NotificationService

    monkeypatch.setitem(app.config, "AWS_ACCESS_KEY_ID", None)
    monkeypatch.setitem(app.config, "AWS_SECRET_ACCESS_KEY", None)
    monkeypatch.setattr(NotificationService, "notify_students_new_offer", staticmethod(lambda data: 0))

    tag = uuid.uuid4().hex[:8]
    state = {"tag": tag, "files": [], "emails": [f"fix2-{tag}@fs-test.local", f"fix2-r-{tag}@fs-test.local"]}
    with app.app_context():
        rest = User(name="[TEST] Fix2 R", email=state["emails"][1], role="restaurant", verification_status="verified")
        rest.password = PASSWORD
        db.session.add(rest)
        db.session.flush()
        db.session.add(RestaurantProfile(owner_user_id=rest.id, name="[TEST] Fix2 Bistro", lat=47.5, lng=19.05))
        db.session.commit()
        state["rest_id"] = rest.id

    yield state

    with app.app_context():
        ids = [r[0] for r in db.session.execute(text("SELECT id FROM users WHERE lower(email) = ANY(:e)"),
                                                {"e": state["emails"]})]
        db.session.execute(text("DELETE FROM claims WHERE offer_id IN (SELECT o.id FROM offers o JOIN restaurant_profiles p "
                                "ON p.id = o.restaurant_id WHERE p.owner_user_id = ANY(:i))"), {"i": ids})
        db.session.execute(text("DELETE FROM offers WHERE restaurant_id IN (SELECT id FROM restaurant_profiles "
                                "WHERE owner_user_id = ANY(:i))"), {"i": ids})
        db.session.execute(text("DELETE FROM restaurant_profiles WHERE owner_user_id = ANY(:i)"), {"i": ids})
        db.session.execute(text("DELETE FROM audit_logs WHERE user_id = ANY(:i) OR details LIKE :m"),
                           {"i": ids, "m": f"%fix2-%{tag}@fs-test.local%"})
        db.session.execute(text("DELETE FROM users WHERE id = ANY(:i)"), {"i": ids})
        db.session.commit()
        for path in state["files"]:
            if os.path.isfile(path):
                os.remove(path)


def _token(app, user_id, role):
    return jwt.encode({"user_id": user_id, "role": role, "type": "access",
                       "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
                      app.config["JWT_SECRET_KEY"], algorithm="HS256")


def _local_path(app, url):
    from app.services.storage_service import StorageService
    if url.startswith(StorageService.LOCAL_PRIVATE_PREFIX):
        return os.path.join(os.path.dirname(app.root_path), "private_uploads", url[len(StorageService.LOCAL_PRIVATE_PREFIX):])
    return os.path.join(app.root_path, "static", "uploads", url.split("/static/uploads/", 1)[1])


def test_email_normalisation_and_password_update(app, client, world):
    mixed = f"  Fix2-{world['tag']}@FS-Test.LOCAL "
    res = client.post("/api/auth/register", json={"name": "[TEST] Fix2", "email": mixed, "password": PASSWORD, "role": "user"})
    assert res.status_code == 201, res.get_json()
    user_id = res.get_json()["user_id"]
    with app.app_context():
        from app.models import User
        assert User.query.get(user_id).email == world["emails"][0]

    assert client.post("/api/auth/register", json={"name": "x", "email": world["emails"][0], "password": PASSWORD,
                                                   "role": "user"}).status_code == 409
    for variant in (world["emails"][0], world["emails"][0].upper()):
        assert client.post("/api/auth/login", json={"email": variant, "password": PASSWORD}).status_code == 200

    headers = auth(_token(app, user_id, "user"))
    assert client.put("/api/auth/update", json={"password": "abc", "current_password": PASSWORD}, headers=headers).status_code == 400
    res = client.put("/api/auth/update", json={"password": "NewValid456", "current_password": PASSWORD}, headers=headers)
    assert res.status_code == 200, res.get_json()
    assert client.post("/api/auth/login", json={"email": world["emails"][0], "password": PASSWORD}).status_code == 401
    assert client.post("/api/auth/login", json={"email": world["emails"][0], "password": "NewValid456"}).status_code == 200
    # Name-only updates still need no password
    assert client.put("/api/auth/update", json={"name": "[TEST] Fix2 renamed"}, headers=headers).status_code == 200


def test_valid_uploads_are_stored_with_detected_type(app, client, world):
    res = client.post("/api/auth/register", json={"name": "[TEST] Fix2", "email": world["emails"][0], "password": PASSWORD, "role": "user"})
    user_id = res.get_json()["user_id"]
    headers = auth(_token(app, user_id, "user"))

    res = client.post("/api/upload/user-avatar", data={"file": (io.BytesIO(PNG), "evil.html")}, headers=headers)
    assert res.status_code == 200, res.get_json()
    url = res.get_json()["url"]
    world["files"].append(_local_path(app, url))
    assert url.endswith(".png")
    served = client.get("/static/uploads/" + url.split("/static/uploads/", 1)[1])
    assert served.status_code == 200 and served.headers["Content-Type"] == "image/png"

    res = client.post("/api/upload/user-document", data={"file": (io.BytesIO(JPEG), "id.jpg"), "document_type": "student"},
                      headers=headers)
    assert res.status_code == 200, res.get_json()
    doc = res.get_json()["file_url"]
    world["files"].append(_local_path(app, doc))
    assert doc.startswith("local-private://id_documents/") and doc.endswith(".jpg")
    with app.app_context():
        from app.models import User
        assert User.query.get(user_id).verification_status == "pending"


@pytest.mark.parametrize("payload", [
    {"type": "free", "quantity": 1},
    {"type": "free", "quantity": "3"},
    {"type": "discount", "quantity": 2, "discount_rate": 0},
    {"type": "discount", "quantity": 2, "discount_rate": 100},
    {"type": "Discount", "quantity": 1, "discount_rate": "20"},
])
def test_valid_offers_are_still_accepted(app, client, world, payload):
    res = client.post("/api/offers/create", json={"title": "[TEST] Fix2 meal", "description": "[TEST] Fix2 meal", **payload},
                      headers=auth(_token(app, world["rest_id"], "restaurant")))
    assert res.status_code == 201, res.get_json()
