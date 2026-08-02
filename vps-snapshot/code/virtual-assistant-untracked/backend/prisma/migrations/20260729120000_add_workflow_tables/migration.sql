-- Create enums
DO $$ BEGIN
  CREATE TYPE "workflow_trigger_type" AS ENUM ('DB_EVENT', 'CRON', 'WEBHOOK', 'SCHEDULED', 'MANUAL');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "workflow_action_type" AS ENUM (
    'SEND_MESSAGE', 'SEND_EMAIL', 'SEND_WHATSAPP_TEMPLATE',
    'UPDATE_LEAD_STATUS', 'CREATE_TASK', 'CREATE_TICKET',
    'UPDATE_RECORD', 'CREATE_RECORD', 'HTTP_REQUEST',
    'DELAY', 'CONDITION', 'LOOP', 'CODE', 'AI_AGENT',
    'WEBHOOK', 'CANCEL_WORKFLOW'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Workflow definitions
CREATE TABLE IF NOT EXISTS "workflow_definitions" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workflow_definitions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "workflow_definitions_tenant_id_idx" ON "workflow_definitions"("tenant_id");
CREATE INDEX IF NOT EXISTS "workflow_definitions_active_idx" ON "workflow_definitions"("active");

-- Workflow versions (immutable snapshots)
CREATE TABLE IF NOT EXISTS "workflow_versions" (
  "id" TEXT NOT NULL,
  "workflow_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "config" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  CONSTRAINT "workflow_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workflow_versions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflow_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "workflow_versions_workflow_id_version_key" ON "workflow_versions"("workflow_id", "version");
CREATE INDEX IF NOT EXISTS "workflow_versions_workflow_id_idx" ON "workflow_versions"("workflow_id");

-- Triggers
CREATE TABLE IF NOT EXISTS "workflow_triggers" (
  "id" TEXT NOT NULL,
  "version_id" TEXT NOT NULL,
  "type" "workflow_trigger_type" NOT NULL,
  "config" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "workflow_triggers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workflow_triggers_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "workflow_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "workflow_triggers_version_id_idx" ON "workflow_triggers"("version_id");

-- Steps
CREATE TABLE IF NOT EXISTS "workflow_steps" (
  "id" TEXT NOT NULL,
  "version_id" TEXT NOT NULL,
  "stepKey" TEXT NOT NULL,
  "actionType" "workflow_action_type" NOT NULL,
  "label" TEXT,
  "config" JSONB NOT NULL DEFAULT '{}',
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workflow_steps_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workflow_steps_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "workflow_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "workflow_steps_version_id_idx" ON "workflow_steps"("version_id");

-- Edges
CREATE TABLE IF NOT EXISTS "workflow_edges" (
  "id" TEXT NOT NULL,
  "version_id" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "targetKey" TEXT NOT NULL,
  "label" TEXT,
  CONSTRAINT "workflow_edges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workflow_edges_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "workflow_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "workflow_edges_version_id_idx" ON "workflow_edges"("version_id");
