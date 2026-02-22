from flask import Blueprint, request, jsonify
from app.services.qr_service import QRService
from app.models import Leaderboard
# from app.utils.decorators import restaurant_required

restaurant_bp = Blueprint('restaurant', __name__)

@restaurant_bp.route('/create', methods=['POST'])
def create_offer():
    data = request.get_json()
    
    # CRITICAL FIX: Sanitize the 'type' field before it reaches the database.
    # This prevents the React Native tabs (Free/Discount) from breaking.
    if data and 'type' in data and data['type']:
        data['type'] = str(data['type']).lower().strip()
        
    result = QRService.create_offer(data)
    
    # Using .get() for safety in case 'status' key is missing in the result dict
    return jsonify(result), result.get('status', 200)

@restaurant_bp.route('/verify', methods=['POST'])
def verify_claim():
    data = request.get_json()
    qr_code = data.get('qr_code')
    
    result = QRService.verify_claim_qr(qr_code)
    
    return jsonify(result), result.get('status', 200)

@restaurant_bp.route('/leaderboard', methods=['GET'])
def get_leaderboard():
    # Fetches the top 10 restaurants/users based on points
    leaders = Leaderboard.query.order_by(Leaderboard.points.desc()).limit(10).all()
    
    output = []
    for index, leader in enumerate(leaders):
        data = leader.to_dict()
        data['rank'] = index + 1 # Dynamically assign the leaderboard rank
        output.append(data)
        
    return jsonify(output), 200