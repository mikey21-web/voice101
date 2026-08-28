/**
 * deploy.mjs — upload changed files + rebuild on VPS
 * Run: node deploy.mjs
 */
import { Client } from 'ssh2';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const HOST = '169.58.246.11';
const USER = 'root';
const PASS = 'Medusa15!';
const REMOTE = '/root/voice-agent';

const FILES = [
  // Backend
  'backend/src/voice-agent/caller-memory.service.ts',
  'backend/src/voice-agent/outpero-compat.controller.ts',
  'backend/src/voice-agent/voice-agent.module.ts',
  'backend/src/voice-agent/voice-call.controller.ts',
  'backend/src/voice-agent/voice-employee.service.ts',
  'backend/src/voice-agent/voice-lead.service.ts',
  'backend/src/voice-agent/voice-billing.service.ts',
  'backend/prisma/schema.prisma',
  'backend/prisma/migrations/add_developer_mode.sql',
  'backend/prisma/migrations/add_webhook_prevars_dialer.sql',
  // Dashboard
  'dashboard-v2/src/App.tsx',
  'dashboard-v2/src/components/layout/sidebar.tsx',
  'dashboard-v2/src/lib/data.ts',
  'dashboard-v2/src/pages/TalkToEmployeePage.tsx',
  'dashboard-v2/src/pages/VoiceEmployeeDetailPage.tsx',
  'dashboard-v2/src/pages/CallerMemoryPage.tsx',
  'dashboard-v2/src/pages/AdminPage.tsx',
];

const conn = new Client();

const run = (cmd, label) => new Promise((resolve) => {
  process.stdout.write(`\n▶ ${label || cmd.slice(0, 70)}\n`);
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error('exec error:', err.message); resolve(1); return; }
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', (code) => { console.log(code === 0 ? '  ✓' : `  ❌ exit ${code}`); resolve(code ?? 0); });
  });
});

const upload = (sftp, localRel, remoteRel) => new Promise((resolve, reject) => {
  const local = join(__dir, localRel);
  const remote = `${REMOTE}/${remoteRel}`;
  process.stdout.write(`  upload ${remoteRel}\n`);
  sftp.fastPut(local, remote, (err) => err ? reject(err) : resolve());
});

conn.on('ready', async () => {
  console.log('✓ Connected to', HOST);

  // 1. Upload files via SFTP
  console.log('\n▶ Uploading changed files');
  const sftp = await new Promise((res, rej) => conn.sftp((e, s) => e ? rej(e) : res(s)));

  // Ensure remote dirs exist first
  const dirs = [...new Set(FILES.map(f => `${REMOTE}/${f}`.replace(/\/[^/]+$/, '')))];
  for (const d of dirs) {
    await new Promise((res) => conn.exec(`mkdir -p ${d}`, (e, s) => { s?.on('close', res); s?.resume(); }));
  }

  for (const f of FILES) {
    await upload(sftp, f, f).catch(e => console.error('  upload failed:', e.message));
  }

  // 2. Run SQL migrations
  await run(
    `docker exec lead-automation-db psql -U postgres lead_automation -c "ALTER TABLE voice_employees ADD COLUMN IF NOT EXISTS developer_mode BOOLEAN NOT NULL DEFAULT FALSE;" 2>&1`,
    'SQL migration: developer_mode',
  );
  await run(
    `docker exec -i lead-automation-db psql -U postgres lead_automation < /root/voice-agent/backend/prisma/migrations/add_webhook_prevars_dialer.sql 2>&1`,
    'SQL migration: webhook + pre_variables + dialer_settings',
  );

  // 3. Rebuild backend
  await run(`cd ${REMOTE} && docker compose build --no-cache backend 2>&1 | tail -30`, 'build backend');
  await run(`cd ${REMOTE} && docker compose up -d backend 2>&1 | tail -5`, 'restart backend');
  await run(`sleep 12 && docker exec lead-automation-backend wget -qO- http://localhost:3001/health 2>/dev/null | head -1 || echo "health check skipped"`, 'backend health');

  // 4. Rebuild dashboard
  await run(`cd ${REMOTE} && docker compose build --no-cache dashboard 2>&1 | tail -30`, 'build dashboard');
  await run(`cd ${REMOTE} && docker compose up -d dashboard 2>&1 | tail -5`, 'restart dashboard');

  // 5. Status
  await run(`docker ps --format "{{.Names}}: {{.Status}}" | grep lead-automation`, 'container status');

  console.log('\n✅ Deploy complete!');
  conn.end();
}).on('error', e => { console.error('SSH error:', e.message); process.exit(1); })
  .connect({ host: HOST, port: 22, username: USER, password: PASS, readyTimeout: 20000, tryKeyboard: true });

conn.on('keyboard-interactive', (n, i, l, p, finish) => finish([PASS]));
