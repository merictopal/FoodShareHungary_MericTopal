"""
Writes (opt-in): end-to-end regressions for the 2026-10-08 audit fixes (F1, F2, F4-F8, F11, F13).

NOT part of the gate (marker `writes`, skipped unless FS_ALLOW_WRITES=1). Only @fs-test.local / [TEST] rows;
everything created here (users, profiles, offers, claims, notifications, audit rows) is removed in teardown.
Google's token verifier and SMTP are stubbed; new-offer pushes are never triggered (offers are inserted directly).
"""
import os
import uuid
from datetime import datetime, timedelta
from unittest.mock import patch

import pytest
from sqlalchemy import text

from helpers import auth

pytestmark = [
    pytest.mark.writes,
    pytest.mark.skipif(os.environ.get("FS_ALLOW_WRITES") != "1", reason="set FS_ALLOW_WRITES=1 to run write tests"),
]

PASSWORD = "Valid123!"
GOOGLE_VERIFY = 'app.services.auth_service.id_token.verify_oauth2_token'
OPTIONAL_FIELDS = ('phone', 'date_of_birth', 'gender', 'occupation', 'university', 'major', 'study_year', 'avatar_url')


@pytest.fixture()
def world(app, monkeypatch):
    from app.extensions import db
    from app.models import User, RestaurantProfile

    monkeypatch.setenv('GOOGLE_WEB_CLIENT_ID', 'test-client-id')
    tag = uuid.uuid4().hex[:8]
    email = lambda name: f"audit-{name}-{tag}@fs-test.local"
    with app.app_context():
        def user(name, role, status):
            u = User(name=f"[TEST] Audit {name}", email=email(name), role=role, verification_status=status)
            u.password = PASSWORD
            db.session.add(u)
            db.session.flush()
            return u

        restaurants = {status: user(f"rest-{status}", "restaurant", status)
                       for status in ("verified", "pending", "unverified", "suspended")}
        profiles = [RestaurantProfile(owner_user_id=r.id, name=f"[TEST] Audit {s}", lat=47.5, lng=19.05)
                    for s, r in restaurants.items()]
        db.session.add_all(profiles)
        student = user("student", "student", "verified")
        suspended_student = user("suspended-student", "student", "suspended")
        db.session.commit()
        state = {"tag": tag, "email": email, "restaurants": {s: r.id for s, r in restaurants.items()},
                 "student": student.id, "suspended_student": suspended_student.id,
                 "profile_ids": [p.id for p in profiles], "verified_profile": profiles[0].id}

    yield state

    with app.app_context():
        ids = {"u": [r[0] for r in db.session.execute(text("SELECT id FROM users WHERE email LIKE :m"),
                                                      {"m": f"audit-%-{tag}@fs-test.local"})],
               "p": state["profile_ids"]}
        db.session.execute(text("DELETE FROM claims WHERE user_id = ANY(:u) OR offer_id IN "
                                "(SELECT id FROM offers WHERE restaurant_id = ANY(:p))"), ids)
        db.session.execute(text("DELETE FROM offers WHERE restaurant_id = ANY(:p)"), ids)
        db.session.execute(text("DELETE FROM restaurant_profiles WHERE id = ANY(:p)"), ids)
        db.session.execute(text("DELETE FROM notifications WHERE user_id = ANY(:u)"), ids)
        db.session.execute(text("DELETE FROM audit_logs WHERE user_id = ANY(:u) OR details LIKE :m"),
                           {**ids, "m": f"%audit-%-{tag}@fs-test.local%"})
        db.session.execute(text("DELETE FROM users WHERE id = ANY(:u)"), ids)
        db.session.commit()


def _row(app, email):
    from app.models import User
    from app.services.auth_service import find_user_by_email

    with app.app_context():
        u = find_user_by_email(email)
        return None if u is None else {"id": u.id, "role": u.role, "status": u.verification_status,
                                       **{f: getattr(u, f) for f in OPTIONAL_FIELDS}}


