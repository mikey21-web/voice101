import { Client } from 'ssh2';

const HOST = '160.250.204.162';
const PASS = 'Maheshwari21!';
const SQL = `DO $$ BEGIN CREATE TYPE "workflow_trigger_type" AS ENUM ('DB_EVENT', 'CRON', 'SCHEDULED', 'WEBHOOK', 'MANUAL'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "workflow_action_type" AS ENUM ('SEND_MESSAGE', 'SEND_EMAIL', 'SEND_WHATSAPP_TEMPLATE', 'UPDATE_LEAD_STATUS', 'CREATE_TASK', 'CREATE_TICKET', 'UPDATE_RECORD', 'CREATE_RECORD', 'HTTP_REQUEST', 'DELAY', 'CONDITION', 'LOOP', 'CODE', 'AI_AGENT', 'WEBHOOK', 'CANCEL_WORKFLOW'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "workflow_definitions" ("id" TEXT NOT NULL, "tenant_id" TEXT NOT NULL, "name" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT false, "tags" TEXT[] DEFAULT ARRAY[]::TEXT[], "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ NOT NULL, PRIMARY KEY ("id"));
CREATE TABLE IF NOT EXISTS "workflow_versions" ("id" TEXT NOT NULL, "workflow_id" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1, "status" TEXT NOT NULL DEFAULT 'draft', "config" JSONB NOT NULL DEFAULT '{}', "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "publishedAt" TIMESTAMPTZ, PRIMARY KEY ("id"));
CREATE TABLE IF NOT EXISTS "workflow_triggers" ("id" TEXT NOT NULL, "version_id" TEXT NOT NULL, "type" "workflow_trigger_type" NOT NULL, "config" JSONB NOT NULL DEFAULT '{}', PRIMARY KEY ("id"));
CREATE TABLE IF NOT EXISTS "workflow_steps" ("id" TEXT NOT NULL, "version_id" TEXT NOT NULL, "stepKey" TEXT NOT NULL, "actionType" "workflow_action_type" NOT NULL, "label" TEXT, "config" JSONB NOT NULL DEFAULT '{}', "displayOrder" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY ("id"));
CREATE TABLE IF NOT EXISTS "workflow_edges" ("id" TEXT NOT NULL, "version_id" TEXT NOT NULL, "sourceKey" TEXT NOT NULL, "targetKey" TEXT NOT NULL, "label" TEXT, PRIMARY KEY ("id"));

ALTER TABLE "workflow_definitions" ADD CONSTRAINT workflow_definitions_tenant_id_fkey FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workflow_versions" ADD CONSTRAINT workflow_versions_workflow_id_fkey FOREIGN KEY ("workflow_id") REFERENCES "workflow_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_triggers" ADD CONSTRAINT workflow_triggers_version_id_fkey FOREIGN KEY ("version_id") REFERENCES "workflow_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_steps" ADD CONSTRAINT workflow_steps_version_id_fkey FOREIGN KEY ("version_id") REFERENCES "workflow_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_edges" ADD CONSTRAINT workflow_edges_version_id_fkey FOREIGN KEY ("version_id") REFERENCES "workflow_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS workflow_versions_workflow_id_version_key ON "workflow_versions"("workflow_id", "version");
CREATE INDEX IF NOT EXISTS workflow_definitions_tenant_id_idx ON "workflow_definitions"("tenant_id");
CREATE INDEX IF NOT EXISTS workflow_definitions_active_idx ON "workflow_definitions"("active");
CREATE INDEX IF NOT EXISTS workflow_versions_workflow_id_idx ON "workflow_versions"("workflow_id");
CREATE INDEX IF NOT EXISTS workflow_triggers_version_id_idx ON "workflow_triggers"("version_id");
CREATE INDEX IF NOT EXISTS workflow_steps_version_id_idx ON "workflow_steps"("version_id");
CREATE INDEX IF NOT EXISTS workflow_edges_version_id_idx ON "workflow_edges"("version_id");`;

const conn = new Client();
const runWithStdin = (cmd, stdin) => new Promise((resolve, reject) => {
  conn.exec(cmd, (err, stream) => {
    if (err) { reject(err.message); return; }
    let o = '';
    stream.stderr.on('data', d => o += d.toString());
    stream.on('data', d => o += d.toString());
    stream.on('close', (code) => resolve(o.trim()));
    stream.stdin.end(stdin);
  });
});

const run = (cmd) => new Promise((resolve, reject) => {
  conn.exec(cmd, (err, stream) => {
    if (err) { reject(err.message); return; }
    let o = '';
    stream.on('close', (code) => resolve(o.trim()));
    stream.stderr.on('data', d => o += d.toString());
    stream.on('data', d => o += d.toString());
  });
});

conn.on('ready', async () => {
  console.log('Connected, running migration...');
  
  // Pipe SQL directly to psql via stdin
  const result = await runWithStdin(
    'docker exec -i demo-realestate-postgres-1 psql -U postgres lead_automation 2>&1',
    SQL
  );
  console.log('Migration output:', result);
  
  const verify = await run(`docker exec demo-realestate-postgres-1 psql -U postgres lead_automation -c "\\dt workflow_*" 2>&1`);
  console.log('Tables:', verify);
  
  const verify2 = await run(`docker exec demo-realestate-postgres-1 psql -U postgres lead_automation -c "\\d workflow_definitions" 2>&1`);
  console.log('Def schema:', verify2);
  
  conn.end();
}).on('error', e => console.error('SSH Error:', e.message))
.connect({ host: HOST, port: 22, username: 'root', password: PASS, readyTimeout: 30000, keepaliveInterval: 10000 });
