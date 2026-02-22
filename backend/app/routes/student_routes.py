from flask import Blueprint, request, jsonify
from app.models import Offer, Claim, Notification, User
from app.services.qr_service import QRService
from app.extensions import db
# from app.utils.decorators import student_required

student_bp = Blueprint('student', __name__)

@student_bp.route('/offers', methods=['GET'])
def get_offers():
    try:
        user_lat = float(request.args.get('lat', 41.0082))
        user_lng = float(request.args.get('lng', 28.9784))
        
        offers = Offer.query.filter(
            Offer.status == 'active', 
            Offer.current_quantity > 0
        ).all()
        
        output = []
        for offer in offers:
            restaurant = offer.restaurant
            
            dist = QRService.calculate_distance(
                user_lat, user_lng, 
                restaurant.lat, restaurant.lng
            )
            
            # CRITICAL FIX: Ensure 'type' is always lowercase and stripped of whitespaces
            offer_type = str(offer.type).lower().strip() if offer.type else 'free'
            is_recommended = (offer_type == 'free') or (dist < 2.0)
            
            offer_data = offer.to_dict()
            offer_data['type'] = offer_type # Overwrite with cleaned data
            offer_data['distance'] = dist
            offer_data['is_recommended'] = is_recommended
            
            output.append(offer_data)
            
        output.sort(key=lambda x: x['distance'])
        
        return jsonify(output), 200

    except Exception as e:
        return jsonify({"error": "Error fetching data", "message": str(e)}), 500

@student_bp.route('/claim', methods=['POST'])
def claim_offer():
    data = request.get_json()
    result = QRService.claim_offer(data.get('user_id'), data.get('offer_id'))
    return jsonify(result), result['status']

@student_bp.route('/history/<int:user_id>', methods=['GET'])
def get_history(user_id):
    claims = Claim.query.filter_by(user_id=user_id)\
        .order_by(Claim.timestamp.desc())\
        .all()
        
    output = []
    for c in claims:
        claim_dict = c.to_dict()
        # CRITICAL FIX: Sanitizing the 'type' field before sending it to React Native tabs
        if 'type' in claim_dict and claim_dict['type']:
            claim_dict['type'] = str(claim_dict['type']).lower().strip()
        else:
            claim_dict['type'] = 'free' # Fallback safety
            
        output.append(claim_dict)
        
    return jsonify(output), 200

@student_bp.route('/notifications/<int:user_id>', methods=['GET'])
def get_notifications(user_id):
    notifs = Notification.query.filter_by(user_id=user_id)\
        .order_by(Notification.created_at.desc())\
        .limit(20)\
        .all()
        
    return jsonify([n.to_dict() for n in notifs]), 200

@student_bp.route('/verify', methods=['POST'])
def upload_verification_doc():
    data = request.get_json()
    user_id = data.get('user_id')
    doc = data.get('document')
    
    user = User.query.get(user_id)
    if user:
        user.verification_doc = doc 
        user.verification_status = 'pending' 
        
        # BUG FIX: Added missing database commit to actually save the changes
        db.session.commit() 
        
        return jsonify({"success": True, "message": "Documents uploaded. Pending approval."}), 200
    
    return jsonify({"success": False, "message": "User not found."}), 404