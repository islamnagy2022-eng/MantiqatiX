import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const migrationDir = "supabase/migrations";
const manifestPath = process.argv[2] ?? "s04-replay-evidence/migration-normalization-manifest.json";
const mapping = [
  ["20260928020000_rc101_g6_rls_permissive_policy_hardening.sql", "20260928101022_rc101_g6_rls_permissive_policy_hardening.sql"],
  ["20260928020000_rc102_g8_crm_notification_support_rls_hardening.sql", "20260928104107_rc102_g8_crm_notification_support_rls_hardening.sql"],
  ["20260928060000_rc109_harden_order_support_tenant_boundaries.sql", "20260928112420_rc109_harden_order_support_tenant_boundaries.sql"],
  ["20260928060000_restore_registration_request_dml_grants.sql", "20260928034100_restore_registration_request_dml_grants.sql"],
  ["20260928190000_rc162_mantigo_trip_state_machine.sql", "20260928124303_rc162_mantigo_trip_state_machine.sql"],
  ["20260928190000_rc200_cross_tenant_customer_payment_authorization.sql", "20260928154527_rc200_cross_tenant_customer_payment_authorization.sql"],
  ["20260928200000_rc164_mantigo_direct_delete_lockdown.sql", "20260928125655_rc164_mantigo_direct_delete_lockdown.sql"],
  ["20260928200000_rc164_retire_legacy_mantigo_mutator.sql", "20260928125731_rc164_retire_legacy_mantigo_mutator.sql"],
  ["20260928200000_rc206_geographic_ad_targeting_and_nearest_fallback.sql", "20260928161513_rc206_geographic_ad_targeting_and_nearest_fallback.sql"],
  ["20260928210000_rc172_restore_medical_booking_contract.sql", "20260928131753_rc172_restore_medical_booking_contract.sql"],
  ["20260928210000_rc207_official_global_mnty_cover_ads.sql", "20260928174954_rc207_official_global_mnty_cover_ads.sql"]
];

const digest = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const names = fs.readdirSync(migrationDir).filter(name => name.endsWith(".sql")).sort();
const byVersion = new Map();
for (const name of names) {
  const version = name.slice(0, 14);
  byVersion.set(version, [...(byVersion.get(version) ?? []), name]);
}
const collisions = [...byVersion.entries()].filter(([, group]) => group.length > 1);
const expected = new Map([
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
const actualCollisions = new Map(collisions.map(([version, group]) => [version, [...group].sort()]));
if (actualCollisions.size !== expected.size) {
  throw new Error(`Unexpected migration collision group count: expected ${expected.size}, found ${actualCollisions.size}`);
}
for (const [version, files] of expected) {
  const actual = actualCollisions.get(version);
  if (!actual || JSON.stringify(actual) !== JSON.stringify([...files].sort())) {
    throw new Error(`Unexpected collision contents for ${version}: ${JSON.stringify(actual ?? [])}`);
  }
}
if (mapping.length !== 11 || new Set(mapping.map(([from]) => from)).size !== mapping.length ||
    new Set(mapping.map(([, to]) => to)).size !== mapping.length) {
  throw new Error("Normalization mapping is not one-to-one.");
}

const manifest = {
  schema_version: 1,
  purpose: "Disposable clean-replay normalization only; repository migration history remains unchanged.",
  source_files: names.length,
  expected_legacy_collision_groups: [...expected.entries()].map(([version, files]) => ({ version, files })),
  normalized: []
};

for (const [from, to] of mapping) {
  const source = path.join(migrationDir, from);
  const target = path.join(migrationDir, to);
  if (!fs.existsSync(source)) throw new Error(`Expected legacy migration is missing: ${from}`);
  if (fs.existsSync(target)) throw new Error(`Normalization target already exists: ${to}`);
  const sha256 = digest(source);
  fs.renameSync(source, target);
  if (digest(target) !== sha256) throw new Error(`SQL content digest changed during normalization: ${from}`);
  manifest.normalized.push({ from, to, sha256 });
}

const normalizedNames = fs.readdirSync(migrationDir).filter(name => name.endsWith(".sql")).sort();
const invalid = normalizedNames.filter(name => !/^\\d{14}_.+\\.sql$/.test(name));
const versions = new Map();
for (const name of normalizedNames) {
  const version = name.slice(0, 14);
  versions.set(version, [...(versions.get(version) ?? []), name]);
}
const duplicates = [...versions.entries()].filter(([, group]) => group.length > 1);
if (invalid.length || duplicates.length) {
  throw new Error(`Normalized replay directory still invalid: invalid=${JSON.stringify(invalid)}, duplicates=${JSON.stringify(duplicates)}`);
}
manifest.normalized_file_count = normalizedNames.length;
manifest.normalized_duplicate_version_groups = duplicates.length;
fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\\n");
console.log(`S04 replay normalization PASS: ${mapping.length} filename mappings; SQL SHA-256 preserved; repository files are unchanged outside this disposable CI checkout.`);
