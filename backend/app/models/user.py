from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from app.extensions import db

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    
    role = db.Column(db.String(20), default='student', nullable=False)
    
    verification_status = db.Column(db.String(20), default='unverified')
    
    verification_doc = db.Column(db.Text, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    
    restaurant_profile = db.relationship('RestaurantProfile', backref='owner', uselist=False, cascade="all, delete-orphan")
    
    claims = db.relationship('Claim', backref='student', lazy='dynamic')
    
    notifications = db.relationship('Notification', backref='user', lazy='dynamic', cascade="all, delete-orphan")


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
            'role': self.role,
            'status': self.verification_status,
            'joined_at': self.created_at.strftime('%d-%m-%Y'),
            'restaurant_name': self.restaurant_profile.name if self.restaurant_profile else None
        }

    def __repr__(self):
        return f"<User {self.email} ({self.role})>"


class RestaurantProfile(db.Model):

    __tablename__ = 'restaurant_profiles'

    id = db.Column(db.Integer, primary_key=True)
    
    owner_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), unique=True, nullable=False)
    
    name = db.Column(db.String(120), nullable=False) 
    description = db.Column(db.Text, nullable=True)
    address = db.Column(db.String(255), nullable=True)
    phone = db.Column(db.String(20), nullable=True)
    
    lat = db.Column(db.Float, default=47.4979)
    lng = db.Column(db.Float, default=19.0402)
    
    offers = db.relationship('Offer', backref='restaurant', lazy='dynamic')
    
    leaderboard_entry = db.relationship('Leaderboard', backref='restaurant', uselist=False)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'address': self.address,
            'location': {'latitude': self.lat, 'longitude': self.lng}
        }