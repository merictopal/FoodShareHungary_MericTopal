from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime
import uuid
import math
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import linear_kernel

app = Flask(__name__)

app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:murat2003@127.0.0.1/foodshare_db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
CORS(app)

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default='student') 
    verification_status = db.Column(db.String(20), default='unverified') 
    verification_doc = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Restaurant(db.Model):
    __tablename__ = 'restaurants'
    id = db.Column(db.Integer, primary_key=True)
    owner_user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text)
    lat = db.Column(db.Float, default=47.4979)
    lng = db.Column(db.Float, default=19.0402)

class Offer(db.Model):
    __tablename__ = 'offers'
    id = db.Column(db.Integer, primary_key=True)
    restaurant_id = db.Column(db.Integer, db.ForeignKey('restaurants.id'))
    type = db.Column(db.String(20), nullable=False)
    description = db.Column(db.Text, nullable=False)
    discount_rate = db.Column(db.Integer, default=0)
    status = db.Column(db.String(20), default='active')
    quantity = db.Column(db.Integer, default=1)
    restaurant = db.relationship('Restaurant', backref='offers')

class Claim(db.Model):
    __tablename__ = 'claims'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    offer_id = db.Column(db.Integer, db.ForeignKey('offers.id'))
    qr_code = db.Column(db.String(255), unique=True)
    status = db.Column(db.String(20), default='pending')
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    offer = db.relationship('Offer', backref='claims')

class Leaderboard(db.Model):
    __tablename__ = 'leaderboard'
    restaurant_id = db.Column(db.Integer, db.ForeignKey('restaurants.id'), primary_key=True)
    points = db.Column(db.Integer, default=0)
    meals_shared = db.Column(db.Integer, default=0)
    restaurant = db.relationship('Restaurant', backref='leaderboard_entry')

