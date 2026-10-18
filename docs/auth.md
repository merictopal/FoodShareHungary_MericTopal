# Auth (JWT, roles, sessions)

Short reference for Claude sessions. Canonical status: `PROJECT_STATE.md`. Checked against the code on 2026-09-30.

## Purpose
Registration (email or Google), login, dual-token JWT sessions, and role/ownership checks for every protected route.

## Files
- `backend/app/services/auth_service.py`: `AuthService.register_user`, `login_user`, `refresh_access_token`, `google_login`,
  `update_profile`, `update_fcm_token`, `send_forgot_password_email`, `log_audit`, `parse_coordinates`
- `backend/app/routes/auth_routes.py`: `/api/auth/{register,login,refresh,update,fcm-token,me/<int:id>,google,forgot-password}`
- `backend/app/utils/decorators.py`: `is_account_suspended(user)` (single definition of the account lock), `role_required` and the wrappers `admin_required`, `restaurant_required`,
  `student_required` (student + user) and `token_required` (any role)
- `backend/config.py`, `backend/app/__init__.py`: `JWT_SECRET_KEY` (startup refuses without it), limiter, CORS, JSON 404/429/500 handlers
- Mobile: `FoodShareMobile/src/api/client.ts` (interceptors, silent refresh, `setSessionExpiredHandler`), `src/context/AuthContext.tsx`
- Admin: `admin-dashboard/src/api/client.ts` (`clearAdminSession`, `hasAdminSession`), `src/App.tsx` (`RequireAdmin`), `src/pages/Login.tsx`

## Workflow
1. `login` checks the password hash. It returns an **access** token (15 min, `{user_id, role, type:'access'}`) and a
   **refresh** token (7 days, `{user_id, type:'refresh'}`), both HS256.
2. `role_required` does the following, in order:
   - requires a Bearer token, else 401
   - rejects refresh tokens (401)
   - reloads the user from the DB; a missing user gets **404**
   - blocks a **suspended** non-admin account (403 `Account Suspended`)
   - checks the role from the DB, never from the token claim (403)
   - blocks a restaurant whose status is not `verified` (403)
   - sets `g.user`
3. Clients refresh once on a 401. Parallel 401s wait in a queue. A permanent refresh failure (400/401/403/404) clears storage
   and returns to login. Public auth URLs (login/register/google/forgot) never trigger a refresh.
4. `google`: verifies the Google ID token (audience = `GOOGLE_WEB_CLIENT_ID`; refused with 503 if unset), requires `email_verified is True`
   (401 otherwise), creates a `student` (`unverified`) account on first login, applies the same `account_block` rule as password login
   to existing accounts, and issues the same token pair.

## Tables
`users` (`role`, `verification_status`, `password_hash`, `fcm_token`, `xp`, `level`) · `audit_logs` (`user_id` nullable, `action`, `details`, `ip_address`, `timestamp`).

## Rules
- Self-registration is limited to roles `student`, `user` and `restaurant` (→ 400 otherwise); `user` is stored as `student` (since 2026-10-08,
  so app and Google sign-ups get the same role; old `user` rows keep working via `STUDENT_ROLES`). Restaurants start `pending`; everyone else starts `unverified`.
- Identity comes from `g.user.id`. Routes that take a `user_id` compare it with `g.user.id` unless the caller is an admin (IDOR).
- Rate limits are in-memory: `200/day` and `50/hour` per IP globally, and `5/minute` on the whole auth blueprint.
- Audit actions: `REGISTER_*`, `LOGIN_SUCCESS/FAILED/DENIED`, `LOGIN_GOOGLE_SUCCESS`, `TOKEN_REFRESHED`, `FCM_TOKEN_LINKED`, `PROFILE_UPDATED`, `PASSWORD_RESET_REQUESTED`.

## Account suspension (fix 20, 2026-09-30)
- `is_account_suspended(user)` = `verification_status == 'suspended' and role != 'admin'`. It's enforced in four places:
  - `login_user`, after the password check: 403 plus audit `LOGIN_DENIED` "Account suspended."; a wrong password still returns 401
  - `google_login` for an existing user: 403, no tokens
  - `refresh_access_token`: 403, so no new access tokens
  - `role_required`: already-issued access tokens → 403
