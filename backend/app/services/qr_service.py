import uuid
import math
from datetime import datetime
from app.models import User, RestaurantProfile, Offer, Claim, Notification, Leaderboard
from app.extensions import db

class QRService:

    @staticmethod
    def calculate_distance(lat1, lon1, lat2, lon2):
        if not lat1 or not lat2: return 0.0
        
        R = 6371 
        dLat = math.radians(lat2 - lat1)
        dLon = math.radians(lon2 - lon1)
        
        a = math.sin(dLat/2) * math.sin(dLat/2) + \
            math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * \
            math.sin(dLon/2) * math.sin(dLon/2)
            
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        return round(R * c, 2) 

    @staticmethod
    def create_offer(data):
        user_id = data.get('user_id')
        
        restaurant = RestaurantProfile.query.filter_by(owner_user_id=user_id).first()
        
        if not restaurant:
            return {'success': False, 'message': 'Restaurant profile not found.', 'status': 404}

        try:
            discount_val = int(data.get('discount_rate', 0)) if data.get('type') == 'discount' else 0
            
            new_offer = Offer(
                restaurant_id=restaurant.id,
                title=data.get('title', 'Delicious Meal'),
                description=data.get('description'),
                type=data.get('type'), 
                original_quantity=int(data.get('quantity', 1)),
                current_quantity=int(data.get('quantity', 1)),
                discount_rate=discount_val,
                pickup_start=data.get('pickup_start'),
                pickup_end=data.get('pickup_end')
            )
            
            db.session.add(new_offer)
            
            students = User.query.filter_by(role='student').all()
            for s in students:
                notif = Notification(
                    user_id=s.id,
                    title="New Offer! 🍕",
                    message=f"{restaurant.name} shared: {new_offer.title}!"
                )
                db.session.add(notif)
            
            db.session.commit()
            
            return {
                'success': True,
                'message': 'Offer published successfully and notifications sent.',
                'status': 201
            }
        except Exception as e:
            db.session.rollback()
            return {'success': False, 'message': f'Error: {str(e)}', 'status': 500}

    @staticmethod
    def claim_offer(user_id, offer_id):
        offer = Offer.query.get(offer_id)
        
        if not offer:
            return {'success': False, 'message': 'Offer not found.', 'status': 404}
            
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
        claim = Claim.query.filter_by(qr_code=qr_code).first()
        
        if not claim:
            return {'success': False, 'message': 'Invalid QR Code.', 'status': 404}
            
        if claim.status == 'validated':
            return {'success': False, 'message': 'This code has already been used!', 'status': 400}
            
        if claim.status == 'expired':
            return {'success': False, 'message': 'This code has expired.', 'status': 400}

        try:
            claim.status = 'validated'
            claim.validated_at = datetime.utcnow()
            
            offer = Offer.query.get(claim.offer_id)
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
                'points': lb.points,
                'status': 200
            }
        except Exception as e:
            db.session.rollback()
            return {'success': False, 'message': f'Server error: {str(e)}', 'status': 500}