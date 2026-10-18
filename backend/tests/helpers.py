"""Plain helpers shared by more than one test module (fixtures live in conftest.py)."""


def auth(token):
    return {"Authorization": f"Bearer {token}"}


# Every route that must reject anonymous callers, as (method, path).
# Keep in sync with app/routes/*: when you add a protected route, add it here.
PROTECTED_ROUTES = [
    ("GET", "/api/admin/stats"),
    ("GET", "/api/admin/pending"),
    ("POST", "/api/admin/approve"),
    ("POST", "/api/admin/reject"),
    ("GET", "/api/admin/users"),
    ("POST", "/api/admin/suspend"),
    ("GET", "/api/admin/user/1/stats"),
    ("GET", "/api/admin/offers"),
    ("POST", "/api/admin/offer/cancel"),
    ("GET", "/api/admin/audit-logs"),
    ("PUT", "/api/auth/update"),
    ("POST", "/api/auth/fcm-token"),
    ("DELETE", "/api/auth/fcm-token"),
    ("GET", "/api/auth/me/1"),
    ("DELETE", "/api/auth/account"),
    ("GET", "/api/offers/my-offers"),
    ("DELETE", "/api/offers/delete/1"),
    ("POST", "/api/offers/create"),
    ("POST", "/api/claims/verify"),
    ("GET", "/api/restaurant/location"),
    ("PUT", "/api/restaurant/location"),
    ("GET", "/api/recommendations/1"),
    ("POST", "/api/offers/claim"),
    ("GET", "/api/student/history/1"),
    ("GET", "/api/notifications"),
    ("POST", "/api/notifications/read"),
    ("POST", "/api/upload/student-id"),
    ("POST", "/api/upload/offer-image"),
    ("POST", "/api/upload/restaurant-profile"),
    ("POST", "/api/upload/user-document"),
    ("POST", "/api/upload/user-avatar"),
]

ADMIN_ONLY_GET_ROUTES = [path for method, path in PROTECTED_ROUTES if method == "GET" and path.startswith("/api/admin/")]

# Strings that must never appear in an error body sent to clients.
LEAK_MARKERS = ("Traceback", "psycopg2", "sqlalchemy", "could not convert", "ST_", "File \"")
