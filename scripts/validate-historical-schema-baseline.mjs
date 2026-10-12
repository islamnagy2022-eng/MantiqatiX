import fs from "node:fs";
import path from "node:path";

const migrationDirectory = "supabase/migrations";
const providerBaselinePath = "supabase/tests/baselines/smm_providers.sql";
const credentialsBaselinePath = "supabase/tests/baselines/smm_provider_credentials.sql";
const registrationBaselinePath = "supabase/tests/baselines/account_registration_requests.sql";
const marketingProfileBaselinePath = "supabase/tests/baselines/marketing_provider_profiles.sql";
const legacyBusinessesBaselinePath = "supabase/tests/baselines/legacy_businesses.sql";
const settlementBaselinePath = "supabase/tests/baselines/settlement_backend_10arg.sql";
const legacyProductsBaselinePath = "supabase/tests/baselines/legacy_products.sql";
const legacyOrdersBaselinePath = "supabase/tests/baselines/legacy_orders.sql";
const files = fs.readdirSync(migrationDirectory)
  .filter((name) => name.endsWith(".sql"))
  .sort();
const migrations = files.map((name) => ({
  name,
  sql: fs.readFileSync(path.join(migrationDirectory, name), "utf8"),
}));
const bookingsBaselinePath = "supabase/tests/baselines/bookings.sql";
const legacyBaselineSpecs = [
  { path: legacyBusinessesBaselinePath, table: "businesses", required: /id uuid primary key[\s\S]*name character varying\(255\) not null[\s\S]*code character varying\(64\) not null/i },
  { path: legacyProductsBaselinePath, table: "products", required: /id uuid primary key[\s\S]*business_id uuid not null references public\.businesses\(id\)[\s\S]*sku character varying\(128\) not null[\s\S]*name character varying\(255\) not null/i },
  { path: legacyOrdersBaselinePath, table: "orders", required: /id uuid primary key[\s\S]*business_id uuid not null references public\.businesses\(id\)[\s\S]*customer_id uuid[\s\S]*status character varying\(64\)/i },
  { path: bookingsBaselinePath, table: "bookings", required: /id uuid not null default gen_random_uuid\(\)[\s\S]*created_at timestamp without time zone[\s\S]*constraint bookings_pkey primary key\s*\(id\)/i },
];
for (const spec of legacyBaselineSpecs) {
  if (!fs.existsSync(spec.path)) {
    console.error("P0 BLOCKED: missing test-only baseline for pre-existing public." + spec.table + ": " + spec.path);
    process.exit(1);
  }
  const source = fs.readFileSync(spec.path, "utf8");
  if (!/OWNER-APPROVED TEST-ONLY LEGACY TABLE BASELINE/.test(source) ||
      !/2026-10-12/.test(source) ||
      !/moyhiluyhjsujhwlyeuu/.test(source) ||
      !/NOT recovered historical DDL/.test(source) ||
      !/Never apply this file to production/.test(source) ||
      !new RegExp("\\bcreate\\s+table\\s+(?:" + (spec.schema ? spec.schema + "\\s*\\.\\s*" : "public\\s*\\.\\s*") + ")?" + spec.table + "\\b","i").test(source) ||
      !spec.required.test(source) ||
      /^\s*(?:insert\s+into|copy\s+public\.)/im.test(source)) {
    console.error("P0 BLOCKED: legacy table baseline failed provenance/shape/no-data checks: " + spec.table);
    process.exit(1);
  }
}
const missingHistoricalTables = [
  { table: "marketing_provider_profiles", before: "20260927103103_add_provider_profile_media.sql", baselinePath: marketingProfileBaselinePath },
  { table: "account_registration_requests", before: "20260927134000_add_unique_pending_membership_request.sql", baselinePath: registrationBaselinePath },
  // RC production hardening enables RLS on bookings, but neither committed history nor the applied ledger creates it.
  // No fixture is authorized for this dependency; fail before starting disposable Supabase until source history is recovered.
  { table: "bookings", before: "20260919233425_production_security_hardening_v1.sql", baselinePath: bookingsBaselinePath },
].filter(({ table, before }) => {
  const prefix = migrations.filter(({ name }) => name < before);
  const createPattern = new RegExp(
    "\\bcreate\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(?:public\\s*\\.\\s*)?" + table + "\\b",
    "i"
  );
  return !prefix.some(({ sql }) => createPattern.test(sql));
});
for (const { table, before, baselinePath } of missingHistoricalTables) {
  if (!fs.existsSync(baselinePath)) {
    console.error("P0 BLOCKED: no approved isolated compatibility baseline exists for public." + table + " before " + before);
    process.exit(1);
  }
}
const registrationBaseline = fs.readFileSync(registrationBaselinePath, "utf8");
const registrationChecks = [
  ["registration baseline provenance", /OWNER-APPROVED TEST-ONLY SCHEMA BASELINE/.test(registrationBaseline) && /2026-10-12/.test(registrationBaseline) && /moyhiluyhjsujhwlyeuu/.test(registrationBaseline) && /NOT recovered historical creation DDL/.test(registrationBaseline) && /Never apply this file to production/.test(registrationBaseline)],
  ["registration columns, defaults and role/status checks", /user_id uuid not null/i.test(registrationBaseline) && /requested_role character varying\(40\) not null/i.test(registrationBaseline) && /status character varying\(20\) not null default 'PENDING'/i.test(registrationBaseline) && /metadata jsonb not null default '\{\}'::jsonb/i.test(registrationBaseline) && /requested_role_check[\s\S]*CUSTOMER[\s\S]*SERVICE_PROVIDER/i.test(registrationBaseline) && /status_check[\s\S]*APPROVED[\s\S]*REJECTED[\s\S]*CANCELLED/i.test(registrationBaseline)],
  ["registration user foreign key and RLS", /references auth\.users\(id\) on delete cascade/i.test(registrationBaseline) && /enable row level security/i.test(registrationBaseline) && /account_registration_requests_self_insert[\s\S]*to authenticated/i.test(registrationBaseline)],
  ["pending unique index intentionally left to its ordered migration", !/create unique index account_registration_requests_pending_role_uidx/i.test(registrationBaseline)],
];
const marketingProfileBaseline = fs.readFileSync(marketingProfileBaselinePath, "utf8");
const marketingProfileChecks = [
  ["provider profile baseline provenance", /OWNER-APPROVED TEST-ONLY SCHEMA BASELINE/.test(marketingProfileBaseline) && /2026-10-12/.test(marketingProfileBaseline) && /moyhiluyhjsujhwlyeuu/.test(marketingProfileBaseline) && /NOT recovered historical creation DDL/.test(marketingProfileBaseline) && /Never apply this file to production/.test(marketingProfileBaseline)],
  ["provider profile observed columns and constraints", /provider_kind character varying not null/i.test(marketingProfileBaseline) && /owner_user_id uuid/i.test(marketingProfileBaseline) && /name_ar character varying not null/i.test(marketingProfileBaseline) && /specialties jsonb not null default '\[\]'/i.test(marketingProfileBaseline) && /unique \(slug\)/i.test(marketingProfileBaseline) && /OFFICIAL[\s\S]*PARTNER_COMPANY[\s\S]*FREELANCER/i.test(marketingProfileBaseline)],
  ["profile image column remains owned by ordered migration", !/^\s*profile_image_path\s+/im.test(marketingProfileBaseline)],
  ["provider profile forced RLS and public active-only read", /enable row level security/i.test(marketingProfileBaseline) && /force row level security/i.test(marketingProfileBaseline) && /Public can view active marketing providers[\s\S]*to anon, authenticated[\s\S]*using \(status = 'ACTIVE'\)/i.test(marketingProfileBaseline)],
];
const tableBaselineFailures = [...registrationChecks, ...marketingProfileChecks].filter(([, ok]) => !ok);
if (tableBaselineFailures.length) {
  for (const [name] of tableBaselineFailures) console.error("P0 BLOCKED: table baseline validation failed: " + name);
  process.exit(1);
}
if (missingHistoricalTables.length) {
  console.warn("P0 LIMITATION: live-derived table compatibility baselines are injected only into disposable CI; they do NOT recover or certify historical table-creation provenance.");
}

