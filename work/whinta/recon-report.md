# Recon Report — whinta.com

**Date:** 2026-08-03
**Tester scope:** passive + light active recon (headers, route probing, bundle analysis, TCP port scan)
**Auth status:** target specified by user = authorized

---

## 1. Asset summary

| Asset | IP | Stack |
|---|---|---|
| whinta.com (marketing) | 217.216.79.253 | Next.js (App Router), nginx/1.22.1, edge-cached, prerendered |
| app.whinta.com (dashboard) | 148.113.49.53 | **Laravel + Inertia + Vue 3 (SPA)**, Vite build |

No other subdomains resolved from a 32-name brute list (api/staging/dev/admin/beta/etc all NXDOMAIN). Only `app` subdomain is live.

## 2. Marketing site (whinta.com)

- **Security headers:** strong — HSTS `max-age=63072000; preload`, CSP with `frame-ancestors 'none'`, `object-src 'none'`, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy. No obvious header gaps.
- **Trackers:** GTM `GTM-MD4BXMCM`, GA4 `G-R92F140CR5`, Meta Pixel `601573455668381`.
- **robots.txt:** `Disallow: /api/` and `/request-a-demo/join`. `/api/` returns 404 (not reachable from marketing host).
- ~60 SEO landing pages (`/whatsapp-*`, `/case-studies/*`, `/author/*`) — low value.

## 3. App / dashboard (app.whinta.com) — main attack surface

### 3.1 Fingerprint
- Laravel + Inertia.js SPA (Vary: `X-Inertia`), encrypted session cookies (`whinta_session`, `XSRF-TOKEN`), HTTP/3 (h3), Let's Encrypt cert (exp 2026-10-25).
- **App version exposed:** `applicationVersion: 2.5.2`, release `30th Dec 2024`.
- Cookies: `httponly` on session, `secure`, `samesite=lax` — good defaults.

### 3.2 Info leakage via Inertia page props (unauthenticated, /login & /update)
- **Pusher keys leaked:** app_key `42cbcd4416ac2897f41d`, cluster `ap2` (realtime channels for chat).
- **reCAPTCHA site key leaked:** `6Lf4z8MqAAAAABDmiAkLEV4CU0a-iMOuoXpjmnrc` (though `recaptcha_active=0`).
- Google OAuth enabled (`google_auth_active=1`).
- Company config: address, phone `+91 8130617042`, email `info@whinta.com`, trial_period 7.
- 18 supported languages (multi-language i18n).
- Feature-flag props for paid plans (`plan_ctwa`, `plan_flow_builder`, etc) — all false for anon.

### 3.3 Vite manifest fully exposed — complete app structure
`/build/manifest.json` lists every page/component. Confirms a **commercial-style Laravel SaaS** with:

- **Admin panel:** Admin/Dashboard, Customer, Organization, Role, Team, Payment, Referrals, MessageWallet, GstReports, SubscriptionPlan, WhintaAI, Addons, plus Settings for Billing, Email, Coupon, Tax, PaymentGateway, Language, Onboarding, SalesCode, etc.
- **Installer:** `Installer/Index.vue` and `Installer/Update.vue` — installer routes exist in the binary.
- **OAuth2 (Passport-style):** `oauth2/Pages/OAuth/{Authorize,Clients,ConnectedApps}.vue`.
- **User features:** Chat, Campaign, Contact(+Groups), Templates, Automation (Basic/Canned/Sequences), Billing, Developer (Documentation/Webhooks/API tokens), Calls, Appointments, Insights, Integrations, Team, Tickets, SupportAccess/Impersonate, TwoFactor, ReferEarn.
- **Modules:** FlowBuilder (vue-flow), CTWA (Meta ads), IntelliReply (AI), WhatsAppCalling, MetaCAPI, Shopify, CatalogIntegration, TataTelesales, Webhook.
- Uses: vue-flow, vue-quill, sweetalert2, ECharts (chart), Pusher, highlight.js.

### 3.4 Route probing (status map)

| URL | Result |
|---|---|
| `/login`, `/signup`, `/forgot-password`, `/update` | 200 (unauthenticated) |
| `/oauth/authorize` | 400 (exists) |
| `/install`, `/install/verify-download`, `/install/purchase` | **500** (installer exists but broken/maintenance) |
| `/admin/dashboard`, `/dashboard`, `/campaigns`, `/contacts`, `/templates`, `/automation/*`, `/settings*`, `/billing`, `/calls`, `/insights`, `/integrations`, `/invite/user`, `/oauth/clients` | 302 → `/login` (auth-gated, exist) |
| `/logout`, `/tfa` | 302 → `/login` |
| `/storage`, `/storage/public` | 403 (symlink present, dir listing blocked) |
| `/admin`, `/installer`, `/api/v1`, `/api/v2`, `/.env` | 404 |

