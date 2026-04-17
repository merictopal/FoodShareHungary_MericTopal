import jwt
from functools import wraps
from flask import request, jsonify, current_app, g

def role_required(allowed_roles):
    """
    Validates the JWT token from the Authorization header and checks RBAC permissions.
    Assigns the verified user object to flask.g.user for downstream route usage.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            from app.models.user import User
            
            token = None
            
            # 1. Extract token from 'Authorization: Bearer <token>'
            if 'Authorization' in request.headers:
                parts = request.headers['Authorization'].split()
                if len(parts) == 2 and parts[0] == 'Bearer':
                    token = parts[1]

            if not token:
                return jsonify({
                    "error": "Unauthorized",
                    "message": "Authentication failed. JWT Token is missing."
                }), 401

            try:
                # 2. Cryptographically verify the token
                data = jwt.decode(token, current_app.config['JWT_SECRET_KEY'], algorithms=["HS256"])
                
                # 🛡️ SECURITY FIX: The ultimate check! Block Refresh Tokens from accessing standard APIs.
                # Only short-lived "access" tokens are allowed through this gate.
                if data.get('type') == 'refresh':
                    return jsonify({
                        "error": "Invalid Token Type",
                        "message": "Refresh tokens cannot be used to access API endpoints. Use your access token."
                    }), 401
                    
                current_user_id = data.get('user_id')
                
            except jwt.ExpiredSignatureError:
                return jsonify({
                    "error": "Token Expired",
                    "message": "Your session has expired. Please log in again."
                }), 401
            except jwt.InvalidTokenError:
                return jsonify({
                    "error": "Invalid Token",
                    "message": "Authentication failed. The token is invalid."
                }), 401

            # 3. Fetch user securely using the ID embedded in the trusted token
            user = User.query.get(current_user_id)
            if not user:
                return jsonify({
                    "error": "Not Found",
                    "message": "User not found in the database."
                }), 404

            # 4. Verify Role-Based Access Control (RBAC)
            if user.role not in allowed_roles:
                return jsonify({
                    "error": "Forbidden",
                    "message": f"Access denied. Insufficient permissions for role '{user.role}'."
                }), 403

            # 5. Prevent unverified restaurants from interacting with secured endpoints
            if user.role == 'restaurant' and user.verification_status != 'verified':
                return jsonify({
                    "error": "Account Pending",
                    "message": "Your restaurant account has not been approved by an administrator yet."
                }), 403

            # 6. Attach the verified user to the global context
            g.user = user

            return f(*args, **kwargs)
        return decorated_function
    return decorator

# --- Convenience Decorators ---

def admin_required(f):
    return role_required(['admin'])(f)

def restaurant_required(f):
    return role_required(['restaurant'])(f)

def student_required(f):
    return role_required(['student', 'user'])(f)
    
def token_required(f):
    """Requires a valid token but allows any valid role."""
    return role_required(['admin', 'restaurant', 'student', 'user'])(f)