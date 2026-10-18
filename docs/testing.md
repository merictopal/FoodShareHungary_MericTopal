# Testing and evidence

## Purpose
How behaviour is verified, and where the thesis evidence lives. Status vocabulary: `PROJECT_STATE.md` (top).

## Automated
- `backend/tests/` (pytest, `pytest.ini`: `testpaths = tests`, `--strict-markers`, `xfail_strict = true`):
  - `smoke/test_smoke_api.py`: boot, JSON 404, public offers/leaderboard shape, distance order, anonymous → 401, own profile, admin stats
  - `edge/test_edge_auth.py`: token abuse, role claim not trusted, admin/restaurant route isolation, IDOR
  - `edge/test_edge_inputs.py`: coordinate boundaries, non-int ids, missing user
  - `conftest.py`: in-process Flask client, limiter disabled, `PROPAGATE_EXCEPTIONS=False`, `mint_token` (local JWT),
    fixtures `student`/`admin`/`verified_restaurant`/`other_user_id` taken from **existing** DB rows (read-only)
- Pinned known bugs (`xfail` strict): duplicate `/api/leaderboard`, `/api/offers?lat=abc` → 500, `/api/recommendations/abc` → 500.
- `backend/test_api.py`: a **live-server API test script**, not part of the pytest-collected suite.
  - It has 2 pytest-style functions (`test_bot_can_register`, `test_bot_can_login`) that call `http://127.0.0.1:5000/api/auth` with `requests`,
    so a backend must already be running.
  - `pytest.ini` (`testpaths = tests`) does **not** collect it. It runs only when named explicitly (`python -m pytest test_api.py`), and the gate never runs it.
  - **Every run writes to the DB**: it registers a new `testbot_<random>@student.hu` student (+ audit rows). That's how test user 85 came about.
  - This is what PROJECT_STATE §4 calls "backend pytest `test_api.py` 2 passed". In the thesis, describe it as 2 automated
    API tests against a running server, not as an in-process unit/pytest suite.
- `backend/tests/CLAUDE.md` is referenced by `conftest.py` and `.claude/rules/test-after-every-feature.md` but **does not exist**. The
  rules it would hold are in the `conftest.py` docstring (in-process, read-only, locally minted tokens).
- Gate: `python scripts/run_checks.py` runs backend `pytest -m "smoke or edge"` plus the TS ratchet (`tsc`; baseline in
  `.claude/hooks/tsc-baseline.json`: admin 1, mobile 17). The push hook runs it (`.claude/rules/push-gate.md`).
- Jest: 1 suite fails (Firebase ESM, pre-existing). Mobile release JS bundle builds.

- Gate result 2026-09-30, after fixes 19–20: backend 78 passed / 5 xfailed; TypeScript errors at baseline (admin 1, mobile 17).
  New tests:
  - smoke `test_student_can_list_own_notifications`, and `/api/notifications` + `/read` in `PROTECTED_ROUTES` (anonymous → 401)
  - edge: `user_id` spoofing ignored, refresh token → 401, `is_account_suspended` truth table

## Focused live test (2026-09-30): inbox + suspension
- `thesis_evidence/2026-09-30/scripts/t_inbox_suspension.py setup | suspend | cleanup` runs against `python backend/run.py`
  (`.claude/launch.json` → `backend`). Auth calls are throttled to ≤5/min.
- It **writes TEST data** (`*@fs-test.local`, `[TEST]` offers). Admin actions use a token minted for admin 27.
  Passwords and tokens stay in a scratch state file, never in the evidence.
- `cleanup` deletes **only the ids recorded by the run** (including `[TEST]` notifications sent to real user 31), then asserts the protected
  records and the table totals. It isn't the global cleanup tool.
- Result: 60/60 PASS (`inbox_suspension_results.jsonl`). Emulator screenshots `n01`, `n02`, `s01` in `thesis_evidence/2026-09-30/screenshots/`.
- Emulator tips: Metro is `.claude/launch.json` → `metro` (cwd `FoodShareMobile`) plus `adb reverse tcp:8081 tcp:8081`. The emulator keyboard autocorrects
  `adb input text`, so type credentials one character at a time and hide the keyboard before tapping the next field.

## Manual / API evidence (2026-09-29)
- Final regression of 61 items: 53 PASSED · 3 DB VERIFIED · 1 AWS VERIFIED · 2 OBSERVED · 2 FAILED (pre-existing: Jest, TS).
  Details: `thesis_evidence/2026-09-29/FINAL_REGRESSION_REPORT.md`; raw data: `final_regression_results.jsonl`.
- Methods: barrier-synchronised threads for concurrency, adb-driven emulator, correctly signed expired tokens injected into AsyncStorage,
  synthetic TEST PNG documents, read-only SQL before/after each block, S3 HEAD checks.
- Author's manual tests: Google login and cancel, admin dashboard, genuine webcam QR scan.

## Test data
- Emails `*@fs-test.local`, titles prefixed `[TEST]`. Cleanup: `thesis_evidence/2026-09-29/cleanup_test_data.py` (dry run by default, `--apply` asserts
  the protected real records). Final cleanup applied on 2026-09-30, so the DB now holds only real records (PROJECT_STATE §5).
- The `student` fixture needs a real `role='student'` row (currently user 31); `verified_restaurant` → 32.

## NOT TESTED
iOS · physical Android · mobile image-picker screens · refresh failure caused by a network error · password reset · production/load.

## Thesis
Chapter 6: keep the automated tests (the 2 `test_api.py` tests; the smoke/edge suites were added afterwards) separate from the manual/API regression.
Use representative cases (input, expected, observed, HTTP status, DB effect).