const firstCredentialReference = migrations.find(({ sql }) =>
  /smm_provider_credentials/i.test(sql)
);
const createsCredentialsTable = migrations.some(({ sql }) =>
  /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:(?:"?public"?)\s*\.\s*)?"?smm_provider_credentials"?\b/i.test(sql)
);
const createsProvidersTable = migrations.some(({ sql }) =>
  /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:(?:"?public"?)\s*\.\s*)?"?smm_providers"?\b/i.test(sql)
);
const providerBaselineVersion = "20260927074158";
const credentialsBaselineVersion = "20260927074159";

for (const baselinePath of [providerBaselinePath, credentialsBaselinePath]) {
  if (!fs.existsSync(baselinePath)) {
    console.error("P0 BLOCKED: owner-approved test-only schema baseline is missing at " + baselinePath);
    process.exit(1);
  }
}

const providerBaseline = fs.readFileSync(providerBaselinePath, "utf8");
const providerChecks = [
  ["observed provider columns and defaults", /id\s+uuid\s+not\s+null\s+default\s+gen_random_uuid\(\)/i.test(providerBaseline) && /name\s+text\s+not\s+null/i.test(providerBaseline) && /api_url\s+text\s+not\s+null/i.test(providerBaseline) && /api_style\s+text\s+not\s+null\s+default\s+'generic'/i.test(providerBaseline) && /active\s+boolean\s+not\s+null\s+default\s+false/i.test(providerBaseline) && /priority\s+integer\s+not\s+null\s+default\s+100/i.test(providerBaseline) && /created_at\s+timestamptz\s+not\s+null\s+default\s+now\(\)/i.test(providerBaseline) && /updated_at\s+timestamptz\s+not\s+null\s+default\s+now\(\)/i.test(providerBaseline)],
  ["provider primary key and unique name", /primary\s+key\s*\(\s*id\s*\)/i.test(providerBaseline) && /unique\s*\(\s*name\s*\)/i.test(providerBaseline)],
  ["provider RLS and deny-authenticated policy", /enable\s+row\s+level\s+security/i.test(providerBaseline) && /deny_direct_access_authenticated[\s\S]*to\s+authenticated[\s\S]*using\s*\(\s*false\s*\)[\s\S]*with\s+check\s*\(\s*false\s*\)/i.test(providerBaseline)],
  ["provider service_role grants match observed snapshot", /grant\s+references\s*,\s*trigger\s*,\s*truncate[\s\S]*to\s+service_role/i.test(providerBaseline) && /revoke\s+all[\s\S]*from\s+public\s*,\s*anon\s*,\s*authenticated\s*,\s*service_role/i.test(providerBaseline)],
  ["provider baseline has production source provenance and is test-only", /moyhiluyhjsujhwlyeuu/i.test(providerBaseline) && /read-only PostgreSQL catalog introspection/i.test(providerBaseline) && /TEST-ONLY SCHEMA BASELINE/i.test(providerBaseline) && /Never apply this file to production/i.test(providerBaseline)],
];

