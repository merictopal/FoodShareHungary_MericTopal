import os
import re
import secrets
import smtplib
import jwt
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

from flask import current_app, request
from werkzeug.security import generate_password_hash, check_password_hash
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from sqlalchemy import text, func

from app.models import User, RestaurantProfile
from app.models.user import AuditLog 
from app.services.storage_service import StorageService
from app.extensions import db
from app.utils.decorators import account_block, RESTAURANT_REJECTED_STATUS

# Public registration may create these roles; 'user' is the legacy alias of 'student' and is stored as 'student',
# so app registration and Google sign-in produce the same role (old 'user' rows stay valid via STUDENT_ROLES).
REGISTRATION_ROLES = ('student', 'user', 'restaurant')
CANONICAL_STUDENT_ROLE = 'student'

ACCESS_TOKEN_TTL = timedelta(minutes=15)
REFRESH_TOKEN_TTL = timedelta(days=7)

# Same public answer for registered and unknown e-mails (no account enumeration), also when sending fails
FORGOT_PASSWORD_MESSAGE = 'If this email is registered, a reset code has been sent.'

# --- PASSWORD RESET LIMITS ---
RESET_CODE_TTL_MINUTES = 15
RESET_CODE_MAX_ATTEMPTS = 5
MIN_PASSWORD_LENGTH = 6
INVALID_RESET_CODE_MESSAGE = 'Invalid or expired reset code.'
PASSWORD_TOO_SHORT_MESSAGE = f'Password must be at least {MIN_PASSWORD_LENGTH} characters.'

# Same rule as the mobile app's isValidEmail (FoodShareMobile/src/utils/validation.ts)
EMAIL_PATTERN = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')


def normalize_email(value):
    """Trimmed, lower-cased e-mail, so case variants map to one account. Non-strings become ''."""
    return value.strip().lower() if isinstance(value, str) else ''


def find_user_by_email(email):
    """Case-insensitive lookup, so accounts stored before normalisation (mixed case) still match."""
    if not email:
        return None
    return User.query.filter(func.lower(User.email) == normalize_email(email)).first()

# --- INITIALIZE ENVIRONMENT VARIABLES ---
# This securely loads all variables from your .env file into the os.environ dictionary
load_dotenv()

