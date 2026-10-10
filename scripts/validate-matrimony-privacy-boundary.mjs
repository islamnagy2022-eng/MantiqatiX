import fs from "node:fs";
import assert from "node:assert/strict";

const migration = fs.readFileSync("supabase/migrations/20261010150000_rc447_matrimony_profile_privacy_boundary.sql", "utf8");
const fixture = fs.readFileSync("supabase/tests/rc447_matrimony_privacy_fixture.sql", "utf8");
const integration = fs.readFileSync("supabase/tests/rc447_matrimony_privacy_integration.sql", "utf8");

assert.match(migration, /drop policy if exists matrimony_profiles_select/i);
assert.match(migration, /using \(owner_user_id = auth\.uid\(\)\)/i, "raw profile SELECT must be owner-only");
assert.match(migration, /function public\.matrimony_discover_profiles_backend/i);
const discoverStart = migration.indexOf("function public.matrimony_discover_profiles_backend");
const contactStart = migration.indexOf("function public.matrimony_get_unlocked_contact_backend");
const discover = migration.slice(discoverStart, contactStart);
assert.match(discover, /p\.is_verified is true/);
assert.match(discover, /is_anonymous/, "discovery must reject anonymous Auth sessions");
assert.doesNotMatch(discover, /wali_contact_phone|direct_contact_phone|financial_status|housing_status|religiosity_level|about_me|partner_requirements/i);
assert.match(migration, /v_request[.]status IS DISTINCT FROM 'ACCEPTED_MUTUAL'/i, "contact retrieval must fail closed for every non-mutual state");
assert.match(migration, /current_user not in \('postgres','service_role'\)/i, "verification changes must be trusted-server-only");
assert.doesNotMatch(migration, /public[.]is_platform_admin[(][)]/i, "generic admin helper must not bypass server-only verification");
assert.match(migration, /revoke all on function private[.]guard_matrimony_profile_verification[(][)] from public,anon,authenticated/i);
assert.match(migration, /revoke all on function public\.matrimony_discover_profiles_backend\(integer,text,text\) from public,anon/i);
assert.match(migration, /revoke all on function public\.matrimony_get_unlocked_contact_backend\(uuid\) from public,anon/i);
assert.match(fixture, /authenticated_sessions_only on public\.matrimony_profiles as restrictive/i);
assert.match(fixture, /select true/, "fixture must prove generic admin helper cannot bypass the trigger");
assert.match(integration, /anonymous raw profile SELECT unexpectedly succeeded/);
assert.match(integration, /pending request contact unexpectedly succeeded/);
assert.match(integration, /unrelated user contact retrieval unexpectedly succeeded/);
assert.match(integration, /profile owner self-verification unexpectedly succeeded/);

console.log("RC447 matrimony privacy source contract: PASS");
