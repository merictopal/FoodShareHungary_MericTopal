from datetime import datetime
from app.extensions import db

class Offer(db.Model):
    __tablename__ = 'offers'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    restaurant_id = db.Column(db.Integer, db.ForeignKey('restaurant_profiles.id'), nullable=False)
    title = db.Column(db.String(100), nullable=False) 
    description = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(20), nullable=False)
    discount_rate = db.Column(db.Integer, default=0)
    original_quantity = db.Column(db.Integer, default=1) 
    quantity = db.Column(db.Integer, default=1)  
    status = db.Column(db.String(20), default='active')
    pickup_start = db.Column(db.String(20), nullable=True)
    pickup_end = db.Column(db.String(20), nullable=True)
    image_url = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    claims = db.relationship('app.models.offer.Claim', backref='offer', lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id,
            'restaurant': self.restaurant.name if self.restaurant else "Unknown",
            'title': self.title,
            'description': self.description,
            'type': self.type,
            'discount_rate': self.discount_rate,
            'quantity_left': self.quantity,
            'original_quantity': self.original_quantity,
            'status': self.status,
            'pickup_window': f"{self.pickup_start} - {self.pickup_end}" if self.pickup_start else "Gün Boyu",
            'image_url': self.image_url,
            'location': {'lat': self.restaurant.lat if self.restaurant else 0.0, 'lng': self.restaurant.lng if self.restaurant else 0.0},
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M')
        }

class Claim(db.Model):
    __tablename__ = 'claims'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    offer_id = db.Column(db.Integer, db.ForeignKey('offers.id'), nullable=False)
    qr_code = db.Column(db.String(255), unique=True, nullable=False)
    status = db.Column(db.String(20), default='pending')
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'offer_title': self.offer.title if self.offer else "Unknown",
            'offer_desc': self.offer.description if self.offer else "",
            'restaurant_name': self.offer.restaurant.name if self.offer and self.offer.restaurant else "Unknown",
            'qr_code': self.qr_code,
            'status': self.status,
            'date': self.created_at.strftime('%d-%m-%Y'),
            'time': self.created_at.strftime('%H:%M')
        }