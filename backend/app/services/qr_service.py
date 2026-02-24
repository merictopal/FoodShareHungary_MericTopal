import uuid
import math
from datetime import datetime
# Notification tablosu Firebase ile değiştirileceği için import listesinden çıkarıldı
from app.models import User, RestaurantProfile, Offer, Claim, Leaderboard
from app.extensions import db

class QRService:

    @staticmethod
    def calculate_distance(lat1, lon1, lat2, lon2):
        """Calculates the Haversine distance between two coordinates in kilometers."""
        if not lat1 or not lat2: return 0.0
        
        R = 6371 # Earth radius in km
        dLat = math.radians(lat2 - lat1)
        dLon = math.radians(lon2 - lon1)
        
        a = math.sin(dLat/2) * math.sin(dLat/2) + \
            math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * \
            math.sin(dLon/2) * math.sin(dLon/2)
            
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        return round(R * c, 2) 

    @staticmethod
    def create_offer(data):
        """Creates a new offer for a restaurant."""
        user_id = data.get('user_id')
        restaurant = RestaurantProfile.query.filter_by(owner_user_id=user_id).first()
        
        if not restaurant:
            return {'success': False, 'message': 'Restaurant profile not found.', 'status': 404}

        try:
            # Safely parse quantity and discount
            quantity = int(data.get('quantity', 1))
            discount_val = int(data.get('discount_rate', 0)) if data.get('type') == 'discount' else 0
            
            new_offer = Offer(
                restaurant_id=restaurant.id,
                title=data.get('title', 'Delicious Meal'),
                description=data.get('description'),
                type=data.get('type'), 
                original_quantity=quantity,
                current_quantity=quantity,
                discount_rate=discount_val,
                pickup_start=data.get('pickup_start'),
                pickup_end=data.get('pickup_end'),
                status='active'
            )
            
            db.session.add(new_offer)
            db.session.commit()
            
            # Note: Real-time Push Notifications (FCM) will be implemented here in Phase 2 (March 15)
            
            return {
                'success': True,
                'message': 'Offer published successfully!',
                'status': 201
            }
        except Exception as e:
            db.session.rollback()
            return {'success': False, 'message': f'Error creating offer: {str(e)}', 'status': 500}

    @staticmethod
    def claim_offer(user_id, offer_id):
        """Handles the reservation of an offer by a student and generates a tracking QR code."""
        offer = Offer.query.get(offer_id)
        
        if not offer:
            return {'success': False, 'message': 'Offer not found.', 'status': 404}
            
        # CRITICAL INVENTORY CHECK
        if offer.current_quantity < 1 or offer.status != 'active':
            return {'success': False, 'message': 'Sorry, this item is sold out.', 'status': 400}

        try:
            offer.current_quantity -= 1
            
            if offer.current_quantity == 0:
                offer.status = 'sold_out'

            unique_code = f"OFF-{offer.id}-USR-{user_id}-{uuid.uuid4().hex[:6].upper()}"
            
            claim = Claim(
                user_id=user_id,
                offer_id=offer.id,
                qr_code=unique_code,
                status='pending'
            )
            
            db.session.add(claim)
            db.session.commit()
            
            return {
                'success': True,
                'message': 'Meal reserved! Your QR Code has been generated.',
                'qr_code': unique_code,
                'offer_desc': offer.description,
                'status': 201
            }
        except Exception as e:
            db.session.rollback()
            return {'success': False, 'message': f'Processing error: {str(e)}', 'status': 500}

    @staticmethod
    def verify_claim_qr(qr_code):
        """Validates a scanned QR code by a restaurant and awards Gamification XP points."""
        claim = Claim.query.filter_by(qr_code=qr_code).first()
        
        if not claim:
            return {'success': False, 'message': 'Invalid QR Code. Claim not found.', 'status': 404}
            
        if claim.status == 'validated':
            return {'success': False, 'message': 'This code has already been used!', 'status': 400}
            
        if claim.status in ['expired', 'rejected']:
            return {'success': False, 'message': f'This code is {claim.status}.', 'status': 400}

        try:
            claim.status = 'validated'
            
            if hasattr(claim, 'validated_at'):
                claim.validated_at = datetime.utcnow()
            
            points_to_add = 0
            offer = Offer.query.get(claim.offer_id)
            
            if offer:
                lb = Leaderboard.query.get(offer.restaurant_id)
                if not lb:
                    lb = Leaderboard(restaurant_id=offer.restaurant_id, points=0, meals_shared=0)
                    db.session.add(lb)
                
                points_to_add = 20 if offer.type == 'free' else 10
                
                lb.points += points_to_add
                lb.meals_shared += 1
            
            db.session.commit()
            
            return {
                'success': True,
                'message': f'Validation Successful! You earned +{points_to_add} Points.',
                'points': lb.points if offer else 0,
                'status': 200
            }
        except Exception as e:
            db.session.rollback()
            return {'success': False, 'message': f'Verification server error: {str(e)}', 'status': 500}