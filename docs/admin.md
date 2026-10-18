# Admin dashboard and admin API

Admin session handling is in `auth.md`; document links and rejection in `documents.md`.

## Purpose
A web panel where an admin verifies accounts, suspends users, cancels offers and reads audit logs and statistics.

## Files
- `backend/app/routes/admin_routes.py` (all routes `admin_required` except `document-file`):
  - `GET /stats` · `GET /pending` · `POST /approve` · `POST /reject` · `GET /users` · `POST /suspend`
  - `GET /user/<int:id>/stats` · `GET /offers` · `POST /offer/cancel` · `GET /audit-logs` (latest 200)
- `admin-dashboard/src/pages/`: `Login`, `Dashboard`, `PendingDocs`, `Users`, `Restaurants`, `Offers`, `AuditLogs`
- `admin-dashboard/src/api/client.ts` (base `http://127.0.0.1:5000/api`), `src/App.tsx` (`RequireAdmin` guard)

## Workflow
- Pending list: users with `verification_status='pending'` (students **and** restaurants), each with a 5-min document link.
- Approve → `verified`. Reject → `unverified` plus the document is deleted. Suspend → `suspended` (admin targets refused with 400). Cancel offer → `status='cancelled'`.
- Suspension effect (fix 20, see `auth.md`): suspended **student, user and restaurant** accounts are blocked at login (403), at refresh (403)
  and on every protected route (already-issued tokens → 403). Admin accounts can't be suspended.

## Rules
- The backend enforces the admin role on every route. The page-level role check and `RequireAdmin` are UX only.
- The admin dashboard is English-only (project convention).

## Known limitations
- Approve, reject, suspend and offer-cancel **write no `audit_logs` row**. The audit log only holds auth events (see `auth.md`).
- Suspension limitations:
  - there is no unsuspend action
  - suspending overwrites the previous verification status (verified/unverified is lost)
  - an already-open session may keep getting 403 responses until its access token expires (≤15 min); then the refresh fails and the app returns to login
- `str(e)` leaks in `message` from stats, pending, approve, reject, users, suspend, `user/<id>/stats` ("Server Error: …"), offers and
  offer/cancel. Not from audit-logs or document-file. `POST /approve` with no `user_id` → a generic 500 (sanitised handler).
- The header "Welcome, Super Admin" is hard-coded. The "meals claimed" stat counts pending claims too.
- Duplicated types (`SystemUser`, `PendingUser`, `SortConfig`) across pages; see promote-shared-code debts.

## Evidence
Fix 11 (logout clears storage; repeated wrong logins don't hang). Manual read-only admin session on 2026-09-29 at 14:50 (values matched the DB; only audit row 364 was added).
Edge tests: `test_student_cannot_reach_admin_routes`, `test_admin_can_read_other_profiles`, `test_admin_stats_for_missing_user_does_not_500`.

## Thesis
Admin/verification workflow and data visualisation section. Distinguish the author's manual test from automated checks.
