import os
from flask import Flask, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from config import config
from .extensions import db, cors

# --- SECURITY: BRUTE FORCE PROTECTION ---
# Initialize the Rate Limiter using the client's IP address
limiter = Limiter(
    key_func=get_remote_address,
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
    # 🛡️ Apply strict rate limits specifically to authentication routes (Max 5 attempts per minute)
    limiter.limit("5 per minute")(auth_bp) 
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
        
    @app.errorhandler(429)
    def ratelimit_handler(e):
        # Custom message for Rate Limiting (Brute Force shield triggered)
        return jsonify({"success": False, "error": "Too Many Requests", "message": "Rate limit exceeded. Please wait a minute and try again."}), 429

    with app.app_context():
        db.create_all()
        
    return app