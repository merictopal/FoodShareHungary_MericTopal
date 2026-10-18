# Thesis fact sheet (for Claude sessions)

This isn't a chapter. Use it to check every claim in the thesis. Details are in the domain docs; status is in `PROJECT_STATE.md`.
Code facts are as of 2026-09-30. Status words: IMPLEMENTED / TESTED / DATABASE VERIFIED / AWS VERIFIED / OBSERVED / NOT TESTED.

## 1. What the system implements
- Flask REST API with PostgreSQL + PostGIS; React Native app (students + restaurants); React/Vite admin panel.
- JWT access (15 min) + refresh (7 days) tokens. Roles are re-read from the DB; IDOR checks; Google sign-in (`auth.md`).
- Offers → claim → QR code → restaurant scan, with atomic stock reservation, one claim per student per offer, and atomic single verification (`claims.md`, `qr.md`).
- XP/levels and a restaurant leaderboard via an SQL upsert (`qr.md`).
- Private identity documents: private S3 prefixes, 5-minute pre-signed links for admins, the file deleted on reject (`documents.md`).
- Restaurant location with PostGIS `geom`; offers sorted by `ST_DistanceSphere` (`location.md`).
- Collaborative-filtering recommendations with a cold-start fallback (`recommendations.md`).
- FCM push for new offers and verified claims, plus an **in-app notification inbox** (own stored rows, newest first, marked read on opening).
  Implemented and tested on 2026-09-30 (`notifications.md`).
