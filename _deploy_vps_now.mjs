import { Client } from 'ssh2';

const HOST = '160.250.204.162';
const PASS = 'Maheshwari21!';

const conn = new Client();
const run = (c) => new Promise((resolve) => {
  conn.exec(c, (err, stream) => {
    if (err) { console.error(err.message); resolve(1); return; }
    let o = '';
    stream.on('close', (code) => { console.log(o.trim()); resolve(code); });
    stream.stderr.on('data', d => o += d.toString());
    stream.on('data', d => o += d.toString());
  });
});

conn.on('ready', async () => {
  const cmds = [
    'cd /opt/lead-automation-demo && docker compose -p virtual-assistant down --remove-orphans 2>/dev/null; echo down_ok',
    'cd /opt/lead-automation-demo && docker compose -p virtual-assistant up -d --build backend postgres redis 2>&1 | tail -10',
    'sleep 25',
    'docker exec lead-automation-backend npx prisma migrate deploy 2>&1 | tail -15',
    'docker restart lead-automation-backend',
    'cd /opt/lead-automation-demo && docker compose -p virtual-assistant up -d dashboard agent-service 2>&1 | tail -5',
    'grep -q "Caddyfile.additions" /etc/caddy/Caddyfile || echo "import /opt/lead-automation-demo/deploy-demo/Caddyfile.additions" >> /etc/caddy/Caddyfile',
    'caddy reload --config /etc/caddy/Caddyfile 2>&1 | tail -1',
  ];
  for (const c of cmds) {
    const code = await run(c);
    if (code !== 0 && code !== undefined) { console.error('FAILED, aborting'); break; }
  }
  conn.end();
}).on('error', e => console.error(e.message))
.connect({ host: HOST, port: 22, username: 'root', password: PASS, readyTimeout: 30000, keepaliveInterval: 10000 });
