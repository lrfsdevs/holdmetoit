-- Add resultsLockedAt to Challenge (FEAT-CHAL-05, D1)
-- Allows idempotent locking of challenge results and punishment evaluation
-- even after natural event expiry (endAt in the past).
ALTER TABLE "Challenge" ADD COLUMN IF NOT EXISTS "resultsLockedAt" TIMESTAMP(3);
