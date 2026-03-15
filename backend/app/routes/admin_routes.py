from flask import Blueprint, request, jsonify
from app.models import User, RestaurantProfile, Offer, Claim
from app.extensions import db

admin_bp = Blueprint('admin', __name__)

# --- GET SYSTEM STATISTICS ---
@admin_bp.route('/stats', methods=['GET'])
def get_stats():
    """Returns basic counts for the admin dashboard overview."""
    try:
        stats = {
            "total_users": User.query.count(),
            "total_restaurants": RestaurantProfile.query.count(),
            "active_offers": Offer.query.filter_by(status='active').count(),
            "total_claims": Claim.query.count(),
            "pending_approvals": User.query.filter_by(verification_status='pending').count()
        }
        return jsonify(stats), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- GET PENDING VERIFICATIONS ---
@admin_bp.route('/pending', methods=['GET'])
def get_pending_users():
    """Fetches all users (students and restaurants) waiting for admin approval."""
    try:
        pending_users = User.query.filter_by(verification_status='pending').all()
        output = []
        for user in pending_users:
            try:
                detail = "Unknown"
                if user.role == 'restaurant' and getattr(user, 'restaurant_profile', None):
                    detail = user.restaurant_profile.name
                elif user.role == 'student':
                    detail = "Identity Document Available"
                    
                # 🚀 THE FIX: Fetch from the real column 'id_document_url'
                doc_url = getattr(user, 'id_document_url', None)
                    
                joined_date = "N/A"
                if getattr(user, 'created_at', None):
                    joined_date = str(user.created_at)[:10]

                output.append({
                    'user_id': user.id,
                    'name': user.name,
                    'email': user.email,
                    'type': str(user.role).strip().lower(), 
                    'detail': detail,
                    'doc': doc_url,
                    'joined_at': joined_date
                })
            except Exception as item_e:
                print(f"Skipping user {user.id} due to error: {item_e}")
                continue 
                
        return jsonify(output), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- APPROVE USER ---
@admin_bp.route('/approve', methods=['POST'])
def approve_user():
    """Changes a user's status from pending to verified."""
    data = request.get_json()
    user_id = data.get('user_id')
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({"success": False, "message": "User not found."}), 404
        
    try:
        user.verification_status = 'verified'
        db.session.commit()
        return jsonify({"success": True, "message": f"{user.name} successfully approved."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

# --- REJECT USER ---
@admin_bp.route('/reject', methods=['POST'])
def reject_user():
    """Rejects a user document, setting them back to unverified so they can try again."""
    data = request.get_json()
    user_id = data.get('user_id')
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({"success": False, "message": "User not found."}), 404
        
    try:
        user.verification_status = 'unverified'
        # 🚀 THE FIX: Clear the real column 'id_document_url'
        user.id_document_url = None
        db.session.commit()
        return jsonify({"success": True, "message": f"{user.name}'s document has been rejected."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500