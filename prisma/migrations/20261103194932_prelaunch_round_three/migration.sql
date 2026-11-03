-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "confirmationSentAt" TIMESTAMPTZ(3),
ADD COLUMN     "reminderSentAt" TIMESTAMPTZ(3),
ADD COLUMN     "reviewRequestedAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "nameEn" TEXT;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "nameEn" TEXT;

-- AlterTable
ALTER TABLE "Setting" ADD COLUMN     "googleRating" DOUBLE PRECISION NOT NULL DEFAULT 4.3,
ADD COLUMN     "googleReviewCount" INTEGER NOT NULL DEFAULT 382,
ADD COLUMN     "vapidPrivateKey" TEXT,
ADD COLUMN     "vapidPublicKey" TEXT;

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoginAttempt_key_createdAt_idx" ON "LoginAttempt"("key", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
