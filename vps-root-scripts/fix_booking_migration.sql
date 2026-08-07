BEGIN;

-- Create the missing enum type that should have existed already
CREATE TYPE "booking_status" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- Convert the existing text column to use the enum (table is empty, safe)
ALTER TABLE "bookings" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "bookings" ALTER COLUMN "status" TYPE "booking_status" USING "status"::"booking_status";
ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- CreateEnum
CREATE TYPE "booking_applicant_role" AS ENUM ('PRIMARY', 'CO_APPLICANT');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "bookingAmountPaise" BIGINT,
ADD COLUMN     "bookingNumber" TEXT,
ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "confirmedById" TEXT,
ADD COLUMN     "costSheetId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "booking_applicants" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "contactId" TEXT,
    "role" "booking_applicant_role" NOT NULL DEFAULT 'PRIMARY',
    "name" TEXT NOT NULL,
    "panMasked" TEXT,
    "addressSnapshot" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_applicants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_status_history" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "fromStatus" "booking_status",
    "toStatus" "booking_status" NOT NULL,
    "reason" TEXT,
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "booking_applicants_bookingId_idx" ON "booking_applicants"("bookingId");

-- CreateIndex
CREATE INDEX "booking_status_history_bookingId_idx" ON "booking_status_history"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_bookingNumber_key" ON "bookings"("bookingNumber");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_costSheetId_fkey" FOREIGN KEY ("costSheetId") REFERENCES "cost_sheets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_applicants" ADD CONSTRAINT "booking_applicants_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_applicants" ADD CONSTRAINT "booking_applicants_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