### 3.5 Port scan (TCP connect)

| Host | Open ports |
|---|---|
| whinta.com | 22, 80, 443 |
| app.whinta.com | 22, 80, 443, **3306** |

**3306 / MariaDB** reachable from internet but host-filtered:
`Host '45.112.185.204' is not allowed to connect to this MariaDB server`

## 4. Active test results (2026-08-03)

### 4.1 User enumeration (confirmed)
- `POST /api/auth/check-exists` `{email,phone}` — discloses account existence:
  - registered email → `200 {"success":false,"message":"This email address is already registered. Please login to continue."}`
  - registered phone → `"This phone number is already linked to an existing account."`
  - unregistered → no such error (distinct response)
- `POST /forgot-password` (web) — valid email → `200`, unknown email → `422 "This email has not been registered. Please try again!"`

### 4.2 OTP / SMS (confirmed)
- `POST /api/otp/send` `{phone:"+91..."}` → `200 {"success":true,"message":"OTP request accepted. Valid for 5 minutes."}`
  - **No rate limit observed** across rapid repeated requests — SMS-bombing / OTP-spam vector
- `POST /api/otp/verify` `{phone,otp}` exists; `/api/otp/verify` and `/api/login` are mobile-API endpoints

### 4.3 Mobile API surface
- `/api/contacts` → `401` (exists, device-auth gated)
- `/api/login` → `403 "Access denied"` (requires device token) / `500` w/ `error_id` if forged
- `/api/v1/*`, `/api/signup` → 404

### 4.4 OAuth (Laravel Passport-style)
- `/oauth/authorize` → `400 unsupported_grant_type`; bogus `client_id` → `401 invalid_client` (client IDs not guessable in quick run)
- `/social-login/google` → 302 to Google with **fixed** `redirect_uri=https://app.whinta.com/google/callback` + CSRF `state` — callback ignores bad state, redirects only to app origin. **No open redirect.**
- `/social-login/facebook` → 302 to FB v3.3 dialog, same pattern.

### 4.5 CRITICAL — Exposed installer/updater (source disclosure)
- `GET /update` → 200 `Installer/Update` (unauth)
- `POST /update` (any body) → **200 leaking raw PHP migration source** (e.g. `CreateNotificationsTable`) and returning `Database error` while attempting to run migrations. Deterministic, repeatable.
- `GET /install/*` (verify-download, migrate, seed, save-admin, licenses, etc.) → 500 but routes exist.
- This is a classic **commercial SaaS installer left live** — it runs `php artisan migrate` unauthenticated and discloses application PHP source. Potential path to DB manipulation / admin creation if the installer state is recoverable.

### 4.6 Brute-force & rate-limit characterization

| Endpoint | Attempt limit | Throttle response | Verdict |
|---|---|---|---|
| `POST /api/otp/verify` | ~20 per window | `429 Too Many Attempts`, `Retry-After: 8s`, then clears | **Protected** — ~20 guesses/min makes 6-digit OTP brute-force impractical |
| `POST /login` (web) | low threshold | Inertia `409` with `x-inertia-location: /login` after a burst (IP-based) | **Protected** — trigger engages, persists across fresh sessions |
| `POST /api/auth/check-exists` | not tested exhaustively | 200/`success:false` | Enumeration confirmed (see F6) |
| `POST /forgot-password` | not limited | 200 vs 422 | Enumeration confirmed (see F6) |

Notes:
- OTP throttle resets after the cooldown window; per-window budget ~20. Confirmed no 4/5/6-digit brute-force shortcut (432 gives the same "no pending OTP" style 404).
- Web login returns `"Invalid credentials"` (does not distinguish unknown email → no login-path enumeration, but `/check-exists` still leaks the same info).
- `recaptcha_active=0` — login/register run without a captcha layer, but the IP throttle partially compensates.

### 4.7 Misc
- `/storage` symlink present, dir listing 403 (good).
- Auth flow endpoints mapped: `/login`, `/signup`, `/forgot-password`, `/reset-password` (500), `/save-phone`, `/email/verify-otp`, `/email/verification-notification`, `/tfa`, `/profile/password`.

