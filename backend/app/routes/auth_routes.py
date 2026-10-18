import jwt
from flask import Blueprint, request, jsonify, g, current_app
from app.services.auth_service import AuthService
from app.utils.decorators import token_required, student_required
from flask_limiter.util import get_remote_address
from app import limiter

# Credential endpoints: 5 attempts per minute per IP (brute-force protection). Keyed by IP even when a
# token is sent, so extra accounts can't buy extra attempts.
credential_limit = limiter.limit("5 per minute", key_func=get_remote_address)


def _refresh_token_key():
    """/auth/refresh carries no usable access token; count it per account from its verified refresh token
    (a forged/expired one falls back to the IP), so a shared IP doesn't throttle everyone's 15-minute renewals."""
    token = (request.get_json(silent=True) or {}).get('refresh_token')
    if isinstance(token, str):
        try:
            data = jwt.decode(token, current_app.config['JWT_SECRET_KEY'], algorithms=["HS256"])
            if data.get('type') == 'refresh' and data.get('user_id') is not None:
                return f"user:{data['user_id']}"
        except jwt.InvalidTokenError:
            pass
    return get_remote_address()

auth_bp = Blueprint('auth', __name__)

# --- USER REGISTRATION ---
@auth_bp.route('/register', methods=['POST'])
@credential_limit
def register():
    """Handles new user registration (both students and restaurants). Public endpoint."""
    data = request.get_json()
    result = AuthService.register_user(data)
    return jsonify(result), result['status']

# --- USER LOGIN ---
@auth_bp.route('/login', methods=['POST'])
@credential_limit
def login():
    """Handles user authentication, returning a cryptographic JWT and user data. Public endpoint."""
    data = request.get_json()
    result = AuthService.login_user(data)
    return jsonify(result), result['status']
# --- REFRESH ACCESS TOKEN ---
@auth_bp.route('/refresh', methods=['POST'])
# Same values as the default limits, but counted per account
@limiter.limit("200 per day;50 per hour", key_func=_refresh_token_key)
def refresh_token():
    """
    Validates the refresh token and issues a new access token.
    """
    data = request.get_json() or {}
    result = AuthService.refresh_access_token(data)
    return jsonify(result), result['status']
# --- UPDATE PROFILE ---
@auth_bp.route('/update', methods=['PUT'])
# Checks the current password, so it keeps the strict limit (counted per account)
@limiter.limit("5 per minute")
@token_required
def update_profile():
    """Updates user profile information. Protected by JWT."""
    data = request.get_json()
    
    # IDOR Protection: Force the update ID to be the securely extracted token ID
    data['user_id'] = g.user.id 
    
    result = AuthService.update_profile(data)
    return jsonify(result), result['status']

# --- UPDATE FCM TOKEN FOR PUSH NOTIFICATIONS ---
@auth_bp.route('/fcm-token', methods=['POST'])
@token_required
def update_fcm_token():
    """Links the mobile device's FCM token to the user. Protected by JWT."""
    data = request.get_json()
    
    # Ensure a malicious user cannot update someone else's FCM token
    data['user_id'] = g.user.id
    
    # Map 'token' to 'fcm_token' to ensure compatibility with AuthService
    if 'token' in data and 'fcm_token' not in data:
        data['fcm_token'] = data['token']
        
    result = AuthService.update_fcm_token(data)
    return jsonify(result), result['status']

# --- UNLINK FCM TOKEN ON LOGOUT ---
@auth_bp.route('/fcm-token', methods=['DELETE'])
@token_required
def clear_fcm_token():
    """Unlinks this device's FCM token from the caller (always g.user, never a body id). Protected by JWT."""
    data = request.get_json(silent=True) or {}
    result = AuthService.clear_fcm_token(g.user.id, data.get('fcm_token'))
    return jsonify(result), result['status']

# --- GET CURRENT USER DATA ---
@auth_bp.route('/me/<int:user_id>', methods=['GET'])
@token_required
def get_current_user(user_id):
    """
    Fetches the latest user data to sync mobile app state.
    Includes IDOR protection: Users can only fetch their own data unless they are admins.
    """
    from app.models.user import User 
    
    # IDOR Protection check
    if g.user.id != user_id and g.user.role != 'admin':
        return jsonify({
            'success': False, 
            'message': 'Forbidden. You do not have permission to access this user profile.'
        }), 403

    user = User.query.get(user_id)
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404

    # FIX: Use the model's to_dict() method to ensure consistent and complete data
    # This prevents the issue where the app shows '0' or 'undefined' after a reload
    user_data = user.to_dict()
    
    # Append verification_status to match the frontend TypeScript User interface expectations
    user_data['verification_status'] = user.verification_status

    return jsonify({
        'success': True,
        'user': user_data
    }), 200

# --- GOOGLE OAUTH LOGIN ---
@auth_bp.route('/google', methods=['POST'])
@credential_limit
def google_login():
    """
    Handles Google OAuth login.
    Receives the Google ID Token, verifies it, and returns JWT tokens.
    Public endpoint.
    """
    data = request.get_json()
    result = AuthService.google_login(data)
    return jsonify(result), result['status']

# --- FORGOT PASSWORD ---
@auth_bp.route('/forgot-password', methods=['POST'])
@credential_limit
def forgot_password():
    """
    Receives an email address and triggers the password reset email flow.
    """
    data = request.get_json()
    result = AuthService.forgot_password(data)
    return jsonify(result), result['status']

# --- RESET PASSWORD (COMPLETES FORGOT PASSWORD) ---
@auth_bp.route('/reset-password', methods=['POST'])
@credential_limit
def reset_password():
    """Verifies the e-mailed reset code and sets a new password. Public endpoint."""
    data = request.get_json(silent=True) or {}
    result = AuthService.reset_password(data)
    return jsonify(result), result['status']

# --- RESTAURANT RE-APPLICATION (AFTER REJECTION) ---
@auth_bp.route('/restaurant/reapply', methods=['POST'])
@credential_limit
def reapply_restaurant():
    """Rejected restaurant -> pending again. Public, but needs the account's e-mail + password."""
    data = request.get_json(silent=True) or {}
    result = AuthService.reapply_restaurant(data)
    return jsonify(result), result['status']

# --- DELETE OWN ACCOUNT ---
@auth_bp.route('/account', methods=['DELETE'])
@student_required
def delete_account():
    """
    Permanently deletes the caller's own account. The target is always g.user (never a body/URL id).
    Students only: restaurant and admin accounts get 403 from the decorator.
    """
    result = AuthService.delete_account(g.user)
    return jsonify(result), result['status']
