from datetime import datetime
from app.extensions import db

class Notification(db.Model):
    __tablename__ = 'notifications'
    __table_args__ = {'extend_existing': True}

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
    __tablename__ = 'leaderboard'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    restaurant_id = db.Column(db.Integer, db.ForeignKey('restaurant_profiles.id'), nullable=False)
    points = db.Column(db.Integer, default=0)
    meals_shared = db.Column(db.Integer, default=0)

    def to_dict(self):
        return {
            'restaurant': self.restaurant_lb.name if self.restaurant_lb else "Unknown",
            'points': self.points,
            'meals_shared': self.meals_shared,
            'rank': 0
        }