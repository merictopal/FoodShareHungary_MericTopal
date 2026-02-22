from datetime import datetime
from app.extensions import db

class Notification(db.Model):
   
    __tablename__ = 'notifications'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    title = db.Column(db.String(100), default="Bildirim")
    message = db.Column(db.String(255), nullable=False)
    
    is_read = db.Column(db.Boolean, default=False)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'message': self.message,
            'is_read': self.is_read,
            'date': self.created_at.strftime('%d/%m %H:%M')
        }


class Leaderboard(db.Model):
    """
    En yardımsever restoranları sıralamak için kullanılan tablo.
    Her başarılı (validated) işlemde puan artar.
    """
    __tablename__ = 'leaderboard'

    restaurant_id = db.Column(db.Integer, db.ForeignKey('restaurant_profiles.id'), primary_key=True)
    
    points = db.Column(db.Integer, default=0)
    meals_shared = db.Column(db.Integer, default=0)
    
    last_updated = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'restaurant': self.restaurant.name,
            'points': self.points,
            'meals_shared': self.meals_shared,
            'rank': 0
        }