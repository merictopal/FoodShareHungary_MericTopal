import os
import boto3
from botocore.exceptions import ClientError
import uuid
from werkzeug.utils import secure_filename
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
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

    LOCAL_PRIVATE_PREFIX = 'local-private://'
    DOC_URL_TTL_SECONDS = 300

    @staticmethod
    def _private_root():
        # Outside app/static, so Flask never serves these files publicly
        return os.path.join(os.path.dirname(current_app.root_path), 'private_uploads')

    @staticmethod
    def _doc_serializer():
        return URLSafeTimedSerializer(current_app.config['JWT_SECRET_KEY'], salt='document-access')

    @staticmethod
    def get_document_access_url(stored_url):
        """
        Turns a stored document reference into a short-lived URL for an administrator:
        S3 objects -> pre-signed GET URL; private local files -> signed, expiring backend link.
        Anything else (legacy public URLs) is returned unchanged.
        """
        if not stored_url:
            return None
        ttl = StorageService.DOC_URL_TTL_SECONDS
        if stored_url.startswith(StorageService.LOCAL_PRIVATE_PREFIX):
            rel = stored_url[len(StorageService.LOCAL_PRIVATE_PREFIX):]
            token = StorageService._doc_serializer().dumps(rel)
            return f"{request.host_url.rstrip('/')}/api/admin/document-file/{token}"
        bucket = current_app.config.get('AWS_BUCKET_NAME')
        s3_client = StorageService.get_s3_client()
        if bucket and s3_client and stored_url.startswith(f"https://{bucket}.s3.") and '.amazonaws.com/' in stored_url:
            key = stored_url.split('.amazonaws.com/', 1)[1]
            return s3_client.generate_presigned_url('get_object', Params={'Bucket': bucket, 'Key': key}, ExpiresIn=ttl)
        return stored_url

    @staticmethod
    def resolve_private_document(token):
        """Returns the absolute path for a valid, unexpired document token, otherwise None."""
        try:
            rel = StorageService._doc_serializer().loads(token, max_age=StorageService.DOC_URL_TTL_SECONDS)
        except (BadSignature, SignatureExpired):
            return None
        root = os.path.realpath(StorageService._private_root())
        path = os.path.realpath(os.path.join(root, rel))
        if not path.startswith(root + os.sep) or not os.path.isfile(path):
            return None
        return path

    DOCUMENT_FOLDERS = ('id_documents', 'student_ids')

    @staticmethod
    def delete_document(stored_url, folders=DOCUMENT_FOLDERS):
        """
        Deletes a stored file. Only objects inside `folders` (default: the verification document folders)
        are ever deleted. Returns 'deleted', 'missing' (already gone), 'skipped' (no/unknown reference) or 'error'.
        """
        if not stored_url:
            return 'skipped'
        try:
            # 1. Private local storage: local-private://<folder>/<file>
            if stored_url.startswith(StorageService.LOCAL_PRIVATE_PREFIX):
                rel = stored_url[len(StorageService.LOCAL_PRIVATE_PREFIX):]
                return StorageService._delete_local(StorageService._private_root(), rel, folders)

            # 2. S3 object in this project's bucket
            bucket = current_app.config.get('AWS_BUCKET_NAME')
            if bucket and stored_url.startswith(f"https://{bucket}.s3.") and '.amazonaws.com/' in stored_url:
                key = stored_url.split('.amazonaws.com/', 1)[1]
                if key.split('/', 1)[0] not in folders:
                    return 'skipped'
                s3_client = StorageService.get_s3_client()
                if not s3_client:
                    return 'error'
                try:
                    s3_client.head_object(Bucket=bucket, Key=key)
                except ClientError as e:
                    if e.response.get('Error', {}).get('Code') in ('404', 'NoSuchKey', 'NotFound'):
                        return 'missing'
                    raise
                s3_client.delete_object(Bucket=bucket, Key=key)
                return 'deleted'

            # 3. Older public local fallback: http(s)://<host>/static/uploads/<folder>/<file>
            if '/static/uploads/' in stored_url:
                rel = stored_url.split('/static/uploads/', 1)[1]
                return StorageService._delete_local(os.path.join(current_app.root_path, 'static', 'uploads'), rel, folders)

            return 'skipped'
        except Exception as e:
            print(f"❌ Document deletion error: {str(e)}")
            return 'error'

    @staticmethod
    def _delete_local(root, rel, folders):
        if rel.split('/', 1)[0] not in folders:
            return 'skipped'
        root = os.path.realpath(root)
        path = os.path.realpath(os.path.join(root, rel))
        if not path.startswith(root + os.sep):
            return 'skipped'
        if not os.path.isfile(path):
            return 'missing'
        os.remove(path)
        return 'deleted'

    @staticmethod
    def upload_file(file_obj, folder='general', private=False, extension=None, content_type=None):
        """
        `extension` / `content_type`, when given (validated uploads), replace the client-supplied
        file name extension and Content-Type, so a stored object can never claim to be e.g. HTML.
        Uploads a file to AWS S3 and returns the public URL.
        If AWS keys are missing, saves the file locally as a fallback
        (private files go to a non-public folder and a 'local-private://' reference is returned).
        """
        try:
            s3_client = StorageService.get_s3_client()
            bucket_name = current_app.config.get('AWS_BUCKET_NAME')
            region = current_app.config.get('AWS_REGION', 'eu-central-1')

            original_filename = secure_filename(file_obj.filename)
            if not extension:
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
                    ExtraArgs={'ContentType': content_type or file_obj.content_type or 'image/jpeg'}
                )

                file_url = f"https://{bucket_name}.s3.{region}.amazonaws.com/{s3_key}"
                print(f"✅ S3 Upload successful! URL: {file_url}")
                return {'success': True, 'url': file_url}

            # --- ATTEMPT 2: LOCAL FALLBACK (DEVELOPMENT MODE) ---
            print("⚠️ WARNING: AWS credentials missing. Using local storage fallback.")
            
            file_obj.seek(0)

            if private:
                private_dir = os.path.join(StorageService._private_root(), folder)
                os.makedirs(private_dir, exist_ok=True)
                file_obj.save(os.path.join(private_dir, unique_filename))
                print("✅ Local private fallback successful (not publicly served).")
                return {'success': True, 'url': f"{StorageService.LOCAL_PRIVATE_PREFIX}{folder}/{unique_filename}"}

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
            return {'success': False, 'message': 'File upload failed. Please try again.'}