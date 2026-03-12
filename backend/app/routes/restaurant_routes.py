from flask import Blueprint, request, jsonify
from app.services.qr_service import QRService
# NEW: Import NotificationService to trigger the real-time alerts
from app.services.notification_service import NotificationService
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
    
    # --- 🚀 THE FINAL PIECE OF PHASE 2 - STAGE 3 ---
    # If the offer was successfully saved to the database, fire the notification!
    if result.get('success'):
        try:
            # Tell the notification service to alert students about this new meal
            print("🚀 Offer created! Triggering push notifications for students...")
            NotificationService.notify_students_new_offer(data)
        except Exception as e:
            # We use try-except so if notifications fail, the restaurant still sees "Success"
            print(f"⚠️ Notification trigger failed (but offer was saved): {str(e)}")
            
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