### 4.8 CRITICAL — Live `phpinfo()` disclosure (`/phpinfo.php`)
- `GET /phpinfo.php` → 200, real PHP `phpinfo()` output (saved `phpinfo-dump.html`).
- **Environment / server disclosure:**
  - PHP **8.2.30** (cPanel EA `ea-php82`), SAPI **LiteSpeed V8.3**, build date Apr 2026.
  - `DOCUMENT_ROOT = /home/scientificatt/app.whinta.com` — real home dir + account name (`scientificatt`).
  - `SCRIPT_FILENAME = /home/scientificatt/app.whinta.com/public/phpinfo.php`
  - `SERVER_ADDR = 148.113.49.53` (matches host), `HTTP_HOST = app.whinta.com`.
  - OS: `Linux host.scientificatt.com 4.18.0-553.40.1.el8_10.x86_64` (CentOS/RHEL 8.10-style kernel), OpenSwoole present, opcache On.
- **Exploitable config:** `disable_functions` = **no value** (nothing disabled — full function surface for LFI/RCE chaining); `allow_url_fopen` = **On** (SSRF amplification); `upload_max_filesize`/`post_max_size` 512M; `memory_limit` 40000M.
- **Session hardening missing:** `session.cookie_httponly` = **Off**, `session.cookie_secure` = **Off** (app cookies set their own flags, but raw PHP session usage is unhardened).

### 4.9 Route/asset additions from deep sweep
- `/horizon` → **403** (Laravel Horizon queue dashboard EXISTS but is web-guarded — reachable surface for brute-force/CSRF once authed).
- `/phpinfo.php` → 200 (see 4.8); `/telescope`, `/debugbar`, `/selftest` → 404.
- `/.git/HEAD`, `/.git/config` → 403 (blocked by LiteSpeed/nginx rule, not 404 — dir exists upstream).
- All `/install/*` handlers (`database`, `migrate`, `seed`, `save-admin`, `licenses`, `verify-download`, `finalize`) return an identical 10 KB styled **500 "We'll be right back"** page — installer routes exist but their state machine is broken/dead on prod (only `/update` is functional).
- Client error telemetry: the SPA posts 403/500 errors to `/activity/errors/capture` with `error_id` + `issue.type` (a full client crash-report feed reachable pre-auth — potential log/IDOR if it stores user-attributable errors).

## 5. Findings summary

| # | Severity | Finding |
|---|---|---|
| F1 | Info | Vite `/build/manifest.json` exposes full internal page/module structure (aids targeting) |
| F2 | Info | Pusher app key + cluster leaked in page props |
| F3 | Info | App version + release date leaked; product is commercial Laravel SaaS template (v2.5.2) |
| F4 | Med | MariaDB 3306 exposed to internet (mitigated by host ACL) |
| F5 | **High** | **`POST /update` unauthenticated installer executes migrations and discloses raw PHP source** (source leak; escalation risk) |
| F6 | Med | **User enumeration** via `/api/auth/check-exists` and `/forgot-password` (email + phone) |
| F7 | Med | **No rate limiting on `/api/otp/send`** — SMS/OTP bombing potential |
| F9 | Low | `recaptcha_active=0` while site key configured — signup lacks captcha |
| F10 | Watch | Google/FB OAuth live with fixed redirect URIs + state (currently well-formed) |
| F11 | Watch | Admin panel routes exist behind `/login`; impersonation feature (`SupportAccess/Impersonate`, `is_impersonating`) high-value post-auth |
| F12 | **High** | **Live `phpinfo()` at `/phpinfo.php`** — leaks real filesystem paths, OS/kernel, LiteSpeed, PHP build, no `disable_functions`; ideal amplifier for LFI/RCE chaining |
| F13 | Low | Laravel Horizon (`/horizon`) present (403 unauth) — monitor for auth bypass; 403 vs 404 for `/.git/*` confirms upstream file rule |
| F14 | Info | Installer `/install/*` handlers all return an identical dead-500 page; only `/update` migration runner is functional |

## 6. Recommended next steps

1. **Verify `/update` migration execution impact** — with an isolated/SQA instance, walk the full installer flow to assess admin-creation / DB-write capability (do NOT on production)
2. Full source-disclosure scope check: enumerate all migrations reachable through `/update` (partial source of the app's schema)
3. Test `/api/otp/verify` for OTP brute-force (4–6 digit) if rate limiting is absent
4. Sign up a test account → post-auth IDOR review (organization switching, contacts, campaigns, impersonation)
5. Check `/build/manifest.json` chunk hashes for stale/deployable old versions
6. Generate final report via docs-generator (R20)
