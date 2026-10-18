"""
Edge: hybrid recommendation scoring (pure functions, no DB access).

Covers normalisation (no signal dominates through its raw scale), weight renormalisation for cold start and
missing coordinates, distance behaviour, re-ranking diversity/determinism and the unchanged CF component.
"""
from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest

from app.services import recommendation_service as reco

NOW = datetime(2026, 10, 8, 12, 0)
HOME = (47.5, 19.05)


def offer(id, restaurant_id, lat=47.5, lng=19.05, age_minutes=60, type="free", discount_rate=0):
    return SimpleNamespace(id=id, restaurant_id=restaurant_id, lat=lat, lng=lng,
                           created_at=NOW - timedelta(minutes=age_minutes), type=type, discount_rate=discount_rate)


def ranked_ids(scored, top_n=10):
    return [c.id for c, _, _ in reco.rerank(scored, top_n)]


def test_weights_are_explicit_and_sum_to_one():
    assert reco.WEIGHTS == {'similar_users': 0.35, 'restaurant_affinity': 0.15, 'proximity': 0.20,
                            'popularity': 0.15, 'freshness': 0.10, 'value': 0.05}
    assert sum(reco.WEIGHTS.values()) == pytest.approx(1.0)


def test_signals_are_normalised_before_weighting():
    # Affinity has a much larger raw scale (10 claims) than CF (0.3); after max-normalisation both top out at 1.0,
    # so the CF favourite wins by weight (0.35 > 0.15), not by raw magnitude.
    scored = reco.score_candidates([offer(1, 10), offer(2, 20)], similar_users={10: 0.3}, affinity={20: 10},
                                   popularity={}, user_location=None, now=NOW)
    (_, cf_score, cf_parts), (_, aff_score, aff_parts) = scored
    assert cf_score > aff_score
    assert max(cf_parts.values()) <= 1 and max(aff_parts.values()) <= 1
    assert all(0 <= s <= 1 for _, s, _ in scored)


def test_cold_start_uses_only_non_personal_signals():
    scored = reco.score_candidates([offer(1, 10)], similar_users={}, affinity={}, popularity={10: 3},
                                   user_location=HOME, now=NOW)
    parts = scored[0][2]
    assert set(parts) == {'proximity', 'popularity', 'freshness', 'value'}
    weights = reco.active_weights(set(parts))
    assert sum(weights.values()) == pytest.approx(1.0)
    assert weights['proximity'] == pytest.approx(0.20 / 0.50)


def test_cold_start_without_any_claims_or_location_still_ranks():
    scored = reco.score_candidates([offer(1, 10, age_minutes=300), offer(2, 20, age_minutes=10)],
                                   similar_users={}, affinity={}, popularity={}, user_location=None, now=NOW)
    assert set(scored[0][2]) == {'freshness', 'value'}
    assert ranked_ids(scored) == [2, 1]  # newer first when nothing else is known


def test_nearer_offer_wins_when_everything_else_is_equal():
    near, far = offer(1, 10, lat=47.501, lng=19.05), offer(2, 20, lat=47.6, lng=19.05)  # ~0.1 km vs ~11 km
    scored = reco.score_candidates([far, near], {}, {}, {}, user_location=HOME, now=NOW)
    assert ranked_ids(scored) == [1, 2]


def test_without_coordinates_distance_has_no_effect():
    near, far = offer(1, 10, lat=47.501, lng=19.05), offer(2, 20, lat=47.6, lng=19.05)
    scored = reco.score_candidates([far, near], {}, {}, {}, user_location=None, now=NOW)
    assert all('proximity' not in parts for _, _, parts in scored)
    assert scored[0][1] == pytest.approx(scored[1][1])
    assert ranked_ids(scored) == [1, 2]  # tie -> lower offer id, deterministic


def test_proximity_freshness_value_shapes():
    assert reco.proximity_score(0) == 1.0
    assert reco.proximity_score(1) > reco.proximity_score(5) > reco.proximity_score(50) > 0
    assert reco.proximity_score(-1) == 1.0
    assert reco.freshness_score(NOW, NOW) == 1.0
    assert reco.freshness_score(NOW - timedelta(hours=30), NOW) == 0.0
    assert reco.freshness_score(NOW + timedelta(minutes=5), NOW) == 1.0  # clock skew is clamped
    assert reco.value_score('free', 0) == 1.0
    assert reco.value_score('discount', 30) == pytest.approx(0.3)
    assert reco.value_score('discount', None) == 0.0
    assert reco.value_score('discount', 250) == 1.0


def test_previously_visited_restaurant_is_a_positive_signal_not_an_exclusion():
    scored = reco.score_candidates([offer(1, 10), offer(2, 20)], similar_users={}, affinity={10: 2},
                                   popularity={}, user_location=None, now=NOW)
    assert ranked_ids(scored) == [1, 2]
    assert reco.reasons(scored[0][2])[0] == 'restaurant_affinity'


def test_rerank_puts_one_offer_per_restaurant_first_then_fills():
    candidates = [offer(1, 10, age_minutes=1), offer(2, 10, age_minutes=2), offer(3, 10, age_minutes=3),
                  offer(4, 20, age_minutes=600)]
    scored = reco.score_candidates(candidates, {}, {}, {}, user_location=None, now=NOW)
    assert ranked_ids(scored, top_n=2) == [1, 4]
    assert ranked_ids(scored) == [1, 4, 2, 3]
    assert ranked_ids(scored) == ranked_ids(list(reversed(scored)))  # input order does not matter


def test_rerank_handles_empty_and_short_lists():
    assert reco.rerank([], 5) == []
    scored = reco.score_candidates([offer(1, 10)], {}, {}, {}, None, NOW)
    assert ranked_ids(scored, top_n=5) == [1]


def test_reasons_are_signal_codes_only():
    scored = reco.score_candidates([offer(1, 10)], {10: 1.0}, {10: 1}, {10: 1}, HOME, NOW)
    codes = reco.reasons(scored[0][2])
    assert 1 <= len(codes) <= 3 and set(codes) <= set(reco.WEIGHTS)
    assert codes[0] == 'similar_users'


# --- COLLABORATIVE COMPONENT (unchanged algorithm, extracted into a pure function) ---
PAIRS = [(u, r) for u, d in {1: {'A': 2, 'B': 1}, 2: {'A': 1, 'B': 2, 'C': 1}, 3: {'A': 1, 'C': 2},
                               4: {'D': 2, 'E': 1}}.items() for r, n in d.items() for _ in range(n)]


def test_cf_needs_enough_claims_and_target_history():
    assert reco.collaborative_scores(PAIRS[:4], 1) == {}
    assert reco.collaborative_scores(PAIRS, 99) == {}


def test_cf_scores_only_unvisited_restaurants_of_similar_users():
    scores = reco.collaborative_scores(PAIRS, 1)
    assert set(scores) == {'C'}  # D/E come from a user with zero similarity, A/B are already visited
    assert scores['C'] > 0


def test_claim_counts_for_user_and_everyone():
    assert reco.claim_counts(PAIRS, 1) == {'A': 2, 'B': 1}
    assert reco.claim_counts(PAIRS)['A'] == 4
    assert reco.claim_counts([], 1) == {}
