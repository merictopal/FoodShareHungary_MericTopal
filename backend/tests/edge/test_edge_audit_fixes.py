"""
Edge (read-only): regressions for the 2026-10-08 code audit (F2-F12, see
thesis_evidence/2026-10-08/AUDIT_FINDINGS_PRE_FIX.md). Nothing here writes to the DB: audit logging is patched
out where a rejected request would record a row, and Google's token verifier is stubbed (no network).
"""
from datetime import datetime
from unittest.mock import patch

import pytest

from helpers import auth

pytestmark = pytest.mark.edge

GOOGLE_VERIFY = 'app.services.auth_service.id_token.verify_oauth2_token'
NO_AUDIT = 'app.services.auth_service.AuthService.log_audit'


def _google_identity(email, verified=True):
    return {'email': email, 'email_verified': verified, 'name': '[TEST] Google', 'picture': ''}


# --- F3: Google sign-in without a configured client id ---
def test_google_login_refused_when_client_id_missing(client, monkeypatch):
    monkeypatch.delenv('GOOGLE_WEB_CLIENT_ID', raising=False)
    with patch(GOOGLE_VERIFY) as verify:
        res = client.post('/api/auth/google', json={'token': 'any-google-token'})
    assert res.status_code == 503
    assert res.get_json()['success'] is False
    verify.assert_not_called()  # no token is accepted without an audience to check against


def test_google_login_passes_the_configured_client_id_as_audience(client, monkeypatch):
    monkeypatch.setenv('GOOGLE_WEB_CLIENT_ID', 'expected-client-id')
    with patch(GOOGLE_VERIFY, side_effect=ValueError('wrong audience')) as verify:
        res = client.post('/api/auth/google', json={'token': 'token-for-another-app'})
    assert verify.call_args.args[2] == 'expected-client-id'
    assert res.status_code == 401


# --- F2: unverified Google e-mail ---
@pytest.mark.parametrize('verified', [False, None, 'true'])
def test_google_identity_without_verified_email_is_rejected(client, monkeypatch, app, verified):
    from app.models import User

    monkeypatch.setenv('GOOGLE_WEB_CLIENT_ID', 'expected-client-id')
    with app.app_context():
        existing = User.query.order_by(User.id).first()  # an existing account must not be reachable this way
    identity = _google_identity(existing.email, verified)
    with patch(GOOGLE_VERIFY, return_value=identity), patch(NO_AUDIT):
        res = client.post('/api/auth/google', json={'token': 'stub'})
    body = res.get_json()
    assert res.status_code == 401
    assert body['error'] == 'Invalid Credentials'
    assert 'token' not in body and 'refresh_token' not in body


def test_google_identity_without_email_is_rejected(client, monkeypatch):
    monkeypatch.setenv('GOOGLE_WEB_CLIENT_ID', 'expected-client-id')
    with patch(GOOGLE_VERIFY, return_value={'email_verified': True}), patch(NO_AUDIT):
        res = client.post('/api/auth/google', json={'token': 'stub'})
    assert res.status_code == 401


# --- F4 / F13: the one access rule (pure, no DB) ---
@pytest.mark.parametrize('role,status,expected', [
    ('restaurant', 'verified', None),
    ('restaurant', 'pending', 'Account Pending'),
    ('restaurant', 'unverified', 'Application Rejected'),   # set by /admin/reject
    ('restaurant', 'suspended', 'Account Suspended'),
    ('student', 'unverified', None),
    ('student', 'verified', None),
    ('student', 'suspended', 'Account Suspended'),
    ('user', 'suspended', 'Account Suspended'),
    ('admin', 'suspended', None),                           # admins can't be locked out
])
def test_account_block_rule(role, status, expected):
    from app.models import User
    from app.utils.decorators import account_block

    block = account_block(User(role=role, verification_status=status))
    assert (block[1] if block else None) == expected
    if block:
        assert block[0] == 403


# --- F5: forgot-password does not reveal unknown e-mails (existing ones: writes suite) ---
def test_forgot_password_unknown_email_gets_the_generic_answer(client):
    from app.services.auth_service import FORGOT_PASSWORD_MESSAGE

    res = client.post('/api/auth/forgot-password', json={'email': 'nobody-audit@fs-test.local'})
    assert res.status_code == 200
    assert res.get_json() == {'success': True, 'message': FORGOT_PASSWORD_MESSAGE, 'status': 200}


# --- F10: no placeholder position on the server ---
def test_offers_without_position_have_no_distance(client):
    offers = client.get('/api/offers').get_json()
    assert isinstance(offers, list)
    assert all(o['distance'] is None for o in offers)


def test_offers_with_position_have_distances(client):
    offers = client.get('/api/offers?lat=46.0727&lng=18.2323').get_json()
    assert all(isinstance(o['distance'], (int, float)) for o in offers)


