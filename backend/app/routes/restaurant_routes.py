from flask import Blueprint, request, jsonify, g
from app.utils.decorators import restaurant_required
from app.services.qr_service import QRService
from app.services.notification_service import NotificationService
from app.models.stats import Leaderboard

restaurant_bp = Blueprint('restaurant', __name__)


@restaurant_bp.route('/offers/my-offers', methods=['GET'])
@restaurant_required
def get_my_offers():
    """Returns all active offers belonging to the authenticated restaurant."""
    user_id = g.user.id  # identity from the JWT; client-supplied user_id is ignored

    try:
        from app.models.user import RestaurantProfile
        from app.models.offer import Offer

        restaurant = RestaurantProfile.query.filter_by(owner_user_id=user_id).first()

        if not restaurant:
            return jsonify({'success': False, 'message': 'Restaurant profile not found.'}), 404

        # Fetch only active offers of the current Budapest day (same-day expiry), newest first
        from app.services.qr_service import offer_is_live
        offers = (
            Offer.query
            .filter_by(restaurant_id=restaurant.id, status='active')
            .filter(offer_is_live())
            .order_by(Offer.created_at.desc())
            .all()
        )

        return jsonify({
            'success': True,
            'offers': [o.to_dict() for o in offers]
        }), 200

    except Exception as e:
        print(f"my-offers error: {str(e)}")
        return jsonify({'success': False, 'message': 'Server error.'}), 500


@restaurant_bp.route('/offers/delete/<int:offer_id>', methods=['DELETE'])
@restaurant_required
def delete_offer(offer_id):
    """Soft-deletes (deactivates) an offer owned by the authenticated restaurant."""
    user_id = g.user.id  # identity from the JWT; client-supplied user_id is ignored

    try:
        from app.models.user import RestaurantProfile
        from app.models.offer import Offer
        from app.extensions import db

        restaurant = RestaurantProfile.query.filter_by(owner_user_id=user_id).first()

        if not restaurant:
            return jsonify({'success': False, 'message': 'Restaurant not found.'}), 404

        offer = Offer.query.filter_by(id=offer_id, restaurant_id=restaurant.id).first()

        if not offer:
            return jsonify({'success': False, 'message': 'Offer not found or not yours.'}), 404

        # Soft delete: mark as cancelled instead of permanently removing from the DB
        offer.status = 'cancelled'
        db.session.commit()

        return jsonify({'success': True, 'message': 'Offer removed.'}), 200

    except Exception as e:
        from app.extensions import db
        db.session.rollback()
        print(f"delete-offer error: {str(e)}")
        return jsonify({'success': False, 'message': 'Server error.'}), 500


@restaurant_bp.route('/offers/create', methods=['POST'])
@restaurant_required
def create_offer():
    """Creates a new offer and triggers push notifications to nearby students."""
    data = request.get_json() or {}
    data['user_id'] = g.user.id  # the offer always belongs to the authenticated restaurant

    # Sanitize the 'type' field before it reaches the database
    if data and 'type' in data and data['type']:
        data['type'] = str(data['type']).lower().strip()

    # QRService.create_offer saves the offer and sends the student notifications exactly once
    # (a second call here used to duplicate every notification and push).
    result = QRService.create_offer(data)

    return jsonify(result), result.get('status', 200)


@restaurant_bp.route('/claims/verify', methods=['POST'])
@restaurant_required
def verify_claim():
    """Validates a student's QR code and awards points to both parties."""
    data = request.get_json() or {}
    qr_code = data.get('qr_code')

    # Only the restaurant that owns the claimed offer may verify it
    result = QRService.verify_claim_qr(qr_code, restaurant_owner_id=g.user.id)

    return jsonify(result), result.get('status', 200)


@restaurant_bp.route('/restaurant/location', methods=['GET', 'PUT'])
@restaurant_required
def restaurant_location():
    """Reads or updates the authenticated restaurant's coordinates (geom follows automatically)."""
    from app.models.user import RestaurantProfile
    from app.extensions import db
    from app.services.auth_service import AuthService

    restaurant = RestaurantProfile.query.filter_by(owner_user_id=g.user.id).first()
    if not restaurant:
        return jsonify({'success': False, 'message': 'Restaurant profile not found.'}), 404

    if request.method == 'PUT':
        data = request.get_json() or {}
        lat, lng = AuthService.parse_coordinates(data.get('lat'), data.get('lng'))
        if lat is None:
            return jsonify({'success': False, 'message': 'Invalid coordinates. Latitude must be -90..90 and longitude -180..180.'}), 400
        restaurant.lat, restaurant.lng = lat, lng
        db.session.commit()

    return jsonify({'success': True, 'lat': restaurant.lat, 'lng': restaurant.lng, 'address': restaurant.address}), 200


@restaurant_bp.route('/leaderboard', methods=['GET'])
def get_leaderboard():
    """Returns the top 10 restaurants ranked by points."""
    try:
        leaders = Leaderboard.query.order_by(Leaderboard.points.desc()).limit(10).all()

        output = []
        for index, leader in enumerate(leaders):
            rest_name = leader.restaurant_lb.name if leader.restaurant_lb else 'Unnamed'
            output.append({
                'restaurant': rest_name,
                'points': leader.points,
                'meals': leader.meals_shared,
                'rank': index + 1
            })

        return jsonify(output), 200

    except Exception as e:
        # Return empty array instead of 500 so the Home Screen does not crash
        print(f"Leaderboard error: {str(e)}")
        return jsonify([]), 200