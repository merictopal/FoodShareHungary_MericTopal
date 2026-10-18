-- One leaderboard row per restaurant (RestaurantProfile.leaderboard_entry is one-to-one, uselist=False).
-- Pre-check on 2026-09-29: SELECT restaurant_id, count(*) FROM leaderboard GROUP BY 1 HAVING count(*) > 1  -> no rows.
-- Safe to re-run.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leaderboard_restaurant_id_key') THEN
        ALTER TABLE leaderboard ADD CONSTRAINT leaderboard_restaurant_id_key UNIQUE (restaurant_id);
    END IF;
END $$;