def _google(client, email, verified=True):
    identity = {'email': email, 'email_verified': verified, 'name': '[TEST] Audit Google', 'picture': ''}
    with patch(GOOGLE_VERIFY, return_value=identity):
        return client.post('/api/auth/google', json={'token': 'stub'})


def _login(client, email):
    return client.post('/api/auth/login', json={'email': email, 'password': PASSWORD})


# --- F1: one canonical student role, whatever the sign-up path ---
def test_app_registration_and_google_signin_create_the_same_student(client, app, world):
    app_email, google_email, default_email = world["email"]("app"), world["email"]("google"), world["email"]("api")
    res = client.post('/api/auth/register', json={'name': '[TEST] Audit app', 'email': app_email, 'password': PASSWORD,
                                                   'role': 'user', 'phone': '', 'gender': '', 'university': ''})
    assert res.status_code == 201
    assert client.post('/api/auth/register', json={'name': '[TEST] Audit api', 'email': default_email,
                                                    'password': PASSWORD}).status_code == 201
    assert _google(client, google_email).status_code == 200

    app_user, google_user, api_user = _row(app, app_email), _row(app, google_email), _row(app, default_email)
    assert app_user["role"] == google_user["role"] == api_user["role"] == "student"
    assert app_user["status"] == google_user["status"] == "unverified"
    # Empty optional fields are NULL on both paths (were '' for app sign-ups, '' avatar for Google)
    assert all(app_user[f] is None for f in OPTIONAL_FIELDS)
    assert all(google_user[f] is None for f in OPTIONAL_FIELDS)

    # Same login payload and JWT role on both paths
    import jwt as pyjwt
    app_login = _login(client, app_email).get_json()
    google_login = _google(client, google_email).get_json()
    assert app_login['user']['role'] == google_login['user']['role'] == 'student'
    assert sorted(app_login['user']) == sorted(google_login['user'])
    for body in (app_login, google_login):
        assert pyjwt.decode(body['token'], options={'verify_signature': False})['role'] == 'student'


def test_google_signin_reuses_an_existing_app_account(client, app, world):
    email = world["email"]("student")
    res = _google(client, email)
    assert res.status_code == 200
    assert res.get_json()['user']['id'] == world["student"]
    with app.app_context():
        from app.extensions import db
        assert db.session.execute(text("SELECT count(*) FROM users WHERE lower(email) = :e"), {"e": email}).scalar() == 1


def test_admin_role_still_cannot_be_registered(client, app, world):
    email = world["email"]("admin-try")
    assert client.post('/api/auth/register', json={'name': 'x', 'email': email, 'password': PASSWORD,
                                                   'role': 'admin'}).status_code == 400
    assert _row(app, email) is None


# --- F2: unverified Google e-mail cannot reach an existing account ---
def test_unverified_google_email_cannot_sign_in_to_existing_account(client, world):
    res = _google(client, world["email"]("student"), verified=False)
    assert res.status_code == 401
    assert 'token' not in res.get_json()


def test_unverified_google_email_creates_no_account(client, app, world):
    email = world["email"]("unverified-google")
    assert _google(client, email, verified=False).status_code == 401
    assert _row(app, email) is None


# --- F4: one restaurant access rule for password login, Google login and refresh ---
@pytest.mark.parametrize('status,expected_status,expected_error', [
    ("verified", 200, None),
    ("pending", 403, "Account Pending"),
    ("unverified", 403, "Application Rejected"),
    ("suspended", 403, "Account Suspended"),
])
def test_restaurant_access_rule_is_the_same_for_both_login_paths(client, world, status, expected_status, expected_error):
    email = world["email"](f"rest-{status}")
    for res in (_login(client, email), _google(client, email)):
        body = res.get_json()
        assert res.status_code == expected_status, body
        assert body.get('error') == expected_error
        assert ('token' in body) == (expected_status == 200)


