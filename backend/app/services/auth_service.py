import jwt
from datetime import datetime, timedelta
from flask import current_app, request
from app.models import User, RestaurantProfile
# IMPORT AUDIT LOG
from app.models.user import AuditLog 
from app.extensions import db
from sqlalchemy import text

class AuthService:

    # --- INTERNAL HELPER: AUDIT LOGGER ---
    @staticmethod
    def log_audit(user_id, action, details=""):
        """Records critical security events to the database."""
        try:
            ip = request.remote_addr if request else 'Unknown IP'
            log = AuditLog(user_id=user_id, action=action, details=details, ip_address=ip)
            db.session.add(log)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            print(f"⚠️ AUDIT LOG FAILED: {str(e)}")

    # --- REGISTER USER ---
    @staticmethod
    def register_user(data):
        email = data.get('email')
        name = data.get('name')
        password = data.get('password')
        role = data.get('role', 'student') 

        if User.query.filter_by(email=email).first():
            AuthService.log_audit(None, 'REGISTER_FAILED', f"Email already in use: {email}")
            return {'success': False, 'message': 'This email address is already in use.', 'status': 400}

        initial_status = 'pending' if role == 'restaurant' else 'unverified'

        try:
            new_user = User(name=name, email=email, role=role, verification_status=initial_status)
            new_user.password = password
            
            db.session.add(new_user)
            db.session.flush() 

            if role == 'restaurant':
                new_rest_profile = RestaurantProfile(
                    owner_user_id=new_user.id, name=data.get('business_name', name), lat=41.0, lng=28.9
                )
                db.session.add(new_rest_profile)

            db.session.commit() 
            AuthService.log_audit(new_user.id, 'REGISTER_SUCCESS', f"Role: {role}")

            return {
                'success': True,
                'message': "Registration successful!" if role != 'restaurant' else "Application received.",
                'user_id': new_user.id,
                'status': 201
            }

        except Exception as e:
            db.session.rollback() 
            print(f"CRITICAL ERROR IN REGISTRATION: {str(e)}") 
            return {'success': False, 'message': 'An unexpected error occurred.', 'status': 500}

    # --- LOGIN USER (ENTERPRISE DUAL-TOKEN SYSTEM) ---
    @staticmethod
    def login_user(data):
        email = data.get('email')
        password = data.get('password')

        user = User.query.filter_by(email=email).first()

        if not user or not user.check_password(password):
            AuthService.log_audit(user.id if user else None, 'LOGIN_FAILED', f"Failed attempt for email: {email}")
            return {'success': False, 'message': 'Invalid email or password.', 'status': 401}

        if user.role == 'restaurant' and user.verification_status != 'verified':
            AuthService.log_audit(user.id, 'LOGIN_DENIED', 'Restaurant not verified yet.')
            return {'success': False, 'message': 'Account pending admin approval.', 'status': 403}

        user_data = user.to_dict()
        user_data['verification_status'] = user.verification_status

        try:
            secret_key = current_app.config['JWT_SECRET_KEY']
            
            # 1. SHORT-LIVED ACCESS TOKEN (15 Minutes) - Extremely Secure
            access_token = jwt.encode(
                {'user_id': user.id, 'role': user.role, 'type': 'access', 'exp': datetime.utcnow() + timedelta(minutes=15)},
                secret_key, algorithm="HS256"
            )
            
            # 2. LONG-LIVED REFRESH TOKEN (7 Days) - Used only to get a new Access Token
            refresh_token = jwt.encode(
                {'user_id': user.id, 'type': 'refresh', 'exp': datetime.utcnow() + timedelta(days=7)},
                secret_key, algorithm="HS256"
            )
            
            AuthService.log_audit(user.id, 'LOGIN_SUCCESS', 'Tokens generated.')

            return {
                'success': True,
                'message': 'Login successful.',
                'user': user_data,
                'token': access_token,      # Send to frontend
                'refresh_token': refresh_token, # Send to frontend
                'status': 200
            }
        except Exception as e:
            print(f"JWT ENCODING ERROR: {str(e)}")
            return {'success': False, 'message': 'Authentication error.', 'status': 500}

    # --- REFRESH TOKEN MECHANISM ---
    @staticmethod
    def refresh_access_token(data):
        """Generates a new 15-minute access token if the 7-day refresh token is valid."""
        refresh_token = data.get('refresh_token')
        
        if not refresh_token:
            return {'success': False, 'message': 'Refresh token missing.', 'status': 400}
            
        try:
            secret_key = current_app.config['JWT_SECRET_KEY']
            decoded = jwt.decode(refresh_token, secret_key, algorithms=["HS256"])
            
            # Ensure this is actually a refresh token
            if decoded.get('type') != 'refresh':
                return {'success': False, 'message': 'Invalid token type.', 'status': 401}
                
            user_id = decoded.get('user_id')
            user = User.query.get(user_id)
            
            if not user:
                return {'success': False, 'message': 'User no longer exists.', 'status': 404}
                
            # Issue a brand new 15-minute access token
            new_access_token = jwt.encode(
                {'user_id': user.id, 'role': user.role, 'type': 'access', 'exp': datetime.utcnow() + timedelta(minutes=15)},
                secret_key, algorithm="HS256"
            )
            
            AuthService.log_audit(user.id, 'TOKEN_REFRESHED', 'New access token issued.')
            return {'success': True, 'token': new_access_token, 'status': 200}
            
        except jwt.ExpiredSignatureError:
            return {'success': False, 'message': 'Refresh token expired. Please log in again.', 'status': 401}
        except jwt.InvalidTokenError:
            return {'success': False, 'message': 'Invalid refresh token.', 'status': 401}

    # --- UPDATE PROFILE ---
    @staticmethod
    def update_profile(data):
        user_id = data.get('user_id')
        user = User.query.get(user_id)

        if not user: return {'success': False, 'message': 'User not found.', 'status': 404}

        changes = []
        if data.get('name'):
            user.name = data['name']
            changes.append("Name")
        if data.get('email'):
            user.email = data['email']
            changes.append("Email")
        if data.get('password'):
            user.password = data['password'] 
            changes.append("Password")

        try:
            db.session.commit()
            user_data = user.to_dict()
            user_data['verification_status'] = user.verification_status
            
            AuthService.log_audit(user.id, 'PROFILE_UPDATED', f"Updated fields: {', '.join(changes)}")
            return {'success': True, 'message': 'Profile updated.', 'user': user_data, 'status': 200}
        except Exception as e:
            db.session.rollback()
            print(f"PROFILE UPDATE ERROR: {str(e)}")
            return {'success': False, 'message': 'System error.', 'status': 500}

# --- FCM TOKEN MANAGEMENT ---
    @staticmethod
    def update_fcm_token(data):
        """
        Links the FCM token to the user using Raw SQL.
        This prevents SQLAlchemy ORM from triggering unnecessary validations 
        on the RestaurantProfile (like GeoAlchemy geometry fields) during flush.
        """
        # Safely check both keys
        fcm_token = data.get('fcm_token') or data.get('token')
        user_id = data.get('user_id')

        if not fcm_token or not user_id: 
            return {'success': False, 'message': 'Missing data.', 'status': 400}
        
        try:
            # RAW SQL is faster and avoids ORM cascading quirks for simple updates
            query = text("UPDATE users SET fcm_token = :t WHERE id = :uid")
            db.session.execute(query, {'t': fcm_token, 'uid': user_id})
            db.session.commit()
            
            AuthService.log_audit(user_id, 'FCM_TOKEN_LINKED', "Token updated via Raw SQL")
            return {'success': True, 'message': 'FCM Token linked successfully.', 'status': 200}
        except Exception as e:
            db.session.rollback()
            print(f"FCM ERROR: {str(e)}")
            return {'success': False, 'message': 'Database error.', 'status': 500}