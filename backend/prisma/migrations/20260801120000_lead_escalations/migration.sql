-- CreateEnum
CREATE TYPE "escalation_trigger" AS ENUM (
  'LEAD_REQUESTED_HUMAN',
  'DEAL_VALUE_OVER_THRESHOLD',
  'NEGATIVE_SENTIMENT',
  'LOW_MODEL_CONFIDENCE',
  'PRICE_NEGOTIATION',
  'LEGAL_OR_COMMITMENT'
);

-- CreateTable
-- Column names match the Prisma model exactly: tenantId is @map("tenant_id"),
-- every other field keeps its camelCase name. A mismatch here passes
-- `migrate status` and fails at query time.
CREATE TABLE "lead_escalations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "trigger" "escalation_trigger" NOT NULL,
    "detail" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_escalations_tenant_id_leadId_resolvedAt_idx" ON "lead_escalations"("tenant_id", "leadId", "resolvedAt");
CREATE INDEX "lead_escalations_leadId_idx" ON "lead_escalations"("leadId");

-- AddForeignKey
ALTER TABLE "lead_escalations" ADD CONSTRAINT "lead_escalations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lead_escalations" ADD CONSTRAINT "lead_escalations_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
