ALTER TYPE "ReportCategory" ADD VALUE IF NOT EXISTS 'scam';

ALTER TABLE "Message"
  ADD COLUMN "clientMessageId" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3),
  ADD COLUMN "editedAt" TIMESTAMP(3),
  ADD COLUMN "readAt" TIMESTAMP(3);

UPDATE "Message"
SET "clientMessageId" = "id"::text,
    "updatedAt" = "createdAt"
WHERE "clientMessageId" IS NULL;

ALTER TABLE "Message"
  ALTER COLUMN "clientMessageId" SET NOT NULL,
  ALTER COLUMN "updatedAt" SET NOT NULL;

CREATE UNIQUE INDEX "Message_senderId_clientMessageId_key"
  ON "Message"("senderId", "clientMessageId");
CREATE INDEX "Message_senderId_createdAt_idx"
  ON "Message"("senderId", "createdAt");

ALTER TABLE "Message"
  ADD CONSTRAINT "Message_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Message_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "NotificationPreference" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "newMatchEnabled" BOOLEAN NOT NULL DEFAULT true,
  "newMessageEnabled" BOOLEAN NOT NULL DEFAULT true,
  "accountEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

CREATE TABLE "PushSubscription" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "endpoint" TEXT NOT NULL,
  "subscription" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");