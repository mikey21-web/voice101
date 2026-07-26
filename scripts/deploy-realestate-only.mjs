import { Client } from 'ssh2';

const HOST = '160.250.204.162';
const PASS = process.env.DEPLOY_PASS;
if (!PASS) { console.error('Set DEPLOY_PASS env var'); process.exit(1); }

const conn = new Client();
const run = (c) => new Promise((resolve) => {
  conn.exec(c, (err, stream) => {
    if (err) { resolve(`ERR: ${err.message}`); return; }
    let o = '';
    stream.on('close', () => resolve(o.trim()));
    stream.on('data', d => o += d.toString());
    stream.stderr.on('data', d => o += d.toString());
  });
});

conn.on('ready', async () => {
  const backend = 'demo-realestate-backend-1';

  console.log('=== Locating demo-realestate compose project dir ===');
  let dir = await run(`docker inspect ${backend} --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' 2>&1`);
  if (!dir || dir.includes('Error') || dir.includes('ERR:')) {
    console.error(`Could not locate project dir for ${backend}: ${dir}`);
    conn.end();
    process.exit(1);
  }
  console.log(`Project dir: ${dir}`);

  console.log('\n=== Current branch / status ===');
  console.log(await run(`cd ${dir} && git branch --show-current && git status --short | head -20`));

  console.log('\n=== git pull ===');
  console.log(await run(`cd ${dir} && git pull 2>&1`));

  const compose = `docker compose -f docker-compose.demo.yml -p demo-realestate --env-file deploy-demo/.env.realestate`;

  console.log('\n=== Rebuild backend + dashboard (realestate only) ===');
  console.log(await run(`cd ${dir} && ${compose} up -d --build backend dashboard agent-service 2>&1 | tail -30`));

  console.log('\n=== Run prisma migrate deploy ===');
  console.log(await run(`cd ${dir} && ${compose} exec -T backend npx prisma migrate deploy 2>&1`));

  console.log('\n=== Health check ===');
  console.log(await run(`docker exec ${backend} curl -s -o /dev/null -w "HTTP %{http_code}\\n" http://localhost:3001/health 2>&1`));

  console.log('\n=== Container status ===');
  console.log(await run(`cd ${dir} && ${compose} ps`));

  console.log('\n=== Done ===');
  conn.end();
}).on('error', e => { console.error(e.message); process.exit(1); })
.connect({ host: HOST, port: 22, username: 'root', password: PASS, readyTimeout: 60000, keepaliveInterval: 10000 });
