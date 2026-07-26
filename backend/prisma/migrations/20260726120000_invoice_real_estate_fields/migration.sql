-- Link invoices to real estate entities and add per-line detail

ALTER TABLE "invoices"
  ADD COLUMN "propertyId" TEXT,
  ADD COLUMN "projectId" TEXT,
  ADD COLUMN "dueDate" TIMESTAMP(3),
  ADD COLUMN "notes" TEXT;

ALTER TABLE "invoice_line_items"
  ADD COLUMN "unit" TEXT,
  ADD COLUMN "gstPercent" DOUBLE PRECISION,
  ADD COLUMN "notes" TEXT;

CREATE INDEX "invoices_propertyId_idx" ON "invoices"("propertyId");
CREATE INDEX "invoices_projectId_idx" ON "invoices"("projectId");

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
