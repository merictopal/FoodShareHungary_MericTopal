import uuid
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from sqlalchemy import func, case
from sqlalchemy.dialects.postgresql import insert as pg_insert
from app.models import User, RestaurantProfile, Offer, Claim, Leaderboard
from app.extensions import db
# IMPORT NEW SERVICE
from app.services.notification_service import NotificationService
from app.utils.validators import parse_int

# --- OFFER EXPIRY (same-day rule) ---
# Offers are end-of-day surplus ("add your fresh surplus meals at the end of the day"): an offer can be
# listed and claimed only on the day it was created, in Budapest local time, and expires at local midnight.
# Computed at query/claim time from created_at (stored as naive UTC); no stored status change, no job.
OFFER_TIMEZONE = ZoneInfo('Europe/Budapest')


def offer_cutoff_utc(now=None):
    """Naive-UTC start of the current Budapest day: offers created before it have expired."""
    now = now or datetime.now(timezone.utc)
    local_midnight = now.astimezone(OFFER_TIMEZONE).replace(hour=0, minute=0, second=0, microsecond=0)
    return local_midnight.astimezone(timezone.utc).replace(tzinfo=None)


def offer_is_live():
    """SQL condition shared by every reader of claimable offers."""
    return Offer.created_at >= offer_cutoff_utc()


def local_time_text(utc_naive, fmt):
    """Formats a stored naive-UTC timestamp in Budapest time (the business time zone of the expiry rule)."""
    return utc_naive.replace(tzinfo=timezone.utc).astimezone(OFFER_TIMEZONE).strftime(fmt)


def claimable_offer_conditions():
    """The one definition of an active offer: listed to students, recommendable, claimable and counted as
    'active' on the admin dashboard (status, stock, same-day expiry, restaurant not suspended)."""
    return (Offer.status == 'active', Offer.quantity > 0, offer_is_live(), offer_restaurant_not_suspended())


def offer_restaurant_not_suspended():
    """SQL condition for student-facing listings: hides offers of restaurants whose owner account an admin
    suspended (the offers themselves stay untouched). IS DISTINCT FROM keeps owners with a NULL status visible."""
    return Offer.restaurant_id.in_(
        db.session.query(RestaurantProfile.id)
        .join(User, User.id == RestaurantProfile.owner_user_id)
        .filter(User.verification_status.is_distinct_from('suspended'))
    )


# --- OFFER INPUT RULES (mirror the restaurant dashboard: two offer types, whole-number quantity,
# percentage discount; title/description limits come from the offers table) ---
OFFER_TYPES = ('free', 'discount')
MAX_TITLE_LENGTH = 100
MAX_INT = 2147483647  # PostgreSQL INTEGER


