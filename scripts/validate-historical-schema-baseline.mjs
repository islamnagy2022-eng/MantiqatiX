import fs from "node:fs";
import path from "node:path";

const migrationDirectory = "supabase/migrations";
const providerBaselinePath = "supabase/tests/baselines/smm_providers.sql";
const credentialsBaselinePath = "supabase/tests/baselines/smm_provider_credentials.sql";
const registrationBaselinePath = "supabase/tests/baselines/account_registration_requests_schema.sql";
const registrationSecurityBaselinePath = "supabase/tests/baselines/account_registration_requests.sql";
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
  // The candidate has an early credit-status function migration that references the
  // credit tables before any committed creation migration. The owner has now approved
  // separately labeled live-derived table-shape fixtures for disposable CI only. The
  // fixtures deliberately do not claim historical provenance and do not inject rows or
  // recreate live-only restrictive policies whose creation history is absent from the ledger.
  { table: "credit_policies", before: "20260920155456_harden_credit_status_authorization.sql", baselinePath: "supabase/tests/baselines/credit_policies.sql" },
  { table: "credit_accounts", before: "20260920155456_harden_credit_status_authorization.sql", baselinePath: "supabase/tests/baselines/credit_accounts.sql" },
  { table: "credit_periods", before: "20260920155456_harden_credit_status_authorization.sql", baselinePath: "supabase/tests/baselines/credit_periods.sql" },
  { table: "marketing_provider_profiles", before: "20260927103103_add_provider_profile_media.sql", baselinePath: marketingProfileBaselinePath },
  { table: "account_registration_requests", before: "20260927065247_mnty_atomic_registration_review.sql", baselinePath: registrationBaselinePath },
  // RC production hardening enables RLS on bookings, but neither committed history nor the applied ledger creates it.
  { table: "bookings", before: "20260919233425_production_security_hardening_v1.sql", baselinePath: bookingsBaselinePath },
  // Live catalog evidence provides an exact schema-only compatibility shape. The finance-read policy
  // remains owned by its chronological migration and is never duplicated in this fixture.
  { table: "settlement_attempts", before: "20260920211717_security_definer_surface_reduction_and_finance_rls.sql", baselinePath: "supabase/tests/baselines/settlement_attempts.sql" },
  { table: "payment_provider_events", before: "20260920211717_security_definer_surface_reduction_and_finance_rls.sql", baselinePath: "supabase/tests/baselines/payment_provider_events.sql" },
].filter(({ table, before }) => {
  const prefix = migrations.filter(({ name }) => name < before);
  const createPattern = new RegExp(
    "\\bcreate\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(?:public\\s*\\.\\s*)?" + table + "\\b",
    "i"
  );
  return !prefix.some(({ sql }) => createPattern.test(sql));
});
const missingBaselines = missingHistoricalTables.filter(({ baselinePath }) => !fs.existsSync(baselinePath));
if (missingBaselines.length > 0) {
  for (const { table, before, baselinePath } of missingBaselines) {
    console.error(
      "P0 BLOCKED: no approved isolated compatibility baseline exists for public." +
      table + " before " + before + " (expected " + baselinePath + ")"
    );
  }
  process.exit(1);
}
// Validate the financial compatibility fixture against read-only catalog evidence. It is schema-only:
// the historical migration remains the sole source of payment_provider_events_finance_read.
const paymentProviderEventsBaselinePath = "supabase/tests/baselines/payment_provider_events.sql";
const paymentProviderEventsBaseline = fs.readFileSync(paymentProviderEventsBaselinePath, "utf8");
const paymentProviderEventsMigration = migrations.find(({ name }) =>
  name === "20260920211717_security_definer_surface_reduction_and_finance_rls.sql"
);
const paymentProviderEventsBaselineValid =
  /READ-ONLY CATALOG-VERIFIED TEST-ONLY COMPATIBILITY BASELINE/.test(paymentProviderEventsBaseline) &&
  /2026-10-13/.test(paymentProviderEventsBaseline) &&
  /moyhiluyhjsujhwlyeuu/.test(paymentProviderEventsBaseline) &&
  /not recovered historical creation DDL/i.test(paymentProviderEventsBaseline) &&
  /NEVER apply this file to production/.test(paymentProviderEventsBaseline) &&
  /create table public\.payment_provider_events/i.test(paymentProviderEventsBaseline) &&
  /id character varying not null/i.test(paymentProviderEventsBaseline) &&
  /tenant_id character varying not null/i.test(paymentProviderEventsBaseline) &&
  /provider character varying not null/i.test(paymentProviderEventsBaseline) &&
  /event_type character varying not null/i.test(paymentProviderEventsBaseline) &&
  /payment_intent_id character varying[\s\S]*references public\.payment_intents\(id\) on delete set null/i.test(paymentProviderEventsBaseline) &&
  /external_event_id character varying not null/i.test(paymentProviderEventsBaseline) &&
  /status character varying not null default 'RECEIVED'/i.test(paymentProviderEventsBaseline) &&
  /signature_verified boolean not null default false/i.test(paymentProviderEventsBaseline) &&
  /payload_hash character varying/i.test(paymentProviderEventsBaseline) &&
  /raw_payload jsonb not null default '\{\}'::jsonb/i.test(paymentProviderEventsBaseline) &&
  /processed_at timestamp with time zone/i.test(paymentProviderEventsBaseline) &&
  /error_message text/i.test(paymentProviderEventsBaseline) &&
  /created_at timestamp with time zone not null default current_timestamp/i.test(paymentProviderEventsBaseline) &&
  /primary key \(id\)/i.test(paymentProviderEventsBaseline) &&
  /unique \(provider, external_event_id\)/i.test(paymentProviderEventsBaseline) &&
  /references public\.tenants\(id\) on delete restrict/i.test(paymentProviderEventsBaseline) &&
  /enable row level security/i.test(paymentProviderEventsBaseline) &&
  /force row level security/i.test(paymentProviderEventsBaseline) &&
  !/create policy|\bgrant\b|\brevoke\b/i.test(paymentProviderEventsBaseline) &&
  !/^\s*(?:insert\s+into|copy\s+(?:public|private)\.)/im.test(paymentProviderEventsBaseline);
