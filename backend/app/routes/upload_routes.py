from flask import Blueprint, request, jsonify
from app.services.storage_service import StorageService
from app.models.user import User, RestaurantProfile
from app.models.offer import Offer
from app.extensions import db

upload_bp = Blueprint('upload', __name__)

@upload_bp.route('/student-id', methods=['POST'])
def upload_student_id():
    # 1. Check if the file is present in the request
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No file part found'}), 400
        
    file = request.files['file']
    user_id = request.form.get('user_id')
    
    if file.filename == '':
        return jsonify({'success': False, 'message': 'No selected file'}), 400
        
    if not user_id:
        return jsonify({'success': False, 'message': 'User ID is required'}), 400

    # 2. Upload the file to AWS S3
    upload_result = StorageService.upload_file(file, folder='student_ids')
    
    if upload_result.get('success'):
        # 3. Save the S3 URL to the database
        user = User.query.get(user_id)
        if user:
            user.id_document_url = upload_result.get('url')
            user.verification_status = 'pending' # Update status so admin can review
            db.session.commit()
            
            return jsonify({
                'success': True, 
                'message': 'Student ID uploaded successfully',
                'url': upload_result.get('url')
            }), 200
        return jsonify({'success': False, 'message': 'User not found'}), 404
        
    return jsonify({'success': False, 'message': upload_result.get('message')}), 500


@upload_bp.route('/offer-image', methods=['POST'])
def upload_offer_image():
    # 1. Check if the file is present in the request
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No file part found'}), 400
        
    file = request.files['file']
    offer_id = request.form.get('offer_id')
    
    if file.filename == '':
        return jsonify({'success': False, 'message': 'No selected file'}), 400
        
    if not offer_id:
        return jsonify({'success': False, 'message': 'Offer ID is required'}), 400

    # 2. Upload the file to AWS S3
    upload_result = StorageService.upload_file(file, folder='offer_images')
    
    if upload_result.get('success'):
        # 3. Save the S3 URL to the database
        offer = Offer.query.get(offer_id)
        if offer:
            offer.image_url = upload_result.get('url')
            db.session.commit()
            
            return jsonify({
                'success': True, 
                'message': 'Offer image uploaded successfully',
                'url': upload_result.get('url')
            }), 200
        return jsonify({'success': False, 'message': 'Offer not found'}), 404
        
    return jsonify({'success': False, 'message': upload_result.get('message')}), 500


@upload_bp.route('/restaurant-profile', methods=['POST'])
def upload_restaurant_profile():
    # 1. Check if the file is present in the request
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No file part found'}), 400
        
    file = request.files['file']
    restaurant_id = request.form.get('restaurant_id')
    
    if file.filename == '':
        return jsonify({'success': False, 'message': 'No selected file'}), 400
        
    if not restaurant_id:
        return jsonify({'success': False, 'message': 'Restaurant ID is required'}), 400

    # 2. Upload the file to AWS S3
    upload_result = StorageService.upload_file(file, folder='restaurant_profiles')
    
    if upload_result.get('success'):
        # 3. Save the S3 URL to the database
        restaurant = RestaurantProfile.query.get(restaurant_id)
        if restaurant:
            restaurant.profile_image_url = upload_result.get('url')
            db.session.commit()
            
            return jsonify({
                'success': True, 
                'message': 'Restaurant profile image uploaded successfully',
                'url': upload_result.get('url')
            }), 200
        return jsonify({'success': False, 'message': 'Restaurant not found'}), 404
        
    return jsonify({'success': False, 'message': upload_result.get('message')}), 500