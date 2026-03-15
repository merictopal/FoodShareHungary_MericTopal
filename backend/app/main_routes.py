from flask import Blueprint, jsonify, request
from app.extensions import db
from app.models import User, RestaurantProfile, Offer, Claim, Leaderboard
from app.services.auth_service import AuthService
from app.services.qr_service import QRService 
import uuid
from sqlalchemy import desc, func
from app.services.storage_service import StorageService

main = Blueprint('main', __name__)

# --- PHASE 2: ARCHITECTURE STABILIZATION ---
# Distance calculations are completely offloaded to the PostGIS spatial database engine 
# for maximum performance and scalability.

@main.route('/api/auth/register', methods=['POST'])
def register():
    return jsonify(AuthService.register_user(request.get_json()))

@main.route('/api/auth/login', methods=['POST'])
def login():
    return jsonify(AuthService.login_user(request.get_json()))

@main.route('/api/offers/create', methods=['POST'])
def create_offer():
    data = request.get_json()
    result = QRService.create_offer(data)
    return jsonify(result), result.get('status', 400)

@main.route('/api/offers', methods=['GET'])
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

@main.route('/api/offers/claim', methods=['POST'])
def claim_offer():
    data = request.get_json()
    result = QRService.claim_offer(data.get('user_id'), data.get('offer_id'))
    return jsonify(result), result.get('status', 400)

@main.route('/api/claims/verify', methods=['POST'])
def verify_claim():
    data = request.get_json()
    result = QRService.verify_claim_qr(data.get('qr_code'))
    return jsonify(result), result.get('status', 400)

@main.route('/api/student/history/<int:user_id>', methods=['GET'])
def get_student_history(user_id):
    try:
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
            
        return jsonify(output)
    except Exception as e:
        print(f"History Error: {e}")
        return jsonify({'error': str(e)}), 500

@main.route('/api/leaderboard', methods=['GET'])
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

# --- PHASE 4: CLOUD STORAGE INTEGRATION ---
@main.route('/api/upload/user-document', methods=['POST'])
def upload_user_document():
    # Check if the file is in the request
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
        
    file = request.files['file']
    user_id = request.form.get('user_id')

    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # DEPLOYMENT READY: Upload the file using StorageService (AWS S3 or Local Fallback)
        upload_result = StorageService.upload_file(file, folder='id_documents')
        
        if not upload_result.get('success'):
            return jsonify({'error': upload_result.get('message', 'Upload failed')}), 500

        user.verification_status = 'pending'
        
        # 🚀 THE FIX: Use the actual database column name: id_document_url
        user.id_document_url = upload_result.get('url')
        
        db.session.commit()

        return jsonify({
            'message': 'Document uploaded successfully', 
            'file_url': user.id_document_url
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500