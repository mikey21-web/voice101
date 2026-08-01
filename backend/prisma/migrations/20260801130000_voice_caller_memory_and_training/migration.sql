-- Per-caller memory: facts persisted across calls, keyed by phone number.
CREATE TABLE "voice_callers" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "phone_number" TEXT NOT NULL,
  "facts" JSONB NOT NULL DEFAULT '{}',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "voice_callers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "voice_callers_tenant_id_phone_number_key" ON "voice_callers"("tenant_id", "phone_number");
CREATE INDEX "voice_callers_tenant_id_idx" ON "voice_callers"("tenant_id");

ALTER TABLE "voice_callers" ADD CONSTRAINT "voice_callers_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Owner-supplied corrections (issue -> fix) injected into future call prompts.
CREATE TABLE "voice_training_examples" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "call_id" TEXT,
  "issue" TEXT NOT NULL,
  "correction" TEXT NOT NULL,
  "context" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "applied_at" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" TEXT,
  CONSTRAINT "voice_training_examples_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "voice_training_examples_tenant_id_idx" ON "voice_training_examples"("tenant_id");
CREATE INDEX "voice_training_examples_employee_id_idx" ON "voice_training_examples"("employee_id");
CREATE INDEX "voice_training_examples_status_idx" ON "voice_training_examples"("status");

ALTER TABLE "voice_training_examples" ADD CONSTRAINT "voice_training_examples_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "voice_training_examples" ADD CONSTRAINT "voice_training_examples_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "voice_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
