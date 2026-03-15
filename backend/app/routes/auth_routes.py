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