- Admin verification, **account suspension** (students, users and restaurants can't log in, refresh or use existing tokens; admins are exempt and
  can't be suspended; 2026-09-30, `auth.md`), offer cancellation, audit-log viewer (`admin.md`).

## 2. What was tested
- **Automated, in-process** (`backend/tests/smoke|edge`, pytest-collected, read-only): added on 2026-09-29 **after** the evidence sessions; used by the push gate.
- **Automated, live server**: `backend/test_api.py`, 2 tests (register + login) against a running backend. Not pytest-collected by default; writes a test user.
- **Focused live test on 2026-09-30** (inbox + suspension): 60/60 PASS, with DB checks, 3 emulator screenshots and a scoped cleanup. See `testing.md`.
- **Manual/API regression**: 61 items (scripts, adb-driven emulator, SQL before/after, S3 HEAD checks). See `testing.md`.
- **The author's own manual tests**: Google login and cancel, admin dashboard (read-only), genuine webcam QR scan.
- Environment: Android Emulator Pixel_7 (API 33), Windows 11, a single local backend.

## 3. Do NOT claim
- More than the inbox does: no per-item read state, no inbox for restaurants or role `user`, no pagination beyond 50.
  (Before 2026-09-30 the app showed mock data; don't describe that older state as current.)
- That **admins** can be suspended, or that an open mobile session is cut off instantly. It's cut off within ≤15 min, when the refresh fails.
  The Google-login suspension path is NOT TESTED.
- **Production deployment**, real users, load/performance testing, or iOS / physical Android testing (NOT TESTED).
- That the recommender **outperforms popularity in real use**. The evaluation is synthetic; the real DB has 0 validated claims from real users.
- A working **password reset**. The code is e-mailed but never stored; there is no reset endpoint.
- **Server-side logout / token revocation**.
- That the **QR scanner lock** prevents double verification. The guarantee is the backend's atomic UPDATE; the lock only helps the client.
- A large **automated test suite** from the evidence period, or "unit tests" (Chapter 6 evidence is mostly manual/API).
- Outdated archived statements that were true only before 2026-09-29: unprotected endpoints, a public bucket, `geom` never written, duplicate claims allowed.
- **Admin actions are audited**. Only auth events are logged.
- Upload validation (file type/size). There is none.

## 4. Key limitations (details in the domain docs)
- No JWT revocation. The FCM token isn't cleared on logout. Only role `student` (not `user`) gets new-offer notifications.
- Suspension: no unsuspend action; suspending overwrites the previous verification status; an open session gets 403s until its access token
  expires, then the refresh fails and the app returns to login.
- Document re-upload leaves orphans (13 remain in S3, private). Pickup times are never stored.
- `str(e)` reaches clients from 22 code paths: QRService 3, student routes 4 (offers, recommendations, history, leaderboard), admin routes 9,
  and upload 6 (all 5 routes via the storage message + `/user-document`'s own `except`); see each doc. Only 2 are pinned by `xfail`.
- Rate limits are in-memory: 200/day + 50/hour per IP; auth 5/minute.
- Forgot-password responses reveal whether an account exists when SMTP fails. An email-change collision → 500. Auth errors lack `success:false`.
- Placeholder coordinates for existing restaurants. Recommendation distance is computed in Python.
- Pre-existing data inconsistency: Burger 30 points / 2 meals and user 31 with XP 75 have no validated claims behind them (cause not established).

## 5. Quantitative evidence
| Topic | Result |
|---|---|
| Final regression | 61 items: 53 PASSED, 3 DB VERIFIED, 1 AWS VERIFIED, 2 OBSERVED, 2 FAILED (pre-existing Jest + TS baseline), 0 regressions |
| QR concurrency (fix 3) | before: 5 × 200 and +125 XP in each of 5 recorded trials (trials 6–12 recorded no responses and are not evidence) → after: 1 × 200 / 7 × 400 in 12/12 trials |
| Oversell (fix 4) | before: 5 claims for qty 1 → after: exactly 1 (5 runs) |
| Duplicate claims (fix 12) | 10 parallel duplicates → 1 claim; raw INSERT → UniqueViolation |
| Leaderboard (fix 16) | 4 concurrent first scores → 1 row, 80/4 |
| Notifications (fix 13) | 16 → 8 rows for 8 students |
| PostGIS (fix 17) | nearest offer first (1.89 km); 0.00 km difference vs. the app formula |
| Recommendation (synthetic) | CF MRR 0.667 (Hit@1 8, Hit@2 16 of 19) vs. popularity 0.307; MRR before the ordering fix 0.627 |
| S3 privacy | document raw URL 200 → 403 after the policy; 15/15 `id_documents/` objects 403 anonymously (2026-09-30) |
| Webcam scan | verify 200 → 400 → 404, XP +50, leaderboard +20/+1 |
| Inbox (fix 19) | 2 offers → 6 rows (2 × 3 students); A sees own 2 rows newest first, B none of A's; anonymous 401; mark-read updated=2 (only A) |
| Suspension (fix 20) | suspended student/user/restaurant: login 403 ×3, old access 403 ×3, old refresh 403 ×3; admin target 400; admin 27 200 |
| Build/TS | tsc errors: mobile 17, admin 1 (baseline); release JS bundle builds |

## 6. Thesis sections
- **Ch. 6 (testing)**: environment; automated (in-process pytest suite vs. the live-server `test_api.py`) separated from manual/API tests;
  representative cases (input / expected / observed / HTTP / DB effect); the concurrency before/after table; the author's manual tests named as such.
- **Ch. 7–10**: token refresh and session design (`auth.md`), document access (`documents.md`), QR concurrency (`qr.md`), PostGIS (`location.md`),
  recommendation with caveats (`recommendations.md`), limitations and future work (§4 above).
- §2.3 requirement "prevents duplicate claims" is now met (fix 12).

## 7. Evidence files (`thesis_evidence/2026-09-29/`, untracked)
- `FINAL_REGRESSION_REPORT.md`, `final_regression_results.jsonl`, `evidence.jsonl`: results and raw data.
- `reco_results_before_fix.json`, `reco_results_after_fix.json`, `scripts/t07_reco.py`: recommendation evaluation.
- `admin_dashboard_session_log.txt`: the manual admin session. `qr_scanner_test/` holds the valid/invalid QR images used for the webcam test.
- `BACKUP_…` / `PROPOSED_s3_bucket_policy.json`: S3 policy rollback and the applied policy. `cleanup_*`: test-data cleanup.
- Screenshots (`screenshots/`):
  - login: `s02`/`s03` invalid login before/after the fix, `r02`
  - claim flow: `s05`/`s06`, `r04` claim + QR
  - verify: `s09`–`s12`, `s14`, `r05`/`r06`
  - token refresh/expiry: `x01`–`x05`, `r07`, `regression_R07_…`
  - location card: `e_location_card`; admin pre-signed document view: `h_admin_view_presigned`
- `thesis_evidence/2026-09-30/`: `scripts/t_inbox_suspension.py`, `inbox_suspension_results.jsonl`, screenshots `n01_inbox_student_A`,
  `n02_inbox_student_B`, `s01_suspended_user_login`.
- Never cite or commit `db_before.txt` (real personal data). Don't reuse `archive/` statements without checking this sheet.
