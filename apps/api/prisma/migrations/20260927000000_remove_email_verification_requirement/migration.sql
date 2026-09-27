ALTER TABLE "User" ALTER COLUMN "status" SET DEFAULT 'active';

UPDATE "User"
SET "status" = 'active'
WHERE "status" = 'pending_verification';