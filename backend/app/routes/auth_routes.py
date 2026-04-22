from flask import Blueprint, request, jsonify, g
from app.services.auth_service import AuthService
from app.utils.decorators import token_required

auth_bp = Blueprint('auth', __name__)

# --- USER REGISTRATION ---
@auth_bp.route('/register', methods=['POST'])
def register():
    """Handles new user registration (both students and restaurants). Public endpoint."""
    data = request.get_json()
    result = AuthService.register_user(data)
    return jsonify(result), result['status']

# --- USER LOGIN ---
@auth_bp.route('/login', methods=['POST'])
def login():
    """Handles user authentication, returning a cryptographic JWT and user data. Public endpoint."""
    data = request.get_json()
    result = AuthService.login_user(data)
    return jsonify(result), result['status']

# --- UPDATE PROFILE ---
@auth_bp.route('/update', methods=['PUT'])
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
def forgot_password():
    """
    Receives an email address and triggers the password reset email flow.
    """
    data = request.get_json()
    result = AuthService.forgot_password(data)
    return jsonify(result), result['status']