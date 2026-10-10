import fs from "node:fs";
import path from "node:path";

const directory = "supabase/migrations";
const files = fs.readdirSync(directory)
  .filter(name => /^\d{14}_.+\.sql$/.test(name))
  .sort();

const knownLegacyCollisions = new Map([
  ["20260928020000", [
    "20260928020000_rc101_g6_rls_permissive_policy_hardening.sql",
    "20260928020000_rc102_g8_crm_notification_support_rls_hardening.sql"
  ]],
  ["20260928060000", [
    "20260928060000_rc109_harden_order_support_tenant_boundaries.sql",
    "20260928060000_restore_registration_request_dml_grants.sql"
  ]],
  ["20260928190000", [
    "20260928190000_rc162_mantigo_trip_state_machine.sql",
    "20260928190000_rc200_cross_tenant_customer_payment_authorization.sql"
  ]],
  ["20260928200000", [
    "20260928200000_rc164_mantigo_direct_delete_lockdown.sql",
    "20260928200000_rc164_retire_legacy_mantigo_mutator.sql",
    "20260928200000_rc206_geographic_ad_targeting_and_nearest_fallback.sql"
  ]],
  ["20260928210000", [
    "20260928210000_rc172_restore_medical_booking_contract.sql",
    "20260928210000_rc207_official_global_mnty_cover_ads.sql"
  ]]
]);

const byVersion = new Map();
for (const file of files) {
  const version = file.slice(0, 14);
  if (!byVersion.has(version)) byVersion.set(version, []);
  byVersion.get(version).push(file);
}

const failures = [];
for (const [version, names] of byVersion) {
  if (names.length < 2) continue;
  const actual = [...names].sort();
  const allowed = knownLegacyCollisions.get(version);
  if (!allowed || JSON.stringify(actual) !== JSON.stringify([...allowed].sort())) {
    failures.push({ version, files: actual, reason: allowed ? "known collision changed" : "new migration-version collision" });
  } else {
    console.warn("KNOWN LEGACY COLLISION (not approved for new migrations): " + version + " => " + actual.join(", "));
  }
}

if (failures.length) {
  console.error("Migration version uniqueness FAILED:");
  for (const failure of failures) {
    console.error("- " + failure.version + " [" + failure.reason + "]: " + failure.files.join(", "));
  }
  console.error("Every new migration must have a unique 14-digit version. Do not silence this check by expanding the allowlist without a reviewed migration-history reconciliation.");
  process.exit(1);
}

console.log("Migration version uniqueness PASS: " + files.length + " migration files; only exact, pre-existing legacy collisions are allowlisted.");
console.log("This check validates repository filenames only; reconcile the live Supabase migration ledger separately before release.");