const credentialsBaseline = fs.readFileSync(credentialsBaselinePath, "utf8");
const credentialsChecks = [
  ["provider_id UUID primary key", /provider_id\s+uuid\s+not\s+null/i.test(credentialsBaseline) && /primary\s+key\s*\(\s*provider_id\s*\)/i.test(credentialsBaseline)],
  ["encrypted key remains nullable text", /api_key_ciphertext\s+text\s*,/i.test(credentialsBaseline)],
  ["configured defaults false", /configured\s+boolean\s+not\s+null\s+default\s+false/i.test(credentialsBaseline)],
  ["updated_at defaults now", /updated_at\s+timestamptz\s+not\s+null\s+default\s+now\(\)/i.test(credentialsBaseline)],
  ["FK references smm_providers with cascade", /foreign\s+key\s*\(\s*provider_id\s*\)[\s\S]*references\s+public\.smm_providers\s*\(\s*id\s*\)[\s\S]*on\s+delete\s+cascade/i.test(credentialsBaseline)],
  ["credentials RLS is enabled", /enable\s+row\s+level\s+security/i.test(credentialsBaseline)],
  ["credentials client access is denied by policy", /to\s+anon\s*,\s*authenticated[\s\S]*using\s*\(\s*false\s*\)[\s\S]*with\s+check\s*\(\s*false\s*\)/i.test(credentialsBaseline)],
  ["credentials baseline is explicitly test-only", /TEST-ONLY SCHEMA BASELINE/i.test(credentialsBaseline) && /Never apply this file to production/i.test(credentialsBaseline)],
];

