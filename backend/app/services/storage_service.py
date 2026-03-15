import os
import boto3
import uuid
from werkzeug.utils import secure_filename
from flask import current_app, request

class StorageService:
    @staticmethod
    def get_s3_client():
        """Creates and returns an authenticated S3 client, or None if keys are missing."""
        try:
            access_key = current_app.config.get('AWS_ACCESS_KEY_ID')
            secret_key = current_app.config.get('AWS_SECRET_ACCESS_KEY')
            region = current_app.config.get('AWS_REGION', 'eu-central-1')

            if not access_key or not secret_key:
                return None

            return boto3.client(
                's3',
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                region_name=region
            )
        except Exception:
            return None

    @staticmethod
    def upload_file(file_obj, folder='general'):
        """
        Uploads a file to AWS S3 and returns the public URL.
        If AWS keys are missing, saves the file locally as a fallback.
        """
        try:
            s3_client = StorageService.get_s3_client()
            bucket_name = current_app.config.get('AWS_BUCKET_NAME')
            region = current_app.config.get('AWS_REGION', 'eu-central-1')

            original_filename = secure_filename(file_obj.filename)
            extension = original_filename.split('.')[-1] if '.' in original_filename else 'jpg'
            unique_filename = f"{uuid.uuid4().hex}.{extension}"

            # --- ATTEMPT 1: AWS S3 UPLOAD ---
            if s3_client and bucket_name:
                print(f"☁️ Uploading {original_filename} to S3 bucket '{bucket_name}'...")
                s3_key = f"{folder}/{unique_filename}"
                
                s3_client.upload_fileobj(
                    file_obj,
                    bucket_name,
                    s3_key,
                    ExtraArgs={'ContentType': file_obj.content_type or 'image/jpeg'}
                )

                file_url = f"https://{bucket_name}.s3.{region}.amazonaws.com/{s3_key}"
                print(f"✅ S3 Upload successful! URL: {file_url}")
                return {'success': True, 'url': file_url}

            # --- ATTEMPT 2: LOCAL FALLBACK (DEVELOPMENT MODE) ---
            print("⚠️ WARNING: AWS credentials missing. Using local storage fallback.")
            
            file_obj.seek(0)
            
            base_dir = current_app.root_path
            upload_dir = os.path.join(base_dir, 'static', 'uploads', folder)
            os.makedirs(upload_dir, exist_ok=True)
            
            local_path = os.path.join(upload_dir, unique_filename)
            file_obj.save(local_path)
            
            # 🚀 THE FIX: Generate an absolute URL so the React Native mobile app can fetch it!
            base_url = request.host_url.rstrip('/')
            local_url = f"{base_url}/static/uploads/{folder}/{unique_filename}"
            print(f"✅ Local Fallback successful! URL: {local_url}")
            
            return {'success': True, 'url': local_url}

        except Exception as e:
            print(f"❌ Storage Service Error: {str(e)}")
            return {'success': False, 'message': str(e)}