def test_refresh_follows_the_same_rule_after_a_rejection(client, app, world):
    from app.extensions import db

    email = world["email"]("rest-verified")
    refresh_token = _login(client, email).get_json()['refresh_token']
    with app.app_context():
        db.session.execute(text("UPDATE users SET verification_status = 'unverified' WHERE id = :i"),
                           {"i": world["restaurants"]["verified"]})
        db.session.commit()
    res = client.post('/api/auth/refresh', json={'refresh_token': refresh_token})
    assert res.status_code == 403
    assert res.get_json()['error'] == 'Application Rejected'


# --- F13: rejected restaurant -> re-application -> pending -> approved ---
def test_rejected_restaurant_can_reapply(client, app, world, mint_token):
    from app.models import User

    rest_id, email = world["restaurants"]["verified"], world["email"]("rest-verified")
    with app.app_context():
        admin_id = User.query.filter_by(role='admin').order_by(User.id).first().id
    admin_headers = auth(mint_token(admin_id, 'admin'))

    assert client.post('/api/admin/reject', json={'user_id': rest_id}, headers=admin_headers).status_code == 200
    assert _login(client, email).get_json()['error'] == 'Application Rejected'

    wrong = client.post('/api/auth/restaurant/reapply', json={'email': email, 'password': 'wrong-password'})
    assert wrong.status_code == 401 and _row(app, email)["status"] == "unverified"

    ok = client.post('/api/auth/restaurant/reapply', json={'email': email, 'password': PASSWORD})
    assert ok.status_code == 200
    assert _row(app, email)["status"] == "pending"
    pending = client.get('/api/admin/pending', headers=admin_headers).get_json()['data']
    assert rest_id in {p['user_id'] for p in pending}
    assert _login(client, email).get_json()['error'] == 'Account Pending'

    # A pending application can't be "re-applied" again
    again = client.post('/api/auth/restaurant/reapply', json={'email': email, 'password': PASSWORD})
    assert again.status_code == 409

    assert client.post('/api/admin/approve', json={'user_id': rest_id}, headers=admin_headers).status_code == 200
    assert _login(client, email).status_code == 200


@pytest.mark.parametrize('who', ["student", "rest-suspended", "rest-pending"])
def test_only_rejected_restaurants_can_reapply(client, app, world, who):
    email = world["email"](who)
    before = _row(app, email)["status"]
    res = client.post('/api/auth/restaurant/reapply', json={'email': email, 'password': PASSWORD})
    assert res.status_code == 409
    assert _row(app, email)["status"] == before


# --- F5: forgot-password answers identically, the reset code still works ---
def test_forgot_password_does_not_reveal_registered_emails(client, app, world):
    email = world["email"]("student")
    with patch('app.services.auth_service.smtplib.SMTP'):
        known = client.post('/api/auth/forgot-password', json={'email': email})
    unknown = client.post('/api/auth/forgot-password', json={'email': world["email"]("nobody")})
    with patch('app.services.auth_service.smtplib.SMTP', side_effect=OSError('smtp down')):
        failing = client.post('/api/auth/forgot-password', json={'email': email})
    assert known.status_code == unknown.status_code == failing.status_code == 200
    assert known.get_json() == unknown.get_json() == failing.get_json()


def test_reset_code_rules_are_unchanged(client, app, world):
    from app.extensions import db
    from app.models import User

    email = world["email"]("student")
    sent = {}

    class FakeSMTP:
        def __init__(self, *a): pass
        def starttls(self): pass
        def login(self, *a): pass
        def quit(self): pass
        def send_message(self, msg):
            import re
            sent['code'] = re.search(r'letter-spacing: 5px;">(\d{6})<', msg.get_payload()[0].get_payload()).group(1)

    with patch('app.services.auth_service.smtplib.SMTP', FakeSMTP), \
            patch.dict(os.environ, {'SMTP_EMAIL': 'x@fs-test.local', 'SMTP_APP_PASSWORD': 'x'}):
        client.post('/api/auth/forgot-password', json={'email': email})
    with app.app_context():
        stored = User.query.get(world["student"])
        assert stored.reset_code_hash and sent['code'] not in stored.reset_code_hash  # hashed, never plain
    new_password = "NewValid456!"
    ok = client.post('/api/auth/reset-password', json={'email': email, 'code': sent['code'], 'new_password': new_password})
    assert ok.status_code == 200
    reuse = client.post('/api/auth/reset-password', json={'email': email, 'code': sent['code'], 'new_password': 'Other789!'})
    assert reuse.status_code == 400  # single use
    assert client.post('/api/auth/login', json={'email': email, 'password': new_password}).status_code == 200


