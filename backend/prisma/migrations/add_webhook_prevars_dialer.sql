-- Lead webhook fields on voice_employees
ALTER TABLE voice_employees ADD COLUMN IF NOT EXISTS webhook_secret TEXT;
ALTER TABLE voice_employees ADD COLUMN IF NOT EXISTS webhook_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE voice_employees ADD COLUMN IF NOT EXISTS pre_variables JSONB;
ALTER TABLE voice_employees ADD COLUMN IF NOT EXISTS dialer_settings JSONB;

-- Webhook event log (TEXT ids to match voice_employees.id type)
CREATE TABLE IF NOT EXISTS voice_webhook_events (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  employee_id  TEXT NOT NULL REFERENCES voice_employees(id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL,
  payload      JSONB NOT NULL DEFAULT '{}',
  status       TEXT NOT NULL DEFAULT 'ok',
  error_msg    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS voice_webhook_events_employee_id_idx ON voice_webhook_events(employee_id);
