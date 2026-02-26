from app.extensions import db
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from geoalchemy2 import Geometry # PHASE 2: PostGIS Spatial Integration

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), default='student') # Roles: student, restaurant, admin
    verification_status = db.Column(db.String(20), default='unverified') 
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    restaurant_profile = db.relationship('RestaurantProfile', backref='owner', uselist=False)
    claims = db.relationship('Claim', backref='user', lazy=True)

    @property
    def password(self):
        raise AttributeError('Password is not readable!')

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
            'role': self.role,
            'status': self.verification_status
        }

class RestaurantProfile(db.Model):
    __tablename__ = 'restaurant_profiles'
    
    id = db.Column(db.Integer, primary_key=True)
    owner_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    address = db.Column(db.String(255), nullable=True)
    
    # Legacy coordinates (Kept for backward compatibility during transition)
    lat = db.Column(db.Float, nullable=True)
    lng = db.Column(db.Float, nullable=True)
    
    # --- PHASE 2: Architecture Stabilization & PostGIS Spatial Integration ---
    # geom: Stores the exact geographic location of the restaurant.
    # geometry_type='POINT': Represents a single coordinate pair on the map.
    # srid=4326: Standard WGS 84 GPS coordinate system.
    geom = db.Column(Geometry(geometry_type='POINT', srid=4326))
    
    offers = db.relationship('Offer', backref='restaurant', lazy=True)
    leaderboard_entry = db.relationship('Leaderboard', backref='restaurant', uselist=False)

class Offer(db.Model):
    __tablename__ = 'offers'
    
    id = db.Column(db.Integer, primary_key=True)
    restaurant_id = db.Column(db.Integer, db.ForeignKey('restaurant_profiles.id'), nullable=False)
    
    title = db.Column(db.String(100), nullable=True)
    description = db.Column(db.String(255), nullable=False)
    type = db.Column(db.String(20), nullable=False) # Offer types: free / discount
    
    quantity = db.Column(db.Integer, default=1)
    # --- PHASE 1 FIX: Added to track total vs remaining items for UI progress bar ---
    original_quantity = db.Column(db.Integer, default=1) 
    
    discount_rate = db.Column(db.Integer, default=0)
    status = db.Column(db.String(20), default='active') 
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
class Claim(db.Model):
    __tablename__ = 'claims'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    offer_id = db.Column(db.Integer, db.ForeignKey('offers.id'), nullable=False)
    qr_code = db.Column(db.String(100), unique=True, nullable=False)
    status = db.Column(db.String(20), default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Leaderboard(db.Model):
    __tablename__ = 'leaderboard'
    
    id = db.Column(db.Integer, primary_key=True)
    restaurant_id = db.Column(db.Integer, db.ForeignKey('restaurant_profiles.id'), nullable=False)
    points = db.Column(db.Integer, default=0)
    meals_shared = db.Column(db.Integer, default=0)