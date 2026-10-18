from flask import Blueprint, request, jsonify, send_file
from app.services.storage_service import StorageService
from app.models import User, RestaurantProfile, Offer, Claim
from app.extensions import db
from app.models.user import AuditLog
from sqlalchemy import func 
from app.utils.validators import parse_id
from app.utils.decorators import admin_required # 🚀 THE FIX: Imported the Security Shield
from app.utils.constants import STUDENT_ROLES
from app.services.qr_service import claimable_offer_conditions

admin_bp = Blueprint('admin', __name__)

# --- GET SYSTEM STATISTICS ---
@admin_bp.route('/stats', methods=['GET'])
@admin_required # 🛡️ Shield applied
def get_stats():
    """Returns basic counts formatted specifically for the React admin dashboard."""
    try:
        total_users = User.query.filter(User.role.in_(STUDENT_ROLES)).count()
        total_restaurants = User.query.filter_by(role='restaurant').count()
        # Same definition students see (expired / sold-out / suspended restaurants' offers are not active)
        active_offers = Offer.query.filter(*claimable_offer_conditions()).count()
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
        print(f"Admin route error: {str(e)}")
        return jsonify({"success": False, "error": "Server Error", "message": "An unexpected server error occurred."}), 500

# --- GET PENDING VERIFICATIONS ---
@admin_bp.route('/pending', methods=['GET'])
@admin_required # 🛡️ Shield applied
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
                elif user.role in STUDENT_ROLES:
                    detail = "Identity Document Available"
                    
                # Short-lived access URL (pre-signed S3 / signed local link) instead of the stored URL
                doc_url = StorageService.get_document_access_url(getattr(user, 'id_document_url', None))
                doc_type = user.document_type or 'unknown'
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
        print(f"Admin route error: {str(e)}")
        return jsonify({"success": False, "error": "Server Error", "message": "An unexpected server error occurred."}), 500

# --- SERVE PRIVATE LOCAL DOCUMENT (development fallback storage) ---
@admin_bp.route('/document-file/<token>', methods=['GET'])
def get_document_file(token):
    """No JWT here because browsers/Image components open the link directly; the signed,
    5-minute token itself is the credential and is only issued by the admin-only /pending endpoint."""
    path = StorageService.resolve_private_document(token)
    if not path:
        return jsonify({"success": False, "message": "Invalid or expired document link."}), 403
    return send_file(path)

