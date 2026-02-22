from app.models import User, RestaurantProfile
from app.extensions import db

class AuthService:

    @staticmethod
    def register_user(data):
        email = data.get('email')
        name = data.get('name')
        password = data.get('password')
        role = data.get('role', 'student') 

        if User.query.filter_by(email=email).first():
            return {
                'success': False,
                'message': 'This email address is already in use.',
                'status': 400
            }

        initial_status = 'pending' if role == 'restaurant' else 'unverified'

        try:
            new_user = User(
                name=name,
                email=email,
                role=role,
                verification_status=initial_status
            )
            
            new_user.password = password
            
            db.session.add(new_user)
            db.session.flush() 

            if role == 'restaurant':
                new_rest_profile = RestaurantProfile(
                    owner_user_id=new_user.id,
                    name=data.get('business_name', name), 
                    lat=41.0082, 
                    lng=28.9784
                )
                db.session.add(new_rest_profile)

            db.session.commit() 

            if role == 'restaurant':
                success_msg = "Application received. You can log in after admin approval."
            else:
                success_msg = "Registration successful! You can log in."

            return {
                'success': True,
                'message': success_msg,
                'user_id': new_user.id,
                'status': 201
            }

        except Exception as e:
            db.session.rollback() 
            return {
                'success': False,
                'message': f'Server error: {str(e)}',
                'status': 500
            }

    @staticmethod
    def login_user(data):
        email = data.get('email')
        password = data.get('password')

        user = User.query.filter_by(email=email).first()

        if not user or not user.check_password(password):
            return {
                'success': False,
                'message': 'Invalid email or password.',
                'status': 401
            }

        if user.role == 'restaurant' and user.verification_status != 'verified':
            return {
                'success': False,
                'message': 'Your account has not been approved yet. Please wait for admin approval.',
                'status': 403
            }

        return {
            'success': True,
            'message': 'Login successful.',
            'user': user.to_dict(),
            'status': 200
        }

    @staticmethod
    def update_profile(data):
        user_id = data.get('user_id')
        user = User.query.get(user_id)

        if not user:
            return {'success': False, 'message': 'User not found.', 'status': 404}

        if data.get('name'):
            user.name = data['name']
        if data.get('email'):
            user.email = data['email']
        if data.get('password'):
            user.password = data['password'] 

        try:
            db.session.commit()
            return {
                'success': True,
                'message': 'Profile updated.',
                'user': user.to_dict(),
                'status': 200
            }
        except Exception as e:
            db.session.rollback()
            return {'success': False, 'message': 'Update error.', 'status': 500}