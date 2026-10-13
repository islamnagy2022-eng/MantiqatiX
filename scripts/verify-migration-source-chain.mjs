import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const roots = ["supabase/migrations", "supabase/recovered-migrations"];
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
    all.push({
      root,
      name,
      path: fullPath,
      version: match?.[1] ?? null,
      validName: Boolean(match),
      sha256: sha256(fs.readFileSync(fullPath))
    });
  }
}

const byName = new Map();
const conflictingCopies = [];
for (const file of all) {
  const existing = byName.get(file.name);
  if (!existing) byName.set(file.name, file);
  else if (existing.sha256 !== file.sha256) {
    conflictingCopies.push({ name: file.name, paths: [existing.path, file.path], sha256: [existing.sha256, file.sha256] });
  }
}
const uniqueNames = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
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

const missingRequired = expected.filter((name) => !byName.has(name));
const invalidNames = all.filter((f) => !f.validName).map((f) => ({ path: f.path, name: f.name }));
const rc433Candidates = uniqueNames.filter((f) => /rc433_/i.test(f.name)).map((f) => f.name);
const blockers = [];
if (missingDirectories.length) blockers.push({ kind: "missing_directory", items: missingDirectories });
if (invalidNames.length) blockers.push({ kind: "invalid_filename", items: invalidNames });
if (conflictingCopies.length) blockers.push({ kind: "same_name_different_content", items: conflictingCopies });
if (missingRequired.length) blockers.push({ kind: "required_source_missing", items: missingRequired });
if (collisions.length) blockers.push({ kind: "migration_version_collision", items: collisions });

const report = {
  generatedAt: new Date().toISOString(),
  status: blockers.length ? "BLOCKED" : "PASS",
  purpose: "Source preflight only; not evidence of production application or successful SQL replay.",
  roots,
  counts: {
    migrationDirectorySqlFiles: all.filter((f) => f.root === roots[0]).length,
    recoveredDirectorySqlFiles: all.filter((f) => f.root === roots[1]).length,
    totalFilesIncludingMirrors: all.length,
    uniqueFilenames: uniqueNames.length,
    uniqueVersionCount: byVersion.size,
    versionCollisionGroups: collisions.length
  },
  expectedSources: expected.map((name) => ({ name, found: byName.has(name), locations: all.filter((f) => f.name === name).map((f) => f.path) })),
  rc433Audit: {
    result: rc433Candidates.length ? "SOURCE_FOUND" : "NO_SOURCE_FOUND",
    files: rc433Candidates,
    note: "The surrounding RC425–RC441 range was requested for review, but the current PR's explicit required-source list omits RC433. Confirm from authoritative task/ledger evidence whether RC433 was ever a defined migration; absence alone does not prove a missing applied migration."
  },
  collisions,
  conflictingCopies,
  invalidNames,
  missingRequired,
  blockers,
  replayMayStart: blockers.length === 0
};

const reportArg = process.argv.findIndex((arg) => arg === "--report");
if (reportArg >= 0 && process.argv[reportArg + 1]) {
  const output = process.argv[reportArg + 1];
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify(report, null, 2));
if (!report.replayMayStart) {
  console.error("Migration clean replay BLOCKED by source-chain preflight. Resolve every blocker; do not skip files or rewrite applied history.");
  process.exit(1);
}
console.log("Migration source-chain preflight PASS. A PostgreSQL replay is still required.");
