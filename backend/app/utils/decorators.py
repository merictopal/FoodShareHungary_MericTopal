from functools import wraps
from flask import request, jsonify

def role_required(allowed_roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            from app.models.user import User
            
            data = request.get_json() or {}
            
            user_id = data.get('user_id')
            if not user_id:
                user_id = request.args.get('user_id')

            if not user_id:
                return jsonify({
                    "error": "Unauthorized",
                    "message": "Authentication failed. User ID is missing."
                }), 401

            user = User.query.get(user_id)
            if not user:
                return jsonify({
                    "error": "Not Found",
                    "message": "User not found."
                }), 404

            if user.role not in allowed_roles:
                return jsonify({
                    "error": "Forbidden",
                    "message": f"Access denied. Insufficient permissions for role '{user.role}'."
                }), 403

            if user.role == 'restaurant' and user.verification_status != 'verified':
                return jsonify({
                    "error": "Account Pending",
                    "message": "Your restaurant account has not been approved by an administrator yet."
                }), 403

            return f(*args, **kwargs)
        return decorated_function
    return decorator

def admin_required(f):
    return role_required(['admin'])(f)

def restaurant_required(f):
    return role_required(['restaurant'])(f)

def student_required(f):
    return role_required(['student'])(f)