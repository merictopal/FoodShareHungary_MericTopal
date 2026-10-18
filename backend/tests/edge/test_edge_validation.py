"""
Edge: input validation and upload hardening (Fix 2).

Read-only like the rest of the gate: every request here must be rejected BEFORE anything is stored.
The `no_side_effects` fixture turns commits, storage uploads and offer notifications into loud failures,
so a regression can never write to the real users the token fixtures point at.
"""
import io

import pytest

from helpers import LEAK_MARKERS, auth

pytestmark = pytest.mark.edge

JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
WEBP = b"RIFF\x00\x00\x00\x00WEBPVP8 " + b"\x00" * 64
HTML = b"<html><script>alert(1)</script></html>"
MB = 1024 * 1024


class SideEffect(Exception):
    pass


@pytest.fixture()
def no_side_effects(monkeypatch):
    from app.extensions import db
    from app.services.storage_service import StorageService
    from app.services.notification_service import NotificationService

    def boom(*args, **kwargs):
        raise SideEffect("a rejected request must not write anything")

    monkeypatch.setattr(db.session, "commit", boom)
    monkeypatch.setattr(StorageService, "upload_file", staticmethod(boom))
    monkeypatch.setattr(NotificationService, "notify_students_new_offer", staticmethod(boom))


@pytest.fixture()
def captured_upload(monkeypatch):
    """Records what a validated upload would store, then fails it (so nothing is stored or committed)."""
    from app.services.storage_service import StorageService
    calls = []

    def fake_upload(file_obj, folder='general', private=False, extension=None, content_type=None):
        calls.append({"folder": folder, "private": private, "extension": extension, "content_type": content_type})
        return {"success": False, "message": "upload disabled in tests"}

    monkeypatch.setattr(StorageService, "upload_file", staticmethod(fake_upload))
    return calls


def _no_leak(res):
    body = res.get_data(as_text=True)
    assert not any(marker in body for marker in LEAK_MARKERS), body


def _file(data, name):
    return {"file": (io.BytesIO(data), name)}


# --- REGISTRATION ---

@pytest.mark.parametrize("payload, fragment", [
    ({"email": "not-an-email", "password": "Valid123"}, "valid email"),
    ({"email": "a b@fs-test.local", "password": "Valid123"}, "valid email"),
    ({"email": "short-pw@fs-test.local", "password": "12345"}, "at least 6"),
    ({"email": "no-pw@fs-test.local"}, "at least 6"),
])
def test_register_rejects_invalid_email_or_short_password(client, no_side_effects, payload, fragment):
    res = client.post("/api/auth/register", json={"name": "[TEST] x", "role": "user", **payload})
    assert res.status_code == 400
    assert fragment in res.get_json()["message"]
    _no_leak(res)


def test_register_rejects_case_variant_of_existing_email(app, client, no_side_effects, admin):
    from app.models import User
    with app.app_context():
        existing = User.query.get(admin[0]).email
    res = client.post("/api/auth/register", json={"name": "[TEST] x", "role": "user",
                                                  "email": f"  {existing.upper()} ", "password": "Valid123"})
    assert res.status_code == 409
    assert "already in use" in res.get_json()["message"]


# --- PASSWORD / PROFILE UPDATE ---

@pytest.mark.parametrize("payload", [
    {"password": "NewPass123"},                                   # no current password
    {"password": "NewPass123", "current_password": "definitely-wrong"},
    {"email": "not-an-email"},
])
def test_profile_update_rejects_without_current_password_or_bad_email(client, mint_token, student, no_side_effects, payload):
    res = client.put("/api/auth/update", json=payload, headers=auth(mint_token(*student)))
    assert res.status_code == 400
    _no_leak(res)


# --- OFFER CREATION ---

