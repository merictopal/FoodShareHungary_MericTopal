from flask import Flask, jsonify
from config import config
from .extensions import db, cors

def create_app(config_name='default'):
    """
    Application Factory Pattern
    """
    app = Flask(__name__)
    
    app.config.from_object(config[config_name])
    config[config_name].init_app(app)
    
    db.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": "*"}})
    
    # --- BLUEPRINT REGISTRATION ---
    
    # Import main from the newly renamed main_routes.py file to avoid folder name collision
    from .main_routes import main
    app.register_blueprint(main)
    
    # Register the Auth Blueprint from the routes folder 
    from .routes.auth_routes import auth_bp
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    
    # --- PHASE 4: CLOUD STORAGE INTEGRATION ---
    # Register the Upload Blueprint for AWS S3 integration
    from .routes.upload_routes import upload_bp
    app.register_blueprint(upload_bp, url_prefix='/api/upload')

    # --- ADMIN PANEL INTEGRATION ---
    # NEW: Register the Admin Blueprint so Flask can route /api/admin requests
    from .routes.admin_routes import admin_bp
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    
    @app.errorhandler(404)
    def page_not_found(e):
        return jsonify({"error": "Not Found", "message": "Endpoint not found."}), 404

    @app.errorhandler(500)
    def internal_server_error(e):
        return jsonify({"error": "Server Error", "message": "Internal server error."}), 500

    with app.app_context():
        db.create_all()
        
    return app