if (!paymentProviderEventsBaselineValid) {
  console.error("P0 BLOCKED: payment_provider_events schema-only baseline failed catalog-evidence, RLS, no-policy/no-grant, or no-data checks.");
  process.exit(1);
}
if (paymentProviderEventsMigration) {
  const paymentEventIndexesMigration = migrations.find(({ name }) =>
    name === "20261002100000_rc256_critical_fk_indexes.sql"
  );
  if (!paymentEventIndexesMigration ||
      !/create index if not exists idx_payment_provider_events_tenant_id on public\.payment_provider_events \(tenant_id\)/i.test(paymentEventIndexesMigration.sql) ||
      !/create index idx_payment_provider_events_payment_intent_id on public\.payment_provider_events \(payment_intent_id\)/i.test(paymentProviderEventsBaseline)) {
    console.error("P0 BLOCKED: the catalog-derived payment_provider_events baseline or chronological RC256 tenant index migration is missing its expected index contract.");
    process.exit(1);
  }
  const paymentEventBaselineVersion = "20260920211716";
  const paymentEventBaselineName = paymentEventBaselineVersion + "_test_only_live_derived_payment_provider_events_baseline.sql";
  if (fs.existsSync(path.join(migrationDirectory, paymentEventBaselineName)) ||
      migrations.some(({ name }) => name.slice(0, 14) === paymentEventBaselineVersion) ||
      paymentEventBaselineVersion >= paymentProviderEventsMigration.name.slice(0, 14)) {
    console.error("P0 BLOCKED: payment_provider_events temporary baseline version collides with repository history or sorts after its dependent policy migration.");
    process.exit(1);
  }
  if (!/CREATE POLICY payment_provider_events_finance_read[\s\S]*ON public\.payment_provider_events[\s\S]*FOR SELECT TO authenticated[\s\S]*m\.role IN \('OWNER','ADMIN','FINANCE','ACCOUNTANT','FINANCE_MANAGER'\)/i.test(paymentProviderEventsMigration.sql)) {
    console.error("P0 BLOCKED: ordered finance-read policy migration differs from the documented security contract; do not synthesize or replace its policy.");
    process.exit(1);
  }
}

