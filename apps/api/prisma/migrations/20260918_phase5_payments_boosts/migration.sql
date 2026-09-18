ALTER TABLE "SubscriptionPlan"
  ADD COLUMN "code" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "durationDays" INTEGER;

UPDATE "SubscriptionPlan"
SET "code" = 'legacy-' || "id"::text,
    "durationDays" = CASE "interval" WHEN 'year' THEN 365 WHEN 'quarter' THEN 90 ELSE 30 END
WHERE "code" IS NULL;

ALTER TABLE "SubscriptionPlan"
  ALTER COLUMN "code" SET NOT NULL,
  ALTER COLUMN "durationDays" SET NOT NULL;
CREATE UNIQUE INDEX "SubscriptionPlan_code_key" ON "SubscriptionPlan"("code");

ALTER TABLE "Profile"
  ADD COLUMN "boostPriority" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Subscription"
  ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'sandbox',
  ADD COLUMN "providerSubscriptionId" TEXT,
  ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Subscription_providerSubscriptionId_idx" ON "Subscription"("providerSubscriptionId");

ALTER TABLE "Payment"
  ADD COLUMN "providerOrderId" TEXT;
CREATE INDEX "Payment_providerOrderId_idx" ON "Payment"("providerOrderId");
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentEvent"
  ADD COLUMN "providerEventId" TEXT;
UPDATE "PaymentEvent"
SET "providerEventId" = 'legacy-' || "id"::text
WHERE "providerEventId" IS NULL;
ALTER TABLE "PaymentEvent" ALTER COLUMN "providerEventId" SET NOT NULL;
CREATE UNIQUE INDEX "PaymentEvent_providerEventId_key" ON "PaymentEvent"("providerEventId");

CREATE TABLE "ProfileBoost" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "paymentId" UUID NOT NULL,
  "startedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProfileBoost_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProfileBoost_paymentId_key" ON "ProfileBoost"("paymentId");
CREATE INDEX "ProfileBoost_userId_status_expiresAt_idx" ON "ProfileBoost"("userId", "status", "expiresAt");
CREATE INDEX "ProfileBoost_expiresAt_idx" ON "ProfileBoost"("expiresAt");
ALTER TABLE "ProfileBoost"
  ADD CONSTRAINT "ProfileBoost_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;