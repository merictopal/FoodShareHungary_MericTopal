import math

EARTH_RADIUS_KM = 6371.0


def haversine_km(lat1, lng1, lat2, lng2):
    """Great-circle distance in km between two WGS84 points (same result as PostGIS ST_DistanceSphere / 1000)."""
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return EARTH_RADIUS_KM * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
