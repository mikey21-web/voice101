-- CreateTable
-- Column names match the Prisma model exactly: tenantId is @map("tenant_id"),
-- every other field keeps its camelCase name.
CREATE TABLE "call_coachings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "callLogId" TEXT NOT NULL,
    "userId" TEXT,
    "leadId" TEXT,
    "score" INTEGER,
    "missedQuestions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "objections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "buyingSignals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendedAction" TEXT,
    "whatToSend" TEXT,
    "dealProbability" DOUBLE PRECISION,
    "isExemplar" BOOLEAN NOT NULL DEFAULT false,
    "analysisStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_coachings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "call_coachings_callLogId_key" ON "call_coachings"("callLogId");
CREATE INDEX "call_coachings_tenant_id_userId_createdAt_idx" ON "call_coachings"("tenant_id", "userId", "createdAt");
CREATE INDEX "call_coachings_tenant_id_isExemplar_idx" ON "call_coachings"("tenant_id", "isExemplar");

-- AddForeignKey
ALTER TABLE "call_coachings" ADD CONSTRAINT "call_coachings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "call_coachings" ADD CONSTRAINT "call_coachings_callLogId_fkey" FOREIGN KEY ("callLogId") REFERENCES "call_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "call_coachings" ADD CONSTRAINT "call_coachings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