def test_offers_with_only_one_coordinate_are_treated_as_unknown_position(client):
    offers = client.get('/api/offers?lat=47.4979').get_json()
    assert all(o['distance'] is None for o in offers)


@pytest.mark.parametrize('query,expected_location', [
    ('', (None, None)),                                   # app without a device fix sends nothing
    ('?lat=47.4979', (None, None)),                       # incomplete -> unknown, not a default city
    ('?lat=46.0727&lng=18.2323', (46.0727, 18.2323)),     # real request-time position is passed through
    ('?lat=41.0082&lng=28.9784', (41.0082, 28.9784)),
])
def test_recommendations_use_only_request_coordinates(client, mint_token, student, query, expected_location):
    with patch('app.routes.student_routes.RecommendationService.get_recommended_offers', return_value=[]) as rec:
        res = client.get(f'/api/recommendations/{student[0]}{query}', headers=auth(mint_token(*student)))
    assert res.status_code == 200
    kwargs = rec.call_args.kwargs
    assert (kwargs['user_lat'], kwargs['user_lng']) == expected_location


def test_recommendations_without_position_report_no_distance(client, mint_token, student):
    fake = [{'id': 1, 'type': 'free', 'location': {'lat': 47.5, 'lng': 19.05}}]
    with patch('app.routes.student_routes.RecommendationService.get_recommended_offers', return_value=fake):
        no_pos = client.get(f'/api/recommendations/{student[0]}', headers=auth(mint_token(*student))).get_json()
        with_pos = client.get(f'/api/recommendations/{student[0]}?lat=47.5&lng=19.05',
                              headers=auth(mint_token(*student))).get_json()
    assert no_pos[0]['distance'] is None
    assert with_pos[0]['distance'] == 0.0


def test_recommendations_reject_invalid_coordinates(client, mint_token, student):
    res = client.get(f'/api/recommendations/{student[0]}?lat=abc&lng=19', headers=auth(mint_token(*student)))
    assert res.status_code == 400


# --- F11: claim history time zone ---
@pytest.mark.parametrize('utc,expected', [
    (datetime(2026, 10, 8, 19, 49), '08.10.2026 21:49'),   # CEST, UTC+2 (observed on the emulator)
    (datetime(2026, 1, 15, 23, 30), '16.01.2026 00:30'),   # CET, UTC+1, crosses midnight
])
def test_local_time_text_uses_budapest_time(utc, expected):
    from app.services.qr_service import local_time_text

    assert local_time_text(utc, '%d.%m.%Y %H:%M') == expected


# --- F7: suspended students get no new-offer notifications ---
def test_new_offer_recipients_exclude_suspended_accounts(app):
    from app.services.notification_service import NotificationService
    from app.utils.constants import STUDENT_ROLES

    with app.app_context():
        recipients = NotificationService.new_offer_recipients()
        assert all(u.role in STUDENT_ROLES for u in recipients)
        assert all(u.verification_status != 'suspended' for u in recipients)


# --- F8: admin "active offers" = what students can see ---
def test_admin_active_offers_matches_the_student_listing(client, mint_token, admin):
    stats = client.get('/api/admin/stats', headers=auth(mint_token(*admin))).get_json()['data']
    listed = client.get('/api/offers').get_json()
    assert stats['active_offers'] == len(listed)


# --- F9: admin stats/offers routes without the stale user_id branches ---
def test_admin_restaurant_stats_and_offers_answer(client, mint_token, admin, verified_restaurant):
    headers = auth(mint_token(*admin))
    stats = client.get(f'/api/admin/user/{verified_restaurant[0]}/stats', headers=headers)
    assert stats.status_code == 200
    data = stats.get_json()['data']
    assert data['role'] == 'restaurant'
    assert isinstance(data['offers_created'], int) and isinstance(data['total_portions'], int)
    offers = client.get('/api/admin/offers', headers=headers)
    assert offers.status_code == 200
    assert all(o['restaurant_name'] for o in offers.get_json()['data'])


# --- F12: development server options ---
@pytest.mark.parametrize('debug_config,env,expected', [
    (True, {}, {'host': '127.0.0.1', 'port': 5000, 'debug': True}),                  # local development
    (True, {'BACKEND_HOST': '0.0.0.0'}, {'host': '0.0.0.0', 'port': 5000, 'debug': False}),  # LAN: no debugger
    (False, {}, {'host': '127.0.0.1', 'port': 5000, 'debug': False}),                # production config
    (False, {'BACKEND_HOST': '0.0.0.0', 'BACKEND_PORT': '8000'}, {'host': '0.0.0.0', 'port': 8000, 'debug': False}),
])
def test_dev_server_never_exposes_the_debugger(debug_config, env, expected):
    from run import dev_server_options

    assert dev_server_options({'DEBUG': debug_config}, env) == expected


def test_production_config_has_debug_off():
    from config import ProductionConfig

    assert not getattr(ProductionConfig, 'DEBUG', False)
