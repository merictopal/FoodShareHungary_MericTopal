-- Applied 2026-09-29 after the approved test-data cleanup (duplicate test claims removed).
-- Enforces "one claim per student per offer" at database level (application rule already implemented).
-- Pre-check (must return no rows):
--   SELECT user_id, offer_id, count(*) FROM claims GROUP BY 1, 2 HAVING count(*) > 1;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'claims_user_offer_key') THEN
        ALTER TABLE claims ADD CONSTRAINT claims_user_offer_key UNIQUE (user_id, offer_id);
    END IF;
END $$;
