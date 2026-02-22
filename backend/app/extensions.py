from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS

"""
We initialize the extensions here, but we do not bind them to the 
Flask application (app) yet. The binding process will be handled 
inside the Application Factory. This pattern is a standard for 
enterprise-level projects.
"""

db = SQLAlchemy()

cors = CORS()