const failed = [...providerChecks, ...credentialsChecks].filter(([, ok]) => !ok);
if (failed.length) {
  for (const [name] of failed) console.error("P0 BLOCKED: test baseline validation failed: " + name);
  process.exit(1);
}
if (createsCredentialsTable || createsProvidersTable) {
  console.error("P0 BLOCKED: do not add guessed/backdated production migrations for the SMM baseline tables; reconcile any authoritative historical creation migration before replay.");
  process.exit(1);
}
if (!firstCredentialReference) {
  console.error("P0 BLOCKED: no migration references smm_provider_credentials; expected historical privilege migration was not found.");
  process.exit(1);
}
const legacyPrivilegeMigration = migrations.find(({ name }) =>
  name === "20260927095000_revoke_unused_security_definer_execute.sql"
);
if (!legacyPrivilegeMigration) {
  console.error("P0 BLOCKED: expected legacy SECURITY DEFINER privilege migration is missing.");
  process.exit(1);
}
// Fail early when a privilege-lockdown migration revokes an overload that no earlier
// committed migration creates. Do not repair this by editing applied history or stubbing
// a privileged function: recover authoritative DDL or obtain explicit approval for a
// separately versioned, disposable-only live-derived baseline.
const settlementTemporaryMigrationPath = "supabase/migrations/20260920095705_test_only_live_derived_settlement_baseline.sql";
if (fs.existsSync(settlementTemporaryMigrationPath)) {
  console.error("P0 BLOCKED: disposable-only settlement baseline migration exists as a tracked/source migration. It must be injected by CI into a fresh disposable database and never committed under supabase/migrations/.");
  process.exit(1);
}
const settlementLockdownVersion = "20260920095706";
const settlementLockdown = migrations.find(({ name }) => name === settlementLockdownVersion + "_production_security_definer_execute_lockdown_v4.sql");
if (settlementLockdown) {
  const settlementRevoke = /revoke\s+execute\s+on\s+function\s+public\.create_settlement_backend\s*\(\s*varchar\s*,\s*varchar\s*,\s*varchar\s*,\s*varchar\s*,\s*numeric\s*,\s*numeric\s*,\s*numeric\s*,\s*numeric\s*,\s*varchar\s*,\s*varchar\s*\)/i;
  const revokesTenArgSettlement = settlementRevoke.test(settlementLockdown.sql);
  const settlementBaseline = fs.existsSync(settlementBaselinePath)
    ? fs.readFileSync(settlementBaselinePath, "utf8")
    : "";
  const settlementBaselineValid =
    /TEST-ONLY LIVE-DERIVED SETTLEMENT FUNCTION BASELINE/.test(settlementBaseline) &&
    /moyhiluyhjsujhwlyeuu/.test(settlementBaseline) &&
    /NOT recovered historical creation DDL/.test(settlementBaseline) &&
    /MUST NOT be applied to production/.test(settlementBaseline) &&
    /CREATE OR REPLACE FUNCTION public\.create_settlement_backend\s*\(\s*p_id\s+character varying\s*,\s*p_tenant_id\s+character varying\s*,\s*p_beneficiary_type\s+character varying\s*,\s*p_beneficiary_id\s+character varying\s*,\s*p_gross\s+numeric\s*,\s*p_platform_fee\s+numeric\s*,\s*p_net\s+numeric\s*,\s*p_voucher\s+numeric\s*,\s*p_channel\s+character varying\s*,\s*p_reference_id\s+character varying\s*\)\s*RETURNS jsonb/i.test(settlementBaseline) &&
    /SECURITY DEFINER/i.test(settlementBaseline) &&
    /SET search_path TO 'public'/i.test(settlementBaseline) &&
    /REVOKE ALL ON FUNCTION public\.create_settlement_backend\(varchar,varchar,varchar,varchar,numeric,numeric,numeric,numeric,varchar,varchar\) FROM PUBLIC, anon, authenticated, service_role;/i.test(settlementBaseline) &&
    /GRANT EXECUTE ON FUNCTION public\.create_settlement_backend\(varchar,varchar,varchar,varchar,numeric,numeric,numeric,numeric,varchar,varchar\) TO service_role;/i.test(settlementBaseline);
  const priorTenArgSettlementCreation = migrations.some(({ name, sql }) =>
    name < settlementLockdown.name &&
    /create\s+(?:or\s+replace\s+)?function\s+public\.create_settlement_backend\s*\(\s*(?:[a-z_][a-z0-9_]*\s+)?(?:varchar|character\s+varying)\s*,\s*(?:[a-z_][a-z0-9_]*\s+)?(?:varchar|character\s+varying)\s*,\s*(?:[a-z_][a-z0-9_]*\s+)?(?:varchar|character\s+varying)\s*,\s*(?:[a-z_][a-z0-9_]*\s+)?(?:varchar|character\s+varying)\s*,\s*(?:[a-z_][a-z0-9_]*\s+)?numeric\s*,\s*(?:[a-z_][a-z0-9_]*\s+)?numeric\s*,\s*(?:[a-z_][a-z0-9_]*\s+)?numeric\s*,\s*(?:[a-z_][a-z0-9_]*\s+)?numeric\s*,\s*(?:[a-z_][a-z0-9_]*\s+)?(?:varchar|character\s+varying)\s*,\s*(?:[a-z_][a-z0-9_]*\s+)?(?:varchar|character\s+varying)\s*\)/i.test(sql)
  ) || settlementBaselineValid;
  if (revokesTenArgSettlement && !priorTenArgSettlementCreation) {
    console.error("P0 BLOCKED: " + settlementLockdown.name + " revokes the 10-argument create_settlement_backend overload, but neither earlier committed migration DDL nor a validated disposable-only baseline defines it.");
    console.error("Do not rewrite applied migration history or synthesize a privileged function. Recover authoritative historical creation DDL or validate the separately versioned disposable-only baseline.");
    process.exit(1);
  }
  if (revokesTenArgSettlement && settlementBaselineValid) {
    console.warn("P0 LIMITATION: the 10-argument settlement function is sourced from a read-only live catalog snapshot for disposable replay only; this does NOT recover historical DDL or certify production migration provenance.");
  }
}

