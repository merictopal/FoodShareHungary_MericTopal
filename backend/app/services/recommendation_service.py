"""
Hybrid offer recommendations: candidate generation -> weighted scoring -> re-ranking.

Deterministic and explainable (no trained model). The collaborative component is the existing user-based
cosine-similarity filtering over validated claims; it is combined with the user's own restaurant affinity,
distance (request coordinates only, never stored), restaurant popularity, offer freshness and offer value.
See docs/recommendations.md for the rationale of each signal and weight.
"""
import math
from datetime import datetime

import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy import select

from app.extensions import db
from app.models.offer import Claim, Offer
from app.models.user import RestaurantProfile
from app.services.qr_service import claimable_offer_conditions
from app.utils.geo import haversine_km

# --- SCORING CONFIGURATION ---
# Heuristic design choices (they sum to 1), deliberately NOT fitted to the evaluation data.
WEIGHTS = {
    'similar_users': 0.35,        # collaborative filtering: restaurants liked by students with a similar history
    'restaurant_affinity': 0.15,  # the student's own repeat visits to a restaurant
    'proximity': 0.20,            # pickup distance from the request coordinates
    'popularity': 0.15,           # validated claims of the restaurant across all students
    'freshness': 0.10,            # how recently the offer was posted today
    'value': 0.05,                # free meal > discount, larger discount > smaller
}
MIN_CLAIMS_FOR_CF = 5           # below this many validated claims system-wide the similarity matrix is meaningless
PROXIMITY_SCALE_KM = 3.0        # exp(-d / 3 km): 1.0 at the door, ~0.51 at 2 km, ~0.19 at 5 km
FRESHNESS_WINDOW_HOURS = 24.0   # offers expire at Budapest midnight, so no live offer is older than a day
CANDIDATE_LIMIT = 200           # newest claimable offers considered per request (all of them at MVP scale)


def _not_claimed_by(user_id):
    """Excludes offers the user already holds a claim for (any status): claiming them again is always a 409
    (UNIQUE(user_id, offer_id)), so recommending them would only offer a button that cannot work."""
    return ~Offer.id.in_(select(Claim.offer_id).where(Claim.user_id == user_id))


# --- SIGNALS (pure functions, unit-tested in tests/edge/test_edge_recommendation_scoring.py) ---
def collaborative_scores(pairs, target_user_id):
    """User-based collaborative filtering over (user_id, restaurant_id) validated-claim pairs.

    Returns {restaurant_id: Σ similarity × similar user's claim count} for restaurants the target has not
    claimed from, or {} when CF cannot run (too few claims, target without history, no similar users)."""
    if len(pairs) < MIN_CLAIMS_FOR_CF:
        return {}

    # User-Item matrix: rows = user_id, columns = restaurant_id, values = claim count
    df = pd.DataFrame(pairs, columns=['user_id', 'restaurant_id'])
    df['claim_count'] = 1
    user_item_df = df.groupby(['user_id', 'restaurant_id'])['claim_count'].sum().reset_index()
    matrix = user_item_df.pivot(index='user_id', columns='restaurant_id', values='claim_count').fillna(0)
    if target_user_id not in matrix.index:
        return {}

    user_similarity = cosine_similarity(matrix)
    similarity_df = pd.DataFrame(user_similarity, index=matrix.index, columns=matrix.index)
    similar_users = similarity_df[target_user_id].sort_values(ascending=False).drop(target_user_id)

    scores = {}
    target_user_claims = set(matrix.loc[target_user_id][matrix.loc[target_user_id] > 0].index)
    for sim_user_id, similarity_score in similar_users.items():
        if similarity_score <= 0:
            continue
        sim_user_claims = matrix.loc[sim_user_id]
        for rest_id in sim_user_claims[sim_user_claims > 0].index:
            # Visited restaurants are covered by restaurant_affinity; CF is the discovery signal
            if rest_id not in target_user_claims:
                scores[rest_id] = scores.get(rest_id, 0) + similarity_score * sim_user_claims[rest_id]
    return {rest_id: float(score) for rest_id, score in scores.items()}


def claim_counts(pairs, user_id=None):
    """Validated claims per restaurant, for one user (affinity) or for everybody (popularity)."""
    counts = {}
    for claim_user_id, restaurant_id in pairs:
        if user_id is None or claim_user_id == user_id:
            counts[restaurant_id] = counts.get(restaurant_id, 0) + 1
    return counts


def normalise_by_max(values):
    """Scales raw restaurant scores to [0, 1] by the largest one, so signals with different raw units (CF
    similarity sums vs. claim counts) are only weighed against each other through WEIGHTS."""
    top = max(values.values(), default=0)
    if top <= 0:
        return {}
    return {key: value / top for key, value in values.items()}


def proximity_score(distance_km):
    return math.exp(-max(distance_km, 0.0) / PROXIMITY_SCALE_KM)


def freshness_score(created_at, now):
    age_hours = max((now - created_at).total_seconds(), 0.0) / 3600
    return max(0.0, 1.0 - age_hours / FRESHNESS_WINDOW_HOURS)


def value_score(offer_type, discount_rate):
    if str(offer_type or '').strip().lower() == 'free':
        return 1.0
    return min(max(discount_rate or 0, 0), 100) / 100


def active_weights(available):
    """Drops signals that carry no information for this request (e.g. no history, no coordinates) and rescales
    the remaining weights to sum to 1, so the ranking is decided by the signals that do exist."""
    weights = {name: weight for name, weight in WEIGHTS.items() if name in available}
    total = sum(weights.values())
    return {name: weight / total for name, weight in weights.items()} if total else {}


