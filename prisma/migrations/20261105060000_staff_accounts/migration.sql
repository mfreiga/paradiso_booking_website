-- AlterTable
ALTER TABLE "PushSubscription" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastLoginAt" TIMESTAMPTZ(3),
ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "stylistId" TEXT,
ADD COLUMN     "username" TEXT,
ALTER COLUMN "role" SET DEFAULT 'BARBER';

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_stylistId_key" ON "User"("stylistId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_stylistId_fkey" FOREIGN KEY ("stylistId") REFERENCES "Stylist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AlterTable
ALTER TABLE "Stylist" ADD COLUMN     "bioEn" TEXT;
