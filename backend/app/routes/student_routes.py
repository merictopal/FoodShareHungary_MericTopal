from flask import Blueprint, jsonify, request, g
from app.extensions import db
from app.utils.decorators import token_required, student_required
from app.models import User, RestaurantProfile, Offer, Claim, Leaderboard, Notification
from app.services.qr_service import QRService, claimable_offer_conditions, local_time_text
from app.services.auth_service import AuthService
from app.utils.validators import parse_id
from app.utils.geo import haversine_km
from app.services.recommendation_service import RecommendationService
from sqlalchemy import desc, func, literal

student_bp = Blueprint('student', __name__)


def _request_location():
    """
    The caller's position from the lat/lng query parameters: (lat, lng), None when the client sent no position
    (both needed), or 'invalid' for non-numeric / out-of-range values. There is deliberately no default
    position: the client's real position is used for this request only and never stored, and a missing one
    means "unknown" (no distance, no proximity ranking), never a placeholder city.
    """
    if 'lat' not in request.args or 'lng' not in request.args:
        return None
    lat, lng = AuthService.parse_coordinates(request.args.get('lat'), request.args.get('lng'))
    return 'invalid' if lat is None else (lat, lng)


INVALID_COORDINATES = {"success": False, "error": "Validation Error",
                       "message": "lat must be -90..90 and lng -180..180."}

# --- GET OFFERS WITH POSTGIS ---
@student_bp.route('/offers', methods=['GET'])
def get_offers():
    # Coordinates are validated (numeric, WGS84 range) before the query so bad input is a 400, not a 500
    location = _request_location()
    if location == 'invalid':
        return jsonify(INVALID_COORDINATES), 400

    try:
        if location:
            # Distance in km from the caller (PostGIS ST_DistanceSphere), nearest first
            user_point = func.ST_SetSRID(func.ST_MakePoint(location[1], location[0]), 4326)
            distance_calc = (func.ST_DistanceSphere(RestaurantProfile.geom, user_point) / 1000).label('distance')
            order = distance_calc
        else:
            # Position unknown: no distance, newest first
            distance_calc = literal(None).label('distance')
            order = desc(Offer.created_at)

        results = db.session.query(Offer, RestaurantProfile, distance_calc)\
            .join(RestaurantProfile, Offer.restaurant_id == RestaurantProfile.id)\
            .filter(*claimable_offer_conditions())\
            .order_by(order, Offer.id.desc())\
            .all()

        output = []
        for offer, rest, dist in results:
            output.append({
                'id': offer.id,
                'restaurant': rest.name,
                # Pickup location for the Home restaurant card / "Open in Google Maps" (address may be NULL)
                'restaurant_id': rest.id,
                'address': rest.address,
                'type': offer.type,
                'description': offer.description,
                'quantity': offer.quantity,
                'discount_rate': offer.discount_rate,
                'lat': rest.lat, 
                'lng': rest.lng,
                'distance': round(dist, 2) if dist is not None else None,
                'image_url': offer.image_url 
            })
            
        return jsonify(output)
    except Exception as e:
        print(f"PostGIS Spatial Query Error: {str(e)}")
        return jsonify({"success": False, "error": "Server Error", "message": "Offers could not be loaded."}), 500

# --- RECOMMENDATIONS (hybrid scoring, see recommendation_service.py) ---
@student_bp.route('/recommendations/<int:user_id>', methods=['GET'])
@token_required
def get_ai_recommendations(user_id):
    try:
        safe_user_id = user_id
        # Ownership: personalised results are derived from the user's claim history
        if g.user.id != safe_user_id and g.user.role != 'admin':
            return jsonify({'success': False, 'message': 'Forbidden. You can only view your own recommendations.'}), 403
        location = _request_location()
        if location == 'invalid':
            return jsonify(INVALID_COORDINATES), 400

        # Proximity only ranks when the client sent its real position (the app sends none without a device fix)
        recommended_offers = RecommendationService.get_recommended_offers(
            target_user_id=safe_user_id, top_n=5,
            user_lat=location[0] if location else None, user_lng=location[1] if location else None)

        output = []
        for offer_data in recommended_offers:
            rest_lat = offer_data.get('location', {}).get('lat')
            rest_lng = offer_data.get('location', {}).get('lng')
            dist = (haversine_km(location[0], location[1], rest_lat, rest_lng)
                    if location and rest_lat is not None and rest_lng is not None else None)

            offer_type = str(offer_data.get('type', 'free')).lower().strip()

            # Extract for React Native safety
            offer_data['lat'] = rest_lat
            offer_data['lng'] = rest_lng
            offer_data['type'] = offer_type
            offer_data['distance'] = round(dist, 2) if dist is not None else None
            offer_data['is_recommended'] = True

            output.append(offer_data)

        return jsonify(output), 200

    except Exception as e:
        print(f"Recommendation Error: {str(e)}")
        return jsonify({"success": False, "error": "Server Error", "message": "Recommendations could not be loaded."}), 500

