# QR verification, XP and leaderboard

Claim creation is in `claims.md`.

## Purpose
A restaurant scans a student's claim QR code. The claim becomes `validated`, the student earns XP, and the restaurant earns leaderboard points.

## Files
- `backend/app/services/qr_service.py`: `QRService.verify_claim_qr(qr_code, restaurant_owner_id)`
- `backend/app/routes/restaurant_routes.py`: `POST /api/claims/verify` (restaurant, verified)
- `backend/app/routes/student_routes.py`: `GET /api/leaderboard` (top 5, **this one is served**)
- `backend/app/routes/restaurant_routes.py`: a second `GET /api/leaderboard` (top 10 with rank) that is **unreachable** (student_bp is registered first)
- `backend/app/models/stats.py`: `Leaderboard`
- Mobile: `FoodShareMobile/src/screens/restaurant/ScannerScreen.tsx` (module-level `isGlobalScanLocked`), `LeaderboardCard.tsx`

## Workflow (`verify_claim_qr`)
1. Unknown code → 404. The offer belongs to another restaurant → 403. Already `validated` → 400. `expired`/`rejected` → 400.
2. **Atomic** `UPDATE claims SET status='validated' WHERE id=… AND status='pending'`. 0 rows → 400 "already used".
3. Leaderboard `INSERT … ON CONFLICT (restaurant_id) DO UPDATE points += p, meals_shared += 1`. p = 20 for free, 10 for discount.
4. Student `xp += 50` (free) or `25` (discount) as a SQL increment. Level = `xp // 100 + 1` (only goes up).
5. Commit, then a push notification to the restaurant owner (failures are ignored). The response message carries the actual XP and points.

## Tables
`claims.status` · `users.xp`, `users.level` · `leaderboard` (`restaurant_id` UNIQUE via `leaderboard_restaurant_id_key`, `points`, `meals_shared`).

## Rules
- Double-verification protection is on the **server**: the conditional UPDATE. The scanner lock is only a client-side convenience.
- Ownership check before any state change: a restaurant can verify only its own offers' claims.
- Keep `ON CONFLICT` and the SQL increments (CLAUDE.md, concurrency-sensitive writes).

## Known limitations
- `level` is assigned in Python after the locked increment. That's safe per claim, but it isn't a single SQL expression.
- The duplicate `/api/leaderboard` route is pinned as `xfail` (`tests/smoke/test_smoke_api.py::test_no_duplicate_url_rules`).
- The mobile verify alert shows "+10" regardless of points (PROJECT_STATE §7.12; not re-checked in code here).
- `str(e)` leaks: a verify 500 ("Gamification error: …") and the served `GET /api/leaderboard` (`{error}`). The unreachable restaurant version returns `[]`.
- Real data: Burger 30/2 and user 31 XP 75 have no validated claims behind them (PROJECT_STATE §5).

## Evidence
- Fix 3: before the fix, 5 × 200 and +125 XP in each of 5 recorded trials (trials 6–12 recorded no responses and are not evidence;
  `thesis_evidence/2026-09-29/evidence.jsonl`, tag "R1 12 trials x 8 …"); after it, 1 × 200 / 7 × 400 in 12/12 trials.
- Fix 16: 4 concurrent first scores → 1 row, 80/4.
- Manual webcam scan on 2026-09-29, 18:15: 200 → 400 → 404, XP +50, leaderboard +20/+1.

## Thesis
Chapter 6 (repeated/concurrent QR verification: client lock vs. atomic backend, with before/after numbers), gamification section.