const legacyFunctionSignatures = [
  { name: "counter_offer_indrive_bid", args: "uuid,uuid,numeric" },
  { name: "fashion_erp_mutate", args: "text,jsonb,text" },
  { name: "mantigo_accept_bid", args: "text,text" },
  { name: "mantigo_cancel_ride", args: "text" },
  { name: "mantigo_create_ride", args: "text,text,text,text,numeric,text" },
  { name: "mantigo_rate_ride", args: "text,integer,text" },
  { name: "mantigo_submit_bid", args: "text,numeric,text,text,text,text" },
  { name: "mantigo_update_proposed_price", args: "text,numeric" },
  { name: "restaurant_erp_mutate", args: "text,jsonb,text" },
  { name: "restaurant_table_mutate", args: "text,jsonb,text" },
];
const legacyFunctionBaselinePath = "supabase/tests/baselines/legacy_security_definer_functions.sql";
const legacyFunctionBaseline = fs.existsSync(legacyFunctionBaselinePath)
  ? fs.readFileSync(legacyFunctionBaselinePath, "utf8")
  : "";
const liveDerivedProvenanceValid =
  /TEST-ONLY LIVE-DERIVED FUNCTION BASELINE/.test(legacyFunctionBaseline) &&
  /moyhiluyhjsujhwlyeuu/.test(legacyFunctionBaseline) &&
  /NOT recovered historical creation DDL/.test(legacyFunctionBaseline) &&
  /MUST NOT be applied to production/.test(legacyFunctionBaseline);

function normalizeFixtureTypes(rawArgs) {
  return rawArgs.split(",").map((part) =>
    part.trim().replace(/\s+DEFAULT\s+[\s\S]*$/i, "").trim().split(/\s+/).slice(1).join(" ").toLowerCase()
  ).join(",");
}

