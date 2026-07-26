-- Visual flow builder: a scripted alternative to the freeform LangGraph agent

ALTER TABLE "business_settings" ADD COLUMN "agentMode" TEXT NOT NULL DEFAULT 'AI';

CREATE TABLE "flows" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "triggerKeywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "nodes" JSONB NOT NULL DEFAULT '[]',
  "edges" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "flows_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "flows_tenant_id_idx" ON "flows"("tenant_id");

CREATE TABLE "flow_progress" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "flowId" TEXT NOT NULL,
  "currentNodeId" TEXT,
  "variables" JSONB NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "flow_progress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "flow_progress_leadId_flowId_key" ON "flow_progress"("leadId", "flowId");
CREATE INDEX "flow_progress_leadId_idx" ON "flow_progress"("leadId");

ALTER TABLE "flows" ADD CONSTRAINT "flows_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "flow_progress" ADD CONSTRAINT "flow_progress_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "flow_progress" ADD CONSTRAINT "flow_progress_flowId_fkey"
  FOREIGN KEY ("flowId") REFERENCES "flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
