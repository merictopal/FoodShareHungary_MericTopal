# Import all models here so SQLAlchemy knows about them, but DO NOT redefine them!
from .user import User, RestaurantProfile
from .offer import Offer, Claim
from .stats import Notification, Leaderboard