@pytest.mark.parametrize("payload", [
    {"type": "free", "quantity": 0},
    {"type": "free", "quantity": -5},
    {"type": "free", "quantity": "abc"},
    {"type": "free", "quantity": 1.5},
    {"type": "free", "quantity": 10 ** 12},
    {"type": "discount", "quantity": 1, "discount_rate": 101},
    {"type": "discount", "quantity": 1, "discount_rate": -1},
    {"type": "discount", "quantity": 1, "discount_rate": "x"},
    {"type": "xyz", "quantity": 1},
    {"quantity": 1},
    {"type": "free", "quantity": 1, "title": "x" * 101},
    {"type": "free", "quantity": 1, "description": None},
])
def test_create_offer_rejects_invalid_input_with_400(client, mint_token, verified_restaurant, no_side_effects, payload):
    body = {"title": "[TEST] x", "description": "[TEST] x", **payload}
    if body.get("description") is None:
        body.pop("description")
    res = client.post("/api/offers/create", json=body, headers=auth(mint_token(*verified_restaurant)))
    assert res.status_code == 400, res.get_json()
    assert res.get_json()["success"] is False
    _no_leak(res)


# --- UPLOADS ---

@pytest.mark.parametrize("path", ["/api/upload/user-avatar", "/api/upload/user-document", "/api/upload/student-id"])
def test_upload_rejects_non_image_content(client, mint_token, student, no_side_effects, path):
    res = client.post(path, data=_file(HTML, "x.html"), headers=auth(mint_token(*student)))
    assert res.status_code == 400
    _no_leak(res)


def test_upload_rejects_image_extension_with_html_content(client, mint_token, student, no_side_effects):
    res = client.post("/api/upload/user-avatar", data=_file(HTML, "avatar.jpg"), headers=auth(mint_token(*student)))
    assert res.status_code == 400


def test_public_image_over_5mb_is_413(client, mint_token, student, no_side_effects):
    res = client.post("/api/upload/user-avatar", data=_file(JPEG + b"\x00" * (5 * MB), "a.jpg"),
                      headers=auth(mint_token(*student)))
    assert res.status_code == 413
    assert res.get_json()["success"] is False


def test_document_over_10mb_is_413(client, mint_token, student, no_side_effects):
    res = client.post("/api/upload/user-document", data=_file(JPEG + b"\x00" * (10 * MB), "d.jpg"),
                      headers=auth(mint_token(*student)))
    assert res.status_code == 413


def test_request_over_global_cap_is_json_413(client, mint_token, student, no_side_effects):
    res = client.post("/api/upload/user-document", data=_file(JPEG + b"\x00" * (12 * MB), "d.jpg"),
                      headers=auth(mint_token(*student)))
    assert res.status_code == 413
    assert res.get_json()["success"] is False


@pytest.mark.parametrize("data, name, ext, ctype", [
    (JPEG, "evil.html", "jpg", "image/jpeg"),
    (PNG, "photo.jpg", "png", "image/png"),
    (WEBP, "noext", "webp", "image/webp"),
])
def test_avatar_storage_type_comes_from_content_not_client(client, mint_token, student, captured_upload, data, name, ext, ctype):
    res = client.post("/api/upload/user-avatar", data=_file(data, name), headers=auth(mint_token(*student)))
    assert captured_upload == [{"folder": "avatars", "private": False, "extension": ext, "content_type": ctype}]
    assert res.status_code == 500  # the fake storage refuses; nothing was stored
    _no_leak(res)


def test_document_between_5_and_10mb_reaches_private_storage(client, mint_token, student, captured_upload):
    res = client.post("/api/upload/user-document", data={**_file(JPEG + b"\x00" * (6 * MB), "d.jpg"),
                                                         "document_type": "student"},
                      headers=auth(mint_token(*student)))
    assert captured_upload == [{"folder": "id_documents", "private": True, "extension": "jpg", "content_type": "image/jpeg"}]
    assert res.status_code == 500
    _no_leak(res)


@pytest.mark.parametrize("path", ["/api/upload/user-document", "/api/upload/student-id"])
def test_documents_are_student_only(client, mint_token, verified_restaurant, admin, no_side_effects, path):
    for who in (verified_restaurant, admin):
        res = client.post(path, data=_file(JPEG, "d.jpg"), headers=auth(mint_token(*who)))
        assert res.status_code == 403, (who, res.get_json())
