from flask import Blueprint, request, jsonify
from app.models import User, RestaurantProfile, Offer, Claim
from app.extensions import db
from sqlalchemy import func # 🚀 FIXED: Moved to the top globally

admin_bp = Blueprint('admin', __name__)

# --- GET SYSTEM STATISTICS ---
@admin_bp.route('/stats', methods=['GET'])
def get_stats():
    """Returns basic counts formatted specifically for the React admin dashboard."""
    try:
        # Standardize individual users by checking both 'user' and legacy 'student' roles
        total_users = User.query.filter(User.role.in_(['user', 'student'])).count()
        total_restaurants = User.query.filter_by(role='restaurant').count()
        active_offers = Offer.query.filter_by(status='active').count()
        pending_approvals = User.query.filter_by(verification_status='pending').count()
        
        return jsonify({
            "success": True,
            "data": {
                "total_users": total_users,
                "total_restaurants": total_restaurants,
                "active_offers": active_offers,
                "pending_approvals": pending_approvals
            }
        }), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# --- GET PENDING VERIFICATIONS ---
@admin_bp.route('/pending', methods=['GET'])
def get_pending_users():
    """Fetches all users and restaurants waiting for admin approval."""
    try:
        pending_users = User.query.filter_by(verification_status='pending').all()
        output = []
        for user in pending_users:
            try:
                detail = "Unknown"
                if user.role == 'restaurant' and getattr(user, 'restaurant_profile', None):
                    detail = user.restaurant_profile.name
                elif user.role in ['user', 'student']:
                    detail = "Identity Document Available"
                    
                doc_url = getattr(user, 'id_document_url', None)
                doc_type = getattr(user, 'document_type', 'unknown')    
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
                    'doc_type': doc_type,
                    'joined_at': joined_date
                })
            except Exception as item_e:
                print(f"Skipping user {user.id} due to error: {item_e}")
                continue 
                
        return jsonify({"success": True, "data": output}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# --- APPROVE USER ---
@admin_bp.route('/approve', methods=['POST'])
def approve_user():
    """Changes a user's status from pending to verified."""
    data = request.get_json()
    user_id = data.get('user_id')
    
    user = User.query.get(int(user_id))
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
        # Clear the document URL so they can upload a new one
        user.id_document_url = None
        db.session.commit()
        return jsonify({"success": True, "message": f"{user.name}'s document has been rejected."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500
    
# --- GET ALL USERS ---
@admin_bp.route('/users', methods=['GET'])
def get_all_users():
    """Fetches all registered users for the admin management table."""
    try:
        all_users = User.query.all()
        output = []
        
        for user in all_users:
            output.append({
                'id': user.id,
                'name': user.name,
                'email': user.email,
                'role': str(user.role).strip().lower(),
                'status': user.verification_status,
                'joined_at': str(user.created_at)[:10] if getattr(user, 'created_at', None) else "N/A"
            })
            
        return jsonify({"success": True, "data": output}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
    
# --- SUSPEND (BAN) USER ---
@admin_bp.route('/suspend', methods=['POST'])
def suspend_user():
    """Changes a user's verification status to suspended."""
    data = request.get_json()
    user_id = data.get('user_id')
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({"success": False, "message": "User not found."}), 404
        
    try:
        user.verification_status = 'suspended'
        db.session.commit()
        return jsonify({"success": True, "message": f"{user.name} has been suspended."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

# --- GET DETAILED USER STATS ---
@admin_bp.route('/user/<int:user_id>/stats', methods=['GET'])
def get_user_detailed_stats(user_id):
    """Fetches detailed statistics safely for both users and restaurants."""
    user = User.query.get(user_id)
    if not user:
        return jsonify({"success": False, "message": "User not found."}), 404

    try:
        role = str(user.role).strip().lower()
        
        # Base statistics dictionary
        stats = {
            "name": user.name,
            "role": role,
            "status": user.verification_status,
            "xp": getattr(user, 'xp', 0),
            "level": getattr(user, 'level', 1),
            "joined_at": str(user.created_at)[:10] if getattr(user, 'created_at', None) else "N/A",
            "meals_claimed": 0,
            "offers_created": 0,
            "total_portions": 0
        }

        # --- SAFELY FETCH ROLE-SPECIFIC DATA ---
        if role in ['user', 'student']:
            stats["meals_claimed"] = Claim.query.filter_by(user_id=user.id).count()
            
        elif role == 'restaurant':
            profile = getattr(user, 'restaurant_profile', None)
            
            if profile and hasattr(profile, 'name'):
                stats["name"] = profile.name

            # 🚀 THE FIX: Use RestaurantProfile.id instead of User.id if applicable
            search_kwargs = {}
            if hasattr(Offer, 'restaurant_id') and profile and hasattr(profile, 'id'):
                search_kwargs = {'restaurant_id': profile.id}
            else:
                search_kwargs = {'user_id': user.id}
            
            # 1. Total number of active/past offers published
            stats["offers_created"] = Offer.query.filter_by(**search_kwargs).count()
            
            # 2. Total sum of portions (quantity) they shared
            portions = db.session.query(func.sum(Offer.quantity)).filter_by(**search_kwargs).scalar()
            stats["total_portions"] = int(portions) if portions else 0

        return jsonify({"success": True, "data": stats}), 200

    except Exception as e:
        print(f"Stats fetch error for user {user_id}: {str(e)}")
        return jsonify({"success": False, "message": f"Server Error: {str(e)}"}), 500
    
    # --- GET ALL OFFERS ---
@admin_bp.route('/offers', methods=['GET'])
def get_all_offers():
    """Fetches all food offers for the admin dashboard."""
    try:
        # Fetch offers and sort by newest first
        offers = Offer.query.order_by(Offer.created_at.desc()).all()
        output = []
        
        for offer in offers:
            try:
                # Find the restaurant name associated with this offer
                rest_name = "Unknown Restaurant"
                
                # Check based on your database structure (restaurant_id vs user_id)
                if hasattr(offer, 'restaurant_id') and offer.restaurant_id:
                    profile = RestaurantProfile.query.get(offer.restaurant_id)
                    if profile:
                        rest_name = profile.name
                elif hasattr(offer, 'user_id') and offer.user_id:
                    profile = RestaurantProfile.query.filter_by(user_id=offer.user_id).first()
                    if profile:
                        rest_name = profile.name

                output.append({
                    'id': offer.id,
                    'restaurant_name': rest_name,
                    'title': getattr(offer, 'title', 'Surprise Box'),
                    'quantity': getattr(offer, 'quantity', 0),
                    'status': getattr(offer, 'status', 'unknown'),
                    'created_at': str(offer.created_at)[:10] if getattr(offer, 'created_at', None) else "N/A"
                })
            except Exception as item_e:
                print(f"Skipping offer {offer.id} due to error: {item_e}")
                continue
                
        return jsonify({"success": True, "data": output}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# --- CANCEL/DELETE OFFER ---
@admin_bp.route('/offer/cancel', methods=['POST'])
def cancel_offer():
    """Allows admin to cancel or take down an active offer."""
    data = request.get_json()
    offer_id = data.get('offer_id')
    
    offer = Offer.query.get(offer_id)
    if not offer:
        return jsonify({"success": False, "message": "Offer not found."}), 404
        
    try:
        # Instead of deleting from DB, we change status to 'cancelled' for history tracking
        offer.status = 'cancelled'
        db.session.commit()
        return jsonify({"success": True, "message": "Offer has been successfully cancelled."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500