-- CreateTable
CREATE TABLE "jarvis_outcomes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "goal" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "current" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "steps" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jarvis_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "jarvis_outcomes_tenant_id_status_idx" ON "jarvis_outcomes"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "jarvis_outcomes_userId_idx" ON "jarvis_outcomes"("userId");

-- AddForeignKey
ALTER TABLE "jarvis_outcomes" ADD CONSTRAINT "jarvis_outcomes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jarvis_outcomes" ADD CONSTRAINT "jarvis_outcomes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
