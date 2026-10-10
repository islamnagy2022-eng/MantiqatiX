import fs from "node:fs";
import assert from "node:assert/strict";

const app = fs.readFileSync("web/app.js", "utf8");
const migration = fs.readFileSync("supabase/migrations/20261010070000_rc565_matrimony_public_profile_boundary.sql", "utf8");
const fixture = fs.readFileSync("supabase/tests/rc565_matrimony_profile_fixture.sql", "utf8");
const integration = fs.readFileSync("supabase/tests/rc565_matrimony_profile_integration.sql", "utf8");

assert.ok(app.includes("list_matrimony_public_profiles_backend"), "UI must use the safe discovery RPC");
assert.ok(app.includes(".eq('owner_user_id',user.id)"), "private profile reads must be owner-filtered");
assert.ok(!app.includes("q=q.or('is_verified.eq.true,owner_user_id.eq.'+user.id)"), "broad direct profile discovery must be removed");
assert.ok(app.includes("تعذر تحميل ملفات الزواج من المصدر الآمن"), "failed profile reads must render an explicit unavailable state");

assert.ok(migration.includes("DROP POLICY IF EXISTS matrimony_profiles_select"), "broad SELECT policy must be removed");
assert.ok(migration.includes("USING (owner_user_id = auth.uid())"), "direct table SELECT must be owner-only");
assert.ok(migration.includes("SET search_path = ''"), "SECURITY DEFINER function must use an empty search_path");
assert.ok(migration.includes("WHERE p.is_verified IS TRUE"), "discovery must expose verified profiles only");
assert.ok(migration.includes("REVOKE ALL ON FUNCTION public.list_matrimony_public_profiles_backend(integer) FROM PUBLIC, anon"), "public/anonymous execute must be revoked");
for (const field of ["wali_contact_phone", "direct_contact_phone", "financial_status", "religiosity_level", "about_me", "partner_requirements", "compatibility_tags"]) {
  assert.ok(!migration.slice(migration.indexOf("RETURNS TABLE"), migration.indexOf("LANGUAGE plpgsql")).includes(field), "public RPC must not return " + field);
}
assert.ok(fixture.includes("CREATE POLICY matrimony_profiles_select"), "fixture must reproduce the broad production policy");
assert.ok(integration.includes("direct table SELECT exposed another user private profile"), "negative cross-user table read assertion missing");
assert.ok(integration.includes("unverified profile must not be discoverable"), "unverified profile denial assertion missing");
assert.ok(integration.includes("anon must not execute public matrimony discovery"), "anonymous execute denial assertion missing");
assert.ok(integration.includes("unauthenticated discovery call must be rejected"), "unauthenticated caller denial assertion missing");

console.log("RC565 matrimony public/private boundary source contract: PASS");