class AuthService:

    # --- SHARED LOGIN HELPERS (password login, Google login, refresh) ---
    @staticmethod
    def _blocked_response(user, channel):
        """Audited error result when account_block() refuses this account, else None."""
        block = account_block(user)
        if not block:
            return None
        status, title, message = block
        AuthService.log_audit(user.id, 'LOGIN_DENIED', f"{title} ({channel}).")
        return {'success': False, 'error': title, 'message': message, 'status': status}

    @staticmethod
    def _access_token(user):
        return jwt.encode({'user_id': user.id, 'role': user.role, 'type': 'access',
                           'exp': datetime.utcnow() + ACCESS_TOKEN_TTL},
                          current_app.config['JWT_SECRET_KEY'], algorithm="HS256")

    @staticmethod
    def _refresh_token(user):
        return jwt.encode({'user_id': user.id, 'type': 'refresh', 'exp': datetime.utcnow() + REFRESH_TOKEN_TTL},
                          current_app.config['JWT_SECRET_KEY'], algorithm="HS256")

    @staticmethod
    def _user_payload(user):
        user_data = user.to_dict()
        user_data['verification_status'] = user.verification_status
        return user_data

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

    # --- COORDINATE VALIDATION ---
    @staticmethod
    def parse_coordinates(lat, lng):
        """Returns (lat, lng) as floats if both are valid WGS84 values, otherwise (None, None)."""
        try:
            lat, lng = float(lat), float(lng)
        except (TypeError, ValueError):
            return None, None
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            return None, None
        return lat, lng

    # --- REGISTER USER ---
    @staticmethod
    def register_user(data):
        """Registers a new user and creates associated profiles based on role."""
        email = normalize_email(data.get('email'))
        name = data.get('name')
        password = data.get('password')
        role = data.get('role', CANONICAL_STUDENT_ROLE)

        # Public registration may only create the roles the apps offer; admins are never self-registered.
        if role not in REGISTRATION_ROLES:
            AuthService.log_audit(None, 'REGISTER_FAILED', f"Rejected role '{role}' for email: {email}")
            return {'success': False, 'error': 'Validation Error', 'message': 'Invalid role for registration.', 'status': 400}
        if role == 'user':
            role = CANONICAL_STUDENT_ROLE

        # --- EXTENDED DEMOGRAPHICS (optional; empty values stored as NULL like Google-created accounts) ---
        phone = data.get('phone') or None
        date_of_birth = data.get('date_of_birth') or None
        gender = data.get('gender') or None
        occupation = data.get('occupation') or None
        university = data.get('university') or None
        major = data.get('major') or None
        study_year = data.get('study_year') or None

        if not EMAIL_PATTERN.match(email):
            return {'success': False, 'error': 'Validation Error', 'message': 'Please enter a valid email address.', 'status': 400}
        if not isinstance(password, str) or len(password) < MIN_PASSWORD_LENGTH:
            return {'success': False, 'error': 'Validation Error', 'message': PASSWORD_TOO_SHORT_MESSAGE, 'status': 400}

        if find_user_by_email(email):
            AuthService.log_audit(None, 'REGISTER_FAILED', f"Email already in use: {email}")
            return {'success': False, 'error': 'Conflict', 'message': 'This email address is already in use.', 'status': 409}

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
                # Coordinates are optional at sign-up; without them the previous placeholder
                # (41.0, 28.9) is kept until the restaurant sets its location from the dashboard.
                lat, lng = AuthService.parse_coordinates(data.get('lat'), data.get('lng'))
                if lat is None:
                    lat, lng = 41.0, 28.9
                new_rest_profile = RestaurantProfile(
                    owner_user_id=new_user.id, name=data.get('business_name', name),
                    address=data.get('address'), lat=lat, lng=lng
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
        email = normalize_email(data.get('email'))
        password = data.get('password')

        user = find_user_by_email(email)

        if not user or not isinstance(password, str) or not user.check_password(password):
            AuthService.log_audit(user.id if user else None, 'LOGIN_FAILED', f"Failed attempt for email: {email}")
            return {'success': False, 'error': 'Invalid Credentials', 'message': 'Invalid email or password.', 'status': 401}

        blocked = AuthService._blocked_response(user, 'password')
        if blocked:
            return blocked

        user_data = AuthService._user_payload(user)

        try:
            # Short-lived access token (15 min) + refresh token (7 days, only used to get new access tokens)
            access_token = AuthService._access_token(user)
            refresh_token = AuthService._refresh_token(user)

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

            # A refresh token issued before a suspension (or a restaurant rejection) must not mint new access tokens
            block = account_block(user)
            if block:
                status, title, message = block
                return {'success': False, 'error': title, 'message': message, 'status': status}

            new_access_token = AuthService._access_token(user)

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

        new_email = normalize_email(data['email']) if data.get('email') else None
        email_changes = new_email is not None and new_email != normalize_email(user.email)

        # E-mail and password changes need the current password: a stolen/forgotten-open session alone must
        # not be enough to take over the account (a changed e-mail would receive the next reset code).
        # 400 (not 401) so clients don't mistake it for an expired session.
        if email_changes or data.get('password'):
            current = data.get('current_password')
            if not isinstance(current, str) or not current or not user.check_password(current):
                return {'success': False, 'error': 'Validation Error', 'message': 'Current password is incorrect.', 'status': 400}

        changes = []
        if data.get('name'):
            user.name = data['name']
            changes.append("Name")
        if email_changes:
            if not EMAIL_PATTERN.match(new_email):
                return {'success': False, 'error': 'Validation Error', 'message': 'Please enter a valid email address.', 'status': 400}
            existing = find_user_by_email(new_email)
            if existing and existing.id != user.id:
                return {'success': False, 'error': 'Conflict', 'message': 'This email address is already in use.', 'status': 409}
            user.email = new_email
            changes.append("Email")
        if data.get('password'):
            new_password = data['password']
            if not isinstance(new_password, str) or len(new_password) < MIN_PASSWORD_LENGTH:
                db.session.rollback()
                return {'success': False, 'error': 'Validation Error', 'message': PASSWORD_TOO_SHORT_MESSAGE, 'status': 400}
            user.password = new_password
            changes.append("Password")

        try:
            db.session.commit()
            user_data = AuthService._user_payload(user)

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
            # An FCM token identifies one physical device: unlink it from any other account first, so pushes
            # for an account that previously used this device (e.g. logout never reached the server) stop.
            db.session.execute(text("UPDATE users SET fcm_token = NULL WHERE fcm_token = :t AND id <> :uid"),
                               {'t': fcm_token, 'uid': user_id})
            query = text("UPDATE users SET fcm_token = :t WHERE id = :uid")
            db.session.execute(query, {'t': fcm_token, 'uid': user_id})
            db.session.commit()

            AuthService.log_audit(user_id, 'FCM_TOKEN_LINKED', "Token updated via Raw SQL")
            return {'success': True, 'message': 'FCM Token linked successfully.', 'status': 200}
        except Exception as e:
            db.session.rollback()
            print(f"FCM ERROR: {str(e)}")
            return {'success': False, 'message': 'Database error.', 'status': 500}

    @staticmethod
    def clear_fcm_token(user_id, fcm_token):
        """
        Unlinks this device's FCM token from the user on logout. Only clears when the stored token is exactly
        this device's, so logging out on an old device never removes a newer device's token. Idempotent.
        """
        if not isinstance(fcm_token, str) or not fcm_token.strip():
            return {'success': False, 'error': 'Validation Error', 'message': 'fcm_token is required.', 'status': 400}

        try:
            result = db.session.execute(
                text("UPDATE users SET fcm_token = NULL WHERE id = :uid AND fcm_token = :t"),
                {'uid': user_id, 't': fcm_token})
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            print(f"FCM ERROR: {str(e)}")
            return {'success': False, 'error': 'Server Error', 'message': 'Database error.', 'status': 500}

        # Audit only real changes; a repeated/mismatched unregister is a no-op
        if result.rowcount:
            AuthService.log_audit(user_id, 'FCM_TOKEN_UNLINKED', 'Token cleared on logout')
        return {'success': True, 'message': 'FCM Token unlinked.', 'status': 200}

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

        # Without the expected client id google-auth skips the audience check and would accept an ID token
        # issued for ANY Google app, so Google sign-in is refused instead of running unchecked.
        client_id = os.environ.get("GOOGLE_WEB_CLIENT_ID")
        if not client_id:
            print("GOOGLE LOGIN REFUSED: GOOGLE_WEB_CLIENT_ID is not configured.")
            return {'success': False, 'error': 'Server Error',
                    'message': 'Google sign-in is not available right now.', 'status': 503}

        try:
            # 1. Verify the token's signature, expiry, issuer and audience (our client id)
            idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), client_id)

            # 2. Accounts are matched by e-mail, so the e-mail must be one Google has verified for this identity;
            # otherwise an unverified address could sign in to the existing account that owns it.
            email = normalize_email(idinfo.get('email'))
            if not email or idinfo.get('email_verified') is not True:
                AuthService.log_audit(None, 'LOGIN_FAILED', f"Google identity without a verified e-mail: {email or '(none)'}")
                return {'success': False, 'error': 'Invalid Credentials',
                        'message': 'Your Google e-mail address is not verified.', 'status': 401}
            name = idinfo.get('name', 'Google User')
            avatar_url = idinfo.get('picture') or None

            # 3. Check if user already exists in our database
            user = find_user_by_email(email)

            if not user:
                # First time login! Create a new student account silently
                user = User(
                    name=name,
                    email=email,
                    role=CANONICAL_STUDENT_ROLE,
                    verification_status='unverified',
                    avatar_url=avatar_url
                )
                user.password = secrets.token_urlsafe(16)
                
                db.session.add(user)
                db.session.flush() 
                
                AuthService.log_audit(user.id, 'REGISTER_GOOGLE_SUCCESS', f"Email: {email}")

            else:
                # Same rule as password login (suspension, restaurant approval)
                blocked = AuthService._blocked_response(user, 'Google')
                if blocked:
                    return blocked

            # 4. Generate native Dual-Tokens
            access_token = AuthService._access_token(user)
            refresh_token = AuthService._refresh_token(user)

            db.session.commit()
            AuthService.log_audit(user.id, 'LOGIN_GOOGLE_SUCCESS', 'Native tokens generated.')

            user_data = AuthService._user_payload(user)

            return {
                'success': True,
                'message': 'Google Login successful.',
                'user': user_data,
                'token': access_token,
                'refresh_token': refresh_token,
                'status': 200
            }

        except ValueError:
            return {'success': False, 'error': 'Invalid Credentials', 'message': 'Invalid Google Token. Please try again.', 'status': 401}
        except Exception as e:
            db.session.rollback()
            print(f"CRITICAL ERROR IN GOOGLE LOGIN: {str(e)}")
            return {'success': False, 'message': 'System error during Google Login.', 'status': 500}    

    # --- RESTAURANT RE-APPLICATION (after an admin rejection) ---
    @staticmethod
    def reapply_restaurant(data):
        """
        A rejected restaurant (status RESTAURANT_REJECTED_STATUS, set by /admin/reject) puts its application back
        to 'pending', so it reappears in the admin's pending list. Needs the account's e-mail + password because a
        rejected restaurant cannot obtain tokens. Wrong credentials get the same answer as /login.
        """
        data = data if isinstance(data, dict) else {}
        user = find_user_by_email(normalize_email(data.get('email')))
        password = data.get('password')
        if not user or not isinstance(password, str) or not user.check_password(password):
            AuthService.log_audit(user.id if user else None, 'LOGIN_FAILED', 'Failed restaurant re-application.')
            return {'success': False, 'error': 'Invalid Credentials', 'message': 'Invalid email or password.', 'status': 401}

        if user.role != 'restaurant' or user.verification_status != RESTAURANT_REJECTED_STATUS:
            return {'success': False, 'error': 'Conflict',
                    'message': 'There is no rejected application for this account.', 'status': 409}

        # Conditional UPDATE: two parallel re-applications move the row once
        changed = db.session.query(User).filter(
            User.id == user.id, User.verification_status == RESTAURANT_REJECTED_STATUS
        ).update({User.verification_status: 'pending'}, synchronize_session=False)
        db.session.commit()
        if changed:
            AuthService.log_audit(user.id, 'RESTAURANT_REAPPLIED', 'Application set back to pending.')
        return {'success': True, 'message': 'Application received.', 'status': 200}

    # --- REAL EMAIL SENDING FEATURE ---
    @staticmethod
    def send_forgot_password_email(data):
        """
        Validates the user email and sends a real 6-digit recovery code via SMTP.
        Retrieves secure credentials from the .env file to prevent leaks.
        """
        email_address = normalize_email(data.get('email'))
        
        if not email_address:
            return {'success': False, 'message': 'Email is required.', 'status': 400}

        # Verify if the user actually exists in our database
        # One public answer for every outcome below (unknown e-mail, sent, sending failed): the response must
        # not reveal whether an account exists.
        generic = {'success': True, 'message': FORGOT_PASSWORD_MESSAGE, 'status': 200}

        user = find_user_by_email(email_address)
        if not user:
            return generic

        try:
            # Generate a 6-digit recovery code from a CSPRNG; only its hash is stored, never the code itself
            recovery_code = f"{100000 + secrets.randbelow(900000)}"
            user.reset_code_hash = generate_password_hash(recovery_code)
            user.reset_code_expires_at = datetime.utcnow() + timedelta(minutes=RESET_CODE_TTL_MINUTES)
            user.reset_code_attempts = 0
            db.session.commit()
            
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
            return generic

        except Exception as e:
            # Logged for the operator only; a 500 here (and only here) would reveal that the account exists.
            # The stored code stays valid (hash + expiry + attempt cap), the user can simply request again.
            db.session.rollback()
            print(f"SMTP EMAIL ERROR: {str(e)}")
            AuthService.log_audit(user.id, 'PASSWORD_RESET_EMAIL_FAILED', 'Recovery email could not be sent.')
            return generic

    # --- ROUTER BINDING / BACKWARD COMPATIBILITY ---
    @staticmethod
    def forgot_password(data):
        """
        Acts as the router binding that delegates the request to the real email sender.
        Maintained to ensure the /forgot-password route operates seamlessly.
        """
        return AuthService.send_forgot_password_email(data)

    # --- RESET PASSWORD WITH E-MAILED CODE ---
    @staticmethod
    def reset_password(data):
        """
        Completes the forgot-password flow: verifies the stored code (hash, expiry, attempt cap) and sets
        the new password. Unknown email, missing/expired/wrong code all get the same answer (no enumeration).
        """
        email = normalize_email(data.get('email'))
        code = str(data.get('code') or '').strip()
        new_password = data.get('new_password') or ''

        if not email or not code or not new_password:
            return {'success': False, 'error': 'Validation Error',
                    'message': 'Email, code and new password are required.', 'status': 400}
        if not isinstance(new_password, str) or len(new_password) < MIN_PASSWORD_LENGTH:
            return {'success': False, 'error': 'Validation Error',
                    'message': PASSWORD_TOO_SHORT_MESSAGE, 'status': 400}

        invalid = {'success': False, 'error': 'Invalid Code', 'message': INVALID_RESET_CODE_MESSAGE, 'status': 400}

        user = find_user_by_email(email)
        if not user or not user.reset_code_hash or not user.reset_code_expires_at:
            return invalid

        try:
            if user.reset_code_expires_at < datetime.utcnow():
                AuthService._clear_reset_code(user)
                db.session.commit()
                return invalid

            if not check_password_hash(user.reset_code_hash, code):
                user.reset_code_attempts = (user.reset_code_attempts or 0) + 1
                # Too many wrong guesses burn the code, so a 6-digit space cannot be brute forced
                if user.reset_code_attempts >= RESET_CODE_MAX_ATTEMPTS:
                    AuthService._clear_reset_code(user)
                db.session.commit()
                AuthService.log_audit(user.id, 'PASSWORD_RESET_FAILED', 'Wrong reset code.')
                return invalid

            user.password = new_password
            AuthService._clear_reset_code(user)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            print(f"PASSWORD RESET ERROR: {str(e)}")
            return {'success': False, 'error': 'Server Error', 'message': 'System error.', 'status': 500}

        AuthService.log_audit(user.id, 'PASSWORD_RESET_SUCCESS', 'Password changed with e-mailed code.')
        return {'success': True, 'message': 'Password has been reset. You can now log in.', 'status': 200}

    @staticmethod
    def _clear_reset_code(user):
        # Single use: the code is wiped after success, expiry or too many attempts
        user.reset_code_hash = None
        user.reset_code_expires_at = None
        user.reset_code_attempts = 0

    # --- DELETE ACCOUNT (SELF-SERVICE, STUDENTS ONLY) ---
    @staticmethod
    def delete_account(user):
        """
        Permanently deletes a student account and the rows that belong only to it.
        Restaurants/admins are rejected by the route decorator: their offers carry other users' claims.
        """
        user_id = user.id
        stored_files = [
            (user.id_document_url, StorageService.DOCUMENT_FOLDERS),
            (user.avatar_url, ('avatars',)),
        ]

        try:
            # Pending claims still hold one portion each; give it back with a conditional UPDATE
            # (same style as claim creation) instead of read-then-write.
            db.session.execute(text("""
                UPDATE offers o
                SET quantity = o.quantity + 1,
                    status = CASE WHEN o.status = 'sold_out' THEN 'active' ELSE o.status END
                FROM claims c
                WHERE c.offer_id = o.id AND c.user_id = :uid AND c.status = 'pending'
            """), {'uid': user_id})
            db.session.execute(text("DELETE FROM claims WHERE user_id = :uid"), {'uid': user_id})
            db.session.execute(text("DELETE FROM notifications WHERE user_id = :uid"), {'uid': user_id})
            # Keep the security log but unlink it from the deleted account
            db.session.execute(text("UPDATE audit_logs SET user_id = NULL WHERE user_id = :uid"), {'uid': user_id})
            db.session.delete(user)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            print(f"ACCOUNT DELETION ERROR: {str(e)}")
            return {'success': False, 'error': 'Server Error',
                    'message': 'Account could not be deleted. Please try again.', 'status': 500}

        # Files go only after the DB no longer references them (same order as /admin/reject);
        # a failed file deletion can leave an orphan but never a broken account.
        file_deletion = [StorageService.delete_document(url, folders) for url, folders in stored_files if url]

        AuthService.log_audit(None, 'ACCOUNT_DELETED', f"user #{user_id}")
        return {'success': True, 'message': 'Your account has been deleted.',
                'file_deletion': file_deletion, 'status': 200}
