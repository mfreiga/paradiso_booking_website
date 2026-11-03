-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'de';

-- AlterTable
ALTER TABLE "Stylist" ADD COLUMN     "photoData" BYTEA,
ADD COLUMN     "photoMime" TEXT;
