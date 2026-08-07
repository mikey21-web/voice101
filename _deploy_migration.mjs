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
  // Step 1: See what's running
  await run('docker ps --format "{{.Names}} {{.Status}}"');
  // Step 2: Copy new backend code into the container
  await run('docker cp /opt/lead-automation-demo/backend/prisma/schema.prisma lead-automation-backend:/app/prisma/schema.prisma');
  await run('docker cp /opt/lead-automation-demo/backend/src/workflow lead-automation-backend:/app/src/workflow');
  await run('docker cp /opt/lead-automation-demo/backend/src/app.module.ts lead-automation-backend:/app/src/app.module.ts');
  // Step 3: Run migration
  await run('docker exec lead-automation-backend npx prisma migrate deploy 2>&1');
  // Step 4: Rebuild backend (npm run build inside container, or just restart with new code)
  await run('docker exec lead-automation-backend npx prisma generate 2>&1');
  await run('docker exec lead-automation-backend npx nest build 2>&1');
  // Step 5: Restart
  await run('docker restart lead-automation-backend');
  console.log('DONE');
  conn.end();
}).on('error', e => console.error(e.message))
.connect({ host: HOST, port: 22, username: 'root', password: PASS, readyTimeout: 30000, keepaliveInterval: 10000 });
