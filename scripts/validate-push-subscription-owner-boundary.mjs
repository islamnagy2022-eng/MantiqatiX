import fs from "node:fs";
import assert from "node:assert/strict";

const migrationPath = "supabase/migrations/20261009144500_mnty_push_subscription_owner_conflict.sql";
const sql = fs.readFileSync(migrationPath, "utf8");

assert.match(sql, /create or replace function private\.upsert_mnty_push_subscription/i);
assert.match(sql, /if auth\.uid\(\) is null then[\s\S]*?AUTH_REQUIRED/i);
assert.match(sql, /insert into public\.push_subscriptions as current_subscription/i);
assert.match(sql, /on conflict \(endpoint\) do update/i);
assert.match(sql, /where current_subscription\.user_id = auth\.uid\(\)/i);
assert.doesNotMatch(sql, /set user_id\s*=\s*excluded\.user_id/i);
assert.match(sql, /if not found then[\s\S]*?PUSH_ENDPOINT_OWNERSHIP_CONFLICT/i);
assert.match(sql, /using errcode = '42501'/i);
assert.match(sql, /set search_path = public, pg_temp/i);
assert.match(sql, /left\(p_user_agent, 500\)/i);
assert.match(sql, /left\(p_platform, 100\)/i);

console.log("Push subscription ownership boundary: PASS (11 source-contract assertions)");
console.log("Runtime two-user SQL integration tests are still required before production rollout.");
