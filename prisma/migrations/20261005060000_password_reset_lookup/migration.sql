-- Expansion only: preserve passwords, legacy tokens and deadlines.
-- Plaintext recovery links are deliberately rejected by the new application.
CREATE INDEX IF NOT EXISTS "User_lojaID_resetToken_idx" ON "User"("lojaID", "resetToken");
