from flask import Blueprint, request, jsonify
from app.services.qr_service import QRService
from app.services.notification_service import NotificationService
from app.models.stats import Leaderboard

restaurant_bp = Blueprint('restaurant', __name__)


@restaurant_bp.route('/offers/my-offers', methods=['GET'])
def get_my_offers():
    """Returns all active offers belonging to the authenticated restaurant."""
    user_id = request.args.get('user_id', type=int)

    if not user_id:
        return jsonify({'success': False, 'message': 'user_id is required.'}), 400

    try:
        from app.models.user import RestaurantProfile
        from app.models.offer import Offer

        restaurant = RestaurantProfile.query.filter_by(owner_user_id=user_id).first()

        if not restaurant:
            return jsonify({'success': False, 'message': 'Restaurant profile not found.'}), 404

        # Fetch only active offers, ordered newest first
        offers = (
            Offer.query
            .filter_by(restaurant_id=restaurant.id, status='active')
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
def delete_offer(offer_id):
    """Soft-deletes (deactivates) an offer owned by the authenticated restaurant."""
    user_id = request.args.get('user_id', type=int)

    if not user_id:
        return jsonify({'success': False, 'message': 'user_id is required.'}), 400

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
def create_offer():
    """Creates a new offer and triggers push notifications to nearby students."""
    data = request.get_json()

    # Sanitize the 'type' field before it reaches the database
    if data and 'type' in data and data['type']:
        data['type'] = str(data['type']).lower().strip()

    result = QRService.create_offer(data)

    # If the offer was saved successfully, fire push notifications
    if result.get('success'):
        try:
            print("Offer created! Triggering push notifications for students...")
            NotificationService.notify_students_new_offer(data)
        except Exception as e:
            # Notifications failing must not block the restaurant's success response
            print(f"Notification trigger failed (offer was saved): {str(e)}")

    return jsonify(result), result.get('status', 200)


@restaurant_bp.route('/claims/verify', methods=['POST'])
def verify_claim():
    """Validates a student's QR code and awards points to both parties."""
    data = request.get_json()
    qr_code = data.get('qr_code')

    result = QRService.verify_claim_qr(qr_code)

    return jsonify(result), result.get('status', 200)


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