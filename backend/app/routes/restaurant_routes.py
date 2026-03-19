from flask import Blueprint, request, jsonify
from app.services.qr_service import QRService
from app.services.notification_service import NotificationService

# FIXED: Imported Leaderboard model correctly from stats
from app.models.stats import Leaderboard

restaurant_bp = Blueprint('restaurant', __name__)

@restaurant_bp.route('/offers/create', methods=['POST'])
def create_offer():
    data = request.get_json()
    
    # CRITICAL FIX: Sanitize the 'type' field before it reaches the database.
    # This prevents the React Native tabs (Free/Discount) from breaking.
    if data and 'type' in data and data['type']:
        data['type'] = str(data['type']).lower().strip()
        
    result = QRService.create_offer(data)
    
    # --- THE FINAL PIECE OF PHASE 2 - STAGE 3 ---
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

@restaurant_bp.route('/claims/verify', methods=['POST'])
def verify_claim():
    data = request.get_json()
    qr_code = data.get('qr_code')
    
    result = QRService.verify_claim_qr(qr_code)
    
    return jsonify(result), result.get('status', 200)

# Maintained your original 10-limit rank logic, but formatted the JSON to match React Native exactly
@restaurant_bp.route('/leaderboard', methods=['GET'])
def get_leaderboard():
    try:
        # Fetches the top 10 restaurants/users based on points
        leaders = Leaderboard.query.order_by(Leaderboard.points.desc()).limit(10).all()
        
        output = []
        for index, leader in enumerate(leaders):
            # Formatted to perfectly match what HomeScreen.tsx expects
            rest_name = leader.restaurant_lb.name if leader.restaurant_lb else "Unnamed"
            output.append({
                'restaurant': rest_name,
                'points': leader.points,
                'meals': leader.meals_shared,
                'rank': index + 1 # Dynamically assign the leaderboard rank
            })
            
        return jsonify(output), 200
    except Exception as e:
        # FIXED: Added error handling so the Home Screen doesn't crash if the leaderboard fails.
        print(f"Leaderboard Error: {str(e)}")
        return jsonify([]), 200 # Return empty array instead of 500 error to save the Home Screen