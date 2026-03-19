import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from app.models.offer import Claim, Offer
from app.models.user import RestaurantProfile
from app.extensions import db

class RecommendationService:
    @staticmethod
    def get_recommended_offers(target_user_id, top_n=5):
        """
        Generates personalized offer recommendations using Collaborative Filtering.
        Based on Cosine Similarity of user claim histories.
        """
        
        # 1. Fetch all validated claims with their associated restaurant IDs
        # We look at which user claimed from which restaurant
        query = db.session.query(Claim.user_id, Offer.restaurant_id).join(
            Offer, Claim.offer_id == Offer.id
        ).filter(Claim.status == 'validated').all()

        # If there are not enough claims in the system, return popular/latest active offers (Cold Start Fallback)
        if len(query) < 5:
            return RecommendationService._get_fallback_offers(top_n)

        # 2. Convert query results to a Pandas DataFrame
        df = pd.DataFrame(query, columns=['user_id', 'restaurant_id'])

        # Create a "Claim Count" column (How many times a user claimed from a specific restaurant)
        df['claim_count'] = 1
        user_item_df = df.groupby(['user_id', 'restaurant_id'])['claim_count'].sum().reset_index()

        # 3. Create the User-Item Matrix
        # Rows = user_id, Columns = restaurant_id, Values = claim_count
        matrix = user_item_df.pivot(index='user_id', columns='restaurant_id', values='claim_count').fillna(0)

        # Check if target_user is in the matrix. If not, fallback to popular offers (Cold Start for new user)
        if target_user_id not in matrix.index:
            return RecommendationService._get_fallback_offers(top_n)

        # 4. Calculate Cosine Similarity between all users
        user_similarity = cosine_similarity(matrix)
        similarity_df = pd.DataFrame(user_similarity, index=matrix.index, columns=matrix.index)

        # 5. Get similar users to our target_user
        similar_users = similarity_df[target_user_id].sort_values(ascending=False)
        
        # Remove the target user themselves from the similar users list
        similar_users = similar_users.drop(target_user_id)

        if similar_users.empty:
            return RecommendationService._get_fallback_offers(top_n)

        # 6. Find restaurants claimed by similar users, heavily weighted by similarity score
        recommended_restaurants = {}
        target_user_claims = set(matrix.loc[target_user_id][matrix.loc[target_user_id] > 0].index)

        for sim_user_id, similarity_score in similar_users.items():
            if similarity_score <= 0:
                continue
                
            sim_user_claims = matrix.loc[sim_user_id]
            # Find restaurants the similar user has claimed from
            claimed_restaurants = sim_user_claims[sim_user_claims > 0].index
            
            for rest_id in claimed_restaurants:
                # Only recommend restaurants the target user hasn't visited yet
                if rest_id not in target_user_claims:
                    if rest_id not in recommended_restaurants:
                        recommended_restaurants[rest_id] = 0
                    # Weight the recommendation by the similarity score and the amount of claims
                    recommended_restaurants[rest_id] += similarity_score * sim_user_claims[rest_id]

        # Sort the recommended restaurants by their weighted score
        sorted_recommended_restaurants = sorted(recommended_restaurants.items(), key=lambda x: x[1], reverse=True)
        top_restaurant_ids = [rest_id for rest_id, score in sorted_recommended_restaurants][:top_n]

        # 7. If AI couldn't find enough unique recommendations, fill with fallback
        if not top_restaurant_ids:
            return RecommendationService._get_fallback_offers(top_n)

        # 8. Fetch the active offers belonging to the recommended restaurants
        recommended_offers = Offer.query.filter(
            Offer.restaurant_id.in_(top_restaurant_ids),
            Offer.status == 'active',
            Offer.quantity > 0
        ).limit(top_n).all()

        # If no active offers from those restaurants, fallback
        if not recommended_offers:
            return RecommendationService._get_fallback_offers(top_n)

        return [offer.to_dict() for offer in recommended_offers]

    @staticmethod
    def _get_fallback_offers(limit=5):
        """
        Fallback method for cold starts (new users or not enough data).
        Returns the most recently added active offers.
        """
        offers = Offer.query.filter_by(status='active').filter(Offer.quantity > 0).order_by(Offer.created_at.desc()).limit(limit).all()
        return [offer.to_dict() for offer in offers]