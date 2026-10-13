import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const roots = ["supabase/migrations", "supabase/recovered-migrations"];
const diagnosticReplay = process.argv.includes("--diagnostic-replay");
const expected = [
  "20261009120000_rc425_atomic_mantigo_paymob_payment.sql",
  "20261009130000_rc426_digital_page_provider_order_binding.sql",
  "20261009140000_rc427_one_active_payment_intent_per_order.sql",
  "20261009150000_rc428_atomic_provider_failure_webhook.sql",
  "20261009160000_rc429_atomic_subscription_failure_webhook.sql",
  "20261009170000_rc430_atomic_subscription_success_webhook.sql",
  "20261009180000_rc431_harden_deployed_digital_page_payment_rpc.sql",
  "20261009190000_rc432_smm_wallet_transaction_idempotency.sql",
  "20261009200000_rc434_atomic_erp_purchase_receiving.sql",
  "20261009210000_rc435_subscription_provider_intent_claim.sql",
  "20261009220000_rc436_atomic_financial_journal.sql",
  "20261009230000_rc437_purchase_order_lines_receiving_limits.sql",
  "20261009240000_rc438_purchase_order_creation_with_lines.sql",
  "20261010010000_rc439_encrypted_checkout_recovery.sql",
  "20261010020000_rc440_exposed_security_definer_search_path.sql",
  "20261010030000_rc441_platform_admin_scope_hardening.sql",
  "20261010170000_rc449_mantigo_platform_admin_scope_hardening.sql",
  "20261012040000_rc462_mantigo_platform_admin_guard_malformed_permissions.sql",
  "20261013190000_rc522_audit_log_append_only.sql",
  "20261013200000_rc523_mantigo_financial_report_canonical_columns.sql"
];

