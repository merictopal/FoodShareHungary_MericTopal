from flask import Blueprint, request, jsonify
from app.services.auth_service import AuthService

auth_bp = Blueprint('auth', __name__)

# --- USER REGISTRATION ---
@auth_bp.route('/register', methods=['POST'])
def register():
    """Handles new user registration (both students and restaurants)."""
    data = request.get_json()
    result = AuthService.register_user(data)
    return jsonify(result), result['status']

# --- USER LOGIN ---
@auth_bp.route('/login', methods=['POST'])
def login():
    """Handles user authentication, returning JWT and user data."""
    data = request.get_json()
    result = AuthService.login_user(data)
    return jsonify(result), result['status']

# --- UPDATE PROFILE ---
@auth_bp.route('/update', methods=['PUT'])
def update_profile():
    """Updates user profile information (name, email, password)."""
    data = request.get_json()
    result = AuthService.update_profile(data)
    return jsonify(result), result['status']

# --- UPDATE FCM TOKEN FOR PUSH NOTIFICATIONS ---
@auth_bp.route('/fcm-token', methods=['POST'])
def update_fcm_token():
    """Links the mobile device's FCM token to the user for push notifications."""
    data = request.get_json()
    result = AuthService.update_fcm_token(data)
    return jsonify(result), result['status']
# --- GET CURRENT USER DATA ---
@auth_bp.route('/me/<int:user_id>', methods=['GET'])
def get_current_user(user_id):
    """Fetches the latest user data to sync mobile app state."""
    from app.models.user import User # Import here to avoid circular dependencies if needed
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404

    return jsonify({
        'success': True,
        'user': {
            'id': user.id,
            'name': user.name,
            'email': user.email,
            'role': user.role,
            'verification_status': user.verification_status,
            'avatar_url': getattr(user, 'avatar_url', None),
            'xp': getattr(user, 'xp', 0),
            'level': getattr(user, 'level', 1)
        }
    }), 200