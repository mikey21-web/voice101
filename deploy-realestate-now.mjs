#!/usr/bin/env node
import { Client } from 'ssh2';

const HOST = process.env.DEPLOY_HOST || '160.250.204.162';
const PASS = process.env.DEPLOY_PASS;

if (!PASS) {
  console.error('❌ Set DEPLOY_PASS env var');
  process.exit(1);
}

const conn = new Client();
const run = (c) => new Promise((resolve) => {
  conn.exec(c, (err, stream) => {
    if (err) { console.error(`❌ ${err.message}`); resolve(1); return; }
    let o = '';
    stream.on('close', (code) => {
      if (o.trim()) console.log(o.trim());
      resolve(code);
    });
    stream.stderr.on('data', d => o += d.toString());
    stream.on('data', d => o += d.toString());
  });
});

conn.on('ready', async () => {
  console.log('🚀 Deploying Prema to realestate.deploysafe.in...\n');

  const cmds = [
    'echo "📦 Pulling single-tenant-arch branch..."',
    'cd /opt/lead-automation-demo && git stash && git clean -fd && git fetch origin single-tenant-arch && git checkout single-tenant-arch && git pull origin single-tenant-arch',
    'echo "🛑 Stopping old containers..."',
    'docker compose -p virtual-assistant down --remove-orphans 2>/dev/null; docker stop $(docker ps -aq --filter name=lead-automation) 2>/dev/null; docker rm -f $(docker ps -aq --filter name=lead-automation) 2>/dev/null; docker rm -f $(docker ps -aq --filter name=virtual-assistant) 2>/dev/null; echo "✓ Cleaned up"',
    'echo "🔨 Building and starting services..."',
    'cd /opt/lead-automation-demo && docker compose -f docker-compose.demo.yml --env-file deploy-demo/.env.realestate -p lead-automation up -d --build backend dashboard 2>&1 | tail -10',
    'echo "⏳ Waiting for services..."',
    'sleep 20',
    'echo "💾 Running migrations..."',
    'docker exec lead-automation-backend npx prisma migrate deploy 2>&1 | tail -3',
    'echo "🔄 Restarting backend..."',
    'docker restart lead-automation-backend',
    'sleep 5',
    'echo "✓ Deployment complete!"',
    'echo ""',
    'docker ps --filter "label=com.docker.compose.project=lead-automation" --format "{{.Names}}: {{.Status}}"',
  ];

  for (const c of cmds) {
    console.log(`\n$ ${c.replace(/echo "/g, '').replace(/"/g, '')}`);
    const code = await run(c);
    if (code !== 0 && code !== undefined && !c.includes('echo')) {
      console.error('❌ FAILED, aborting');
      break;
    }
  }

  console.log('\n✅ Deployment to realestate.deploysafe.in complete!');
  console.log('   Dashboard: https://realestate.deploysafe.in/dashboard');
  console.log('   API: https://realestate.deploysafe.in/api');
  conn.end();
}).on('error', e => {
  console.error(`❌ Connection error: ${e.message}`);
  process.exit(1);
}).connect({
  host: HOST,
  port: 22,
  username: 'root',
  password: PASS,
  readyTimeout: 30000,
  keepaliveInterval: 10000
});