# --- F6: e-mail change needs the current password ---
def test_email_change_requires_current_password(client, app, world, mint_token):
    headers = auth(mint_token(world["student"], 'student'))
    old_email, new_email = world["email"]("student"), world["email"]("student-new")

    stolen = client.put('/api/auth/update', json={'email': new_email}, headers=headers)
    assert stolen.status_code == 400
    wrong = client.put('/api/auth/update', json={'email': new_email, 'current_password': 'nope'}, headers=headers)
    assert wrong.status_code == 400
    assert _row(app, old_email) is not None and _row(app, new_email) is None

    # Unchanged e-mail (e.g. a profile form re-sending it) needs no password; name changes still work
    same = client.put('/api/auth/update', json={'email': old_email.upper(), 'name': '[TEST] Audit renamed'}, headers=headers)
    assert same.status_code == 200

    ok = client.put('/api/auth/update', json={'email': new_email, 'current_password': PASSWORD}, headers=headers)
    assert ok.status_code == 200
    assert _row(app, new_email)["id"] == world["student"]


# --- F7 / F8 / F11 ---
def test_suspended_student_gets_no_new_offer_notification(app, world):
    from app.services.notification_service import NotificationService

    with app.app_context():
        recipients = {u.id for u in NotificationService.new_offer_recipients()}
    assert world["student"] in recipients
    assert world["suspended_student"] not in recipients


def test_admin_active_offer_count_ignores_expired_offers(client, app, world, mint_token):
    from app.extensions import db
    from app.models import User
    from app.models.offer import Offer
    from app.services.qr_service import offer_cutoff_utc

    with app.app_context():
        admin_id = User.query.filter_by(role='admin').order_by(User.id).first().id
    headers = auth(mint_token(admin_id, 'admin'))
    before = client.get('/api/admin/stats', headers=headers).get_json()['data']['active_offers']
    with app.app_context():
        db.session.add_all([
            Offer(restaurant_id=world["verified_profile"], title="[TEST] live", description="[TEST]", type="free",
                  original_quantity=1, quantity=1, status="active"),
            Offer(restaurant_id=world["verified_profile"], title="[TEST] expired", description="[TEST]", type="free",
                  original_quantity=1, quantity=1, status="active", created_at=offer_cutoff_utc() - timedelta(hours=1)),
        ])
        db.session.commit()
    after = client.get('/api/admin/stats', headers=headers).get_json()['data']['active_offers']
    assert after == before + 1


def test_history_shows_budapest_time(client, app, world, mint_token):
    from app.extensions import db
    from app.models.offer import Offer, Claim

    with app.app_context():
        offer = Offer(restaurant_id=world["verified_profile"], title="[TEST] tz", description="[TEST]", type="free",
                      original_quantity=1, quantity=1, status="active")
        db.session.add(offer)
        db.session.flush()
        db.session.add(Claim(user_id=world["student"], offer_id=offer.id, qr_code=f"TEST-TZ-{world['tag']}",
                             status="pending", created_at=datetime(2026, 10, 8, 19, 49)))
        db.session.commit()
    history = client.get(f"/api/student/history/{world['student']}",
                         headers=auth(mint_token(world["student"], 'student'))).get_json()['history']
    assert history[0]['date'] == '08.10.2026 21:49'
