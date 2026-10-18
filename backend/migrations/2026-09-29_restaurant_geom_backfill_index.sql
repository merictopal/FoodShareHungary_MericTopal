-- PostGIS location consistency for restaurant_profiles (2026-09-29).
-- 1) Derive geom from the stored lat/lng for rows where it was never written (x = lng, y = lat, SRID 4326).
--    This does not change lat/lng; rows that still have the registration placeholder (41.0, 28.9) keep it.
-- 2) Spatial index for distance/nearby queries.
-- Safe to re-run.
UPDATE restaurant_profiles
   SET geom = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
 WHERE lat IS NOT NULL AND lng IS NOT NULL
   AND (geom IS NULL OR NOT ST_Equals(geom, ST_SetSRID(ST_MakePoint(lng, lat), 4326)));

CREATE INDEX IF NOT EXISTS idx_restaurant_profiles_geom ON restaurant_profiles USING GIST (geom);
