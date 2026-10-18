"""
Edge: new-offer notification recipients (Fix 11). Read-only: only SELECTs the recipient list.
App registration creates role 'user', Google sign-in creates 'student'; both must be notified.
"""
import pytest
from sqlalchemy import text

pytestmark = pytest.mark.edge


def test_recipients_are_exactly_the_student_roles(app):
    from app.extensions import db
    from app.services.notification_service import NotificationService
    with app.app_context():
        recipients = NotificationService.new_offer_recipients()
        expected = {r[0] for r in db.session.execute(text("SELECT id FROM users WHERE role IN ('student', 'user')"))}
        assert {u.id for u in recipients} == expected
        assert {u.role for u in recipients} <= {"student", "user"}


def test_app_registered_role_user_is_a_recipient(app):
    from app.extensions import db
    from app.services.notification_service import NotificationService
    with app.app_context():
        user_ids = {r[0] for r in db.session.execute(text("SELECT id FROM users WHERE role = 'user'"))}
        if not user_ids:
            pytest.skip("no role='user' account in the dev DB")
        assert user_ids <= {u.id for u in NotificationService.new_offer_recipients()}