- Applies to students, users and restaurants. Admins are exempt, and `POST /api/admin/suspend` refuses admin targets (400), so no admin can be locked out.
- Mobile: the login alert shows the backend message. An already-open session gets 403s until the access token expires (≤15 min); then the refresh
  gets 403 and `isPermanentRefreshFailure` returns the app to login.
- No unsuspend action. Suspending overwrites the previous status (the approve endpoint only serves the pending list).

## Decisions
- No default JWT key in the source (fix 8). The old fallback was the live key.
- Mobile stores tokens before `setUser`, because setting the user triggers the FCM sync (fix 2).
- The admin login page rejects non-admin roles on the client side; the backend enforces `admin_required` independently.

## Known limitations
- No server-side revocation or logout endpoint. Copied tokens stay valid until they expire.
- The FCM token is not cleared on logout (see `notifications.md`).
- A still-valid access token for a deleted user returns 404, not 401.
- `PUT /api/auth/update`: an email change to an address that's already used has no pre-check. The unique constraint fails on commit and
  the result is a generic 500 "System error." instead of a 409. A password change doesn't require the old password.
- Forgot password e-mails a 6-digit code that is never stored, and there is no reset endpoint. Information disclosure: an unknown email returns
  200 (anti-enumeration), but a registered email returns 500 when SMTP fails or isn't configured. The response therefore reveals whether an account exists.
- Error shape: `role_required` returns `{error, message}` with no `"success": false`, unlike the CLAUDE.md contract (only the new
  `Account Suspended` response includes it). `config.SECRET_KEY`
  has a hard-coded fallback (not used for JWT). `JWT_EXPIRATION_HOURS=24` is unused (the real lifetimes are hard-coded in `auth_service.py`).
- Auth service/routes don't leak `str(e)` (errors are only printed). For the leak locations in other areas, see `thesis.md` → limitations.

## Evidence
Fixes 1, 2, 6, 8, 10 and 11 in `PROJECT_STATE.md` §3. Tests: `backend/tests/edge/test_edge_auth.py` (malformed, expired, wrong-secret and
refresh-as-access tokens, role claim not trusted, IDOR on profile/history/recommendations, the `is_account_suspended` truth table). Manual Google login on 2026-09-29 (audit rows 367/368).
Fix 20 live test (2026-09-30), TESTED + DATABASE VERIFIED:
- suspended student, user and restaurant: login 403 ×3, old access token 403 ×3, old refresh token 403 ×3
- active accounts 200; admin 27 is usable, and suspending an admin → 400
- mobile alert `s01_suspended_user_login.png`
Google-login suspension path: IMPLEMENTED, NOT TESTED (it needs a real Google account).

## Thesis
Chapters 7–10: token refresh and session design, RBAC/IDOR, no revocation (PROJECT_STATE §9).

## Audit fixes 2026-10-08 (IMPLEMENTED, TESTED)
- One access rule `account_block(user)` (`utils/decorators.py`) for password login, Google login, refresh and `role_required`:
  suspended non-admin → 403 `Account Suspended`; restaurant `pending` → 403 `Account Pending`; restaurant `unverified`
  (= rejected by `/admin/reject`) → 403 `Application Rejected`; otherwise allowed. Token issuing is shared (`_access_token`, `_refresh_token`).
- `POST /api/auth/restaurant/reapply` {email, password}: rejected restaurant → `pending` (401 wrong credentials, 409 if not rejected);
  the mobile login alert offers "Apply again".
- Forgot password: one public answer for registered, unknown and SMTP-failure cases (no enumeration); code rules unchanged.
- `PUT /api/auth/update`: changing the e-mail needs `current_password` (like a password change).
- Tests: `tests/edge/test_edge_audit_fixes.py`, `tests/writes/test_audit_fix_flows.py`. Report: `thesis_evidence/2026-10-08/AUDIT_REPORT_FINAL.md`.
