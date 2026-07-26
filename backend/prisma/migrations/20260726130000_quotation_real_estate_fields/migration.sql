-- Link quotations to real estate entities, same as invoices

ALTER TABLE "quotations"
  ADD COLUMN "propertyId" TEXT,
  ADD COLUMN "projectId" TEXT;

CREATE INDEX "quotations_propertyId_idx" ON "quotations"("propertyId");
CREATE INDEX "quotations_projectId_idx" ON "quotations"("projectId");

ALTER TABLE "quotations" ADD CONSTRAINT "quotations_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "quotations" ADD CONSTRAINT "quotations_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
