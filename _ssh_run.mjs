import { Client } from 'ssh2';

const HOST = '160.250.204.162';
const PASS = process.env.DEPLOY_PASS;
if (!PASS) { console.error('Set DEPLOY_PASS env var'); process.exit(1); }

const cmd = process.argv[2];
if (!cmd) { console.error('Usage: node _ssh_run.mjs "<command>"'); process.exit(1); }

const conn = new Client();
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error('ERR:', err.message); conn.end(); process.exit(1); }
    let out = '';
    stream.on('close', (code) => { console.log(out); conn.end(); process.exit(code || 0); });
    stream.on('data', d => out += d.toString());
    stream.stderr.on('data', d => out += d.toString());
  });
}).on('error', e => { console.error(e.message); process.exit(1); })
.connect({ host: HOST, port: 22, username: 'root', password: PASS, readyTimeout: 60000 });
