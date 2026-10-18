import os
from app import create_app

config_name = os.getenv('FLASK_CONFIG') or 'development'

app = create_app(config_name)

LOOPBACK_HOSTS = ('127.0.0.1', 'localhost', '::1')


def dev_server_options(app_config, env=os.environ):
    """
    Options for the built-in development server (`python run.py`; production uses a WSGI server).
    - Binds to loopback by default; the Android emulator reaches it as 10.0.2.2. A physical device on the LAN
      needs an explicit BACKEND_HOST=0.0.0.0.
    - The Werkzeug debugger (arbitrary code execution from the browser) only runs with a DEBUG config
      (development) AND a loopback bind; any other combination starts without it.
    """
    host = env.get('BACKEND_HOST', '127.0.0.1')
    debug = bool(app_config.get('DEBUG')) and host in LOOPBACK_HOSTS
    return {'host': host, 'port': int(env.get('BACKEND_PORT', 5000)), 'debug': debug}


if __name__ == '__main__':
    options = dev_server_options(app.config)
    print(f"Starting... (Mod: {config_name}, host: {options['host']}, debug: {options['debug']})")
    app.run(**options)
