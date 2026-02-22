import os
from app import create_app

config_name = os.getenv('FLASK_CONFIG') or 'development'

app = create_app(config_name)

if __name__ == '__main__':
    print(f"Starting... (Mod: {config_name})")
    app.run(host='0.0.0.0', port=5000, debug=True)