# --- APPROVE USER ---
@admin_bp.route('/approve', methods=['POST'])
@admin_required # 🛡️ Shield applied
def approve_user():
    """Changes a user's status from pending to verified."""
    data = request.get_json()
    user_id = parse_id(data.get('user_id') if isinstance(data, dict) else None)
    if user_id is None:
        return jsonify({"success": False, "error": "Validation Error", "message": "user_id must be a positive integer."}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({"success": False, "message": "User not found."}), 404
        
    try:
        user.verification_status = 'verified'
        db.session.commit()
        return jsonify({"success": True, "message": f"{user.name} successfully approved."}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Admin route error: {str(e)}")
        return jsonify({"success": False, "error": "Server Error", "message": "An unexpected server error occurred."}), 500

# --- REJECT USER ---
@admin_bp.route('/reject', methods=['POST'])
@admin_required # 🛡️ Shield applied
def reject_user():
    """Rejects a user document, setting them back to unverified so they can try again."""
    data = request.get_json()
    user_id = parse_id(data.get('user_id') if isinstance(data, dict) else None)
    if user_id is None:
        return jsonify({"success": False, "error": "Validation Error", "message": "user_id must be a positive integer."}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({"success": False, "message": "User not found."}), 404
        
    try:
        rejected_document = user.id_document_url
        user.verification_status = 'unverified'
        user.id_document_url = None
        user.document_type = None
        db.session.commit()

        # Delete the stored file only after the DB no longer references it; a failed deletion
        # can leave an orphaned file but never a user pointing at a missing document.
        deletion = StorageService.delete_document(rejected_document)
        return jsonify({"success": True, "message": f"{user.name}'s document has been rejected.", "document_deletion": deletion}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Admin route error: {str(e)}")
        return jsonify({"success": False, "error": "Server Error", "message": "An unexpected server error occurred."}), 500
    
# --- GET ALL USERS ---
@admin_bp.route('/users', methods=['GET'])
@admin_required # 🛡️ Shield applied
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
        print(f"Admin route error: {str(e)}")
        return jsonify({"success": False, "error": "Server Error", "message": "An unexpected server error occurred."}), 500
    
# --- SUSPEND (BAN) USER ---
@admin_bp.route('/suspend', methods=['POST'])
@admin_required # 🛡️ Shield applied
def suspend_user():
    """Changes a user's verification status to suspended."""
    data = request.get_json()
    user_id = parse_id(data.get('user_id') if isinstance(data, dict) else None)
    if user_id is None:
        return jsonify({"success": False, "error": "Validation Error", "message": "user_id must be a positive integer."}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({"success": False, "message": "User not found."}), 404

    # Suspension is not enforced for admins (see is_account_suspended), so refuse it instead of
    # storing a misleading status; this also stops one admin from locking out another.
    if user.role == 'admin':
        return jsonify({"success": False, "error": "Bad Request", "message": "Admin accounts cannot be suspended."}), 400

    try:
        user.verification_status = 'suspended'
        db.session.commit()
        return jsonify({"success": True, "message": f"{user.name} has been suspended."}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Admin route error: {str(e)}")
        return jsonify({"success": False, "error": "Server Error", "message": "An unexpected server error occurred."}), 500

# --- GET DETAILED USER STATS ---
@admin_bp.route('/user/<int:user_id>/stats', methods=['GET'])
@admin_required # 🛡️ Shield applied
def get_user_detailed_stats(user_id):
    """Fetches detailed statistics safely for both users and restaurants."""
    user = User.query.get(user_id)
    if not user:
        return jsonify({"success": False, "message": "User not found."}), 404

    try:
        role = str(user.role).strip().lower()
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

        if role in STUDENT_ROLES:
            stats["meals_claimed"] = Claim.query.filter_by(user_id=user.id).count()

        elif role == 'restaurant':
            # Offers belong to the restaurant profile (offers.restaurant_id); without a profile there are none
            profile = user.restaurant_profile
            if profile:
                stats["name"] = profile.name
                stats["offers_created"] = Offer.query.filter_by(restaurant_id=profile.id).count()
                portions = db.session.query(func.sum(Offer.quantity)).filter_by(restaurant_id=profile.id).scalar()
                stats["total_portions"] = int(portions) if portions else 0

        return jsonify({"success": True, "data": stats}), 200

    except Exception as e:
        print(f"Stats fetch error for user {user_id}: {str(e)}")
        return jsonify({"success": False, "error": "Server Error", "message": "An unexpected server error occurred."}), 500
    
# --- GET ALL OFFERS ---
@admin_bp.route('/offers', methods=['GET'])
@admin_required # 🛡️ Shield applied
def get_all_offers():
    """Fetches all food offers for the admin dashboard."""
    try:
        offers = Offer.query.order_by(Offer.created_at.desc()).all()
        output = []
        
        for offer in offers:
            try:
                profile = RestaurantProfile.query.get(offer.restaurant_id)
                rest_name = profile.name if profile else "Unknown Restaurant"

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
        print(f"Admin route error: {str(e)}")
        return jsonify({"success": False, "error": "Server Error", "message": "An unexpected server error occurred."}), 500

# --- CANCEL/DELETE OFFER ---
@admin_bp.route('/offer/cancel', methods=['POST'])
@admin_required # 🛡️ Shield applied
def cancel_offer():
    """Allows admin to cancel or take down an active offer."""
    data = request.get_json()
    offer_id = parse_id(data.get('offer_id') if isinstance(data, dict) else None)
    if offer_id is None:
        return jsonify({"success": False, "error": "Validation Error", "message": "offer_id must be a positive integer."}), 400

    offer = Offer.query.get(offer_id)
    if not offer:
        return jsonify({"success": False, "message": "Offer not found."}), 404
        
    try:
        offer.status = 'cancelled'
        db.session.commit()
        return jsonify({"success": True, "message": "Offer has been successfully cancelled."}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Admin route error: {str(e)}")
        return jsonify({"success": False, "error": "Server Error", "message": "An unexpected server error occurred."}), 500
    
@admin_bp.route('/audit-logs', methods=['GET'])
@admin_required # 🛡️ Shield applied (This was the main fix)
def get_audit_logs():
    """Fetches all security events from the database, ordered by latest first."""
    logs = AuditLog.query.order_by(AuditLog.timestamp.desc()).limit(200).all()
    
    return jsonify({
        "success": True,
        "logs": [{
            "id": log.id,
            "user_id": log.user_id,
            "action": log.action,
            "details": log.details,
            "ip_address": log.ip_address,
            "timestamp": log.timestamp.strftime('%Y-%m-%d %H:%M:%S')
        } for log in logs]
    }), 200