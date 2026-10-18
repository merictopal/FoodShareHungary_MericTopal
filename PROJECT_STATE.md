# FoodShare Hungary — Project State (canonical)

Single source of truth for the current technical state, verified evidence and open issues.
Last updated: **2026-10-08** (code audit F1–F13, §4b). Earlier: 2026-10-07 (final evidence after Fixes 1–11, §4a; open issues §7/§8 updated). Previous: 2026-09-30 (final test-data cleanup of DB + S3; fixes 19 notification inbox and 20 universal suspension, tested). Supersedes every report in
`thesis_evidence/2026-09-29/archive/` wherever they differ. BSc Computer Science Engineering thesis project
(supervisor feedback by Peter Novak drives the thesis revision; the thesis itself has **not** been edited yet).

Status vocabulary (never mix): **IMPLEMENTED** = in code · **TESTED** = executed and observed · **DATABASE VERIFIED** ·
**AWS VERIFIED** · **OBSERVED** · **NOT TESTED** · **NOT IMPLEMENTED** · **REQUIRES CONFIRMATION**.

---

## 1. System at a glance

| Part | Stack | Notes |
|---|---|---|
| `backend/` | Flask 3.0, SQLAlchemy 2.0, PostgreSQL 16.11 + PostGIS 3.6.1, PyJWT, Flask-Limiter, boto3, firebase-admin, google-auth, pandas/scikit-learn | one instance on port 5000; global limit 50 req/h per IP, auth blueprint 5/min (in-memory) |
| `FoodShareMobile/` | React Native 0.83.4, React 19.2, TypeScript | `API_URL=http://10.0.2.2:5000/api` (Android emulator) |
| `admin-dashboard/` | React 19 + Vite + Tailwind | API `http://127.0.0.1:5000/api`, dev server `localhost:5173` |
| Storage | AWS S3 `foodshare-hungary-storage` (eu-north-1) | local private fallback `backend/private_uploads/` when AWS keys are absent |
| Push | Firebase Cloud Messaging | in-app alert when the app is in the foreground |

Development-stage MVP; **no production deployment**. Tested on: Android Emulator `Pixel_7` (Android 13 / API 33, x86_64,
Google Play image), Windows 11 host, laptop webcam mapped to the emulator camera (`webcam0`). **iOS and physical Android: NOT TESTED.**

## 2. Running it

```
cd backend && flask run --host 0.0.0.0 --port 5000     # needs JWT_SECRET_KEY in backend/.env (startup refuses without it)
cd FoodShareMobile && npx react-native start           # Metro
cd FoodShareMobile && npx react-native run-android
npm --prefix admin-dashboard run dev                    # http://localhost:5173
```
Windows: set `PYTHONIOENCODING=utf-8` when redirecting backend output (emoji prints crash cp1254 consoles).
Only **one** backend may listen on 5000. Migrations are plain SQL in `backend/migrations/` (no migration tool) – see §5.

## 3. What was fixed on 2026-09-29 (all IMPLEMENTED and TESTED)