def validate_offer_input(data):
    """Returns (clean_values, None) or (None, error message). Defaults match the previous behaviour."""
    offer_type = data.get('type')
    if offer_type not in OFFER_TYPES:
        return None, "Offer type must be 'free' or 'discount'."

    title = data.get('title', 'Delicious Meal')
    if not isinstance(title, str) or not title.strip() or len(title) > MAX_TITLE_LENGTH:
        return None, f'Title is required and must be at most {MAX_TITLE_LENGTH} characters.'

    description = data.get('description')
    if not isinstance(description, str) or not description.strip():
        return None, 'Description is required.'

    quantity = parse_int(data.get('quantity', 1))
    if quantity is None or not 1 <= quantity <= MAX_INT:
        return None, 'Quantity must be a whole number of at least 1.'

    discount = 0
    if offer_type == 'discount':
        discount = parse_int(data.get('discount_rate', 0))
        if discount is None or not 0 <= discount <= 100:
            return None, 'Discount must be a whole percentage between 0 and 100.'

    return {'type': offer_type, 'title': title, 'description': description,
            'quantity': quantity, 'discount_rate': discount}, None


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

        values, error = validate_offer_input(data)
        if error:
            return {'success': False, 'error': 'Validation Error', 'message': error, 'status': 400}

        try:
            new_offer = Offer(
                restaurant_id=restaurant.id,
                title=values['title'],
                description=values['description'],
                type=values['type'],
                original_quantity=values['quantity'],
                quantity=values['quantity'],
                discount_rate=values['discount_rate'],
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
            print(f"OFFER CREATE ERROR: {str(e)}")
            return {'success': False, 'error': 'Server Error', 'message': 'The offer could not be created. Please try again.', 'status': 500}

    @staticmethod
    def claim_offer(user_id, offer_id):
        """Handles the reservation of an offer by a student and generates a tracking QR code."""
        offer = Offer.query.get(offer_id)
        
        if not offer:
            return {'success': False, 'error': 'Not Found', 'message': 'Offer not found.', 'status': 404}

        # Offers of a suspended restaurant are hidden from students; knowing the id must not make them claimable
        if not db.session.query(Offer.id).filter(Offer.id == offer.id, offer_restaurant_not_suspended()).first():
            return {'success': False, 'error': 'Not Found', 'message': 'Offer not found.', 'status': 404}
            
        # One claim per student per offer (functional requirement: prevent duplicate claims)
        if Claim.query.filter_by(user_id=user_id, offer_id=offer.id).first():
            return {'success': False, 'error': 'Already Claimed', 'message': 'You have already claimed this offer.', 'status': 409}

        if offer.created_at < offer_cutoff_utc():
            return {'success': False, 'error': 'Offer Expired', 'message': 'This offer has expired.', 'status': 400}

        # CRITICAL INVENTORY CHECK
        if offer.quantity < 1 or offer.status != 'active':
            return {'success': False, 'error': 'Sold Out', 'message': 'Sorry, this item is sold out.', 'status': 400}

        try:
            # Atomic stock reservation: only succeeds while the offer is active and has stock.
            # Concurrent requests wait on the row lock and re-check the WHERE clause, so
            # quantity can never go below zero and no more claims than stock are created.
            # Expiry and restaurant suspension are enforced inside the atomic reservation too
            reserved = db.session.query(Offer).filter(
                Offer.id == offer.id, *claimable_offer_conditions()
            ).update({
                Offer.quantity: Offer.quantity - 1,
                Offer.status: case((Offer.quantity - 1 <= 0, 'sold_out'), else_=Offer.status)
            }, synchronize_session=False)

            if reserved != 1:
                db.session.rollback()
                return {'success': False, 'error': 'Sold Out', 'message': 'Sorry, this item is sold out.', 'status': 400}

            # Race-safe duplicate check: the UPDATE above holds this offer's row lock until commit,
            # so concurrent claims for the same offer run this query one after another and each
            # sees the claims committed before it. Rolling back also restores the reserved unit.
            if Claim.query.filter_by(user_id=user_id, offer_id=offer.id).first():
                db.session.rollback()
                return {'success': False, 'error': 'Already Claimed', 'message': 'You have already claimed this offer.', 'status': 409}

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
            print(f"CLAIM ERROR: {str(e)}")
            return {'success': False, 'error': 'Server Error', 'message': 'The claim could not be processed. Please try again.', 'status': 500}

    @staticmethod
    def verify_claim_qr(qr_code, restaurant_owner_id=None):
        """Validates a scanned QR code, awards Restaurant Points, and triggers Student XP/Level logic."""
        claim = Claim.query.filter_by(qr_code=qr_code).first()

        if not claim:
            return {'success': False, 'error': 'Invalid Code', 'message': 'Invalid QR Code. Claim not found.', 'status': 404}

        # Ownership: a restaurant may only verify claims for its own offers
        if restaurant_owner_id is not None:
            claimed_offer = Offer.query.get(claim.offer_id)
            if not claimed_offer or not claimed_offer.restaurant or claimed_offer.restaurant.owner_user_id != restaurant_owner_id:
                return {'success': False, 'error': 'Wrong Restaurant', 'message': 'This code belongs to another restaurant.', 'status': 403}

        if claim.status == 'validated':
            return {'success': False, 'error': 'Already Used', 'message': 'This code has already been used!', 'status': 400}
            
        if claim.status in ['expired', 'rejected']:
            return {'success': False, 'error': 'Invalid Code', 'message': f'This code is {claim.status}.', 'status': 400}

        try:
            # Atomic state transition: only one concurrent request can move this claim
            # from 'pending' to 'validated'. A parallel UPDATE waits for the row lock and
            # then re-checks the WHERE clause against the committed row, matching 0 rows.
            transitioned = db.session.query(Claim).filter(
                Claim.id == claim.id,
                Claim.status == 'pending'
            ).update({Claim.status: 'validated'}, synchronize_session=False)

            if transitioned != 1:
                db.session.rollback()
                return {'success': False, 'error': 'Already Used', 'message': 'This code has already been used!', 'status': 400}

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
                rest_points_added = 20 if offer.type == 'free' else 10

                # Atomic upsert on UNIQUE(restaurant_id): the first score creates the row, later (or
                # concurrent first) scores add to it – never a second row, never a lost increment.
                lb_table = Leaderboard.__table__
                upsert = pg_insert(lb_table).values(
                    restaurant_id=offer.restaurant_id, points=rest_points_added, meals_shared=1
                )
                db.session.execute(upsert.on_conflict_do_update(
                    index_elements=[lb_table.c.restaurant_id],
                    set_={
                        'points': func.coalesce(lb_table.c.points, 0) + rest_points_added,
                        'meals_shared': func.coalesce(lb_table.c.meals_shared, 0) + 1,
                    }
                ))

                # --- 2. STUDENT GAMIFICATION (XP & LEVELING) ---
                if student:
                    # Dynamic XP calculation for both free and discount
                    student_xp_added = 50 if offer.type == 'free' else 25

                    current_level = student.level if student.level is not None else 1

                    # SQL-side increment; the row stays locked until commit, so the re-read value is ours
                    db.session.query(User).filter(User.id == student.id).update({
                        User.xp: func.coalesce(User.xp, 0) + student_xp_added
                    }, synchronize_session=False)
                    db.session.refresh(student)

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
                # Numbers for clients that build the message in the user's language
                'student_xp': student_xp_added,
                'restaurant_points': rest_points_added,
                'new_level': new_level if level_up_occurred else None,
                'status': 200
            }
            
        except Exception as e:
            db.session.rollback()
            print(f"QR VERIFY ERROR: {str(e)}")
            return {'success': False, 'error': 'Server Error', 'message': 'The code could not be verified. Please try again.', 'status': 500}