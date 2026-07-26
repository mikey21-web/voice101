-- Attach an optional receipt photo/scan to an expense transaction

ALTER TABLE "transactions"
  ADD COLUMN "receiptMediaId" TEXT;

ALTER TABLE "transactions" ADD CONSTRAINT "transactions_receiptMediaId_fkey"
  FOREIGN KEY ("receiptMediaId") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