// Validate the catalog-derived policy that the historical migration alters but no earlier
// committed migration creates. It is a policy-only fixture, never table DDL or a production change.
const approvalPolicyBaselinePath = "supabase/tests/baselines/approval_requests_scoped_read.sql";
const approvalPolicyBaseline = fs.readFileSync(approvalPolicyBaselinePath, "utf8");
const approvalPolicyVersion = "20260927140499";
const approvalPolicyTemporaryName = approvalPolicyVersion + "_test_only_live_derived_approval_requests_scoped_read.sql";
const approvalPolicyMigration = migrations.find(({ name }) =>
  name === "20260927140500_remove_anonymous_sensitive_policy_access_v2.sql"
);
const approvalPolicyPriorCreation = migrations.some(({ name, sql }) =>
  name.slice(0, 14) < approvalPolicyMigration?.name.slice(0, 14) &&
  /create\s+policy\s+approval_requests_scoped_read\s+on\s+(?:public\s*\.\s*)?approval_requests\b/i.test(sql)
);
const approvalPolicyBaselineValid =
  /READ-ONLY CATALOG-DERIVED TEST-ONLY POLICY COMPATIBILITY BASELINE/.test(approvalPolicyBaseline) &&
  /2026-10-13/.test(approvalPolicyBaseline) &&
  /moyhiluyhjsujhwlyeuu/.test(approvalPolicyBaseline) &&
  /NOT recovered historical policy-creation DDL/i.test(approvalPolicyBaseline) &&
  /MUST NOT be applied to production/i.test(approvalPolicyBaseline) &&
  /CREATE POLICY approval_requests_scoped_read[\s\S]*ON public\.approval_requests[\s\S]*FOR SELECT TO authenticated/i.test(approvalPolicyBaseline) &&
  /approval_requests\.requested_by = auth\.uid\(\)/i.test(approvalPolicyBaseline) &&
  /um\.role::text = ANY[\s\S]*OWNER[\s\S]*ADMIN[\s\S]*SUPER_ADMIN[\s\S]*MANAGER/i.test(approvalPolicyBaseline) &&
  !/create table|alter table|\bgrant\b|\brevoke\b|create trigger/i.test(approvalPolicyBaseline) &&
  !/^\s*(?:insert\s+into|copy\s+(?:public|private)\.)/im.test(approvalPolicyBaseline);
if (!approvalPolicyMigration || approvalPolicyPriorCreation || !approvalPolicyBaselineValid ||
    fs.existsSync(path.join(migrationDirectory, approvalPolicyTemporaryName)) ||
    migrations.some(({ name }) => name.slice(0, 14) === approvalPolicyVersion) ||
    approvalPolicyVersion >= approvalPolicyMigration.name.slice(0, 14) ||
    !/alter policy approval_requests_scoped_read on public\.approval_requests to authenticated;/i.test(approvalPolicyMigration.sql)) {
  console.error("P0 BLOCKED: approval_requests_scoped_read compatibility fixture or its ordered ALTER POLICY contract is invalid.");
  process.exit(1);
}