# --- CLAIM AN OFFER ---
@student_bp.route('/offers/claim', methods=['POST'])
@student_required
def claim_offer():
    data = request.get_json() or {}
    # The claimant is always the authenticated user; a client-supplied user_id is ignored.
    if g.user.verification_status != 'verified':
        return jsonify({'success': False, 'error': 'Verification Required', 'message': 'You need a verified student ID to claim meals.', 'status': 403}), 403
    offer_id = parse_id(data.get('offer_id') if isinstance(data, dict) else None)
    if offer_id is None:
        return jsonify({'success': False, 'error': 'Validation Error', 'message': 'offer_id must be a positive integer.'}), 400
    result = QRService.claim_offer(g.user.id, offer_id)
    return jsonify(result), result.get('status', 400)

# --- STUDENT CLAIM HISTORY ---
@student_bp.route('/student/history/<int:user_id>', methods=['GET'])
@token_required
def get_student_history(user_id):
    if g.user.id != user_id and g.user.role != 'admin':
        return jsonify({'success': False, 'message': 'Forbidden. You can only view your own history.'}), 403
    try:
        student = User.query.get(user_id)
        claims = Claim.query.filter_by(user_id=user_id).order_by(desc(Claim.created_at)).all()
        
        output = []
        for claim in claims:
            real_offer = Offer.query.get(claim.offer_id)
            if real_offer:
                real_rest = RestaurantProfile.query.get(real_offer.restaurant_id)
                rest_name = real_rest.name if real_rest else "Unknown Restaurant"
                
                output.append({
                    'id': claim.id,
                    'restaurant_name': rest_name,
                    # Pickup location shown with the claim QR (address may be NULL; coordinates are the fallback)
                    'restaurant_address': real_rest.address if real_rest else None,
                    'lat': real_rest.lat if real_rest else None,
                    'lng': real_rest.lng if real_rest else None,
                    'offer_title': real_offer.title or real_offer.description,
                    'type': real_offer.type, 
                    # created_at is stored as naive UTC; shown in Budapest time
                    'date': local_time_text(claim.created_at, '%d.%m.%Y %H:%M'),
                    'qr_code': claim.qr_code,
                    'status': claim.status,
                    'image_url': real_offer.image_url
                })
            
        return jsonify({
            'history': output,
            'xp': student.xp if student and student.xp else 0,
            'level': student.level if student and student.level else 1
        })
    except Exception as e:
        print(f"History Error: {e}")
        return jsonify({'success': False, 'error': 'Server Error', 'message': 'History could not be loaded.'}), 500

# --- NOTIFICATION INBOX ---
@student_bp.route('/notifications', methods=['GET'])
@token_required
def get_my_notifications():
    """Stored in-app notifications of the authenticated user only (identity from the JWT), newest first."""
    rows = (Notification.query
            .filter_by(user_id=g.user.id)
            .order_by(desc(Notification.created_at), desc(Notification.id))
            .limit(50)
            .all())
    return jsonify({'success': True, 'notifications': [n.to_dict() for n in rows]}), 200


@student_bp.route('/notifications/read', methods=['POST'])
@token_required
def mark_my_notifications_read():
    """Marks all of the authenticated user's unread notifications as read (single conditional UPDATE)."""
    updated = (Notification.query
               .filter_by(user_id=g.user.id, is_read=False)
               .update({Notification.is_read: True}, synchronize_session=False))
    db.session.commit()
    return jsonify({'success': True, 'updated': updated}), 200


# --- LEADERBOARD ---
@student_bp.route('/leaderboard', methods=['GET'])
def get_leaderboard():
    try:
        leaders = Leaderboard.query.order_by(desc(Leaderboard.points)).limit(5).all()
        output = []
        for l in leaders:
            rest_name = l.restaurant_lb.name if l.restaurant_lb else "Unnamed"
            output.append({
                'restaurant': rest_name,
                'points': l.points,
                'meals': l.meals_shared
            })
        return jsonify(output)
    except Exception as e:
        print(f"Leaderboard Route Error: {str(e)}")
        return jsonify({'success': False, 'error': 'Server Error', 'message': 'Leaderboard could not be loaded.'}), 500