| # | Area | Root cause | Fix (files) | Key evidence |
|---|---|---|---|---|
| 1 | Invalid mobile login showed "No refresh token available" | Axios interceptor treated the login 401 as an expired session and rejected with a synthetic error | public auth endpoints skip refresh; no refresh token → original 401 (`FoodShareMobile/src/api/client.ts`) | 401 → "Invalid email or password." (emulator) |
| 2 | Token/user ordering at login | `setUser` fired the FCM request before tokens were stored | store tokens first (`src/context/AuthContext.tsx`) | login → `fcm-token 200` with no refresh between (incl. Google) |
| 3 | Double QR verification under concurrency | read–check–write, no lock | atomic `UPDATE claims SET status='validated' WHERE id=… AND status='pending'`; XP/leaderboard SQL increments (`backend/app/services/qr_service.py`) | before: 5 × 200 and +125 XP in each of 5 recorded trials (trials 6–12 recorded no responses, so they're not evidence); after: 1 × 200 / 7 × 400 in 12/12 trials |
| 4 | Overselling | quantity checked in Python | conditional `UPDATE offers SET quantity=quantity-1 … WHERE status='active' AND quantity>0` | before: 5 claims for qty 1; after: exactly 1 (5 runs) |
| 5 | Workflow endpoints unauthenticated / IDOR | no decorators, `user_id` from request | JWT + role + ownership; identity from `g.user.id`; restaurant may verify only own claims; verified-student check for claiming (`student_routes.py`, `restaurant_routes.py`, `upload_routes.py`) | 401/403 matrix, cross-restaurant 403 |
| 6 | Admin self-registration | role taken from request | whitelist `student`/`user`/`restaurant` (`auth_service.py`) | `role: admin` → 400, no row |
| 7 | Identity documents exposed | uploads unauthenticated; local files under `static/`; raw URLs to admins | own-account uploads; local docs in `private_uploads/`; admins get 5-min S3 pre-signed / signed local links (`storage_service.py`, `admin_routes.py`) | tampered/expired/traversal links 403 |
| 8 | Default JWT key | source-code fallback was the live key | key only from `.env`, startup refuses without (`config.py`, `app/__init__.py`) | token forged with old key → 401 |
| 9 | Recommendation order lost | `IN (…) LIMIT n` without ORDER BY | sort by CF score (`recommendation_service.py`) | order = score order 4/8 → 8/8 users |
| 10 | Session expiry kept app open | refresh failure cleared storage but not React state | `setSessionExpiredHandler` → user null → login screen; `HomeScreen` mounted guard stops late timers (`client.ts`, `AuthContext.tsx`, `HomeScreen.tsx`) | invalid refresh → login screen, 0 further requests |
| 11 | Admin logout kept tokens; login hang | logout only navigated; no route guard; `isRefreshing` stuck on 2nd wrong password | `clearAdminSession`, `RequireAdmin` guard, login excluded from refresh (`admin-dashboard/src/…`) | storage empty after logout; repeated wrong logins OK |
| 12 | Same student could claim an offer repeatedly | no rule (thesis §2.3 requires "prevents duplicate claims") | 409 check after the offer row lock + DB `UNIQUE(user_id, offer_id)` (`qr_service.py`, `models/offer.py`) | 10 parallel duplicates → 1 claim; raw INSERT → UniqueViolation |
| 13 | Duplicate new-offer notifications, "A Local Restaurant" | notifier called by service **and** route; wrong lookup key | single call; use `restaurant_name` (`restaurant_routes.py`, `notification_service.py`) | 16 → 8 rows for 8 students; correct title |
| 14 | Rejected documents kept in storage | reject only cleared the DB | `StorageService.delete_document` after commit (S3 / local-private / legacy static; folder allow-list) | object deleted (S3 404), DB cleared |
| 15 | `document_type` never saved | column existed in DB, missing in model | model column + validation `student/pensioner/social` | stored; dashboard shows "+65 Age Card" / "Social Support Card" |
| 16 | Leaderboard could get duplicate rows | SELECT-then-INSERT | `UNIQUE(restaurant_id)` + `INSERT … ON CONFLICT DO UPDATE` (`qr_service.py`, `models/stats.py`) | 4 concurrent first scores → 1 row, 80/4 |
| 17 | PostGIS unused, address dropped | `geom` never written; placeholder coords; no location entry | `geom` synced by model event; `GET/PUT /api/restaurant/location`; registration saves address + optional lat/lng; dashboard "Use my current location" card; GiST index (`models/user.py`, `auth_service.py`, `restaurant_routes.py`, `DashboardScreen.tsx`) | nearest offer first (1.89 km); PostGIS = app formula (0.00 km diff) |
| 18 | S3 bucket public | policy `PublicReadGetObject` on `/*` | policy limited to `offer_images/`, `restaurant_profiles/`, `avatars/` (AWS change, applied with approval) | document raw URL 200 → 403; images 200 |

**Fixed on 2026-09-30 (IMPLEMENTED and TESTED, see §4):**

| # | Area | Root cause | Fix (files) | Key evidence |
|---|---|---|---|---|
| 19 | No notification inbox | rows were written by `notify_students_new_offer`, but no route read them; the mobile modal rendered hard-coded `mockNotifications` | `GET /api/notifications` (own rows by JWT identity, newest first, max 50) and `POST /api/notifications/read` (`student_routes.py`); `src/api/notifications.ts`, `ProfileScreen.tsx`, `NotificationModal.tsx` (empty state), i18n `no_notifications` | A sees only A's 2 rows, newest first; B can't see them; anonymous 401; `?user_id=` ignored; emulator screenshots |
| 20 | Suspension only locked restaurants | `suspended` was checked nowhere; only the restaurant-`verified` rule blocked anyone | `is_account_suspended()` in `utils/decorators.py` (role ≠ admin) used by `role_required`, `login_user`, `google_login`, `refresh_access_token`; `/admin/suspend` refuses admin targets (400) | suspended student/user/restaurant: login 403 ×3, old access token 403, old refresh 403; admin 27 unaffected |

Also: `/api/auth/refresh` route existed only uncommitted at the start of the session (kept). `private_uploads/` added to `backend/.gitignore`.

## 4. Verification evidence

**Final consolidated regression (61 items, 2026-09-29 20:45–22:50):** 53 PASSED · 3 DATABASE VERIFIED · 1 AWS VERIFIED · 2 OBSERVED ·
2 FAILED (both **pre-existing**: Jest config, TypeScript baseline). No regression, no new failure.
Full table: `thesis_evidence/2026-09-29/FINAL_REGRESSION_REPORT.md`; raw: `final_regression_results.jsonl`.

**Manual tests by the author:** Google login + cancel (15:00, audit 367/368, no new account) · real admin web dashboard read-only
(14:50, values = DB, only audit row 364 added) · **genuine webcam QR scan** (18:15–18:16: verify 200 → 400 → 404, one request per
scan, claim 198 validated once, XP +50, leaderboard +20/+1).

**Recommendation evaluation** (synthetic dataset, run through the real service inside a rolled-back transaction – NOT real usage):
8 users × 5 restaurants, 23 validated claims. Leave-one-out, 19 cases: CF MRR **0.667** (Hit@1 8, Hit@2 16, 1 not ranked) vs.
popularity baseline MRR **0.307** (Hit@1 0, Hit@2 1). Caveat: hand-built clustered data with near-uniform popularity – shows the
implementation works as designed, not superiority in real use. Before the ordering fix the returned order scored MRR 0.627.
Real DB: 0 validated claims from real users → everyone gets the cold-start fallback (newest offers).

**Hybrid recommendation upgrade (2026-10-08, IMPLEMENTED and TESTED; thesis NOT yet updated):** CF kept as one signal in a
deterministic weighted score (CF 0.35, own restaurant affinity 0.15, proximity 0.20, popularity 0.15, freshness 0.10, value 0.05,
all normalised to [0,1], unavailable signals dropped) + one-offer-per-restaurant re-ranking; cold start = proximity/popularity/
freshness/value. Same synthetic LOO (`thesis_evidence/2026-10-08/scripts/t08_reco_hybrid.py`, weights not tuned): MRR old CF 0.667,
popularity 0.307, hybrid 0.547 (deployed; visited restaurants allowed) / 0.596 (unvisited-only candidates, Recall@3 1.0 vs 0.947).
The protocol cannot exercise distance/freshness/value. Details and caveats: `docs/recommendations.md`.

**Inbox + suspension focused test (2026-09-30, 14:07–14:30):** live script `thesis_evidence/2026-09-30/scripts/t_inbox_suspension.py`
against a local backend, 60/60 PASS (`inbox_suspension_results.jsonl`). TEST accounts 86–89 plus one TEST admin; admin actions via a token minted for admin 27.
- **Inbox, TESTED + DATABASE VERIFIED:**
  - 2 `[TEST]` offers → 6 rows (2 × 3 `role='student'` users, incl. real user 31); role `user` got none (unchanged).
  - A: `GET /api/notifications` 200 → own ids [343, 340] = DB order. B: 200 → [342, 339], none of A's.
  - Anonymous GET/POST 401. `?user_id=B` ignored. `POST /read` → updated=2, only A's rows.
- **Emulator, OBSERVED:** screenshots `n01_inbox_student_A`, `n02_inbox_student_B` (B's unread dots; B's rows flipped to read in the DB after the app's mark-read call).
- **FCM, OBSERVED:** the backend log shows "Found 3 students … sent push notifications to 1 students" per offer (sending code unchanged).
- **Suspension, TESTED + DATABASE VERIFIED:**
  - active student/user/restaurant logins 200
  - admin 27 suspends them: 200, and DB status = suspended
  - their logins 403 plus audit `LOGIN_DENIED`; old access tokens 403 `Account Suspended` (`/auth/me`, `/notifications`, `/restaurant/location`); old refresh tokens 403
  - B unaffected (200); admin 27 `/admin/stats` 200
  - suspending the TEST admin or admin 27 → 400, and their status stays `verified`
  - a wrong password on a suspended account still returns 401 (the password is checked first)
  - mobile shows "Your account has been suspended…" (`s01_suspended_user_login`)
- **Cleanup, DATABASE VERIFIED:** scoped cleanup deleted only this run's rows (6 notifications, 2 offers, 1 restaurant, 20 audit rows, 5 users).
  Protected records are intact; totals are back to users 4 · restaurants 1 · offers 6 · claims 2 · leaderboard 1 · notifications 12 · audit 132.
- **Gate:** `run_checks.py --all`: backend 78 passed / 5 xfailed; TypeScript errors at baseline (admin 1, mobile 17).

**Automated/build (2026-09-29):** backend `test_api.py` (live-server script, not pytest-collected, see `docs/testing.md`) 2 passed (0.68 s) · release JS bundle builds · backend compiles ·
Jest 1 suite fails (Firebase ESM, pre-existing) · `tsc` mobile 17 / admin 1 errors (baseline, `.claude/hooks/tsc-baseline.json`).
`backend/tests/{smoke,edge}` and `scripts/run_checks.py` exist (added 2026-09-29, outside the test sessions above).

**Test methods worth citing:** API scripts with barrier-synchronised threads for concurrency; emulator driven via adb; expired/invalid
tokens injected into the debug app's AsyncStorage (correctly signed, expired); synthetic TEST PNG for documents; admin dashboard in a
browser; read-only SQL before/after each block; S3 checked with HEAD requests (no document content downloaded).

## 4a. Final evidence after Fixes 1–11 (2026-10-07) — current final state

Second fix round (numbered 1–11, separate from fixes 1–20 in §3). Results as reported by the final regression audit of
2026-10-07. Raw result files for this round are **not** stored under `thesis_evidence/` (only `2026-09-29/` and `2026-09-30/` exist).

**Quality and regression results (TESTED):**

| Check | Result |
|---|---|
| Backend quality gate (`scripts/run_checks.py`, pytest smoke + edge) | **198 passed, 1 expected failure** (duplicate `GET /api/leaderboard` route, strict `xfail`) |
| Writes suite | **23/23 passed** |
| Live API regression | **64/64 passed** |
| Critical emulator regression flows | passed |
| Translation parity (`en.ts` / `hu.ts` / `tr.ts`) | **309 / 309 / 309** keys; HU/TR localization verified |
| TypeScript baseline (`.claude/hooks/tsc-baseline.json`) | mobile **14**, admin **1** |
| Final regression severity | **P0: 0 · P1: 0** (the one P1 was fixed by Fix 11) |

**Behaviour verified in the final regression (TESTED):**
- Account deletion invalidates the session; a still-valid access token of a deleted user → **401** (Fix 8).
- FCM token cleanup on logout (`DELETE /api/auth/fcm-token`, called by the mobile app).
- New-offer notifications reach both app-registered (`user`) and Google-registered (`student`) accounts.
- API error responses are JSON.

**Implemented in Fixes 1–11 (IMPLEMENTED; per-item runtime coverage is not itemised in this record):**
- Upload validation: image signature check and size limits (5 MB public images, 10 MB documents, 413 above; `MAX_CONTENT_LENGTH`) in `upload_routes.py`.
- Client-side image caps (longest side): offer image **1280**, restaurant/student avatar **512**; verification documents **intentionally uncapped** (legibility).
  Mobile image-picker screens: **NOT TESTED** (unchanged from §8).
- Same-day offer expiry in **Europe/Budapest** time, computed at query/claim time (Fix 5, `docs/claims.md`).
- Recommendations exclude offers the user already claimed (Fix 7, `docs/recommendations.md`).
- Coordinate and offer input validation (Fix 2, `docs/claims.md`, `docs/location.md`).
- Google Maps key injected from the git-ignored `.env` (Fix 6). Real map tiles: **NOT TESTED** without a configured key.

**Data safety (DATABASE VERIFIED):** no real users modified; no real notifications sent during the regression; test data
cleaned and the DB returned to its baseline.

**Not tested / deferred / not claimed:**
- NOT TESTED: physical Android device · iOS · real-device GPS (incl. late GPS fix) · real Google Maps tiles without an API key.
- DEFERRED: notification localization (push/inbox texts are not translated) · Google Sign-In button matching the app language ·
  default app language decision.
- NOT IMPLEMENTED: automatic expiry of pending claims.
- Formal GDPR compliance: **not claimed** (GDPR is a design consideration only).

## 4b. Code audit 2026-10-08 (F1–F13, IMPLEMENTED and TESTED; thesis NOT updated)

Findings and evidence: `thesis_evidence/2026-10-08/AUDIT_FINDINGS_PRE_FIX.md` (before) and `AUDIT_REPORT_FINAL.md` (after).
- F1 new students are always stored as `student` (app registration sent the legacy `user`); old `user` rows unchanged and still valid.
- F2 Google sign-in requires `email_verified`; F3 refused (503) without `GOOGLE_WEB_CLIENT_ID`.
- F4/F13 one access rule `account_block` for password login, Google login, refresh and protected routes; a rejected restaurant
  (`unverified`) gets `Application Rejected` and can re-apply (`POST /api/auth/restaurant/reapply` → `pending`).
- F5 forgot-password answers identically for known/unknown e-mails and SMTP failures. F6 e-mail change needs the current password.
- F7 suspended students get no new-offer notifications. F8 admin "active offers" = student-visible offers (`claimable_offer_conditions`).
- F9 stale `user_id` branches removed from admin stats/offers. F11 claim history time shown in Europe/Budapest.
- F10 no fake position: the app sends `lat`/`lng` only for a real device fix, the backend has no default position; refresh and
  foreground re-locate the device. Map fallback view only (`FALLBACK_MAP_CENTER`).
- F12 `run.py` binds 127.0.0.1 by default (`BACKEND_HOST` to override) and runs the Werkzeug debugger only with a DEBUG config on loopback.

Results: gate `run_checks.py --all` 240 passed / 1 xfailed, TS at baseline (admin 1, mobile 14); writes 53/53; mobile Jest 31/31
(`App.test.tsx` still fails, pre-existing Firebase ESM). Emulator regression after fixes passed (see the report). Test data removed;
DB back to users 4 · restaurant_profiles 1 · offers 6 · claims 2 · leaderboard 1 · notifications 12 · audit_logs 138.

## 5. Database and schema

Migrations applied 2026-09-29 (`backend/migrations/`):
- `2026-09-29_leaderboard_unique_restaurant.sql` → `leaderboard_restaurant_id_key UNIQUE (restaurant_id)`
- `2026-09-29_restaurant_geom_backfill_index.sql` → `geom` from stored lat/lng + GiST `idx_restaurant_profiles_geom`
- `2026-09-29_claims_unique_user_offer.sql` → `claims_user_offer_key UNIQUE (user_id, offer_id)` (after approved cleanup)
Model-only (column already existed): `users.document_type`.

**Real data (DATABASE VERIFIED after cleanup):** users 27 admin · 29 user · 31 student (verified, XP 75) · 32 restaurant; restaurant 11
"Burger" (placeholder 41.0 / 28.9, `geom` derived); offers 48–53; claims 85, 86 (pending); leaderboard row 10 (30 / 2); notifications 51–62.
Pre-existing inconsistency: Burger 30/2 and user 31 XP 75 have **no validated claims** behind them (claim rows removed before
2026-09-29; cause not established – thesis §5.4).

**TEST data: none (DATABASE VERIFIED 2026-09-30).** The final-regression test data was removed on 2026-09-30 with
`cleanup_test_data.py --apply` (dry run approved first; all protected assertions passed): 13 claims, 18 `[TEST]` notifications
(9 of them for user 31), 2 leaderboard rows (22, 25), 10 offers (90–99), 3 restaurants (27–29), 37 + 5 audit rows, 9 users (77–85);
0 local upload files. Earlier full cleanup: 2026-09-29 (`cleanup_applied_2026-09-29.txt`).
**Post-cleanup totals:** users 4 · restaurant_profiles 1 · offers 6 · claims 2 · leaderboard 1 · notifications 12 (51–62) · audit_logs 132.
Kept audit rows from the author's manual tests: 364 (admin login), 367/368 (Google login + FCM). Also kept: 369 and 459
(`LOGIN_FAILED`, no user id, 127.0.0.1, no test marker – origin not attributable, so not deleted).
Re-running the cleanup (dry run) is safe; it aborts if a protected real record would be touched.

## 6. AWS S3

Account `0746****6942`, IAM user `foodshare-backend`, bucket `foodshare-hungary-storage`. Policy now = `PROPOSED_s3_bucket_policy.json`
(public GetObject only for `offer_images/*`, `restaurant_profiles/*`, `avatars/*`); rollback file `BACKUP_s3_bucket_policy_2026-09-29.json`.
Object ownership `BucketOwnerEnforced`. Verified: document raw URLs 403, admin pre-signed 200 and expiring, offer image/avatar 200.
**Storage state (AWS VERIFIED 2026-09-30):** `id_documents/` holds 15 objects = 2 referenced (users 29, 31) + **13 orphaned**
(uploaded 2026-03-15…04-07, not referenced by any user); anonymous HEAD → 403 for all 15; `student_ids/` empty.
The orphan deletion REQUIRES CONFIRMATION. The regression test orphan `id_documents/d3bdab65fb314f1399b219fc9f13abfe.png` was deleted on 2026-09-30
(single-key delete, approved; HEAD → 404; the other 15 objects are unchanged in key, ETag and size; bucket policy untouched).

## 7. Open issues (documented, not fixed)

1. No server-side JWT revocation (tokens copied before logout stay valid until expiry; mobile + admin).
2. ~~FCM token not cleared on logout~~ — fixed (Fixes 1–11, §4a): logout calls `DELETE /api/auth/fcm-token`; cleanup TESTED.
3. ~~New-offer notifications only for role `student`~~ — fixed (Fixes 1–11, §4a): `user` and `student` accounts both receive them (TESTED).
4. Re-upload of a document leaves the previous file in storage (source of the orphans).
5. `/api/recommendations` still computes distance in Python (identical results to PostGIS).
6. Existing restaurants keep placeholder coordinates until the owner sets a location; mobile registration sends no coordinates.
7. Admin header "Welcome, Super Admin" hard-coded.
8. ~~Still-valid access token of a deleted user → 404 (not 401)~~ — fixed 2026-10-07 (Fix 8): protected routes answer 401, the app's refresh then fails (404) and it returns to login.
9. UX: after a failed mobile login the fields are cleared (screen remounts while `isLoading`); LOG IN with empty fields is silent.
10. ~~Forgot-password code never stored; no reset endpoint~~ — `POST /api/auth/reset-password` exists (IMPLEMENTED, code-checked 2026-10-07); its test evidence is not recorded in this file.
11. ~~`requirements.txt` incomplete~~ — fixed 2026-10-18 (missing packages added, `SQLAlchemy==2.0.43` pinned; clean venv verified, see README §8.7); Jest not configured for Firebase; TS baseline errors (mobile 14, admin 1); one known bug pinned as `xfail` in `backend/tests` (duplicate `/api/leaderboard`).
12. ~~Mobile verify alert shows "+10" regardless of points~~ (fixed 2026-10-07, Fix 8: shows the backend message); admin "meals claimed" counts pending claims (open).
13. Suspension (fix 20): there is no "unsuspend" action; suspending overwrites the previous status (verified/unverified is lost); an open mobile
    session gets 403s until its access token expires (≤15 min), then the refresh fails with 403 and the app returns to login. Admins can't be suspended (by design).
14. Inbox (fix 19): restaurants get push only (no stored rows); student roles see item 3; there's no per-item read state
    (all marked read on opening) and no pagination beyond 50. Notification rows are inserted with the DB's `CURRENT_TIMESTAMP` (DB server time zone,
    OBSERVED 15:09) while other tables store `utcnow()` (12:09 for the same moment). The app shows the notification time as stored (pre-existing, not changed).
15. Admin approve/reject/suspend/cancel write no audit rows. The 22 `str(e)` paths listed in `docs/thesis.md`: a grep on 2026-10-07 found no client-facing `str(e)` in `backend/app`, and API errors are JSON (§4a); REQUIRES CONFIRMATION before claiming every path is sanitised.
16. `backend/tests/CLAUDE.md` is referenced but doesn't exist; `test_api.py` creates a real test user on every run.
17. Pending claims never expire (NOT IMPLEMENTED); offers expire the same day (§4a). Deferred: notification localization, Google Sign-In button language, default app language.

## 8. NOT TESTED

iOS · physical Android device · mobile image-picker screens (SECURITY → UPLOAD ID → Camera/Gallery) · public access to
`restaurant_profiles/` (no objects) · refresh failure caused by a network error · real-device GPS (incl. late GPS fix) ·
real Google Maps tiles without an API key · production deployment / real users / load.

## 9. Thesis revision guidance (not yet applied to the thesis)

- Chapter 6: separate automated tests (2 pytest API tests) from manual/API tests; state the environment (§1); use representative
  cases with inputs, expected, observed, HTTP status and DB effect (final regression table).
- Repeated / concurrent QR verification: scanner lock = client only; backend = atomic conditional UPDATE; cite before/after (fix 3).
- Recommendation: cite the synthetic evaluation and its caveats (§4); real data insufficient.
- Chapters 7–10: explain token refresh (15 min / 7 days, single refresh with queue, logout on failure, no server revocation) and
  document access (private S3 prefix, 5-min pre-signed admin links, deletion on reject, orphan limitation).
- **Do not reuse** outdated statements from the archived phase reports – e.g. "endpoints are unprotected", "PostGIS geom never
  written", "bucket is public", "duplicate claims allowed" were true only before the fixes of 2026-09-29.
- Distinguish what the author tested manually (Google, admin dashboard, webcam scan) from automated/API evidence.

## 10. Evidence index (`thesis_evidence/2026-09-29/`, untracked – do not commit `db_before.txt`)

| File | Content |
|---|---|
| `FINAL_REGRESSION_REPORT.md` | final R01–R61 results, answers, integrity checks |
| `final_regression_results.jsonl`, `evidence.jsonl` | raw per-request/per-test evidence (secrets redacted) |
| `screenshots/`, `qr_scanner_test/` | emulator / admin screenshots, QR images used for the webcam test |
| `admin_dashboard_session_log.txt` | server log of the manual admin session |
| `reco_results*.json`, `scripts/t07_reco.py` | recommendation evaluation (before/after fix) |
| `2026-10-08/reco_hybrid_results.json`, `2026-10-08/scripts/t08_reco_hybrid.py` | hybrid recommendation evaluation + sensitivity |
| `cleanup_test_data.py`, `cleanup_dryrun_2026-09-29.txt`, `cleanup_applied_2026-09-29.txt` | test-data cleanup tool and its outputs |
| `BACKUP_…` / `PROPOSED_s3_bucket_policy.json` | S3 policy rollback / applied policy |
| `db_before.txt` | DB snapshot before testing (**contains real names/e-mails – never commit**) |
| `scripts/` | all test/regression scripts (credentials are not stored in them) |
| `archive/` | historical phase reports (REPORT, PHASE2, PHASE4) – detailed before/after tables; superseded by this file |
| `../2026-09-30/` | inbox + suspension test: `scripts/t_inbox_suspension.py`, `inbox_suspension_results.jsonl`, `screenshots/n01_*`, `n02_*`, `s01_*` |

## 10a. Domain reference docs (`docs/`, created 2026-09-30)

Short per-domain notes for future sessions: files, workflow, rules, limitations, evidence and thesis sections. Read the one you need instead of the code:
`auth.md` · `claims.md` · `qr.md` · `documents.md` · `location.md` · `recommendations.md` · `notifications.md` · `admin.md` · `testing.md`.
**`thesis.md`** is the thesis fact sheet: what's implemented, what was tested, what must NOT be claimed, key numbers and evidence files. Check it before writing thesis text.
This file stays canonical for status. The docs record code facts as of 2026-09-30.

## 11. Git state

Nothing committed on 2026-09-29. Uncommitted: the author's UI redesign (18 mobile files), the fixes in §3, `backend/migrations/`,
`.claude/`, `CLAUDE.md`, `PROJECT_STATE.md`, `thesis_evidence/`. Never commit `.env`, `private_uploads/`, `app/static/uploads/`,
`firebase-service-account.json`, `db_before.txt`.
