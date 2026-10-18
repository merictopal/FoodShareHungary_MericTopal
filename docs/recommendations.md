# Recommendations (hybrid: collaborative filtering + weighted signals)

## Purpose
Personalised offer list for a student. Deterministic, explainable weighted scoring (not machine learning):
candidate generation -> scoring -> re-ranking (upgrade of 2026-10-08; before it, CF only with a "newest" fallback).

## Files
- `backend/app/services/recommendation_service.py`: `RecommendationService.get_recommended_offers(user_id, top_n, user_lat, user_lng)`,
  `_get_fallback_offers` (cold start), pure functions `collaborative_scores`, `claim_counts`, `score_candidates`, `rerank`, `reasons`; `WEIGHTS`
- `backend/app/utils/geo.py`: `haversine_km` (shared by the service and the route)
- `backend/app/routes/student_routes.py`: `GET /api/recommendations/<user_id>?lat&lng` (token_required; own id or admin)
- Mobile: `FoodShareMobile/src/screens/student/home/HomeScreen.tsx`, `RecommendedCard.tsx` (unchanged; ignore the new fields)
- Evaluation: `thesis_evidence/2026-10-08/scripts/t08_reco_hybrid.py`, `reco_hybrid_results.json` (old: `2026-09-29/scripts/t07_reco.py`)
- Tests: `backend/tests/edge/test_edge_recommendation_scoring.py` (gate), `backend/tests/writes/test_recommendation_claim_filter.py`

## Workflow
1. **Signals from validated claims** (one query of (user, restaurant) pairs): CF scores (unchanged user-based cosine CF over a
   user x restaurant count matrix; >= 5 validated claims system-wide; only restaurants the user has NOT visited), own affinity
   (the user's validated claims per restaurant), popularity (everyone's validated claims per restaurant).
2. **Cold start**: no own validated claim -> `_get_fallback_offers`, the same scorer with only proximity, popularity, freshness, value.
3. **Candidate generation**: every claimable offer – active, quantity > 0, created today, restaurant not suspended, not already
   claimed by this user (any status) – newest first, capped at 200.
4. **Scoring**: `score = Σ w_s · x_s` over the *available* signals, weights rescaled to sum to 1. Each `x_s` is in [0, 1]:
   | signal | weight | normalisation |
   |---|---|---|
   | `similar_users` (CF) | 0.35 | raw / max over restaurants |
   | `restaurant_affinity` | 0.15 | own claims / own max |
   | `proximity` | 0.20 | `exp(-d / 3 km)`, d = Haversine from request lat/lng |
   | `popularity` | 0.15 | claims / max |
   | `freshness` | 0.10 | `1 - age_h / 24` |
   | `value` | 0.05 | free = 1, discount = rate / 100 |
   A signal is unavailable (weight dropped) when it is empty for everyone: no CF result, no own history, no popularity data,
   or no `lat`/`lng` in the request (the route passes coordinates only when the client sent both; they are never stored).
5. **Re-ranking**: score desc, ties -> lower offer id; then at most one offer per restaurant until every restaurant is used,
   remaining offers fill the list in score order. Top 5.
6. Response: `offer.to_dict()` + additive `reco_score` (0..1) and `reco_reasons` (up to 3 signal codes, no user-facing text);
   the route adds `distance`, `lat`/`lng`, `is_recommended: true` as before.

## Decisions
- The ordering fix (fix 9): SQL `IN (…)` loses the rank, so results are re-sorted by the CF rank in Python.

## Claimed offers (Fix 7 – 2026-10-07)
- Both paths (collaborative filtering candidates and the cold-start fallback) exclude offers the target user already holds a
  claim row for, in any status (`_not_claimed_by`, a `NOT IN (SELECT offer_id FROM claims WHERE user_id = …)` filter). This
  mirrors the claim rule: `UNIQUE(user_id, offer_id)` makes a second claim a 409 whatever the first claim's status.
  The fallback applies it before `LIMIT`, so claimed offers are replaced rather than shrinking the list. `/offers` is unchanged.

## Known limitations
- `<user_id>` has no `<int:>` converter, so `abc` → 500 leaking `str(e)` (pinned `xfail`).
- Real DB has 0 validated claims from real users, so everyone gets the fallback.
- Distance is computed in Python, not PostGIS (see `location.md`).
- Weights are design choices, not fitted (no real interaction data to fit them on). Expiry proximity is not a signal:
  every live offer expires at the same Budapest midnight. There is no category/cuisine field. Low stock is a filter only.
- Previously visited restaurants can be recommended again (affinity); the exact claimed offer never.
- The similarity matrix is rebuilt on every request, with no caching (fine at MVP scale).

## Evidence
Synthetic dataset only, run inside a rolled-back transaction: 8 users × 5 restaurants, 23 validated claims, leave-one-out over 19 cases.
CF MRR **0.667** (Hit@1 8, Hit@2 16) vs. popularity MRR **0.307**. Before the ordering fix: MRR 0.627. The data was hand-built and clustered, so this
shows the implementation works as designed, **not** that it beats popularity in real use. Order = score order went from 4/8 to 8/8 users.

Hybrid evaluation 2026-10-08 (same data/protocol, `t08_reco_hybrid.py`; t07 itself no longer runs its DB part because
it puts repeat claims on one offer, which `claims_user_offer_key` now rejects): MRR / Hit@1 / Hit@3 / Recall@3 –
old CF 0.667 / 8 / 18 / 0.947; popularity 0.307 / 0 / 11 / 0.579; hybrid as deployed 0.547 / 6 / 13 / 0.684;
hybrid on the baselines' candidate set (unvisited only) 0.596 / 6 / 19 / 1.000. Lower MRR is expected on this protocol: the hidden
item is always an unvisited restaurant, and the data has no positions/times/prices, so proximity, freshness and value cannot act.
Real service = pure-function order for 8/8 users (rolled-back transaction). Weights NOT tuned on this data.

## Thesis
Recommendation chapter: cite the evaluation with its caveats. Real data is insufficient (PROJECT_STATE §4, §9).
