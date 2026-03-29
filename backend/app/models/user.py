from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from app.extensions import db
from geoalchemy2 import Geometry

class User(db.Model):
    __tablename__ = 'users'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False, index=True)
    
    # NEW: Added phone number for security and communication
    phone = db.Column(db.String(20), nullable=True) 
    password_hash = db.Column(db.String(255), nullable=False)
    
    # FIXED: Changed default role from 'student' to 'user' for a broader audience
    role = db.Column(db.String(20), default='user', nullable=False)
    verification_status = db.Column(db.String(20), default='unverified')
    
    id_document_url = db.Column(db.String(500), nullable=True)
    # NEW: Added avatar URL for user profile pictures
    avatar_url = db.Column(db.String(500), nullable=True) 
    
    # --- GAMIFICATION ENGINE ---
    xp = db.Column(db.Integer, default=0)
    level = db.Column(db.Integer, default=1)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    fcm_token = db.Column(db.String(255), nullable=True)
    
    # Clean, single-source-of-truth relationships with fully qualified paths
    restaurant_profile = db.relationship('app.models.user.RestaurantProfile', backref='owner', uselist=False, cascade="all, delete-orphan")
    claims = db.relationship('app.models.offer.Claim', backref='student', lazy='dynamic')
    notifications = db.relationship('app.models.stats.Notification', backref='user', lazy='dynamic', cascade="all, delete-orphan")

    @property
    def password(self):
        raise AttributeError('Password is not a readable attribute! Use hash.')

    @password.setter
    def password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'role': self.role,
            'status': self.verification_status,
            'joined_at': self.created_at.strftime('%d-%m-%Y'),
            'restaurant_name': self.restaurant_profile.name if self.restaurant_profile else None,
            'id_document_url': self.id_document_url,
            'avatar_url': self.avatar_url,
            # FIXED: Moved Gamification stats to the User dictionary where they belong
            'xp': self.xp or 0,
            'level': self.level or 1
        }

    def __repr__(self):
        return f"<User {self.email} ({self.role})>"


class RestaurantProfile(db.Model):
    __tablename__ = 'restaurant_profiles'
    __table_args__ = {'extend_existing': True}
    
    id = db.Column(db.Integer, primary_key=True)
    owner_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), unique=True, nullable=False)
    
    name = db.Column(db.String(120), nullable=False) 
    description = db.Column(db.Text, nullable=True)
    
    # These were actually already in your code, but now we will actively use them!
    address = db.Column(db.String(255), nullable=True)
    phone = db.Column(db.String(20), nullable=True)
    profile_image_url = db.Column(db.String(500), nullable=True)
    
    lat = db.Column(db.Float, default=47.4979)
    lng = db.Column(db.Float, default=19.0402)
    geom = db.Column(Geometry(geometry_type='POINT', srid=4326))
    
    # Explicit relationships with fully qualified paths
    offers = db.relationship('app.models.offer.Offer', backref='restaurant', lazy='dynamic')
    leaderboard_entry = db.relationship('app.models.stats.Leaderboard', backref='restaurant_lb', uselist=False)

    def to_dict(self):
        # CRITICAL FIX: Removed User fields from this method and correctly mapped Restaurant fields.
        return {
            'id': self.id,
            'owner_id': self.owner_user_id,
            'name': self.name,
            'description': self.description,
            'address': self.address,
            'phone': self.phone,
            'profile_image_url': self.profile_image_url,
            'lat': self.lat,
            'lng': self.lng
        }