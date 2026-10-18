"""
Writes (opt-in): notify_students_new_offer end to end for each role (Fix 11).

NOT part of the gate (marker `writes`, skipped unless FS_ALLOW_WRITES=1). Runs inside one transaction that is
always rolled back (commit is turned into flush), so neither the [TEST] users nor any notification row - including
rows for real students - is ever persisted. FCM sending is replaced by a recorder: no push is sent.
"""
import os
import uuid

import pytest
from sqlalchemy import text

pytestmark = [
    pytest.mark.writes,
    pytest.mark.skipif(os.environ.get("FS_ALLOW_WRITES") != "1", reason="set FS_ALLOW_WRITES=1 to run write tests"),
]


def test_new_offer_notifies_student_and_user_roles_only(app, monkeypatch):
    from app.extensions import db
    from app.models import User
    from app.services.notification_service import NotificationService

    pushed = []
    monkeypatch.setattr(NotificationService, "send_push_notification",
                        staticmethod(lambda fcm_token, title, body, data_payload=None: pushed.append(fcm_token) or True))
    tag = uuid.uuid4().hex[:8]
    with app.app_context():
        monkeypatch.setattr(db.session, "commit", db.session.flush)
        try:
            users = {}
            for role in ("user", "student", "restaurant", "admin"):
                u = User(name=f"[TEST] Notify {role}", email=f"notify-{role}-{tag}@fs-test.local", role=role,
                         verification_status="verified", fcm_token=f"TEST-TOKEN-{role}-{tag}")
                u.password = "Valid123!"
                db.session.add(u)
                users[role] = u
            db.session.flush()

            NotificationService.notify_students_new_offer({"title": "[TEST] Soup", "restaurant_name": "[TEST] Bistro"})

            notified = {r[0] for r in db.session.execute(
                text("SELECT user_id FROM notifications WHERE message LIKE '%[TEST] Soup%'"))}
            assert users["user"].id in notified          # app-registered student (the bug)
            assert users["student"].id in notified       # Google-registered student (unchanged)
            assert users["restaurant"].id not in notified and users["admin"].id not in notified
            assert f"TEST-TOKEN-user-{tag}" in pushed and f"TEST-TOKEN-student-{tag}" in pushed
            assert f"TEST-TOKEN-restaurant-{tag}" not in pushed and f"TEST-TOKEN-admin-{tag}" not in pushed
            # Content unchanged
            row = db.session.execute(text("SELECT title, message FROM notifications WHERE user_id = :u"),
                                     {"u": users["user"].id}).first()
            assert row == ("📣 New Offer from [TEST] Bistro!", "Check out the new [TEST] Soup available now.")
        finally:
            db.session.rollback()