// Explicit diagnostic-only tie-break order based on source-control addition chronology
// inspected for these exact files. This is NOT proof of production migration order and
// does NOT repair or rename any migration version.
const collisionOrder = new Map([
  ["20260928020000", [
    "20260928020000_rc101_g6_rls_permissive_policy_hardening.sql",
    "20260928020000_rc102_g8_crm_notification_support_rls_hardening.sql"
  ]],
  ["20260928060000", [
    "20260928060000_restore_registration_request_dml_grants.sql",
    "20260928060000_rc109_harden_order_support_tenant_boundaries.sql"
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

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const all = [];
const missingDirectories = [];
for (const root of roots) {
  if (!fs.existsSync(root)) {
    missingDirectories.push(root);
    continue;
  }
  for (const name of fs.readdirSync(root).filter((n) => n.endsWith(".sql")).sort()) {
    const fullPath = path.join(root, name);
    const match = /^(\d{14})_(.+)\.sql$/.exec(name);
    all.push({ root, name, path: fullPath, version: match?.[1] ?? null,
      validName: Boolean(match), sha256: sha256(fs.readFileSync(fullPath)) });
  }
}

const byName = new Map();
const conflictingCopies = [];
for (const file of all) {
  const existing = byName.get(file.name);
  if (!existing) byName.set(file.name, file);
  else if (existing.sha256 !== file.sha256) {
    conflictingCopies.push({ name: file.name, paths: [existing.path, file.path],
      sha256: [existing.sha256, file.sha256] });
  }
}
const uniqueNames = [...byName.values()];
const byVersion = new Map();
for (const file of uniqueNames) {
  if (!file.version) continue;
  if (!byVersion.has(file.version)) byVersion.set(file.version, []);
  byVersion.get(file.version).push(file.name);
}
const collisions = [...byVersion.entries()]
  .filter(([, names]) => names.length > 1)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([version, names]) => ({ version, files: names.sort() }));

const collisionOrderErrors = [];
for (const collision of collisions) {
  const prescribed = collisionOrder.get(collision.version);
  if (!prescribed || JSON.stringify([...prescribed].sort()) !== JSON.stringify([...collision.files].sort())) {
    collisionOrderErrors.push({version: collision.version, files: collision.files, reason:"no exact diagnostic tie-break manifest"});
  }
}
const orderRank = new Map();
for (const [version, names] of collisionOrder) names.forEach((name, i) => orderRank.set(name, i));
const orderedFiles = [...uniqueNames].sort((a, b) => {
  const versionOrder = (a.version ?? a.name).localeCompare(b.version ?? b.name);
  if (versionOrder !== 0) return versionOrder;
  const rankA = orderRank.get(a.name);
  const rankB = orderRank.get(b.name);
  if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
  return a.name.localeCompare(b.name);
});

const missingRequired = expected.filter((name) => !byName.has(name));
const invalidNames = all.filter((f) => !f.validName).map((f) => ({ path: f.path, name: f.name }));
const rc433Candidates = uniqueNames.filter((f) => /rc433_/i.test(f.name)).map((f) => f.name);
const blockers = [];
if (missingDirectories.length) blockers.push({ kind: "missing_directory", items: missingDirectories });
if (invalidNames.length) blockers.push({ kind: "invalid_filename", items: invalidNames });
if (conflictingCopies.length) blockers.push({ kind: "same_name_different_content", items: conflictingCopies });
if (missingRequired.length) blockers.push({ kind: "required_source_missing", items: missingRequired });
if (collisionOrderErrors.length) blockers.push({ kind: "unreviewed_migration_version_collision", items: collisionOrderErrors });
if (collisions.length && !diagnosticReplay) blockers.push({ kind: "migration_version_collision", items: collisions });

const strictBlockers = blockers.filter((b) => b.kind !== "migration_version_collision");
const replayMayStart = strictBlockers.length === 0 && (!collisions.length || diagnosticReplay);
const report = {
  generatedAt: new Date().toISOString(),
  status: replayMayStart ? (diagnosticReplay && collisions.length ? "DIAGNOSTIC_ONLY" : "PASS") : "BLOCKED",
  purpose: diagnosticReplay
    ? "Diagnostic-only replay order. Collision tie-breaks use reviewed source-control addition chronology; this is not proof of production migration order and cannot certify the chain."
    : "Strict source preflight; not evidence of production application or successful SQL replay.",
  diagnosticReplay,
  certificationAllowed: !diagnosticReplay && collisions.length === 0 && blockers.length === 0,
  roots,
  counts: {
    migrationDirectorySqlFiles: all.filter((f) => f.root === roots[0]).length,
    recoveredDirectorySqlFiles: all.filter((f) => f.root === roots[1]).length,
    totalFilesIncludingMirrors: all.length,
    uniqueFilenames: uniqueNames.length,
    uniqueVersionCount: byVersion.size,
    versionCollisionGroups: collisions.length
  },
  expectedSources: expected.map((name) => ({ name, found: byName.has(name),
    locations: all.filter((f) => f.name === name).map((f) => f.path) })),
  rc433Audit: { result: rc433Candidates.length ? "SOURCE_FOUND" : "NO_SOURCE_FOUND",
    files: rc433Candidates,
    note: "Absence alone does not prove a missing applied migration; confirm the identifier against authoritative source/ledger evidence." },
  collisions,
  collisionTieBreakOrder: collisions.map((c) => ({version:c.version, order:collisionOrder.get(c.version) ?? null,
    basis:"source-control addition chronology; diagnostic only; not production application order"})),
  conflictingCopies,
  invalidNames,
  missingRequired,
  blockers,
  replayOrder: orderedFiles.map((f) => f.path),
  replayMayStart,
  certificationNote: "A successful diagnostic replay does not clear migration-version uniqueness or prove production ledger/source identity."
};

const reportArg = process.argv.findIndex((arg) => arg === "--report");
if (reportArg >= 0 && process.argv[reportArg + 1]) {
  const output = process.argv[reportArg + 1];
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify(report, null, 2));
if (!report.replayMayStart) {
  console.error("Migration replay BLOCKED by source-chain preflight. Resolve every blocker; do not skip files or rewrite applied history.");
  process.exit(1);
}
if (diagnosticReplay) console.warn("DIAGNOSTIC-ONLY MODE: migration version collisions remain unresolved; result cannot certify production readiness.");
