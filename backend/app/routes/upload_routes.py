from flask import Blueprint, request, jsonify, g
from app.utils.decorators import token_required, restaurant_required, student_required
from app.services.storage_service import StorageService
from app.models.user import User, RestaurantProfile
from app.models.offer import Offer
from app.extensions import db

upload_bp = Blueprint('upload', __name__)

ALLOWED_DOCUMENT_TYPES = ('student', 'pensioner', 'social')

# --- UPLOAD FILE RULES ---
# Public images are already downscaled by the app (avatar 512 px, offer 1280 px); verification documents
# are full-resolution photos, so they get a higher cap. MAX_CONTENT_LENGTH (config.py) bounds the request.
PUBLIC_IMAGE_MAX_BYTES = 5 * 1024 * 1024
DOCUMENT_MAX_BYTES = 10 * 1024 * 1024

# Detected from the file content, never from the client's file name / Content-Type
IMAGE_SIGNATURES = (
    (b'\xff\xd8\xff', 'jpg', 'image/jpeg'),
    (b'\x89PNG\r\n\x1a\n', 'png', 'image/png'),
)


def _detect_image(head):
    for signature, extension, content_type in IMAGE_SIGNATURES:
        if head.startswith(signature):
            return extension, content_type
    if len(head) >= 12 and head[:4] == b'RIFF' and head[8:12] == b'WEBP':
        return 'webp', 'image/webp'
    return None


def _validate_image(file, max_bytes):
    """Returns ((extension, content_type), None) for an allowed image, otherwise (None, (response, status))."""
    file.stream.seek(0, 2)
    size = file.stream.tell()
    file.stream.seek(0)
    if size > max_bytes:
        return None, (jsonify({'success': False, 'error': 'Payload Too Large',
                               'message': f'File is too large (max {max_bytes // (1024 * 1024)} MB).'}), 413)
    detected = _detect_image(file.stream.read(12))
    file.stream.seek(0)
    if not detected:
        return None, (jsonify({'success': False, 'error': 'Unsupported File',
                               'message': 'Only JPEG, PNG or WebP images are allowed.'}), 400)
    return detected, None

@upload_bp.route('/student-id', methods=['POST'])
@student_required  # verification documents are only part of the student workflow
def upload_student_id():
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No file part found'}), 400
        
    file = request.files['file']
    user_id = g.user.id  # own account only; client-supplied user_id is ignored
    
    if file.filename == '':
        return jsonify({'success': False, 'message': 'No selected file'}), 400

    detected, error = _validate_image(file, DOCUMENT_MAX_BYTES)
    if error:
        return error

    upload_result = StorageService.upload_file(file, folder='student_ids', private=True,
                                               extension=detected[0], content_type=detected[1])
    
    if upload_result.get('success'):
        user = User.query.get(user_id)
        if user:
            user.id_document_url = upload_result.get('url')
            user.document_type = 'student'
            user.verification_status = 'pending' 
            db.session.commit()
            return jsonify({'success': True, 'message': 'Student ID uploaded successfully', 'url': upload_result.get('url')}), 200
        return jsonify({'success': False, 'message': 'User not found'}), 404
    return jsonify({'success': False, 'message': upload_result.get('message')}), 500


@upload_bp.route('/offer-image', methods=['POST'])
@restaurant_required
def upload_offer_image():
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No file part found'}), 400
        
    file = request.files['file']
    offer_id = request.form.get('offer_id')
    
    if file.filename == '':
        return jsonify({'success': False, 'message': 'No selected file'}), 400
        
    if not offer_id:
        return jsonify({'success': False, 'message': 'Offer ID is required'}), 400

    offer = Offer.query.get(offer_id)
    if not offer:
        return jsonify({'success': False, 'message': 'Offer not found'}), 404
    if not offer.restaurant or offer.restaurant.owner_user_id != g.user.id:
        return jsonify({'success': False, 'message': 'Forbidden. This offer belongs to another restaurant.'}), 403

    detected, error = _validate_image(file, PUBLIC_IMAGE_MAX_BYTES)
    if error:
        return error

    upload_result = StorageService.upload_file(file, folder='offer_images',
                                               extension=detected[0], content_type=detected[1])
    
    if upload_result.get('success'):
        if offer:
            offer.image_url = upload_result.get('url')
            db.session.commit()
            return jsonify({'success': True, 'message': 'Offer image uploaded successfully', 'url': upload_result.get('url')}), 200
        return jsonify({'success': False, 'message': 'Offer not found'}), 404
    return jsonify({'success': False, 'message': upload_result.get('message')}), 500


