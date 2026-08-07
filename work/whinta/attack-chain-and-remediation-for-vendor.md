# How an Attacker Can Compromise Your App — and How To Patch It

**Audience:** Whinta platform engineering/sysadmin
**Date:** 2026-08-04
**Scope:** app.whinta.com — full unauthenticated compromise chain, and the exact fixes.
**Purpose:** defense. This walk-through explains the vulnerable path so it can be closed. Follow the fixes in §3. Do not run the write-steps in §2 on any user-facing instance.

---

## 1. The root cause in one line

Your SaaS installer/updater was left **live and unauthenticated** in production. It has a dead third-party license check plus an unprotected migration runner, and a second oversight that exposes a full `phpinfo()` page. Together they let an attacker go from `GET /` to admin takeover.

Three independent flaws — fixing any one raises the cost hard, fixing all three closes the chain:

- **A. `/update` runs migrations with no auth** and returns raw PHP source.
- **B. The license "gate" is client-side theater** pointed at a server that no longer exists (axis96.xyz = NXDOMAIN).
- **C. `/phpinfo.php` is public**, leaking real filesystem paths and the PHP function surface used to chain any RCE.

---

## 2. The attack chain (how it would be done)

Step 0 — Recon (read-only)
- `GET /update` → returns the `Installer/Update` page (200, no login) and page props with app version, Pusher key, Google OAuth client.
- `GET /phpinfo.php` → full PHP info: PHP 8.2.30, LiteSpeed, real home dir `/home/scientificatt/app.whinta.com`, `disable_functions` empty, `allow_url_fopen=On`.
- `GET /build/manifest.json` → complete list of internal pages/admin modules, including the Installer.

Step 1 — Source disclosure (read-only, repeatable)
- `POST /update` with an empty/any JSON body.
- Response 200 contains the **raw PHP of migration files** (e.g. `CreateNotificationsTable`) — the attacker now knows the entire DB schema.

Step 2 — Unauthenticated migration execution (write primitive)
- The same `POST /update` runs `php artisan migrate` server-side without checking anything.
- Because the license server (`axis96.xyz`) is dead, the client-side "Proceed" button would never pass — but the attacker **doesn't use the button**. They call `POST /update` directly. The server runs migrations anyway.
- This gives the attacker write access to the schema (create/drop/alter tables) using the app's own DB user.

Step 3 — Installer admin creation (escalation)
- The installer the template also exposes `/install/*` handlers: `migrate`, `seed`, `save-admin`, `finalize`.
- `save-admin` is the step that seeds the platform admin account (email + password).
- On a working installer state this yields a legitimate admin login. On your instance these return a generic 500, so the attacker would:
  1. Exercise the same sequence on a private copy of the template / staging to get the exact request order, then
  2. Replay it against this instance if `/install/save-admin` becomes reachable.

Step 4 — Full compromise
- With admin login, the app exposes `SupportAccess/Impersonate` — buy the ability to impersonate any tenant/user → read all chats, tickets, contacts, campaigns, billing data.

### Why this is dangerous even though parts are currently broken
- `/update` source-leak and migration-write are **working today**.
- `allow_url_fopen=On` and nothing in `disable_functions` means if any second bug (LFI, upload, deserialization, SSRF) is found, it chains straight to **RCE** on the web server.
- The entire installer is, by design, the most privileged code in the app — it builds Admin accounts. Shipping it to production unauthenticated is a findable, automatable bug class.

---

## 3. Fix the chain (in priority order)

### Fix 1 — BLOCK / REMOVE the installer (+ the updater) from production
| Action | Detail |
|---|---|
| Disable routes | `routes/web.php`: remove `update` and `install*` in production, or wrap with `auth` + super-admin role + an env flag `INSTALLER_ENABLED=false` |
| One-time gate | Introduce `APP_INSTALLED=true` in `.env`. The installer controllers bail unless `APP_INSTALLED` is false (so it only works on first install, never on a running site). |
| Remove dead deps | Delete stale build chunks (`Install static/Update-*.js`, `Index-*.js`) so the route can't surface in the bundle |

### Fix 2 — Make the migration trigger impossible to abuse
| Action | Detail |
|---|---|
| Server-side license + nonce | `POST /update` must verify a server-side signed deployment token (written at `deploy time` via config), NOT a network call to a dead third party, and NOT a client-supplied `purchase_code` that anyone makes up. |
| Don't run migrations from request | Migrations must run via `php artisan migrate` in the deploy pipeline / console only. No route should call `Artisan::call('migrate')` from user input. |
| DB least privilege | The Laravel DB user must not be `root` and must lack `CREATE/DROP/ALTER`; a separate deploy user owns migrations. |

### Fix 3 — Remove the public `phpinfo()`
| Action | Detail |
|---|---|
| Delete file | Remove `phpinfo.php` from `public/` in production. |
| Dead rule | Add URL block: `^/phpinfo` in the LiteSpeed/nginx/ CDN WAF. |
| Allowlist | Verify `/.env`, `/*.log`, `/storage`, `/.git*` all return 404 (currently some return 403 which confirms the file exists upstream — tighten). |

### Fix 4 — Deny-by-default at the edge (cheap extra layer)
```
location ~* (\.env|\.log|/storage/|phpinfo|/install|^/update) { return 403; }
```
in nginx/LiteSpeed, plus a CDN/WAF rule denying POST to `/update` and `/install*` while the routes exist.

### Fix 5 — Harden serving (not a root cause, cheap)
- `session.cookie_httponly` and `session.cookie_secure` are Off in phpinfo — align with the app's own `httponly; secure` cookie behavior.
- Remove `OpenSwoole` / `display_errors` exposure if not used.

---

## 4. Verify the fixes (simple, safe, read-only)
```powershell
$base="https://app.whinta.com"
1..3 | ForEach-Object { (Invoke-WebRequest "$base/update" -UseBasicParsing).StatusCode }   # want 403/404
(Invoke-WebRequest "$base/phpinfo.php" -UseBasicParsing).StatusCode                          # want 403/404
POST /update  →  want 403/404 (not 200 with source)
GET  /install/*  →  want 404
```

---

## 5. TL;DR for the fix
| Flaw | Fix |
|---|---|
| `/update` unauthenticated + source leak | Remove route / `APP_INSTALLED` gate |
| license gate dead + client-side | Server-side signed deploy token, no third-party call |
| migration runner in a route | Migrate in deploy pipeline only |
| `phpinfo()` public | Delete + WAF rule |
| DB user too privileged | Least-privilege + no DDL for web user |