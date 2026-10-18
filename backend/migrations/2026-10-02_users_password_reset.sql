-- Stores the forgot-password code so /api/auth/reset-password can verify it.
-- Only a hash of the code is kept; expiry and failed attempts limit brute force. Additive and idempotent.
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code_expires_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code_attempts INTEGER NOT NULL DEFAULT 0;