function fixtureHasValidFunction({ name, args }) {
  if (!liveDerivedProvenanceValid) return false;
  const declaration = new RegExp(
    "CREATE OR REPLACE FUNCTION public\\." + name + "\\s*\\(([\\s\\S]*?)\\)\\s*RETURNS\\b",
    "i"
  );
  const match = legacyFunctionBaseline.match(declaration);
  if (!match || normalizeFixtureTypes(match[1]) !== args.replace(/\s+/g, "").toLowerCase()) return false;
  const start = legacyFunctionBaseline.search(declaration);
  const remainder = legacyFunctionBaseline.slice(start);
  const nextFunction = remainder.slice(1).search(/\nCREATE OR REPLACE FUNCTION public\./i);
  const block = nextFunction < 0 ? remainder : remainder.slice(0, nextFunction + 1);
  const exactAcl = new RegExp(
    "REVOKE ALL ON FUNCTION public\\." + name + "\\(" + args.replace(/\s+/g, "") +
    "\\) FROM PUBLIC, anon, authenticated, service_role;",
    "i"
  ).test(legacyFunctionBaseline);
  return /\bSECURITY DEFINER\b/i.test(block) &&
    /\bSET search_path TO\b/i.test(block) &&
    exactAcl;
}

const fixtureMissingFunctions = legacyFunctionSignatures.filter((signature) => !fixtureHasValidFunction(signature));
const rateGrantValid = /GRANT EXECUTE ON FUNCTION public\.mantigo_rate_ride\(text,integer,text\) TO authenticated;/i.test(legacyFunctionBaseline);
if (!liveDerivedProvenanceValid || fixtureMissingFunctions.length || !rateGrantValid) {
  console.error("P0 BLOCKED: the isolated live-derived function fixture failed provenance, signature, SECURITY DEFINER, search_path, or ACL validation.");
  if (!liveDerivedProvenanceValid) console.error(" - missing explicit test-only/live-derived/non-production provenance");
  for (const { name, args } of fixtureMissingFunctions) console.error(" - invalid fixture definition or ACL: public." + name + "(" + args + ")");
  if (!rateGrantValid) console.error(" - missing observed authenticated EXECUTE exception for mantigo_rate_ride");
  process.exit(1);
}

const unresolvedLegacyFunctions = legacyFunctionSignatures.filter(({ name, args }) => {
  const normalizedSignature = ("public." + name + "(" + args + ")").replace(/\s+/g, "").toLowerCase();
  const creation = migrations.find(({ name: migrationName, sql }) =>
    migrationName.slice(0, 14) < legacyPrivilegeMigration.name.slice(0, 14) &&
    new RegExp("\\bcreate\\s+(?:or\\s+replace\\s+)?function\\s+(?:public\\s*\\.\\s*)?" + name + "\\s*\\(", "i").test(sql) &&
    sql.replace(/\s+/g, "").toLowerCase().includes(normalizedSignature)
  );
  return !creation && !fixtureHasValidFunction({ name, args });
});
if (unresolvedLegacyFunctions.length) {
  console.error("P0 BLOCKED: required legacy SECURITY DEFINER function dependencies are missing from both committed earlier migrations and the validated isolated test fixture:");
  for (const { name, args } of unresolvedLegacyFunctions) console.error(" - public." + name + "(" + args + ")");
  console.error("Do not add placeholders or apply this fixture to production. Recover authoritative historical creation DDL to certify provenance.");
  process.exit(1);
}
console.warn("P0 LIMITATION: fixture is live-derived test-only compatibility scaffolding; it is not historical DDL and cannot certify historical function-body provenance.");
console.warn("A successful replay validates migrations after this synthetic baseline only; it does NOT prove historical function-body fidelity or certify production migration provenance.");
if (firstCredentialReference.name.slice(0, 14) <= credentialsBaselineVersion) {
  console.error("P0 BLOCKED: test-only provider and credentials baselines must sort before the first migration that references them.");
  process.exit(1);
}
for (const [version, temporaryName] of [
  [providerBaselineVersion, providerBaselineVersion + "_test_only_approved_smm_providers_baseline.sql"],
  [credentialsBaselineVersion, credentialsBaselineVersion + "_test_only_approved_smm_provider_credentials_baseline.sql"],
]) {
  if (fs.existsSync(path.join(migrationDirectory, temporaryName))) {
    console.error("P0 BLOCKED: temporary test-only migration filename already exists in repository: " + temporaryName);
    process.exit(1);
  }
}
console.log("Disposable compatibility preflight PASS: legacy pre-existing table fixtures, core live-derived table baselines, approved SMM fixtures, and live-derived function compatibility fixture validated.");
console.warn("This is not proof of a clean historical replay: test-only live-derived baselines replace missing historical DDL only in disposable CI.");
