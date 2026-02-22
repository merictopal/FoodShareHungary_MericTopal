from flask import Blueprint, request, jsonify
from app.services.auth_service import AuthService

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    
    data = request.get_json()
    
    result = AuthService.register_user(data)
    
    return jsonify(result), result['status']

@auth_bp.route('/login', methods=['POST'])
def login():
    
    data = request.get_json()
    result = AuthService.login_user(data)
    return jsonify(result), result['status']

@auth_bp.route('/update', methods=['PUT'])
def update_profile():
    
    data = request.get_json()
    result = AuthService.update_profile(data)
    return jsonify(result), result['status']