@upload_bp.route('/restaurant-profile', methods=['POST'])
@restaurant_required
def upload_restaurant_profile():
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No file part found'}), 400
        
    file = request.files['file']
    restaurant_id = request.form.get('restaurant_id')
    
    if file.filename == '':
        return jsonify({'success': False, 'message': 'No selected file'}), 400
        
    if not restaurant_id:
        return jsonify({'success': False, 'message': 'Restaurant ID is required'}), 400

    restaurant = RestaurantProfile.query.get(restaurant_id)
    if not restaurant:
        return jsonify({'success': False, 'message': 'Restaurant not found'}), 404
    if restaurant.owner_user_id != g.user.id:
        return jsonify({'success': False, 'message': 'Forbidden. This restaurant profile is not yours.'}), 403

    detected, error = _validate_image(file, PUBLIC_IMAGE_MAX_BYTES)
    if error:
        return error

    upload_result = StorageService.upload_file(file, folder='restaurant_profiles',
                                               extension=detected[0], content_type=detected[1])
    
    if upload_result.get('success'):
        if restaurant:
            restaurant.profile_image_url = upload_result.get('url')
            db.session.commit()
            return jsonify({'success': True, 'message': 'Restaurant profile image uploaded successfully', 'url': upload_result.get('url')}), 200
        return jsonify({'success': False, 'message': 'Restaurant not found'}), 404
    return jsonify({'success': False, 'message': upload_result.get('message')}), 500


# --- DEPLOYMENT READY: UPLOAD USER DOCUMENT ---
@upload_bp.route('/user-document', methods=['POST'])
@student_required  # restaurants/admins submitting a document used to lock their own account ('pending')
def upload_user_document():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
        
    file = request.files['file']
    user_id = g.user.id  # own account only; client-supplied user_id is ignored
    doc_type = request.form.get('document_type') or None

    # Only the document kinds offered by the app / understood by the admin dashboard
    if doc_type is not None and doc_type not in ALLOWED_DOCUMENT_TYPES:
        return jsonify({'error': 'Invalid document type.'}), 400

    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    detected, error = _validate_image(file, DOCUMENT_MAX_BYTES)
    if error:
        return error

    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        upload_result = StorageService.upload_file(file, folder='id_documents', private=True,
                                                   extension=detected[0], content_type=detected[1])
        
        if not upload_result.get('success'):
            return jsonify({'error': upload_result.get('message', 'Upload failed')}), 500

        user.verification_status = 'pending'
        user.id_document_url = upload_result.get('url')
        user.document_type = doc_type
        db.session.commit()

        return jsonify({'message': 'Document uploaded successfully', 'file_url': user.id_document_url}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Document upload error: {str(e)}")
        return jsonify({'error': 'Document upload failed. Please try again.'}), 500


# --- NEW: UPLOAD USER PROFILE AVATAR ---
@upload_bp.route('/user-avatar', methods=['POST'])
@token_required
def upload_user_avatar():
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No file part found'}), 400
        
    file = request.files['file']
    user_id = g.user.id  # own account only; client-supplied user_id is ignored
    
    if file.filename == '':
        return jsonify({'success': False, 'message': 'No selected file'}), 400

    detected, error = _validate_image(file, PUBLIC_IMAGE_MAX_BYTES)
    if error:
        return error

    # Upload to AWS S3/Firebase Storage in the 'avatars' folder
    upload_result = StorageService.upload_file(file, folder='avatars',
                                               extension=detected[0], content_type=detected[1])
    
    if upload_result.get('success'):
        user = User.query.get(user_id)
        if user:
            user.avatar_url = upload_result.get('url')
            db.session.commit()
            return jsonify({
                'success': True, 
                'message': 'Avatar uploaded successfully', 
                'url': upload_result.get('url')
            }), 200
        return jsonify({'success': False, 'message': 'User not found'}), 404
    return jsonify({'success': False, 'message': upload_result.get('message')}), 500