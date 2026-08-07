// Defanged reproduction of the Whinta update/installer flow.
//
// Replicates the exact logic found in the deployed Update.vue bundle + the
// observed server behaviour, WITHOUT touching a real database or installer.
// Demonstrates the bug class: an unauthenticated /update endpoint that runs
// "migrations" and discloses migration source, gated only by a dead
// third-party license call.
//
// Run:  node update-repro.js

const assert = require('assert');

/** Dead license validator — mirrors POST https://axis96.xyz/api/install/... */
function licenseCheck(code) {
  // axis96.xyz resolves to nothing (NXDOMAIN). The client sees a transport
  // error, so the client-side "gate" can never pass.
  return 0; // no HTTP status (transport error)
}

/** Server-side handler for POST /update — buggy: no auth, runs migrations. */
function handleUpdate(body) {
  // The real server does NOT verify the license. It runs migrations and
  // returns raw migration source in the response (observed live).
  const migration = `class CreateNotificationsTable extends Migration
{
    public function up() { Schema::create('notifications', fn (Blueprint $t) => ...); }
}`;
  return { source: migration, migrated: runMigrations(), statusCode: 500 };
}

/** stand-in for `php artisan migrate` — number of "applied" steps */
function runMigrations() { return 3 + Math.floor(Math.random() * 6); }

/** client state machine — exact port of the bundled Update.vue logic */
function clientFlow(purchaseCode) {
  let n = null; // null | "migrate" | "finish"
  let l = null; // error

  // step 1: C() — license check (dead endpoint -> always fails client-side)
  const status = licenseCheck("https://axis96.xyz/api/install/51790966/item");
  if (status === 200) n = "migrate";
  else { l = "Error: No response received"; n = null; }

  console.log(`license gate -> status=${status} error=${l || 'none'}`);
  console.log("  (gate is client-side theater: a dead host can never grant access)\n");

  if (n !== "migrate") console.log("ATTACK DOES NOT DEPEND ON THE GATE:");

  // step 2: g() — the actual migration call, directly reachable by attackers.
  // The server leaks source AND runs migrations regardless of the license.
  const res = handleUpdate({ purchase_code: purchaseCode });
  console.log(`>>> POST /update -> statusCode=${res.statusCode} migrated=${res.migrated}`);
  console.log(`>>> leaked migration source (first 60 chars): ${res.source.slice(0, 60)}...\n`);
}

// ---- assertions: prove the attack does not depend on the gate ----
assert.strictEqual(licenseCheck("x"), 0, "dead license host never returns 200");
const r = handleUpdate({ purchase_code: "ANY" });
assert.ok(r.source.includes("CreateNotificationsTable"), "migration source leaked");
assert.ok(r.migrated > 0, "migrations ran without license");

clientFlow("WHINTA-PURCHASE-CODE-ABC");
console.log("DEMO COMPLETE — this is a faithful local model, not the live system.");
