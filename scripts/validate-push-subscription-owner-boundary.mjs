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
assert.match(sql, /set search_path = ''/i);
assert.doesNotMatch(sql, /set search_path = public/i);
assert.match(sql, /pg_catalog\.btrim/);
assert.match(sql, /pg_catalog\.now\(\)/);
assert.match(sql, /pg_catalog\.left\(p_user_agent, 500\)/i);
assert.match(sql, /pg_catalog\.left\(p_platform, 100\)/i);

console.log("Push subscription ownership boundary: PASS (14 source-contract assertions)");
console.log("Disposable PostgreSQL two-user integration tests must pass before production rollout.");
