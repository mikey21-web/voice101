-- Voice Employee engine: multi-employee AI voice agents with versioned section
-- graphs, compiled into Dograh workflows at publish time.

CREATE TABLE "voice_employees" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'instant',
  "avatar_url" TEXT,
  "voice_provider" TEXT NOT NULL,
  "voice_id" TEXT NOT NULL,
  "voice_name" TEXT,
  "tts_speed" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "language" TEXT NOT NULL DEFAULT 'te-IN',
  "extra_languages" JSONB NOT NULL DEFAULT '[]',
  "ambient_sound" TEXT,
  "ambient_volume" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "max_call_duration_s" INTEGER NOT NULL DEFAULT 600,
  "status" TEXT NOT NULL DEFAULT 'inactive',
  "welcome_message" TEXT,
  "agent_information" TEXT,
  "call_end_rules" TEXT,
  "script_adherence" INTEGER NOT NULL DEFAULT 2,
  "power_prompting" BOOLEAN NOT NULL DEFAULT false,
  "style_pack_enabled" BOOLEAN NOT NULL DEFAULT true,
  "ai_acknowledgement_enabled" BOOLEAN NOT NULL DEFAULT true,
  "recording_notice" BOOLEAN NOT NULL DEFAULT false,
  "number_id" TEXT,
  "dograh_workflow_id" TEXT,
  "dograh_workflow_uuid" TEXT,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "is_published" BOOLEAN NOT NULL DEFAULT false,
  "has_unpublished_changes" BOOLEAN NOT NULL DEFAULT false,
  "published_at" TIMESTAMP(3),
  "hired_until" TIMESTAMP(3),
  "hire_subscription_status" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "voice_employees_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "voice_employees_tenant_id_idx" ON "voice_employees"("tenant_id");

CREATE TABLE "voice_employee_sections" (
  "id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "section_key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "order" INTEGER NOT NULL,
  "node_type" TEXT NOT NULL DEFAULT 'llm',
  "edges" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "voice_employee_sections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "voice_employee_sections_employee_id_section_key_key" ON "voice_employee_sections"("employee_id", "section_key");
CREATE INDEX "voice_employee_sections_employee_id_idx" ON "voice_employee_sections"("employee_id");

CREATE TABLE "voice_employee_variables" (
  "id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'capture',
  "required" BOOLEAN NOT NULL DEFAULT false,
  "extract_hint" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "voice_employee_variables_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "voice_employee_variables_employee_id_key_key" ON "voice_employee_variables"("employee_id", "key");
CREATE INDEX "voice_employee_variables_employee_id_idx" ON "voice_employee_variables"("employee_id");

CREATE TABLE "voice_employee_actions" (
  "id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "action_key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "gated" BOOLEAN NOT NULL DEFAULT false,
  "gate_reason" TEXT,
  "config" JSONB,
  CONSTRAINT "voice_employee_actions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "voice_employee_actions_employee_id_action_key_key" ON "voice_employee_actions"("employee_id", "action_key");
CREATE INDEX "voice_employee_actions_employee_id_idx" ON "voice_employee_actions"("employee_id");

CREATE TABLE "voice_employee_deliveries" (
  "id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "config" JSONB NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "voice_employee_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "voice_employee_deliveries_employee_id_idx" ON "voice_employee_deliveries"("employee_id");

CREATE TABLE "voice_employee_versions" (
  "id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "published_by_id" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "voice_employee_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "voice_employee_versions_employee_id_revision_key" ON "voice_employee_versions"("employee_id", "revision");
CREATE INDEX "voice_employee_versions_employee_id_idx" ON "voice_employee_versions"("employee_id");

CREATE TABLE "voice_phone_numbers" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'twilio',
  "dlt_registered" BOOLEAN NOT NULL DEFAULT false,
  "kyc_status" TEXT NOT NULL DEFAULT 'not_started',
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "voice_phone_numbers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "voice_phone_numbers_number_key" ON "voice_phone_numbers"("number");
CREATE INDEX "voice_phone_numbers_tenant_id_idx" ON "voice_phone_numbers"("tenant_id");

CREATE TABLE "voice_campaigns" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "total_contacts" INTEGER NOT NULL DEFAULT 0,
  "dialed" INTEGER NOT NULL DEFAULT 0,
  "reached" INTEGER NOT NULL DEFAULT 0,
  "max_concurrency" INTEGER,
  "retry_config" JSONB,
  "schedule_config" JSONB,
  "dograh_campaign_id" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "voice_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "voice_campaigns_tenant_id_idx" ON "voice_campaigns"("tenant_id");

CREATE TABLE "voice_calls" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "campaign_id" TEXT,
  "direction" TEXT NOT NULL DEFAULT 'outbound',
  "duration_s" INTEGER,
  "cost_inr" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "is_web_call" BOOLEAN NOT NULL DEFAULT false,
  "from_number" TEXT,
  "to_number" TEXT NOT NULL,
  "recording_url" TEXT,
  "transcript" JSONB,
  "summary" TEXT,
  "disposition" TEXT,
  "outcome" JSONB,
  "quality_score" INTEGER,
  "dograh_run_id" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "voice_calls_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "voice_calls_tenant_id_idx" ON "voice_calls"("tenant_id");
CREATE INDEX "voice_calls_employee_id_idx" ON "voice_calls"("employee_id");
CREATE INDEX "voice_calls_campaign_id_idx" ON "voice_calls"("campaign_id");

CREATE TABLE "voice_leads" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "call_id" TEXT,
  "phone" TEXT NOT NULL,
  "contact" TEXT,
  "source" TEXT NOT NULL DEFAULT 'manual',
  "outcome" TEXT,
  "captured" JSONB NOT NULL DEFAULT '{}',
  "summary" TEXT,
  "attempt" INTEGER NOT NULL DEFAULT 1,
  "callback_at" TIMESTAMP(3),
  "time_to_call_s" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "voice_leads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "voice_leads_tenant_id_idx" ON "voice_leads"("tenant_id");
CREATE INDEX "voice_leads_employee_id_idx" ON "voice_leads"("employee_id");

ALTER TABLE "voice_employees" ADD CONSTRAINT "voice_employees_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "voice_employees" ADD CONSTRAINT "voice_employees_number_id_fkey"
  FOREIGN KEY ("number_id") REFERENCES "voice_phone_numbers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "voice_employee_sections" ADD CONSTRAINT "voice_employee_sections_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "voice_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "voice_employee_variables" ADD CONSTRAINT "voice_employee_variables_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "voice_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "voice_employee_actions" ADD CONSTRAINT "voice_employee_actions_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "voice_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "voice_employee_deliveries" ADD CONSTRAINT "voice_employee_deliveries_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "voice_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "voice_employee_versions" ADD CONSTRAINT "voice_employee_versions_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "voice_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "voice_phone_numbers" ADD CONSTRAINT "voice_phone_numbers_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "voice_campaigns" ADD CONSTRAINT "voice_campaigns_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "voice_campaigns" ADD CONSTRAINT "voice_campaigns_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "voice_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "voice_calls" ADD CONSTRAINT "voice_calls_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "voice_calls" ADD CONSTRAINT "voice_calls_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "voice_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "voice_calls" ADD CONSTRAINT "voice_calls_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "voice_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "voice_leads" ADD CONSTRAINT "voice_leads_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "voice_leads" ADD CONSTRAINT "voice_leads_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "voice_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