// Validate the read-only live-derived SMM trigger function required by the historical
// privilege-lockdown migration. It is definition-only; replay never invokes the trigger.
const smmBootstrapBaselinePath = "supabase/tests/baselines/smm_bootstrap_first_admin.sql";
const smmBootstrapBaseline = fs.readFileSync(smmBootstrapBaselinePath, "utf8");
const smmBootstrapLockdownMigration = migrations.find(({ name }) =>
  name === "20260927033925_harden_smm_bootstrap_trigger_execute_privilege.sql"
);
const smmBootstrapBaselineVersion = "20260927033924";
const smmBootstrapTemporaryName = smmBootstrapBaselineVersion + "_test_only_live_derived_smm_bootstrap_first_admin.sql";
const smmBootstrapPriorCreation = migrations.some(({ name, sql }) =>
  name.slice(0, 14) < smmBootstrapLockdownMigration?.name.slice(0, 14) &&
  /create\s+(?:or\s+replace\s+)?function\s+(?:public\s*\.\s*)?smm_bootstrap_first_admin\s*\(/i.test(sql)
);
const smmBootstrapBaselineValid =
  /TEST-ONLY LIVE-DERIVED FUNCTION BASELINE/.test(smmBootstrapBaseline) &&
  /2026-10-13/.test(smmBootstrapBaseline) &&
  /moyhiluyhjsujhwlyeuu/.test(smmBootstrapBaseline) &&
  /NOT recovered historical creation DDL/.test(smmBootstrapBaseline) &&
  /MUST NOT be applied to production/.test(smmBootstrapBaseline) &&
  /CREATE OR REPLACE FUNCTION public\.smm_bootstrap_first_admin\(\)/i.test(smmBootstrapBaseline) &&
  /RETURNS trigger/i.test(smmBootstrapBaseline) &&
  /LANGUAGE plpgsql/i.test(smmBootstrapBaseline) &&
  /SECURITY DEFINER/i.test(smmBootstrapBaseline) &&
  /SET search_path TO 'public'/i.test(smmBootstrapBaseline) &&
  /if not exists\(select 1 from public\.smm_admins\)/i.test(smmBootstrapBaseline) &&
  /insert into public\.smm_admins\(user_id\) values\(new\.id\) on conflict do nothing/i.test(smmBootstrapBaseline) &&
  /return new;/i.test(smmBootstrapBaseline) &&
  !/CREATE TRIGGER|\bgrant\b|\brevoke\b/i.test(smmBootstrapBaseline);
if (!smmBootstrapLockdownMigration || smmBootstrapPriorCreation || !smmBootstrapBaselineValid ||
    fs.existsSync(path.join(migrationDirectory, smmBootstrapTemporaryName)) ||
    migrations.some(({ name }) => name.slice(0, 14) === smmBootstrapBaselineVersion) ||
    smmBootstrapBaselineVersion >= smmBootstrapLockdownMigration.name.slice(0, 14) ||
    !/revoke execute on function public\.smm_bootstrap_first_admin\(\) from public, anon, authenticated;/i.test(smmBootstrapLockdownMigration.sql)) {
  console.error("P0 BLOCKED: live-derived smm_bootstrap_first_admin fixture or its ordered EXECUTE lockdown contract is invalid.");
  process.exit(1);
}

// Validate the live-derived settlement_attempts compatibility fixture. The historical
// finance-read policy remains in the ordered security migration and is not copied into this baseline.
const settlementAttemptsBaselinePath = "supabase/tests/baselines/settlement_attempts.sql";
const settlementAttemptsBaseline = fs.readFileSync(settlementAttemptsBaselinePath, "utf8");
const settlementAttemptsPolicyMigration = migrations.find(({ name }) =>
  name === "20260920211717_security_definer_surface_reduction_and_finance_rls.sql"
);
const settlementAttemptsBaselineValid =
  /READ-ONLY CATALOG-VERIFIED TEST-ONLY COMPATIBILITY BASELINE/.test(settlementAttemptsBaseline) &&
  /2026-10-13/.test(settlementAttemptsBaseline) &&
  /moyhiluyhjsujhwlyeuu/.test(settlementAttemptsBaseline) &&
  /NOT recovered historical creation DDL/i.test(settlementAttemptsBaseline) &&
  /NEVER apply this file to production/i.test(settlementAttemptsBaseline) &&
  /create table public\.settlement_attempts/i.test(settlementAttemptsBaseline) &&
  /id character varying not null/i.test(settlementAttemptsBaseline) &&
  /tenant_id character varying not null/i.test(settlementAttemptsBaseline) &&
  /obligation_id character varying not null/i.test(settlementAttemptsBaseline) &&
  /provider character varying not null/i.test(settlementAttemptsBaseline) &&
  /destination_id character varying/i.test(settlementAttemptsBaseline) &&
  /amount numeric not null/i.test(settlementAttemptsBaseline) &&
  /currency character varying not null/i.test(settlementAttemptsBaseline) &&
  /status character varying not null default 'PENDING'/i.test(settlementAttemptsBaseline) &&
  /external_reference character varying/i.test(settlementAttemptsBaseline) &&
  /failure_code character varying/i.test(settlementAttemptsBaseline) &&
  /failure_message text/i.test(settlementAttemptsBaseline) &&
  /created_at timestamp with time zone not null default current_timestamp/i.test(settlementAttemptsBaseline) &&
  /updated_at timestamp with time zone not null default current_timestamp/i.test(settlementAttemptsBaseline) &&
  /primary key \(id\)/i.test(settlementAttemptsBaseline) &&
  /check \(amount > 0\)/i.test(settlementAttemptsBaseline) &&
  /references public\.payout_destinations\(id\) on delete restrict/i.test(settlementAttemptsBaseline) &&
  /references public\.financial_obligations\(id\) on delete restrict/i.test(settlementAttemptsBaseline) &&
  /references public\.tenants\(id\) on delete restrict/i.test(settlementAttemptsBaseline) &&
  /unique \(obligation_id, external_reference\)/i.test(settlementAttemptsBaseline) &&
  /create index idx_settlement_attempts_obligation[\s\S]*on public\.settlement_attempts using btree \(obligation_id, created_at desc\)/i.test(settlementAttemptsBaseline) &&
  /enable row level security/i.test(settlementAttemptsBaseline) &&
  /force row level security/i.test(settlementAttemptsBaseline) &&
  !/create policy|\bgrant\b|\brevoke\b/i.test(settlementAttemptsBaseline) &&
  !/^\s*(?:insert\s+into|copy\s+(?:public|private)\.)/im.test(settlementAttemptsBaseline);
if (!settlementAttemptsBaselineValid) {
  console.error("P0 BLOCKED: settlement_attempts schema-only baseline failed catalog-evidence, RLS, no-policy/no-grant, or no-data checks.");
  process.exit(1);
}
if (settlementAttemptsPolicyMigration) {
  const settlementAttemptsVersion = "20260920211715";
  const settlementAttemptsName = settlementAttemptsVersion + "_test_only_live_derived_settlement_attempts_baseline.sql";
  if (fs.existsSync(path.join(migrationDirectory, settlementAttemptsName)) ||
      migrations.some(({ name }) => name.slice(0, 14) === settlementAttemptsVersion) ||
      settlementAttemptsVersion >= settlementAttemptsPolicyMigration.name.slice(0, 14)) {
    console.error("P0 BLOCKED: settlement_attempts temporary baseline version collides with repository history or sorts after its dependent policy migration.");
    process.exit(1);
  }
  if (!/CREATE POLICY settlement_attempts_finance_read[\s\S]*ON public\.settlement_attempts[\s\S]*FOR SELECT TO authenticated[\s\S]*m\.role IN \('OWNER','ADMIN','FINANCE','ACCOUNTANT','FINANCE_MANAGER'\)/i.test(settlementAttemptsPolicyMigration.sql)) {
    console.error("P0 BLOCKED: ordered settlement_attempts finance-read policy differs from the documented security contract.");
    process.exit(1);
  }
}

// Read-only live catalog recheck on 2026-10-13 confirms numeric(18,2) typmods on all credit amount columns.
const creditBaselineSpecs = [
  {
    path: "supabase/tests/baselines/credit_policies.sql",
    table: "credit_policies",
    required: /credit_limit numeric\(18,2\) not null default 0[\s\S]*grace_days integer not null default 0[\s\S]*suspend_after_days integer not null default 15[\s\S]*block_new_credit boolean not null default true[\s\S]*unique \(tenant_id, business_id\)[\s\S]*references public\.tenants\(id\) on delete cascade/i,
  },
  {
    path: "supabase/tests/baselines/credit_accounts.sql",
    table: "credit_accounts",
    required: /approved_limit numeric\(18,2\) not null default 0[\s\S]*outstanding_amount numeric\(18,2\) not null default 0[\s\S]*available_amount numeric\(18,2\) generated always as[\s\S]*unique \(tenant_id, business_id\)[\s\S]*references public\.credit_policies\(id\)/i,
  },
  {
    path: "supabase/tests/baselines/credit_periods.sql",
    table: "credit_periods",
    required: /billed_amount numeric\(18,2\) not null default 0[\s\S]*paid_amount numeric\(18,2\) not null default 0[\s\S]*outstanding_amount numeric\(18,2\) generated always as[\s\S]*unique \(credit_account_id, period_start, period_end\)[\s\S]*period_end >= period_start/i,
  },
];
for (const spec of creditBaselineSpecs) {
  const source = fs.readFileSync(spec.path, "utf8");
  const valid = /OWNER-APPROVED TEST-ONLY LIVE-DERIVED CREDIT SCHEMA BASELINE/.test(source) &&
    /2026-10-13/.test(source) &&
    /moyhiluyhjsujhwlyeuu/.test(source) &&
    /NOT recovered historical creation DDL/.test(source) &&
    /must NEVER be applied to production/.test(source) &&
    new RegExp("\\bcreate\\s+table\\s+public\\." + spec.table + "\\b", "i").test(source) &&
    spec.required.test(source) &&
    /enable row level security/i.test(source) &&
    /force row level security/i.test(source) &&
    !/^\s*(?:insert\s+into|copy\s+public\.)/im.test(source);
  if (!valid) {
    console.error("P0 BLOCKED: credit compatibility baseline failed provenance/shape/RLS/no-data checks: " + spec.table);
    process.exit(1);
  }
}
const creditBaselineVersions = [
  ["20260920155450", "20260920155450_test_only_live_derived_credit_policies_baseline.sql"],
  ["20260920155451", "20260920155451_test_only_live_derived_credit_accounts_baseline.sql"],
  ["20260920155452", "20260920155452_test_only_live_derived_credit_periods_baseline.sql"],
];
for (const [version, temporaryName] of creditBaselineVersions) {
  if (fs.existsSync(path.join(migrationDirectory, temporaryName))) {
    console.error("P0 BLOCKED: temporary test-only credit migration filename already exists in repository: " + temporaryName);
    process.exit(1);
  }
  if (version >= "20260920155456") {
    console.error("P0 BLOCKED: test-only credit fixtures must sort before the first dependent migration.");
    process.exit(1);
  }
}
const creditPolicyCreator = migrations.find(({ name, sql }) =>
  name.startsWith("20260920211717") && /CREATE POLICY credit_accounts_finance_read/i.test(sql) &&
  /CREATE POLICY credit_periods_finance_read/i.test(sql)
);
if (!creditPolicyCreator) {
  console.error("P0 BLOCKED: expected ordered migration creating finance-read policies was not found; credit baseline must not silently supply or duplicate policy history.");
  process.exit(1);
}

const registrationBaseline = fs.readFileSync(registrationBaselinePath, "utf8");
const registrationSecurityBaseline = fs.readFileSync(registrationSecurityBaselinePath, "utf8");
const registrationChecks = [
  ["registration schema baseline provenance", /OWNER-APPROVED TEST-ONLY LIVE-DERIVED SCHEMA BASELINE/.test(registrationBaseline) && /2026-10-12/.test(registrationBaseline) && /moyhiluyhjsujhwlyeuu/.test(registrationBaseline) && /NOT recovered historical creation DDL/.test(registrationBaseline) && /Never apply this file to production/.test(registrationBaseline)],
  ["registration columns, defaults and role/status checks", /user_id uuid not null/i.test(registrationBaseline) && /requested_role character varying\(40\) not null/i.test(registrationBaseline) && /status character varying\(20\) not null default 'PENDING'/i.test(registrationBaseline) && /metadata jsonb not null default '\{\}'::jsonb/i.test(registrationBaseline) && /requested_role_check[\s\S]*CUSTOMER[\s\S]*SERVICE_PROVIDER/i.test(registrationBaseline) && /status_check[\s\S]*APPROVED[\s\S]*REJECTED[\s\S]*CANCELLED/i.test(registrationBaseline)],
  ["registration user foreign key and RLS", /references auth\.users\(id\) on delete cascade/i.test(registrationBaseline) && /enable row level security/i.test(registrationBaseline) && !/create policy|\bgrant\b|\brevoke\b/i.test(registrationBaseline)],
  ["pending unique index intentionally left to its ordered migration", !/create unique index account_registration_requests_pending_role_uidx/i.test(registrationBaseline)],
  ["registration security fixture provenance", /OWNER-APPROVED TEST-ONLY LIVE-DERIVED REGISTRATION SECURITY BASELINE/.test(registrationSecurityBaseline) && /2026-10-12/.test(registrationSecurityBaseline) && /moyhiluyhjsujhwlyeuu/.test(registrationSecurityBaseline) && /NOT recovered historical policy\/grant provenance/.test(registrationSecurityBaseline) && /Never apply this file to production/.test(registrationSecurityBaseline)],
  ["registration security policies and grants separated from table DDL", /account_registration_requests_platform_review[\s\S]*to authenticated/i.test(registrationSecurityBaseline) && /account_registration_requests_self_insert[\s\S]*to authenticated/i.test(registrationSecurityBaseline) && /account_registration_requests_self_select[\s\S]*to authenticated/i.test(registrationSecurityBaseline) && /grant insert, select on table public\.account_registration_requests to authenticated/i.test(registrationSecurityBaseline) && /grant insert, references, select, trigger, truncate, update[\s\S]*to service_role/i.test(registrationSecurityBaseline) && !/create table|alter table/i.test(registrationSecurityBaseline) && !/^\s*(?:insert\s+into|copy\s+(?:public|private)\.)/im.test(registrationSecurityBaseline)],
];
const registrationTemporaryVersions = [
  ["20260927065246", "20260927065246_test_only_live_derived_registration_schema_baseline.sql"],
  ["20260927074155", "20260927074155_test_only_live_derived_registration_security_baseline.sql"],
];
for (const [version, temporaryName] of registrationTemporaryVersions) {
  if (fs.existsSync(path.join(migrationDirectory, temporaryName)) ||
      migrations.some(({ name }) => name.slice(0, 14) === version)) {
    registrationChecks.push(["registration temporary version is isolated and collision-free: " + version, false]);
  }
}
const registrationSecurityMigration = migrations.find(({ name }) =>
  name === "20260927065247_mnty_atomic_registration_review.sql"
);
if (!registrationSecurityMigration ||
    "20260927065246" >= registrationSecurityMigration.name.slice(0, 14)) {
  registrationChecks.push(["registration schema fixture sorts before first dependent migration", false]);
}
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
console.log("Disposable compatibility preflight PASS: approved live-derived credit table fixtures, legacy pre-existing table fixtures, core live-derived table baselines, approved SMM fixtures, and live-derived function compatibility fixture validated.");
console.warn("This is not proof of a clean historical replay: test-only live-derived baselines replace missing historical DDL only in disposable CI.");
