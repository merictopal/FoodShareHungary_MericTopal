import os
import jwt
from flask import Flask, jsonify, request, current_app
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.exceptions import HTTPException
from config import config
from .extensions import db, cors

# --- SECURITY: BRUTE FORCE PROTECTION ---
def rate_limit_key():
    """
    Requests with a valid access token are counted per account, so users behind one shared IP
    (campus NAT, emulators) don't use up each other's budget; everything else is counted per IP.
    Credential endpoints (login etc.) pass get_remote_address explicitly and stay per IP.
    """
    parts = request.headers.get('Authorization', '').split()
    if len(parts) == 2 and parts[0] == 'Bearer':
        try:
            data = jwt.decode(parts[1], current_app.config['JWT_SECRET_KEY'], algorithms=["HS256"])
            if data.get('type') == 'access' and data.get('user_id') is not None:
                return f"user:{data['user_id']}"
        except jwt.InvalidTokenError:
            pass
    return get_remote_address()


limiter = Limiter(
    key_func=rate_limit_key,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://" # Simple in-memory storage. Use Redis for production.
)

def create_app(config_name='default'):
    """
    Application Factory Pattern
    """
    app = Flask(__name__)
    
    app.config.from_object(config[config_name])
    config[config_name].init_app(app)

    if not app.config.get('JWT_SECRET_KEY'):
        raise RuntimeError("JWT_SECRET_KEY is not set. Add a long random value to backend/.env before starting the server.")
    
    db.init_app(app)
    
    # --- SECURITY: STRICT CORS POLICY ---
    # Replaced "*" with specific trusted origins to prevent Cross-Origin Resource Sharing attacks
    allowed_origins = os.environ.get(
        'CORS_ORIGINS', 
        'http://localhost:5173,http://localhost:8081' # React Admin & Expo Web default ports
    ).split(',')
    
    cors.init_app(app, resources={r"/api/*": {"origins": allowed_origins}})
    
    # Bind the rate limiter to the app
    limiter.init_app(app)
    
    # --- BLUEPRINT REGISTRATION (CLEAN ARCHITECTURE) ---
    
    from .routes.auth_routes import auth_bp
    # The strict 5/minute limits sit on the individual credential routes in auth_routes.py
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    
    from .routes.upload_routes import upload_bp
    app.register_blueprint(upload_bp, url_prefix='/api/upload')

    from .routes.admin_routes import admin_bp
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    
    # Core Application Routes
    from .routes.student_routes import student_bp
    app.register_blueprint(student_bp, url_prefix='/api')
    
    from .routes.restaurant_routes import restaurant_bp
    app.register_blueprint(restaurant_bp, url_prefix='/api')
    
    # --- GLOBAL ERROR SANITIZATION ---
    @app.errorhandler(404)
    def page_not_found(e):
        return jsonify({"success": False, "error": "Not Found", "message": "Endpoint not found."}), 404

    @app.errorhandler(500)
    def internal_server_error(e):
        # Generic message hides stack traces and database internals from potential attackers
        return jsonify({"success": False, "error": "Server Error", "message": "An unexpected system error occurred. Please try again later."}), 500
        
    @app.errorhandler(HTTPException)
    def http_error(e):
        # Any other HTTP error (400 malformed JSON, 405, 415 non-JSON body, ...) in the API's JSON format
        # instead of Werkzeug's HTML page; the specific handlers in this function take precedence.
        return jsonify({"success": False, "error": e.name, "message": e.description}), e.code

    @app.errorhandler(413)
    def payload_too_large(e):
        return jsonify({"success": False, "error": "Payload Too Large", "message": "The uploaded file is too large."}), 413

    @app.errorhandler(429)
    def ratelimit_handler(e):
        # Name the limit that was hit (e.g. "5 per 1 minute", "50 per 1 hour"): windows differ per route
        return jsonify({"success": False, "error": "Too Many Requests",
                        "message": f"Rate limit exceeded ({e.description}). Please try again later."}), 429

    with app.app_context():
        db.create_all()
        
    return app