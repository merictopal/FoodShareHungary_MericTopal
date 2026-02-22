from flask import Blueprint, request, jsonify
from app.models import User, RestaurantProfile, Offer, Claim
from app.extensions import db
from app.utils.decorators import admin_required

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/stats', methods=['GET'])
def get_stats():
    
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

@admin_bp.route('/pending', methods=['GET'])
def get_pending_users():
    
    pending_users = User.query.filter_by(verification_status='pending').all()
    
    output = []
    for user in pending_users:
        detail = "Unknown"
        
        if user.role == 'restaurant' and user.restaurant_profile:
            detail = user.restaurant_profile.name
        elif user.role == 'student':
            detail = "Student ID Available"
            
        output.append({
            'user_id': user.id,
            'name': user.name,
            'email': user.email,
            'type': user.role,
            'detail': detail,
            'doc': user.verification_doc,
            'joined_at': user.created_at.strftime('%d-%m-%Y')
        })
        
    return jsonify(output), 200

@admin_bp.route('/approve', methods=['POST'])
def approve_user():
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