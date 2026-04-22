import os
import secrets
import random
import smtplib
import jwt
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

from flask import current_app, request
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from sqlalchemy import text

from app.models import User, RestaurantProfile
from app.models.user import AuditLog 
from app.extensions import db

# --- INITIALIZE ENVIRONMENT VARIABLES ---
# This securely loads all variables from your .env file into the os.environ dictionary
load_dotenv()

class AuthService:

    # --- INTERNAL HELPER: AUDIT LOGGER ---
    @staticmethod
    def log_audit(user_id, action, details=""):
        """Records critical security events to the database for monitoring."""
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
        """Registers a new user and creates associated profiles based on role."""
        email = data.get('email')
        name = data.get('name')
        password = data.get('password')
        role = data.get('role', 'student') 
        
        # --- EXTENDED DEMOGRAPHICS ---
        phone = data.get('phone')
        date_of_birth = data.get('date_of_birth')
        gender = data.get('gender')
        occupation = data.get('occupation')
        university = data.get('university')
        major = data.get('major')
        study_year = data.get('study_year')

        if User.query.filter_by(email=email).first():
            AuthService.log_audit(None, 'REGISTER_FAILED', f"Email already in use: {email}")
            return {'success': False, 'message': 'This email address is already in use.', 'status': 400}

        initial_status = 'pending' if role == 'restaurant' else 'unverified'

        try:
            # Create the new user entity with all demographic fields
            new_user = User(
                name=name, 
                email=email, 
                role=role, 
                verification_status=initial_status,
                phone=phone,
                date_of_birth=date_of_birth,
                gender=gender,
                occupation=occupation,
                university=university,
                major=major,
                study_year=study_year
            )
            new_user.password = password
            
            db.session.add(new_user)
            db.session.flush() 

            # Conditionally create a restaurant profile if applicable
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
        """Authenticates user credentials and generates JWT Access and Refresh tokens."""
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
                'token': access_token,      
                'refresh_token': refresh_token, 
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
            
            if decoded.get('type') != 'refresh':
                return {'success': False, 'message': 'Invalid token type.', 'status': 401}
                
            user_id = decoded.get('user_id')
            user = User.query.get(user_id)
            
            if not user:
                return {'success': False, 'message': 'User no longer exists.', 'status': 404}
                
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
        """Updates basic user profile information."""
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
        Links the Firebase Cloud Messaging token to the user using Raw SQL.
        This prevents SQLAlchemy ORM from triggering unnecessary validations.
        """
        fcm_token = data.get('fcm_token') or data.get('token')
        user_id = data.get('user_id')

        if not fcm_token or not user_id: 
            return {'success': False, 'message': 'Missing data.', 'status': 400}
        
        try:
            query = text("UPDATE users SET fcm_token = :t WHERE id = :uid")
            db.session.execute(query, {'t': fcm_token, 'uid': user_id})
            db.session.commit()
            
            AuthService.log_audit(user_id, 'FCM_TOKEN_LINKED', "Token updated via Raw SQL")
            return {'success': True, 'message': 'FCM Token linked successfully.', 'status': 200}
        except Exception as e:
            db.session.rollback()
            print(f"FCM ERROR: {str(e)}")
            return {'success': False, 'message': 'Database error.', 'status': 500}
        
    # --- GOOGLE LOGIN (ENTERPRISE GRADE) ---
    @staticmethod
    def google_login(data):
        """
        Verifies the Google ID token, creates a user if they don't exist,
        and generates our native JWT access & refresh tokens.
        """
        token = data.get('token')
        
        if not token:
            return {'success': False, 'message': 'Google token is missing.', 'status': 400}

        try:
            client_id = os.environ.get("GOOGLE_WEB_CLIENT_ID")
            
            # 1. Verify the token with Google's servers securely
            idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), client_id)

            # 2. Extract user data from the verified Google payload
            email = idinfo['email']
            name = idinfo.get('name', 'Google User')
            avatar_url = idinfo.get('picture', '')

            # 3. Check if user already exists in our database
            user = User.query.filter_by(email=email).first()

            if not user:
                # First time login! Create a new student account silently
                user = User(
                    name=name, 
                    email=email, 
                    role='student', 
                    verification_status='unverified',
                    avatar_url=avatar_url
                )
                user.password = secrets.token_urlsafe(16)
                
                db.session.add(user)
                db.session.flush() 
                
                AuthService.log_audit(user.id, 'REGISTER_GOOGLE_SUCCESS', f"Email: {email}")

            # 4. Generate native Dual-Tokens
            secret_key = current_app.config['JWT_SECRET_KEY']
            
            access_token = jwt.encode(
                {'user_id': user.id, 'role': user.role, 'type': 'access', 'exp': datetime.utcnow() + timedelta(minutes=15)},
                secret_key, algorithm="HS256"
            )
            
            refresh_token = jwt.encode(
                {'user_id': user.id, 'type': 'refresh', 'exp': datetime.utcnow() + timedelta(days=7)},
                secret_key, algorithm="HS256"
            )
            
            db.session.commit()
            AuthService.log_audit(user.id, 'LOGIN_GOOGLE_SUCCESS', 'Native tokens generated.')

            user_data = user.to_dict()
            user_data['verification_status'] = user.verification_status

            return {
                'success': True,
                'message': 'Google Login successful.',
                'user': user_data,
                'token': access_token,
                'refresh_token': refresh_token,
                'status': 200
            }

        except ValueError:
            return {'success': False, 'message': 'Invalid Google Token. Please try again.', 'status': 401}
        except Exception as e:
            db.session.rollback()
            print(f"CRITICAL ERROR IN GOOGLE LOGIN: {str(e)}")
            return {'success': False, 'message': 'System error during Google Login.', 'status': 500}    

    # --- REAL EMAIL SENDING FEATURE ---
    @staticmethod
    def send_forgot_password_email(data):
        """
        Validates the user email and sends a real 6-digit recovery code via SMTP.
        Retrieves secure credentials from the .env file to prevent leaks.
        """
        email_address = data.get('email')
        
        if not email_address:
            return {'success': False, 'message': 'Email is required.', 'status': 400}

        # Verify if the user actually exists in our database
        user = User.query.filter_by(email=email_address).first()
        if not user:
            # We return success even if user doesn't exist to prevent email enumeration attacks
            return {'success': True, 'message': 'If this email is registered, a reset link was sent.', 'status': 200}

        try:
            # Generate a secure 6-digit random recovery code
            recovery_code = f"{random.randint(100000, 999999)}"
            
            # --- SECURE SMTP CONFIGURATION ---
            # Fetching the sensitive credentials directly from the .env environment
            SENDER_EMAIL = os.environ.get("SMTP_EMAIL") 
            SENDER_PASSWORD = os.environ.get("SMTP_APP_PASSWORD") 
            
            if not SENDER_EMAIL or not SENDER_PASSWORD:
                raise ValueError("Critical: SMTP credentials are not configured in the .env file.")

            # Construct the email payload
            msg = MIMEMultipart()
            msg['From'] = SENDER_EMAIL
            msg['To'] = email_address
            msg['Subject'] = "FoodShare - Password Reset Code"

            # The HTML formatted body of the email
            html_content = f"""
            <html>
                <body style="font-family: Arial, sans-serif; text-align: center; color: #333;">
                    <h2>FoodShare Password Recovery</h2>
                    <p>Hello {user.name},</p>
                    <p>We received a request to reset your password. Here is your 6-digit recovery code:</p>
                    <h1 style="color: #E27B58; letter-spacing: 5px;">{recovery_code}</h1>
                    <p>If you did not request this, please ignore this email.</p>
                </body>
            </html>
            """
            msg.attach(MIMEText(html_content, 'html'))

            # Connect to Gmail's Secure SMTP Server
            server = smtplib.SMTP('smtp.gmail.com', 587)
            server.starttls() # Secure the connection using TLS
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.send_message(msg)
            server.quit()
            
            # Log the action for security auditing
            AuthService.log_audit(user.id, 'PASSWORD_RESET_REQUESTED', 'Recovery email sent successfully via SMTP.')

            return {'success': True, 'message': 'Recovery email sent successfully.', 'status': 200}

        except Exception as e:
            print(f"SMTP EMAIL ERROR: {str(e)}")
            return {'success': False, 'message': 'Failed to send email. Please check server configuration.', 'status': 500}

    # --- ROUTER BINDING / BACKWARD COMPATIBILITY ---
    @staticmethod
    def forgot_password(data):
        """
        Acts as the router binding that delegates the request to the real email sender.
        Maintained to ensure the /forgot-password route operates seamlessly.
        """
        return AuthService.send_forgot_password_email(data)