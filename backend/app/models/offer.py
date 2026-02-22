from datetime import datetime
from app.extensions import db

class Offer(db.Model):
    """
    Restoranların oluşturduğu yemek fırsatları.
    """
    __tablename__ = 'offers'

    id = db.Column(db.Integer, primary_key=True)
    
    restaurant_id = db.Column(db.Integer, db.ForeignKey('restaurant_profiles.id'), nullable=False)
    
    title = db.Column(db.String(100), nullable=False) 
    description = db.Column(db.Text, nullable=False)
    
    type = db.Column(db.String(20), nullable=False)
    
    discount_rate = db.Column(db.Integer, default=0)
    
    original_quantity = db.Column(db.Integer, default=1) 
    current_quantity = db.Column(db.Integer, default=1)  
    
    status = db.Column(db.String(20), default='active')
    
    pickup_start = db.Column(db.String(20), nullable=True)
    pickup_end = db.Column(db.String(20), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    claims = db.relationship('Claim', backref='offer', lazy='dynamic')

    def to_dict(self):
        """API için ilan detayları"""
        return {
            'id': self.id,
            'restaurant': self.restaurant.name,
            'title': self.title,
            'description': self.description,
            'type': self.type,
            'discount_rate': self.discount_rate,
            'quantity_left': self.current_quantity,
            'original_quantity': self.original_quantity,
            'status': self.status,
            'pickup_window': f"{self.pickup_start} - {self.pickup_end}" if self.pickup_start else "Gün Boyu",
            'location': {'lat': self.restaurant.lat, 'lng': self.restaurant.lng},
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M')
        }


class Claim(db.Model):
    """
    Öğrencilerin 'Al' butonuna bastığında oluşan işlem kaydı.
    QR kod bu tabloya bağlıdır.
    """
    __tablename__ = 'claims'

    id = db.Column(db.Integer, primary_key=True)
    
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    offer_id = db.Column(db.Integer, db.ForeignKey('offers.id'), nullable=False)

    qr_code = db.Column(db.String(255), unique=True, nullable=False)
    

    status = db.Column(db.String(20), default='pending')
    
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    validated_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self):
        """Geçmiş siparişler listesi için"""
        return {
            'id': self.id,
            'offer_title': self.offer.title,
            'offer_desc': self.offer.description,
            'restaurant_name': self.offer.restaurant.name,
            'qr_code': self.qr_code,
            'status': self.status,
            'date': self.timestamp.strftime('%d-%m-%Y'),
            'time': self.timestamp.strftime('%H:%M')
        }