import uuid
from datetime import datetime
from app.models import User, RestaurantProfile, Offer, Claim, Leaderboard
from app.extensions import db
# IMPORT NEW SERVICE
from app.services.notification_service import NotificationService

class QRService:

    # --- PHASE 2 CLEANUP ---
    # The 'calculate_distance' function has been completely removed.
    # Spatial distance calculations are now handled natively by PostGIS in routes.py.

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
                quantity=quantity,
                discount_rate=discount_val,
                status='active'
            )
            
            db.session.add(new_offer)
            db.session.commit()
            
            # TRIGGER FCM: Notify all students about the new offer
            students = User.query.filter_by(role='student').all()
            NotificationService.notify_students_new_offer(students, restaurant.name, new_offer.description)
            
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
        if offer.quantity < 1 or offer.status != 'active':
            return {'success': False, 'message': 'Sorry, this item is sold out.', 'status': 400}

        try:
            offer.quantity -= 1
            
            if offer.quantity == 0:
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
            restaurant = None
            
            if offer:
                restaurant = RestaurantProfile.query.get(offer.restaurant_id)
                lb = Leaderboard.query.get(offer.restaurant_id)
                if not lb:
                    lb = Leaderboard(restaurant_id=offer.restaurant_id, points=0, meals_shared=0)
                    db.session.add(lb)
                
                points_to_add = 20 if offer.type == 'free' else 10
                
                lb.points += points_to_add
                lb.meals_shared += 1
            
            db.session.commit()
            
            # TRIGGER FCM: Notify the restaurant owner that the claim was successfully verified
            if restaurant:
                owner = User.query.get(restaurant.owner_user_id)
                student = User.query.get(claim.user_id)
                student_name = student.name if student else "A student"
                NotificationService.notify_restaurant_claim_verified(owner, student_name)
            
            return {
                'success': True,
                'message': f'Validation Successful! You earned +{points_to_add} Points.',
                'points': lb.points if offer else 0,
                'status': 200
            }
        except Exception as e:
            db.session.rollback()
            return {'success': False, 'message': f'Verification server error: {str(e)}', 'status': 500}