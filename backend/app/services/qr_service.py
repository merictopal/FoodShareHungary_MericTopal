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
            
            # FIXED: Passed only the required 'data' dictionary to the notification service
            # Ensure the restaurant name is included in the data dictionary
            data['restaurant_name'] = restaurant.name 
            
            # TRIGGER FCM: Notify all students about the new offer
            NotificationService.notify_students_new_offer(data)
            
            return {
                'success': True,
                'message': 'Offer published successfully!',
                'offer_id': new_offer.id, # NEW: Crucial for linking the AWS S3 image upload to this specific offer
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
        """Validates a scanned QR code, awards Restaurant Points, and triggers Student XP/Level logic."""
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
            
            offer = Offer.query.get(claim.offer_id)
            student = User.query.get(claim.user_id)
            restaurant = None
            
            rest_points_added = 0
            student_xp_added = 0
            level_up_occurred = False
            new_level = 1
            lb = None
            
            if offer:
                # --- 1. RESTAURANT GAMIFICATION (LEADERBOARD) ---
                restaurant = RestaurantProfile.query.filter_by(owner_user_id=offer.restaurant.owner_user_id).first()
                lb = Leaderboard.query.filter_by(restaurant_id=offer.restaurant_id).first()
                
                if not lb:
                    lb = Leaderboard(restaurant_id=offer.restaurant_id, points=0, meals_shared=0)
                    db.session.add(lb)
                
                rest_points_added = 20 if offer.type == 'free' else 10
                lb.points = (lb.points or 0) + rest_points_added
                lb.meals_shared = (lb.meals_shared or 0) + 1
                
                # --- 2. STUDENT GAMIFICATION (XP & LEVELING) ---
                if student:
                    # Dynamic XP calculation for both free and discount
                    student_xp_added = 50 if offer.type == 'free' else 25
                    
                    # Failsafe math
                    current_xp = student.xp if student.xp is not None else 0
                    current_level = student.level if student.level is not None else 1
                    
                    student.xp = current_xp + student_xp_added
                    
                    # Leveling Logic: 1 Level for every 100 XP
                    calculated_level = (student.xp // 100) + 1
                    
                    if calculated_level > current_level:
                        student.level = calculated_level
                        level_up_occurred = True
                        new_level = calculated_level

            db.session.commit()
            
            # --- 3. FCM NOTIFICATIONS ---
            if restaurant:
                owner = User.query.get(restaurant.owner_user_id)
                student_name = student.name if student else "A student"
                try:
                    NotificationService.notify_restaurant_claim_verified(owner, student_name)
                except Exception as notif_e:
                    print(f"⚠️ Notification error, but verification succeeded: {notif_e}")
            
            msg = f'Success! Student earned +{student_xp_added} XP. Restaurant earned +{rest_points_added} Points.'
            if level_up_occurred:
                msg = f'Success! Student Leveled Up to {new_level}!'

            return {
                'success': True,
                'message': msg,
                'status': 200
            }
            
        except Exception as e:
            db.session.rollback()
            return {'success': False, 'message': f'Gamification error: {str(e)}', 'status': 500}