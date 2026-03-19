from flask import Blueprint, jsonify, request
from app.extensions import db
from app.models import User, RestaurantProfile, Offer, Claim, Leaderboard
from app.services.qr_service import QRService 
from app.services.recommendation_service import RecommendationService
from sqlalchemy import desc, func
import math

student_bp = Blueprint('student', __name__)

# --- GET OFFERS WITH POSTGIS ---
@student_bp.route('/offers', methods=['GET'])
def get_offers():
    try:
        user_lat = float(request.args.get('lat', 41.0082))
        user_lng = float(request.args.get('lng', 28.9784))
        
        # 1. Convert user's latitude and longitude into a PostGIS Geometry Point
        user_location = func.ST_SetSRID(func.ST_MakePoint(user_lng, user_lat), 4326)
        
        # 2. Calculate distance in meters using ST_DistanceSphere, then convert to km
        distance_calc = (func.ST_DistanceSphere(RestaurantProfile.geom, user_location) / 1000).label('distance')
        
        # 3. Query the database and order by exact spatial distance
        results = db.session.query(Offer, RestaurantProfile, distance_calc)\
            .join(RestaurantProfile, Offer.restaurant_id == RestaurantProfile.id)\
            .filter(Offer.status == 'active', Offer.quantity > 0)\
            .order_by(distance_calc)\
            .all()
            
        output = []
        for offer, rest, dist in results:
            output.append({
                'id': offer.id,
                'restaurant': rest.name,
                'type': offer.type,
                'description': offer.description,
                'quantity': offer.quantity,
                'discount_rate': offer.discount_rate,
                'lat': rest.lat, 
                'lng': rest.lng,
                'distance': round(dist, 2) if dist is not None else 0.0,
                'image_url': offer.image_url 
            })
            
        return jsonify(output)
    except Exception as e:
        print(f"PostGIS Spatial Query Error: {str(e)}")
        return jsonify({"error": str(e)}), 500

# --- AI RECOMMENDATION MODULE ---
@student_bp.route('/recommendations/<user_id>', methods=['GET'])
def get_ai_recommendations(user_id):
    try:
        safe_user_id = int(user_id)
        user_lat = float(request.args.get('lat', 41.0082))
        user_lng = float(request.args.get('lng', 28.9784))
        
        recommended_offers = RecommendationService.get_recommended_offers(target_user_id=safe_user_id, top_n=5)
        
        output = []
        for offer_data in recommended_offers:
            rest_lat = float(offer_data.get('location', {}).get('lat', 41.0082))
            rest_lng = float(offer_data.get('location', {}).get('lng', 28.9784))
            
            # Safe distance calculation (Haversine Formula)
            R = 6371.0 
            dlat = math.radians(rest_lat - user_lat)
            dlon = math.radians(rest_lng - user_lng)
            a = math.sin(dlat / 2)**2 + math.cos(math.radians(user_lat)) * math.cos(math.radians(rest_lat)) * math.sin(dlon / 2)**2
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
            dist = R * c
            
            offer_type = str(offer_data.get('type', 'free')).lower().strip()
            
            # Extract for React Native safety
            offer_data['lat'] = rest_lat
            offer_data['lng'] = rest_lng
            offer_data['type'] = offer_type 
            offer_data['distance'] = round(dist, 2)
            offer_data['is_recommended'] = True 
            
            output.append(offer_data)
            
        return jsonify(output), 200

    except Exception as e:
        print(f"AI Recommendation Error: {str(e)}")
        return jsonify({"error": str(e)}), 500

# --- CLAIM AN OFFER ---
@student_bp.route('/offers/claim', methods=['POST'])
def claim_offer():
    data = request.get_json()
    result = QRService.claim_offer(data.get('user_id'), data.get('offer_id'))
    return jsonify(result), result.get('status', 400)

# --- STUDENT CLAIM HISTORY ---
@student_bp.route('/student/history/<int:user_id>', methods=['GET'])
def get_student_history(user_id):
    try:
        student = User.query.get(user_id)
        claims = Claim.query.filter_by(user_id=user_id).order_by(desc(Claim.created_at)).all()
        
        output = []
        for claim in claims:
            real_offer = Offer.query.get(claim.offer_id)
            if real_offer:
                real_rest = RestaurantProfile.query.get(real_offer.restaurant_id)
                rest_name = real_rest.name if real_rest else "Unknown Restaurant"
                
                output.append({
                    'id': claim.id,
                    'restaurant_name': rest_name,
                    'offer_title': real_offer.title or real_offer.description,
                    'type': real_offer.type, 
                    'date': claim.created_at.strftime('%d.%m.%Y %H:%M'),
                    'qr_code': claim.qr_code,
                    'status': claim.status,
                    'image_url': real_offer.image_url
                })
            
        return jsonify({
            'history': output,
            'xp': student.xp if student and student.xp else 0,
            'level': student.level if student and student.level else 1
        })
    except Exception as e:
        print(f"History Error: {e}")
        return jsonify({'error': str(e)}), 500

# --- LEADERBOARD ---
@student_bp.route('/leaderboard', methods=['GET'])
def get_leaderboard():
    try:
        leaders = Leaderboard.query.order_by(desc(Leaderboard.points)).limit(5).all()
        output = []
        for l in leaders:
            rest_name = l.restaurant_lb.name if l.restaurant_lb else "Unnamed"
            output.append({
                'restaurant': rest_name,
                'points': l.points,
                'meals': l.meals_shared
            })
        return jsonify(output)
    except Exception as e:
        print(f"Leaderboard Route Error: {str(e)}")
        return jsonify({'error': str(e)}), 500