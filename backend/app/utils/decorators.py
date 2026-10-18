import jwt
from functools import wraps
from flask import request, jsonify, current_app, g
from app.utils.constants import STUDENT_ROLES


def is_account_suspended(user):
    """
    Single definition of the account lock used by login, refresh and every protected route.
    Admins are exempt: /admin/suspend refuses admin targets, so an admin can never be locked out.
    """
    return user is not None and user.verification_status == 'suspended' and user.role != 'admin'


# A restaurant registers as 'pending'; /admin/reject sets it to 'unverified' (= application rejected,
# it can re-apply via POST /api/auth/restaurant/reapply); only 'verified' restaurants may use the app.
RESTAURANT_REJECTED_STATUS = 'unverified'
SUSPENDED_MESSAGE = 'Your account has been suspended. Please contact support.'


def account_block(user):
    """
    The one rule for whether an existing account may sign in or use the API, shared by password login,
    Google login, token refresh and role_required. Returns (status, error title, message) or None.
    """
    if is_account_suspended(user):
        return 403, 'Account Suspended', SUSPENDED_MESSAGE
    if user.role == 'restaurant' and user.verification_status != 'verified':
        if user.verification_status == RESTAURANT_REJECTED_STATUS:
            return 403, 'Application Rejected', 'Your restaurant application was rejected. You can apply again.'
        return 403, 'Account Pending', 'Your restaurant account has not been approved by an administrator yet.'
    return None


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
                # 401, not 404: a token of a deleted account is no longer a valid session, and clients end
                # the session on 401 (refresh -> 404 -> logout) instead of keeping a ghost session.
                return jsonify({
                    "success": False,
                    "error": "Unauthorized",
                    "message": "This account no longer exists. Please log in again."
                }), 401

            # Suspension (and a restaurant's approval state) applies to already-issued tokens too,
            # with the same rule as login and refresh
            block = account_block(user)
            if block:
                status, title, message = block
                return jsonify({"success": False, "error": title, "message": message}), status

            # 4. Verify Role-Based Access Control (RBAC)
            if user.role not in allowed_roles:
                return jsonify({
                    "error": "Forbidden",
                    "message": f"Access denied. Insufficient permissions for role '{user.role}'."
                }), 403

            # 5. Attach the verified user to the global context
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
    return role_required(list(STUDENT_ROLES))(f)
    
def token_required(f):
    """Requires a valid token but allows any valid role."""
    return role_required(['admin', 'restaurant', 'student', 'user'])(f)