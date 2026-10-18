# Offers and claims

For QR verification and gamification see `qr.md`. For offer images see `documents.md`. For distance see `location.md`.

## Purpose
Restaurants publish offers (`free` or `discount`). Verified students reserve one unit and get a QR code.

## Files
- `backend/app/services/qr_service.py`: `QRService.create_offer`, `QRService.claim_offer`
- `backend/app/routes/restaurant_routes.py`: `POST /api/offers/create`, `GET /api/offers/my-offers`, `DELETE /api/offers/delete/<id>` (soft delete, sets `cancelled`)
- `backend/app/routes/student_routes.py`: `GET /api/offers` (public), `POST /api/offers/claim`, `GET /api/student/history/<int:id>`
- `backend/app/models/offer.py`: `Offer`, `Claim` (+ `to_dict`)
- Mobile: `FoodShareMobile/src/api/offers.ts`, `screens/student/home/HomeScreen.tsx`, `SuccessQrModal.tsx`

## Workflow
1. `create_offer`: the owner comes from `g.user`, `type` is lower-cased, `quantity = original_quantity`, the status is `active`. It then notifies students once (see `notifications.md`).
2. `claim_offer` (route requires a `student`/`user` with `verification_status == 'verified'`, else 403):
   - 404 if the offer is missing or belongs to a suspended restaurant; 409 if the student already has a claim for it; 400 "This offer has expired." if it was
     created before today's Budapest midnight; 400 if it's sold out or inactive
   - **atomic** `UPDATE offers SET quantity = quantity-1, status = CASE … 'sold_out' WHERE id=… AND status='active' AND quantity>0
     AND created_at >= <cutoff> AND <restaurant not suspended>` (an expired offer or a suspended restaurant's offer never
     loses a unit, even in a race with midnight or with the suspension)
   - duplicate check again while holding the row lock → 409 plus rollback (which restores the unit)
   - inserts a `Claim` with `qr_code = OFF-<offer>-USR-<user>-<6 hex>` and status `pending` → 201

## Tables
`offers` (`restaurant_id`, `type`, `discount_rate`, `quantity`, `original_quantity`, `status`: active|sold_out|cancelled, `image_url`, `pickup_start/end`)
· `claims` (`user_id`, `offer_id`, `qr_code` UNIQUE, `status`: pending|validated; `expired`/`rejected` are checked but never set)
· constraint `claims_user_offer_key UNIQUE(user_id, offer_id)` (migration `2026-09-29_claims_unique_user_offer.sql`).

## Expiry (same-day rule, Fix 5 – 2026-10-07)
- An offer can be listed and claimed only on the day it was created, in **Europe/Budapest** local time; it expires at local
  midnight (end-of-day surplus food). Implemented in `qr_service.offer_cutoff_utc()` / `offer_is_live()`: the cutoff is the
  current Budapest midnight converted to UTC, compared with `created_at` (naive UTC). DST is handled by `zoneinfo`.
- Computed at query/claim time only: no scheduled job, no stored `expired` status (an expired offer keeps `status='active'`
  in the DB), no schema change. `pickup_start/pickup_end` remain unused.
- Applied in: `GET /api/offers`, both recommendation queries (CF candidates and cold-start fallback), the claim checks
  above, and `GET /api/offers/my-offers` (expired offers disappear from the restaurant dashboard).
- Not applied: admin offer list (shows the stored status), QR verification of already existing pending claims, history.

## Suspended restaurants
- An admin suspension sets the owner's `users.verification_status = 'suspended'`. `qr_service.offer_restaurant_not_suspended()`
  (owner status `IS DISTINCT FROM 'suspended'`) hides that restaurant's offers from `GET /api/offers` and both recommendation
  queries, and makes `claim_offer` answer 404 "Not Found" even when the student knows the offer id.
- The offers are not deleted or cancelled; the admin offer list still shows them with their stored status. The suspended
  owner's own routes return 403 (existing suspension rule). Claims created before the suspension are unchanged.

## Rules
- The claimant is always `g.user.id`; a client-supplied `user_id` is ignored.
- Never replace the conditional UPDATE or the unique constraint with read-then-write Python (CLAUDE.md, concurrency).
- A restaurant can only list or cancel its own offers (the query filters on its own `restaurant_id`).

## Known limitations
- Pickup times: `create_offer` never stores `pickup_start/pickup_end` (both stay NULL), so `Offer.to_dict()` always returns the hard-coded
  Turkish fallback `pickup_window: "Gün Boyu"`. The image is attached by a separate upload after creation.
- Since Fix 2 (2026-10-07) offer input is validated (type, quantity ≥ 1, discount 0–100, title/description) and errors are generic.
- Claims never expire. Pending claims keep the unit reserved indefinitely, also after the offer itself has expired.
- The admin "meals claimed" count includes pending claims (see `admin.md`).

## Evidence
Fix 4 (oversell: 5 claims for qty 1 before → exactly 1 after, in 5 runs) and fix 12 (10 parallel duplicates → 1 claim; a raw INSERT hits UniqueViolation).
`PROJECT_STATE.md` §3, final regression R-items in `thesis_evidence/2026-09-29/FINAL_REGRESSION_REPORT.md`.

## Thesis
§2.3 (the requirement "prevents duplicate claims"), Chapter 6 concurrency test cases.
