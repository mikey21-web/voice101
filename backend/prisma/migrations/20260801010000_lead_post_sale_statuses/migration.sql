-- AlterEnum
-- Extend LeadStatus with post-sale stages so the lead's life does not end at booking.
ALTER TYPE "LeadStatus" ADD VALUE 'BOOKED';
ALTER TYPE "LeadStatus" ADD VALUE 'AGREEMENT';
ALTER TYPE "LeadStatus" ADD VALUE 'LOAN_PROCESSING';
ALTER TYPE "LeadStatus" ADD VALUE 'REGISTERED';
ALTER TYPE "LeadStatus" ADD VALUE 'POSSESSION';