class Notification(db.Model):
    __tablename__ = 'notifications'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    message = db.Column(db.String(255), nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

def calculate_distance(lat1, lon1, lat2, lon2):
    if not lat1 or not lat2: return 0.0
    R = 6371
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = math.sin(dLat/2) * math.sin(dLat/2) + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLon/2) * math.sin(dLon/2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return round(R * c, 2)

def get_ai_recommendations(user_id):
    user_claims = Claim.query.filter_by(user_id=user_id).all()
    if not user_claims: return []
    user_history_text = " ".join([c.offer.description for c in user_claims])
    active_offers = Offer.query.filter(Offer.status=='active', Offer.quantity > 0).all()
    if not active_offers: return []
    offer_data = [{'id': o.id, 'description': o.description} for o in active_offers]
    df = pd.DataFrame(offer_data)
    all_descriptions = [user_history_text] + df['description'].tolist()
    tfidf = TfidfVectorizer(stop_words='english')
    tfidf_matrix = tfidf.fit_transform(all_descriptions)
    cosine_sim = linear_kernel(tfidf_matrix[0:1], tfidf_matrix[1:]).flatten()
    df['score'] = cosine_sim
    recommended_df = df.sort_values(by='score', ascending=False).head(3)
    return recommended_df[recommended_df['score'] > 0]['id'].tolist()


@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    if User.query.filter_by(email=data.get('email')).first(): return jsonify({"message": "E-posta kayıtlı!"}), 400
    role = data.get('role', 'student')
    status = 'pending' if role == 'restaurant' else 'unverified'
    new_user = User(name=data.get('name'), email=data.get('email'), password=data.get('password'), role=role, verification_status=status)
    db.session.add(new_user)
    db.session.commit()
    if role == 'restaurant':
        import random
        new_rest = Restaurant(owner_user_id=new_user.id, name=data.get('name') + " Restaurant", lat=47.4979 + (random.uniform(-0.02, 0.02)), lng=19.0402 + (random.uniform(-0.02, 0.02)))
        db.session.add(new_rest)
        db.session.commit()
        return jsonify({"message": "Başvuru alındı!"}), 201
    return jsonify({"message": "Kayıt başarılı!"}), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(email=data.get('email')).first()
    if user and user.password == data.get('password'):
        if user.role == 'admin': return jsonify({"message": "Admin", "user": {"id": user.id, "name": user.name, "role": user.role}}), 200
        if user.role == 'restaurant' and user.verification_status != 'verified': return jsonify({"message": "Onay bekleniyor."}), 403
        return jsonify({"message": "Giriş", "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role, "status": user.verification_status}}), 200
    return jsonify({"message": "Hatalı giriş"}), 401

@app.route('/api/user/update', methods=['PUT'])
def update_user():
    data = request.get_json()
    user_id = data.get('user_id')
    user = User.query.get(user_id)
    if not user: return jsonify({"message": "Kullanıcı bulunamadı"}), 404
    
    if 'name' in data and data['name']: user.name = data['name']
    if 'email' in data and data['email']: user.email = data['email']
    if 'password' in data and data['password']: user.password = data['password']
    
    db.session.commit()
    return jsonify({"message": "Profil güncellendi!", "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role, "status": user.verification_status}}), 200

@app.route('/api/offers/create', methods=['POST'])
def create_offer():
    data = request.get_json()
    restaurant = Restaurant.query.filter_by(owner_user_id=data.get('user_id')).first()
    if not restaurant: return jsonify({"message": "Restoran yok"}), 404
    new_offer = Offer(restaurant_id=restaurant.id, type=data.get('type'), description=data.get('description'), quantity=int(data.get('quantity', 1)), discount_rate=int(data.get('discount_rate', 0) if data.get('type')=='discount' else 0))
    db.session.add(new_offer)
    db.session.commit()
    students = User.query.filter_by(role='student').all()
    for s in students: db.session.add(Notification(user_id=s.id, message=f"📣 {restaurant.name}: Yeni {new_offer.description} fırsatı!"))
    db.session.commit()
    return jsonify({"message": "Eklendi!"}), 201

@app.route('/api/offers', methods=['GET'])
def get_offers():
    user_lat, user_lng, user_id = float(request.args.get('lat', 47.4979)), float(request.args.get('lng', 19.0402)), request.args.get('user_id')
    offers = Offer.query.filter(Offer.status=='active', Offer.quantity > 0).all()
    recommended_ids = get_ai_recommendations(int(user_id)) if user_id else []
    output = []
    for offer in offers:
        rest = offer.restaurant
        dist = calculate_distance(user_lat, user_lng, rest.lat, rest.lng) if rest else 0
        output.append({'id': offer.id, 'restaurant': rest.name if rest else "", 'type': offer.type, 'description': offer.description, 'quantity': offer.quantity, 'discount_rate': offer.discount_rate, 'distance': dist, 'lat': rest.lat, 'lng': rest.lng, 'is_recommended': offer.id in recommended_ids})
    output.sort(key=lambda x: (not x['is_recommended'], x['distance']))
    return jsonify(output)

@app.route('/api/notifications/<int:user_id>', methods=['GET'])
def get_notifications(user_id):
    return jsonify([{'id': n.id, 'message': n.message, 'date': n.created_at.strftime("%H:%M")} for n in Notification.query.filter_by(user_id=user_id).order_by(Notification.created_at.desc()).all()])

@app.route('/api/user/verify', methods=['POST'])
def verify_student():
    u = User.query.get(request.get_json().get('user_id'))
    if u: u.verification_doc=request.get_json().get('document'); u.verification_status='pending'; db.session.commit(); return jsonify({"message": "OK"}), 200
    return jsonify({"message": "Err"}), 404

@app.route('/api/offers/claim', methods=['POST'])
def claim_offer():
    data = request.get_json()
    offer = Offer.query.get(data.get('offer_id'))
    if not offer or offer.quantity < 1: return jsonify({"message": "Tükendi"}), 400
    offer.quantity -= 1
    code = f"{offer.id}-{uuid.uuid4().hex[:4].upper()}"
    db.session.add(Claim(user_id=data.get('user_id'), offer_id=offer.id, qr_code=code))
    db.session.commit()
    return jsonify({"message": "OK", "qr_code": code, "offer_desc": offer.description}), 201

@app.route('/api/claims/verify', methods=['POST'])
def verify_claim():
    claim = Claim.query.filter_by(qr_code=request.get_json().get('qr_code')).first()
    if not claim or claim.status=='validated': return jsonify({"message": "Geçersiz"}), 400
    claim.status = 'validated'
    lb = Leaderboard.query.get(claim.offer.restaurant_id)
    if not lb: lb = Leaderboard(restaurant_id=claim.offer.restaurant_id, points=0, meals_shared=0); db.session.add(lb)
    lb.points += 10; lb.meals_shared += 1; db.session.commit()
    return jsonify({"message": "OK", "points": lb.points}), 200

@app.route('/api/admin/stats', methods=['GET'])
def stats(): return jsonify({"total_users": User.query.count(), "total_restaurants": Restaurant.query.count(), "active_offers": Offer.query.filter_by(status='active').count(), "total_claims": Claim.query.count()})

@app.route('/api/admin/pending', methods=['GET'])
def pending():
    rests = [{'type':'restaurant', 'user_id':u.id, 'name':u.name, 'email':u.email, 'detail': Restaurant.query.filter_by(owner_user_id=u.id).first().name} for u in User.query.filter_by(role='restaurant', verification_status='pending').all()]
    studs = [{'type':'student', 'user_id':u.id, 'name':u.name, 'email':u.email, 'detail': 'Öğrenci', 'doc': u.verification_doc} for u in User.query.filter_by(role='student', verification_status='pending').all()]
    return jsonify(rests + studs)

@app.route('/api/admin/approve', methods=['POST'])
def approve():
    u = User.query.get(request.get_json().get('user_id')); 
    if u: u.verification_status='verified'; db.session.commit(); return jsonify({"message": "OK"}), 200
    return jsonify({"message": "Err"}), 404

@app.route('/api/leaderboard', methods=['GET'])
def leaderboard(): return jsonify([{'restaurant': l.restaurant.name, 'points': l.points, 'meals': l.meals_shared} for l in Leaderboard.query.order_by(Leaderboard.points.desc()).limit(10).all()])

@app.route('/api/user/history/<int:user_id>', methods=['GET'])
def history(user_id): return jsonify([{'id': c.id, 'description': c.offer.description, 'restaurant': c.offer.restaurant.name, 'status': c.status, 'date': c.timestamp.strftime("%d-%m"), 'qr_code': c.qr_code} for c in Claim.query.filter_by(user_id=user_id).order_by(Claim.timestamp.desc()).all()])

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        if not User.query.filter_by(email="admin@foodshare.com").first():
            db.session.add(User(name="Yönetici", email="admin@foodshare.com", password="123", role="admin", verification_status="verified"))
            db.session.commit()
    app.run(host='0.0.0.0', port=5000, debug=True)