def score_candidates(candidates, similar_users, affinity, popularity, user_location, now):
    """Weighted sum of normalised signals for each candidate offer.

    candidates: objects with id, restaurant_id, created_at, type, discount_rate, lat, lng.
    similar_users / affinity / popularity: raw per-restaurant scores (normalised here).
    user_location: (lat, lng) from the request, or None.
    Returns [(candidate, score, contributions)] where contributions holds each signal's weighted share."""
    similar_users, affinity, popularity = (normalise_by_max(similar_users), normalise_by_max(affinity),
                                           normalise_by_max(popularity))
    available = {'freshness', 'value'}
    available |= {name for name, signal in (('similar_users', similar_users), ('restaurant_affinity', affinity),
                                            ('popularity', popularity)) if signal}
    if user_location is not None:
        available.add('proximity')
    weights = active_weights(available)

    scored = []
    for candidate in candidates:
        signals = {
            'similar_users': similar_users.get(candidate.restaurant_id, 0.0),
            'restaurant_affinity': affinity.get(candidate.restaurant_id, 0.0),
            'popularity': popularity.get(candidate.restaurant_id, 0.0),
            'freshness': freshness_score(candidate.created_at, now),
            'value': value_score(candidate.type, candidate.discount_rate),
            'proximity': 0.0,
        }
        if user_location is not None and candidate.lat is not None and candidate.lng is not None:
            signals['proximity'] = proximity_score(haversine_km(user_location[0], user_location[1],
                                                                candidate.lat, candidate.lng))
        contributions = {name: weight * signals[name] for name, weight in weights.items()}
        scored.append((candidate, sum(contributions.values()), contributions))
    return scored


def rerank(scored, top_n):
    """Score order (ties: lower offer id first, deterministic), then diversity: one offer per restaurant
    until every restaurant is used, then the remaining offers fill the list in score order."""
    ordered = sorted(scored, key=lambda item: (-item[1], item[0].id))
    first_per_restaurant, rest, seen = [], [], set()
    for item in ordered:
        if item[0].restaurant_id in seen:
            rest.append(item)
        else:
            seen.add(item[0].restaurant_id)
            first_per_restaurant.append(item)
    return (first_per_restaurant + rest)[:top_n]


def reasons(contributions, limit=3):
    """Machine-readable signal names that contributed most (no user-facing text)."""
    ranked = sorted(((share, name) for name, share in contributions.items() if share > 0), key=lambda x: (-x[0], x[1]))
    return [name for _, name in ranked[:limit]]


class _Candidate:
    __slots__ = ('offer', 'id', 'restaurant_id', 'created_at', 'type', 'discount_rate', 'lat', 'lng')

    def __init__(self, offer, lat, lng):
        self.offer = offer
        self.id, self.restaurant_id, self.created_at = offer.id, offer.restaurant_id, offer.created_at
        self.type, self.discount_rate = offer.type, offer.discount_rate
        self.lat, self.lng = lat, lng


class RecommendationService:
    @staticmethod
    def get_recommended_offers(target_user_id, top_n=5, user_lat=None, user_lng=None, now=None):
        """Personalised recommendations. Students without validated claims go to the cold-start path."""
        pairs = RecommendationService._validated_claim_pairs()
        affinity = claim_counts(pairs, target_user_id)
        if not affinity:
            return RecommendationService._get_fallback_offers(top_n, target_user_id, user_lat, user_lng, now)
        return RecommendationService._rank(target_user_id, top_n, user_lat, user_lng, now,
                                           similar_users=collaborative_scores(pairs, target_user_id),
                                           affinity=affinity, popularity=claim_counts(pairs))

    @staticmethod
    def _get_fallback_offers(limit=5, target_user_id=None, user_lat=None, user_lng=None, now=None):
        """Cold start (no own history): the same scorer with only the non-personal signals - proximity,
        popularity, freshness and value."""
        popularity = claim_counts(RecommendationService._validated_claim_pairs())
        return RecommendationService._rank(target_user_id, limit, user_lat, user_lng, now,
                                           similar_users={}, affinity={}, popularity=popularity)

    @staticmethod
    def _validated_claim_pairs():
        return db.session.query(Claim.user_id, Offer.restaurant_id).join(
            Offer, Claim.offer_id == Offer.id
        ).filter(Claim.status == 'validated').all()

    @staticmethod
    def _rank(target_user_id, top_n, user_lat, user_lng, now, similar_users, affinity, popularity):
        # 1. Candidate generation: every claimable offer (hard validity filters), newest first, capped
        query = db.session.query(Offer, RestaurantProfile.lat, RestaurantProfile.lng).join(
            RestaurantProfile, Offer.restaurant_id == RestaurantProfile.id
        ).filter(*claimable_offer_conditions())
        if target_user_id is not None:
            query = query.filter(_not_claimed_by(target_user_id))
        rows = query.order_by(Offer.created_at.desc(), Offer.id.desc()).limit(CANDIDATE_LIMIT).all()
        candidates = [_Candidate(offer, lat, lng) for offer, lat, lng in rows]

        # 2. Scoring, 3. re-ranking
        user_location = (user_lat, user_lng) if user_lat is not None and user_lng is not None else None
        scored = score_candidates(candidates, similar_users, affinity, popularity, user_location,
                                  now or datetime.utcnow())
        output = []
        for candidate, score, contributions in rerank(scored, top_n):
            offer_data = candidate.offer.to_dict()
            offer_data['reco_score'] = round(score, 4)
            offer_data['reco_reasons'] = reasons(contributions)
            output.append(offer_data)
        return output
