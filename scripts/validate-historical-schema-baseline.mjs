import fs from "node:fs";
import path from "node:path";

const migrationDirectory = "supabase/migrations";
const providerBaselinePath = "supabase/tests/baselines/smm_providers.sql";
const credentialsBaselinePath = "supabase/tests/baselines/smm_provider_credentials.sql";
const adminsBaselinePath = "supabase/tests/baselines/smm_admins.sql";
const registrationBaselinePath = "supabase/tests/baselines/account_registration_requests_schema.sql";
const registrationSecurityBaselinePath = "supabase/tests/baselines/account_registration_requests.sql";
const marketingProfileBaselinePath = "supabase/tests/baselines/marketing_provider_profiles.sql";
const marketingLeadsBaselinePath = "supabase/tests/baselines/marketing_leads.sql";
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
const platformTenantSeedBaselinePath = "supabase/tests/baselines/mnty_platform_tenant_seed.sql";
const platformTenantSeedVersion = "20260929073243";
const platformTenantSeedTemporaryName = platformTenantSeedVersion + "_test_only_mnty_platform_tenant_seed.sql";
const platformTenantSeedConsumerName = "20260929073244_seed_mnty_berket_test_business.sql";
const platformTenantSeedConsumer = migrations.find(({ name }) => name === platformTenantSeedConsumerName);
const platformTenantSeedBaseline = fs.existsSync(platformTenantSeedBaselinePath)
  ? fs.readFileSync(platformTenantSeedBaselinePath, "utf8")
  : "";
const platformTenantSeedCreator = migrations.find(({ name, sql }) =>
  name < platformTenantSeedConsumerName &&
  /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\s*\.\s*)?tenants\b/i.test(sql)
);
const platformTenantSeedDml = platformTenantSeedBaseline.match(/^\s*(?:insert\s+into|update\s+public\.|delete\s+from|copy\s+(?:public|private)\.)/gim) || [];
const platformTenantSeedBaselineValid =
  /TEST-ONLY SYNTHETIC TENANT SEED FOR DISPOSABLE MIGRATION REPLAY/.test(platformTenantSeedBaseline) &&
  /schema-only and intentionally contains no rows/i.test(platformTenantSeedBaseline) &&
  /NEVER apply this file to production/i.test(platformTenantSeedBaseline) &&
  /INSERT INTO public\.tenants\s*\(id, name, code, status, settings\)/i.test(platformTenantSeedBaseline) &&
  /SELECT 'MNTY-PLATFORM'[\s\S]*WHERE NOT EXISTS\s*\([\s\S]*FROM public\.tenants\s+WHERE id = 'MNTY-PLATFORM'/i.test(platformTenantSeedBaseline) &&
  platformTenantSeedDml.length === 1 &&
  !/auth\.users|insert\s+into\s+(?:auth|private)\./i.test(platformTenantSeedBaseline);
const platformTenantSeedFailures = [
  ["missing platform tenant seed consumer", !platformTenantSeedConsumer],
  ["missing tenant table creator before seed consumer", !platformTenantSeedCreator],
  ["invalid synthetic tenant seed fixture", !platformTenantSeedBaselineValid],
  ["temporary tenant seed migration already exists", fs.existsSync(path.join(migrationDirectory, platformTenantSeedTemporaryName))],
  ["temporary tenant seed version collision", migrations.some(({ name }) => name.slice(0, 14) === platformTenantSeedVersion)],
  ["temporary tenant seed does not follow tenant table creation", !platformTenantSeedCreator || platformTenantSeedVersion <= platformTenantSeedCreator.name.slice(0, 14)],
  ["temporary tenant seed is not before its first consumer", !platformTenantSeedConsumer || platformTenantSeedVersion >= platformTenantSeedConsumer.name.slice(0, 14)]
].filter(([, failed]) => failed);
if (platformTenantSeedFailures.length) {
  for (const [reason] of platformTenantSeedFailures) console.error("P0 BLOCKED platform tenant seed fixture: " + reason);
  process.exit(1);
}

const platformOrganizationSeedBaselinePath = "supabase/tests/baselines/mnty_main_organization_seed.sql";
const platformOrganizationSeedVersion = "20261004005818";
const platformOrganizationSeedTemporaryName = platformOrganizationSeedVersion + "_test_only_mnty_main_organization_seed.sql";
const platformOrganizationSeedConsumerSourceName = "20261004004500_rc339_seed_mantiqati_official_showcase.sql";
const platformOrganizationSeedConsumerReplayVersion = "20261004005819";
const platformOrganizationSeedConsumer = migrations.find(({ name }) => name === platformOrganizationSeedConsumerSourceName);
const platformOrganizationSeedBaseline = fs.existsSync(platformOrganizationSeedBaselinePath)
  ? fs.readFileSync(platformOrganizationSeedBaselinePath, "utf8")
  : "";
const platformOrganizationSeedCreator = migrations.find(({ name, sql }) =>
  name < platformOrganizationSeedConsumerSourceName &&
  /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\s*\.\s*)?organizations\b/i.test(sql)
);
const platformOrganizationSeedDml = platformOrganizationSeedBaseline.match(/^\s*(?:insert\s+into|update\s+public\.|delete\s+from|copy\s+(?:public|private)\.)/gim) || [];
const platformOrganizationSeedBaselineValid =
  /TEST-ONLY SYNTHETIC ORGANIZATION SEED FOR DISPOSABLE MIGRATION REPLAY/.test(platformOrganizationSeedBaseline) &&
  /schema-only and intentionally contains no rows/i.test(platformOrganizationSeedBaseline) &&
  /NEVER apply this file to production/i.test(platformOrganizationSeedBaseline) &&
  /INSERT INTO public\.organizations\s*\(id, tenant_id, name, code, status, settings\)/i.test(platformOrganizationSeedBaseline) &&
  /SELECT 'MNTY-MAIN', 'MNTY-PLATFORM'[\s\S]*WHERE NOT EXISTS\s*\([\s\S]*FROM public\.organizations\s+WHERE id = 'MNTY-MAIN'/i.test(platformOrganizationSeedBaseline) &&
  platformOrganizationSeedDml.length === 1 &&
  !/auth\.users|insert\s+into\s+(?:auth|private)\./i.test(platformOrganizationSeedBaseline);
const replayWorkflowForOrganizationSeed = fs.readFileSync(".github/workflows/migration-chain-replay.yml", "utf8");
const platformOrganizationSeedFailures = [
  ["missing RC339 showcase seed source", !platformOrganizationSeedConsumer],
  ["missing organization table creator before RC339", !platformOrganizationSeedCreator],
  ["invalid synthetic organization seed fixture", !platformOrganizationSeedBaselineValid],
  ["temporary organization seed migration already exists", fs.existsSync(path.join(migrationDirectory, platformOrganizationSeedTemporaryName))],
  ["temporary organization seed version collision", migrations.some(({ name }) => name.slice(0, 14) === platformOrganizationSeedVersion)],
  ["temporary organization seed does not follow tenant seed", platformOrganizationSeedVersion <= platformTenantSeedVersion],
  ["temporary organization seed does not follow organization table creation", !platformOrganizationSeedCreator || platformOrganizationSeedVersion <= platformOrganizationSeedCreator.name.slice(0, 14)],
  ["temporary organization seed is not before canonical RC339 replay version", platformOrganizationSeedVersion >= platformOrganizationSeedConsumerReplayVersion],
  ["RC339 replay alias is missing", !replayWorkflowForOrganizationSeed.includes('rename_legacy_alias "20261004004500_rc339_seed_mantiqati_official_showcase.sql" "20261004005819_rc339_seed_mantiqati_official_showcase.sql"')]
].filter(([, failed]) => failed);
if (platformOrganizationSeedFailures.length) {
  for (const [reason] of platformOrganizationSeedFailures) console.error("P0 BLOCKED organization seed fixture: " + reason);
  process.exit(1);
}

const platformUserSeedBaselinePath = "supabase/tests/baselines/mnty_showcase_owner_user_seed.sql";
const platformUserSeedVersion = "20260930090000";
const platformUserSeedTemporaryName = platformUserSeedVersion + "_test_only_mnty_showcase_owner_user_seed.sql";
const platformUserSeedConsumerSourceName = "20261004004500_rc339_seed_mantiqati_official_showcase.sql";
const platformUserSeedConsumerReplayVersion = "20261004005819";
const platformUserSeedConsumer = migrations.find(({ name }) => name === platformUserSeedConsumerSourceName);
const platformUserSeedTriggerMigrationName = "20260930100000_rc215_customer_membership_invariant.sql";
const platformUserSeedTriggerMigration = migrations.find(({ name }) => name === platformUserSeedTriggerMigrationName);
const platformUserSeedBaseline = fs.existsSync(platformUserSeedBaselinePath)
  ? fs.readFileSync(platformUserSeedBaselinePath, "utf8")
  : "";
const platformUserSeedCreator = migrations.find(({ name, sql }) =>
  name < platformUserSeedConsumerSourceName &&
  /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\s*\.\s*)?users\b/i.test(sql)
);
const platformUserSeedDml = platformUserSeedBaseline.match(/^\s*(?:insert\s+into|update\s+public\.|delete\s+from|copy\s+(?:public|private)\.)/gim) || [];
const platformUserSeedBaselineValid =
  /TEST-ONLY SYNTHETIC SHOWCASE OWNER SEED FOR DISPOSABLE MIGRATION REPLAY/.test(platformUserSeedBaseline) &&
  /fixed owner UUID/i.test(platformUserSeedBaseline) &&
  /non-login synthetic auth identity only in disposable CI/i.test(platformUserSeedBaseline) &&
  /NEVER apply this file to production/i.test(platformUserSeedBaseline) &&
  /INSERT INTO auth\.users\s*\([\s\S]*?id, aud, role, email, encrypted_password, email_confirmed_at[\s\S]*?raw_app_meta_data, raw_user_meta_data, created_at, updated_at/i.test(platformUserSeedBaseline) &&
  /f7914ac7-4b03-4456-afdd-e386f2ac6a5b/i.test(platformUserSeedBaseline) &&
  /showcase-owner@invalid\.example/i.test(platformUserSeedBaseline) &&
  !/ALTER TABLE auth\.users (?:DISABLE|ENABLE) TRIGGER/i.test(platformUserSeedBaseline) &&
  !/SELECT private\.ensure_customer_membership_for_user/i.test(platformUserSeedBaseline) &&
  /INSERT INTO public\.users\s*\([\s\S]*?id, tenant_id, organization_id, name, email, role, roles/i.test(platformUserSeedBaseline) &&
  /'MNTY-PLATFORM'[\s\S]*'OWNER'[\s\S]*ON CONFLICT \(id\) DO UPDATE/i.test(platformUserSeedBaseline) &&
  platformUserSeedDml.length === 2 &&
  !/showcase-owner@(?!invalid\.example)/i.test(platformUserSeedBaseline);
const platformUserSeedFailures = [
  ["missing RC339 showcase seed source", !platformUserSeedConsumer],
  ["missing public users table creator before RC339", !platformUserSeedCreator],
  ["invalid synthetic showcase owner fixture", !platformUserSeedBaselineValid],
  ["temporary showcase owner migration already exists", fs.existsSync(path.join(migrationDirectory, platformUserSeedTemporaryName))],
  ["temporary showcase owner version collision", migrations.some(({ name }) => name.slice(0, 14) === platformUserSeedVersion)],
  ["missing RC215 trigger migration", !platformUserSeedTriggerMigration],
  ["temporary showcase owner seed does not follow tenant seed", platformUserSeedVersion <= platformTenantSeedVersion],
  ["temporary showcase owner seed is not before RC215 trigger migration", !platformUserSeedTriggerMigration || platformUserSeedVersion >= platformUserSeedTriggerMigration.name.slice(0, 14)],
  ["temporary showcase owner seed is not before organization seed", platformUserSeedVersion >= platformOrganizationSeedVersion],
  ["temporary showcase owner seed is not before canonical RC339 replay version", platformUserSeedVersion >= platformUserSeedConsumerReplayVersion],
  ["RC339 replay alias is missing for showcase owner", !replayWorkflowForOrganizationSeed.includes('rename_legacy_alias "20261004004500_rc339_seed_mantiqati_official_showcase.sql" "20261004005819_rc339_seed_mantiqati_official_showcase.sql"')]
].filter(([, failed]) => failed);
if (platformUserSeedFailures.length) {
  for (const [reason] of platformUserSeedFailures) console.error("P0 BLOCKED showcase owner seed fixture: " + reason);
  process.exit(1);
}

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
  { table: "marketing_leads", before: "20260927140500_remove_anonymous_sensitive_policy_access_v2.sql", baselinePath: marketingLeadsBaselinePath },
  { table: "account_registration_requests", before: "20260927065247_mnty_atomic_registration_review.sql", baselinePath: registrationBaselinePath },
  // RC production hardening enables RLS on bookings, but neither committed history nor the applied ledger creates it.
  { table: "bookings", before: "20260919233425_production_security_hardening_v1.sql", baselinePath: bookingsBaselinePath },
  // Live catalog evidence provides an exact schema-only compatibility shape. The finance-read policy
  // remains owned by its chronological migration and is never duplicated in this fixture.
  { table: "settlement_attempts", before: "20260920211717_security_definer_surface_reduction_and_finance_rls.sql", baselinePath: "supabase/tests/baselines/settlement_attempts.sql" },
  { table: "payment_provider_events", before: "20260920211717_security_definer_surface_reduction_and_finance_rls.sql", baselinePath: "supabase/tests/baselines/payment_provider_events.sql" },
  // The archived source changes this live RLS policy but does not create its table.
  { table: "smm_wallet_transactions", before: "20260927140500_remove_anonymous_sensitive_policy_access_v2.sql", baselinePath: "supabase/tests/baselines/smm_wallet_transactions.sql" },
  // Exact live schema is approved for disposable replay only; it is not recovered historical DDL.
  { table: "smm_admins", before: "20260928150000_rc151_backend_only_erp_smm_table_privileges.sql", baselinePath: adminsBaselinePath },
  { table: "smm_services", before: "20260927140500_remove_anonymous_sensitive_policy_access_v2.sql", baselinePath: "supabase/tests/baselines/smm_services.sql" },
  { table: "smm_orders", before: "20260927140500_remove_anonymous_sensitive_policy_access_v2.sql", baselinePath: "supabase/tests/baselines/smm_orders.sql" },
  { table: "smm_order_events", before: "20260927140500_remove_anonymous_sensitive_policy_access_v2.sql", baselinePath: "supabase/tests/baselines/smm_order_events.sql" },
  { table: "smm_wallets", before: "20260927140500_remove_anonymous_sensitive_policy_access_v2.sql", baselinePath: "supabase/tests/baselines/smm_wallets.sql" },
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

// Validate the catalog-derived settlement finance-read policy missing from historical source.
// Only the policy is injected: settlement_transactions already exists by this migration point.
const settlementTransactionsPolicyBaselinePath = "supabase/tests/baselines/settlement_transactions_finance_read.sql";
const settlementTransactionsPolicyBaseline = fs.readFileSync(settlementTransactionsPolicyBaselinePath, "utf8");
const settlementTransactionsPolicyVersion = "20260927140492";
const settlementTransactionsPolicyTemporaryName = settlementTransactionsPolicyVersion + "_test_only_live_derived_settlement_transactions_finance_read.sql";
const settlementTransactionsPolicyMigration = migrations.find(({ name }) =>
  name === "20260927140500_remove_anonymous_sensitive_policy_access_v2.sql"
);
const settlementTransactionsPriorPolicyCreation = migrations.some(({ name, sql }) =>
  name.slice(0, 14) < settlementTransactionsPolicyMigration?.name.slice(0, 14) &&
  /create\s+policy\s+settlement_transactions_finance_read\s+on\s+(?:public\s*\.\s*)?settlement_transactions\b/i.test(sql)
);
const settlementTransactionsPolicyBaselineValid =
  /READ-ONLY CATALOG-DERIVED TEST-ONLY POLICY COMPATIBILITY BASELINE/.test(settlementTransactionsPolicyBaseline) &&
  /2026-10-13/.test(settlementTransactionsPolicyBaseline) &&
  /moyhiluyhjsujhwlyeuu/.test(settlementTransactionsPolicyBaseline) &&
  /NOT recovered historical policy-creation DDL/i.test(settlementTransactionsPolicyBaseline) &&
  /MUST NOT be applied to production/i.test(settlementTransactionsPolicyBaseline) &&
  /CREATE POLICY settlement_transactions_finance_read[\s\S]*ON public\.settlement_transactions[\s\S]*FOR SELECT[\s\S]*TO authenticated/i.test(settlementTransactionsPolicyBaseline) &&
  /um\.tenant_id::text = \(settlement_transactions\.tenant_id\)::text/i.test(settlementTransactionsPolicyBaseline) &&
  /um\.status::text = 'ACTIVE'::text/i.test(settlementTransactionsPolicyBaseline) &&
  /upper\(\(um\.role\)::text\) = ANY/i.test(settlementTransactionsPolicyBaseline) &&
  /OWNER[\s\S]*ADMIN[\s\S]*MANAGER[\s\S]*FINANCE[\s\S]*ACCOUNTANT[\s\S]*FINANCE_MANAGER/i.test(settlementTransactionsPolicyBaseline) &&
  !/create\s+table|\bgrant\b|\brevoke\b|insert\s+into|copy\s+(?:public|private)\./i.test(settlementTransactionsPolicyBaseline);
if (!settlementTransactionsPolicyMigration || settlementTransactionsPriorPolicyCreation ||
    !settlementTransactionsPolicyBaselineValid ||
    fs.existsSync(path.join(migrationDirectory, settlementTransactionsPolicyTemporaryName)) ||
    migrations.some(({ name }) => name.slice(0, 14) === settlementTransactionsPolicyVersion) ||
    settlementTransactionsPolicyVersion >= settlementTransactionsPolicyMigration.name.slice(0, 14) ||
    !/alter policy settlement_transactions_finance_read on public\.settlement_transactions to authenticated;/i.test(settlementTransactionsPolicyMigration.sql)) {
  console.error("P0 BLOCKED: settlement_transactions finance-read test-only policy baseline, provenance, timestamp, or ordered ALTER POLICY contract is invalid.");
  process.exit(1);
}

// Validate the catalog-derived wallet finance-read policy missing from historical source.
const walletAccountsPolicyBaselinePath = "supabase/tests/baselines/wallet_accounts_finance_read.sql";
const walletAccountsPolicyBaseline = fs.readFileSync(walletAccountsPolicyBaselinePath, "utf8");
const walletAccountsPolicyVersion = "20260927140486";
const walletAccountsPolicyTemporaryName = walletAccountsPolicyVersion + "_test_only_live_derived_wallet_accounts_finance_read.sql";
const walletAccountsPolicyMigration = migrations.find(({ name }) =>
  name === "20260927140500_remove_anonymous_sensitive_policy_access_v2.sql"
);
const walletAccountsPriorPolicyCreation = migrations.some(({ name, sql }) =>
  name.slice(0, 14) < walletAccountsPolicyMigration?.name.slice(0, 14) &&
  /create\s+policy\s+wallet_accounts_finance_read\s+on\s+(?:public\s*\.\s*)?wallet_accounts\b/i.test(sql)
);
const walletAccountsPolicyBaselineValid =
  /READ-ONLY CATALOG-DERIVED TEST-ONLY POLICY COMPATIBILITY BASELINE/.test(walletAccountsPolicyBaseline) &&
  /2026-10-13/.test(walletAccountsPolicyBaseline) &&
  /moyhiluyhjsujhwlyeuu/.test(walletAccountsPolicyBaseline) &&
  /NOT recovered historical policy-creation DDL/i.test(walletAccountsPolicyBaseline) &&
  /MUST NOT be applied to production/i.test(walletAccountsPolicyBaseline) &&
  /CREATE POLICY wallet_accounts_finance_read[\s\S]*ON public\.wallet_accounts[\s\S]*FOR SELECT[\s\S]*TO authenticated/i.test(walletAccountsPolicyBaseline) &&
  /um\.tenant_id::text = wallet_accounts\.tenant_id::text/i.test(walletAccountsPolicyBaseline) &&
  /um\.status::text = 'ACTIVE'/i.test(walletAccountsPolicyBaseline) &&
  /upper\(um\.role::text\) = ANY/i.test(walletAccountsPolicyBaseline) &&
  /OWNER[\s\S]*ADMIN[\s\S]*MANAGER[\s\S]*FINANCE[\s\S]*ACCOUNTANT[\s\S]*FINANCE_MANAGER/i.test(walletAccountsPolicyBaseline) &&
  !/create\s+table|\bgrant\b|\brevoke\b|insert\s+into|copy\s+(?:public|private)\./i.test(walletAccountsPolicyBaseline);
if (!walletAccountsPolicyMigration || walletAccountsPriorPolicyCreation || !walletAccountsPolicyBaselineValid ||
    fs.existsSync(path.join(migrationDirectory, walletAccountsPolicyTemporaryName)) ||
    migrations.some(({ name }) => name.slice(0, 14) === walletAccountsPolicyVersion) ||
    walletAccountsPolicyVersion >= walletAccountsPolicyMigration.name.slice(0, 14) ||
    !/alter policy wallet_accounts_finance_read on public\.wallet_accounts to authenticated;/i.test(walletAccountsPolicyMigration.sql)) {
  console.error("P0 BLOCKED: wallet_accounts finance-read test-only policy baseline, provenance, timestamp, or ordered ALTER POLICY contract is invalid.");
  process.exit(1);
}

// Validate the catalog-derived finance-read policy missing from the historical source chain.
// The table already exists in the replay; only this policy definition is injected test-only.
const paymentEventsPolicyBaselinePath = "supabase/tests/baselines/payment_events_finance_read.sql";
const paymentEventsPolicyBaseline = fs.readFileSync(paymentEventsPolicyBaselinePath, "utf8");
const paymentEventsPolicyVersion = "20260927140493";
const paymentEventsPolicyTemporaryName = paymentEventsPolicyVersion + "_test_only_live_derived_payment_events_finance_read.sql";
const paymentEventsPolicyMigration = migrations.find(({ name }) =>
  name === "20260927140500_remove_anonymous_sensitive_policy_access_v2.sql"
);
const paymentEventsPriorPolicyCreation = migrations.some(({ name, sql }) =>
  name.slice(0, 14) < paymentEventsPolicyMigration?.name.slice(0, 14) &&
  /create\s+policy\s+payment_events_finance_read\s+on\s+(?:public\s*\.\s*)?payment_events\b/i.test(sql)
);
const paymentEventsPolicyBaselineValid =
  /READ-ONLY CATALOG-DERIVED TEST-ONLY POLICY COMPATIBILITY BASELINE/.test(paymentEventsPolicyBaseline) &&
  /2026-10-13/.test(paymentEventsPolicyBaseline) &&
  /moyhiluyhjsujhwlyeuu/.test(paymentEventsPolicyBaseline) &&
  /NOT recovered historical policy-creation DDL/i.test(paymentEventsPolicyBaseline) &&
  /MUST NOT be applied to production/i.test(paymentEventsPolicyBaseline) &&
  /CREATE POLICY payment_events_finance_read[\s\S]*ON public\.payment_events[\s\S]*FOR SELECT[\s\S]*TO authenticated/i.test(paymentEventsPolicyBaseline) &&
  /um\.tenant_id::text = \(payment_events\.tenant_id\)::text/i.test(paymentEventsPolicyBaseline) &&
  /um\.status::text = 'ACTIVE'::text/i.test(paymentEventsPolicyBaseline) &&
  /upper\(\(um\.role\)::text\) = ANY/i.test(paymentEventsPolicyBaseline) &&
  /OWNER[\s\S]*ADMIN[\s\S]*MANAGER[\s\S]*FINANCE[\s\S]*ACCOUNTANT[\s\S]*FINANCE_MANAGER/i.test(paymentEventsPolicyBaseline) &&
  !/create\s+table|\bgrant\b|\brevoke\b|insert\s+into|copy\s+(?:public|private)\./i.test(paymentEventsPolicyBaseline);
if (!paymentEventsPolicyMigration || paymentEventsPriorPolicyCreation || !paymentEventsPolicyBaselineValid ||
    fs.existsSync(path.join(migrationDirectory, paymentEventsPolicyTemporaryName)) ||
    migrations.some(({ name }) => name.slice(0, 14) === paymentEventsPolicyVersion) ||
    paymentEventsPolicyVersion >= paymentEventsPolicyMigration.name.slice(0, 14) ||
    !/alter policy payment_events_finance_read on public\.payment_events to authenticated;/i.test(paymentEventsPolicyMigration.sql)) {
  console.error("P0 BLOCKED: payment_events finance-read test-only policy baseline, provenance, timestamp, or ordered ALTER POLICY contract is invalid.");
  process.exit(1);
}

// Validate the live-derived marketing CRM tables whose policies are altered before any
// canonical CREATE TABLE source exists. This remains synthetic disposable-only compatibility,
// not a claim that the historical table/policy creation DDL has been recovered.
const marketingLeadsBaseline = fs.readFileSync(marketingLeadsBaselinePath, "utf8");
const marketingLeadsVersion = "20260927140496";
const marketingLeadsTemporaryName = marketingLeadsVersion + "_test_only_live_derived_marketing_leads.sql";
const marketingLeadsPolicyMigration = migrations.find(({ name }) =>
  name === "20260927140500_remove_anonymous_sensitive_policy_access_v2.sql"
);
const marketingLeadsPriorCreator = migrations.some(({ name, sql }) =>
  name.slice(0, 14) < marketingLeadsPolicyMigration?.name.slice(0, 14) &&
  /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\s*\.\s*)?marketing_leads\b/i.test(sql)
);
const marketingProjectsPriorCreator = migrations.some(({ name, sql }) =>
  name.slice(0, 14) < marketingLeadsPolicyMigration?.name.slice(0, 14) &&
  /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\s*\.\s*)?marketing_projects\b/i.test(sql)
);
const marketingParticipantsPriorCreator = migrations.some(({ name, sql }) =>
  name.slice(0, 14) < marketingLeadsPolicyMigration?.name.slice(0, 14) &&
  /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\s*\.\s*)?marketing_project_participants\b/i.test(sql)
);
const marketingPlansPriorCreator = migrations.some(({ name, sql }) =>
  name.slice(0, 14) < marketingLeadsPolicyMigration?.name.slice(0, 14) &&
  /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\s*\.\s*)?marketing_plans\b/i.test(sql)
);
const marketingSubscriptionsPriorCreator = migrations.some(({ name, sql }) =>
  name.slice(0, 14) < marketingLeadsPolicyMigration?.name.slice(0, 14) &&
  /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\s*\.\s*)?marketing_provider_subscriptions\b/i.test(sql)
);
const marketingLeadsBaselineValid =
  /OWNER-APPROVED TEST-ONLY LIVE-DERIVED TABLE\/POLICY BASELINE/.test(marketingLeadsBaseline) &&
  /2026-10-13/.test(marketingLeadsBaseline) &&
  /moyhiluyhjsujhwlyeuu/.test(marketingLeadsBaseline) &&
  /NOT recovered historical DDL/i.test(marketingLeadsBaseline) &&
  /MUST NOT be applied to production/i.test(marketingLeadsBaseline) &&
  /CREATE TABLE public\.marketing_leads/i.test(marketingLeadsBaseline) &&
  /requester_user_id uuid/i.test(marketingLeadsBaseline) &&
  /requester_business_id uuid/i.test(marketingLeadsBaseline) &&
  /assigned_provider_id uuid/i.test(marketingLeadsBaseline) &&
  /required_services jsonb not null default '\[\]'::jsonb/i.test(marketingLeadsBaseline) &&
  /marketing_leads_status_check/i.test(marketingLeadsBaseline) &&
  /marketing_leads_source_check/i.test(marketingLeadsBaseline) &&
  /marketing_leads_requester_user_id_fkey[\s\S]*references auth\.users\(id\) on delete set null/i.test(marketingLeadsBaseline) &&
  /marketing_leads_requester_business_id_fkey[\s\S]*references public\.businesses\(id\) on delete set null/i.test(marketingLeadsBaseline) &&
  /marketing_leads_assigned_provider_id_fkey[\s\S]*references public\.marketing_provider_profiles\(id\) on delete set null/i.test(marketingLeadsBaseline) &&
  /create index idx_mkt_leads_status on public\.marketing_leads\s*\(status, created_at desc\)/i.test(marketingLeadsBaseline) &&
  /alter table public\.marketing_leads enable row level security/i.test(marketingLeadsBaseline) &&
  /alter table public\.marketing_leads force row level security/i.test(marketingLeadsBaseline) &&
  /CREATE POLICY "Users view own marketing leads"[\s\S]*ON public\.marketing_leads[\s\S]*FOR SELECT[\s\S]*TO authenticated[\s\S]*auth\.uid\(\)[\s\S]*requester_user_id/i.test(marketingLeadsBaseline) &&
  /CREATE TABLE public\.marketing_projects/i.test(marketingLeadsBaseline) &&
  /marketing_projects_lead_id_fkey[\s\S]*references public\.marketing_leads\(id\) on delete set null/i.test(marketingLeadsBaseline) &&
  /marketing_projects_client_business_id_fkey[\s\S]*references public\.businesses\(id\) on delete set null/i.test(marketingLeadsBaseline) &&
  /marketing_projects_management_mode_check/i.test(marketingLeadsBaseline) &&
  /marketing_projects_status_check/i.test(marketingLeadsBaseline) &&
  /create index idx_mkt_projects_status on public\.marketing_projects(?:\s+using\s+btree)?\s*\(status, created_at desc\)/i.test(marketingLeadsBaseline) &&
  /alter table public\.marketing_projects enable row level security/i.test(marketingLeadsBaseline) &&
  /alter table public\.marketing_projects force row level security/i.test(marketingLeadsBaseline) &&
  /CREATE POLICY "Project clients can view own marketing projects"[\s\S]*ON public\.marketing_projects[\s\S]*FOR SELECT TO authenticated[\s\S]*um\.user_id = \(SELECT auth\.uid\(\) AS uid\)[\s\S]*um\.status::text = 'ACTIVE'::text/i.test(marketingLeadsBaseline) &&
  /REVOKE ALL ON TABLE public\.marketing_projects FROM PUBLIC, anon, authenticated, service_role/i.test(marketingLeadsBaseline) &&
  /GRANT SELECT ON TABLE public\.marketing_projects TO authenticated/i.test(marketingLeadsBaseline) &&
  /GRANT REFERENCES, TRIGGER, TRUNCATE ON TABLE public\.marketing_projects TO service_role/i.test(marketingLeadsBaseline) &&
  /CREATE TABLE public\.marketing_project_participants/i.test(marketingLeadsBaseline) &&
  /marketing_project_participants_project_id_fkey[\s\S]*references public\.marketing_projects\(id\) on delete cascade/i.test(marketingLeadsBaseline) &&
  /marketing_project_participants_provider_id_fkey[\s\S]*references public\.marketing_provider_profiles\(id\) on delete restrict/i.test(marketingLeadsBaseline) &&
  /marketing_project_participants_role_check/i.test(marketingLeadsBaseline) &&
  /marketing_project_participants_status_check/i.test(marketingLeadsBaseline) &&
  /marketing_project_participants_allocation_percent_check/i.test(marketingLeadsBaseline) &&
  /create index idx_mkt_project_participants_provider on public\.marketing_project_participants(?:\s+using\s+btree)?\s*\(provider_id\)/i.test(marketingLeadsBaseline) &&
  /alter table public\.marketing_project_participants enable row level security/i.test(marketingLeadsBaseline) &&
  /alter table public\.marketing_project_participants force row level security/i.test(marketingLeadsBaseline) &&
  /CREATE POLICY "Providers view assigned projects"[\s\S]*ON public\.marketing_project_participants[\s\S]*FOR SELECT TO authenticated[\s\S]*p\.owner_user_id = \(SELECT auth\.uid\(\) AS uid\)/i.test(marketingLeadsBaseline) &&
  /REVOKE ALL ON TABLE public\.marketing_project_participants FROM PUBLIC, anon, authenticated, service_role/i.test(marketingLeadsBaseline) &&
  /GRANT REFERENCES, TRIGGER, TRUNCATE ON TABLE public\.marketing_project_participants TO service_role/i.test(marketingLeadsBaseline) &&
  /CREATE TABLE public\.marketing_plans/i.test(marketingLeadsBaseline) &&
  /marketing_plans_provider_kind_code_key/i.test(marketingLeadsBaseline) &&
  /marketing_plans_billing_period_check/i.test(marketingLeadsBaseline) &&
  /marketing_plans_provider_kind_check/i.test(marketingLeadsBaseline) &&
  /marketing_plans_price_check/i.test(marketingLeadsBaseline) &&
  /marketing_plans_status_check/i.test(marketingLeadsBaseline) &&
  /alter table public\.marketing_plans enable row level security/i.test(marketingLeadsBaseline) &&
  /alter table public\.marketing_plans force row level security/i.test(marketingLeadsBaseline) &&
  /CREATE POLICY "Public can view active marketing plans"[\s\S]*ON public\.marketing_plans[\s\S]*FOR SELECT TO anon, authenticated[\s\S]*status::text = 'ACTIVE'::text/i.test(marketingLeadsBaseline) &&
  /REVOKE ALL ON TABLE public\.marketing_plans FROM PUBLIC, anon, authenticated, service_role/i.test(marketingLeadsBaseline) &&
  /GRANT REFERENCES, TRIGGER, TRUNCATE ON TABLE public\.marketing_plans TO service_role/i.test(marketingLeadsBaseline) &&
  /CREATE TABLE public\.marketing_provider_subscriptions/i.test(marketingLeadsBaseline) &&
  /marketing_provider_subscriptions_plan_id_fkey[\s\S]*references public\.marketing_plans\(id\)/i.test(marketingLeadsBaseline) &&
  /marketing_provider_subscriptions_provider_id_fkey[\s\S]*references public\.marketing_provider_profiles\(id\) on delete cascade/i.test(marketingLeadsBaseline) &&
  /marketing_provider_subscriptions_status_check/i.test(marketingLeadsBaseline) &&
  /alter table public\.marketing_provider_subscriptions enable row level security/i.test(marketingLeadsBaseline) &&
  /alter table public\.marketing_provider_subscriptions force row level security/i.test(marketingLeadsBaseline) &&
  /CREATE POLICY "Owners view their subscriptions"[\s\S]*ON public\.marketing_provider_subscriptions[\s\S]*FOR SELECT TO authenticated[\s\S]*p\.owner_user_id = \(SELECT auth\.uid\(\) AS uid\)/i.test(marketingLeadsBaseline) &&
  /REVOKE ALL ON TABLE public\.marketing_provider_subscriptions FROM PUBLIC, anon, authenticated, service_role/i.test(marketingLeadsBaseline) &&
  /GRANT REFERENCES, TRIGGER, TRUNCATE ON TABLE public\.marketing_provider_subscriptions TO service_role/i.test(marketingLeadsBaseline) &&
  !/insert\s+into|copy\s+public\.|create trigger/i.test(marketingLeadsBaseline);
if (!marketingLeadsPolicyMigration || marketingLeadsPriorCreator || marketingProjectsPriorCreator ||
    marketingParticipantsPriorCreator || marketingPlansPriorCreator || marketingSubscriptionsPriorCreator ||
    !marketingLeadsBaselineValid ||
    fs.existsSync(path.join(migrationDirectory, marketingLeadsTemporaryName)) ||
    migrations.some(({ name }) => name.slice(0, 14) === marketingLeadsVersion) ||
    marketingLeadsVersion >= marketingLeadsPolicyMigration.name.slice(0, 14) ||
    !/alter policy "Users view own marketing leads" on public\.marketing_leads to authenticated;/i.test(marketingLeadsPolicyMigration.sql) ||
    !/alter policy "Project clients can view own marketing projects" on public\.marketing_projects to authenticated;/i.test(marketingLeadsPolicyMigration.sql) ||
    !/alter policy "Providers view assigned projects" on public\.marketing_project_participants to authenticated;/i.test(marketingLeadsPolicyMigration.sql) ||
    !/alter policy "Owners view their subscriptions" on public\.marketing_provider_subscriptions to authenticated;/i.test(marketingLeadsPolicyMigration.sql)) {
  console.error("P0 BLOCKED: marketing CRM test-only baselines, provenance, timestamp, grants/RLS, or ordered ALTER POLICY contracts are invalid.");
  process.exit(1);
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

// Validate the live-derived marketing tables that the historical policy migration
// alters before the later RC99 policy replacement. This is disposable-only, not source recovery.
const marketingSchemaBaselinePath = "supabase/tests/baselines/marketing_commission_schema.sql";
const marketingSchemaBaseline = fs.readFileSync(marketingSchemaBaselinePath, "utf8");
const marketingSchemaVersion = "20260927132903";
const marketingSchemaTemporaryName = marketingSchemaVersion + "_test_only_live_derived_marketing_commission_schema.sql";
const marketingSchemaFirstConsumerMigration = migrations.find(({ name }) =>
  name === "20260927132904_restore_marketing_catalog_grants_and_owner_profile_access.sql"
);
const marketingSchemaPrerequisiteVersion = "20260927074156";
const marketingSchemaPolicyMigration = migrations.find(({ name }) =>
  name === "20260927140500_remove_anonymous_sensitive_policy_access_v2.sql"
);
const marketingSchemaReplacementMigration = migrations.find(({ name }) =>
  name === "20260928010000_rc99_g5_provider_services_rls_hardening.sql"
);
const marketingSchemaPriorCreators = [
  /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\s*\.\s*)?marketing_services\b/i,
  /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\s*\.\s*)?marketing_provider_services\b/i,
  /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\s*\.\s*)?marketing_commission_rules\b/i,
].some(pattern => migrations.some(({ sql }) => pattern.test(sql)));
const marketingSchemaPriorPolicyCreators = [
  /create\s+policy\s+"Public can view active marketing services"\s+on\s+(?:public\s*\.\s*)?marketing_services\b/i,
  /create\s+policy\s+"Public can view active provider services"\s+on\s+(?:public\s*\.\s*)?marketing_provider_services\b/i,
  /create\s+policy\s+"Authenticated can view active commission rules"\s+on\s+(?:public\s*\.\s*)?marketing_commission_rules\b/i,
  /create\s+policy\s+authenticated_sessions_only\s+on\s+(?:public\s*\.\s*)?marketing_services\b/i,
  /create\s+policy\s+mnt_non_anonymous_boundary\s+on\s+(?:public\s*\.\s*)?marketing_services\b/i,
  /create\s+policy\s+non_anonymous_authenticated_guard\s+on\s+(?:public\s*\.\s*)?marketing_services\b/i,
  /create\s+policy\s+authenticated_sessions_only\s+on\s+(?:public\s*\.\s*)?marketing_provider_services\b/i,
  /create\s+policy\s+mnt_non_anonymous_boundary\s+on\s+(?:public\s*\.\s*)?marketing_provider_services\b/i,
  /create\s+policy\s+non_anonymous_authenticated_guard\s+on\s+(?:public\s*\.\s*)?marketing_provider_services\b/i,
  /create\s+policy\s+authenticated_sessions_only\s+on\s+(?:public\s*\.\s*)?marketing_commission_rules\b/i,
  /create\s+policy\s+mnt_non_anonymous_boundary\s+on\s+(?:public\s*\.\s*)?marketing_commission_rules\b/i,
  /create\s+policy\s+non_anonymous_authenticated_guard\s+on\s+(?:public\s*\.\s*)?marketing_commission_rules\b/i,
].some(pattern => migrations.some(({ sql }) => pattern.test(sql)));
const marketingSchemaBaselineValid =
  /TEST-ONLY LIVE-DERIVED MARKETING SCHEMA COMPATIBILITY BASELINE/.test(marketingSchemaBaseline) &&
  /2026-10-13/.test(marketingSchemaBaseline) &&
  /moyhiluyhjsujhwlyeuu/.test(marketingSchemaBaseline) &&
  /NOT recovered historical creation DDL/i.test(marketingSchemaBaseline) &&
  /MUST NOT be applied to production/i.test(marketingSchemaBaseline) &&
  /CREATE TABLE public\.marketing_services[\s\S]*CREATE TABLE public\.marketing_provider_services[\s\S]*CREATE TABLE public\.marketing_commission_rules/i.test(marketingSchemaBaseline) &&
  /FOREIGN KEY \(service_id\) REFERENCES public\.marketing_services\(id\) ON DELETE CASCADE/i.test(marketingSchemaBaseline) &&
  /FOREIGN KEY \(service_id\) REFERENCES public\.marketing_services\(id\) ON DELETE SET NULL/i.test(marketingSchemaBaseline) &&
  /marketing_provider_services_provider_id_service_id_key UNIQUE \(provider_id, service_id\)/i.test(marketingSchemaBaseline) &&
  /ALTER TABLE public\.marketing_services ENABLE ROW LEVEL SECURITY[\s\S]*ALTER TABLE public\.marketing_services FORCE ROW LEVEL SECURITY/i.test(marketingSchemaBaseline) &&
  /ALTER TABLE public\.marketing_provider_services ENABLE ROW LEVEL SECURITY[\s\S]*ALTER TABLE public\.marketing_provider_services FORCE ROW LEVEL SECURITY/i.test(marketingSchemaBaseline) &&
  /ALTER TABLE public\.marketing_commission_rules ENABLE ROW LEVEL SECURITY[\s\S]*ALTER TABLE public\.marketing_commission_rules FORCE ROW LEVEL SECURITY/i.test(marketingSchemaBaseline) &&
  /CREATE POLICY "Public can view active marketing services"/i.test(marketingSchemaBaseline) &&
  /CREATE POLICY "Public can view active provider services"/i.test(marketingSchemaBaseline) &&
  /CREATE POLICY "Authenticated can view active commission rules"/i.test(marketingSchemaBaseline) &&
  /CREATE POLICY authenticated_sessions_only ON public\.marketing_services AS RESTRICTIVE/i.test(marketingSchemaBaseline) &&
  /CREATE POLICY mnt_non_anonymous_boundary ON public\.marketing_provider_services AS RESTRICTIVE/i.test(marketingSchemaBaseline) &&
  /CREATE POLICY non_anonymous_authenticated_guard ON public\.marketing_commission_rules AS RESTRICTIVE/i.test(marketingSchemaBaseline) &&
  !/CREATE POLICY marketing_services_admin_manage|CREATE POLICY marketing_provider_services_owner_manage/i.test(marketingSchemaBaseline) &&
  !/^\s*(?:insert\s+into|copy\s+(?:public|private)\.|update\s+public\.|delete\s+from\s+public\.)/im.test(marketingSchemaBaseline);
const marketingSchemaFailureReasons = [
  ["earlier or later committed table creator exists; fixture may duplicate source history", marketingSchemaPriorCreators],
  ["committed policy creator exists; fixture may duplicate source history", marketingSchemaPriorPolicyCreators],
  ["live-derived schema/policy contract invalid", !marketingSchemaBaselineValid],
  ["temporary baseline does not follow provider-profile prerequisite version", marketingSchemaVersion <= marketingSchemaPrerequisiteVersion],
  ["missing first table consumer migration", !marketingSchemaFirstConsumerMigration],
  ["temporary baseline is not before first table consumer", !marketingSchemaFirstConsumerMigration || marketingSchemaVersion >= marketingSchemaFirstConsumerMigration.name.slice(0, 14)],
  ["missing policy ALTER migration", !marketingSchemaPolicyMigration],
  ["missing later RC99 replacement migration", !marketingSchemaReplacementMigration],
  ["temporary migration file already exists", fs.existsSync(path.join(migrationDirectory, marketingSchemaTemporaryName))],
  ["temporary version collision", migrations.some(({ name }) => name.slice(0, 14) === marketingSchemaVersion)],
  ["temporary version is not earlier than policy ALTER", !marketingSchemaPolicyMigration || marketingSchemaVersion >= marketingSchemaPolicyMigration.name.slice(0, 14)],
  ["commission policy ALTER is missing", !marketingSchemaPolicyMigration || !/alter policy "Authenticated can view active commission rules" on public\.marketing_commission_rules to authenticated;/i.test(marketingSchemaPolicyMigration.sql)],
  ["RC99 policy replacement contract changed", !marketingSchemaReplacementMigration ||
    !/drop policy if exists "authenticated_sessions_only" on public\.marketing_services/i.test(marketingSchemaReplacementMigration.sql) ||
    !/drop policy if exists "authenticated_sessions_only" on public\.marketing_provider_services/i.test(marketingSchemaReplacementMigration.sql) ||
    !/create policy marketing_services_admin_manage/i.test(marketingSchemaReplacementMigration.sql) ||
    !/create policy marketing_provider_services_owner_manage/i.test(marketingSchemaReplacementMigration.sql)],
].filter(([, failed]) => failed);
if (marketingSchemaFailureReasons.length) {
  for (const [reason] of marketingSchemaFailureReasons) console.error("P0 BLOCKED marketing schema baseline: " + reason);
  process.exit(1);
}

// Validate both catalog-derived journal finance-read policies that the historical
// ALTER POLICY migration expects to exist. The fixture is disposable-only, not source recovery.
const journalFinancePolicyBaselinePath = "supabase/tests/baselines/journal_finance_read_policies.sql";
const journalFinancePolicyBaseline = fs.readFileSync(journalFinancePolicyBaselinePath, "utf8");
const journalFinancePolicyVersion = "20260927140495";
const journalFinancePolicyTemporaryName = journalFinancePolicyVersion + "_test_only_live_derived_journal_finance_read_policies.sql";
const journalFinancePolicyMigration = migrations.find(({ name }) =>
  name === "20260927140500_remove_anonymous_sensitive_policy_access_v2.sql"
);
const journalFinancePolicyPriorCreation = migrations.some(({ name, sql }) =>
  name.slice(0, 14) < journalFinancePolicyMigration?.name.slice(0, 14) &&
  /create\s+policy\s+journal_entries_finance_read\s+on\s+(?:public\s*\.\s*)?journal_entries\b/i.test(sql)
) || migrations.some(({ name, sql }) =>
  name.slice(0, 14) < journalFinancePolicyMigration?.name.slice(0, 14) &&
  /create\s+policy\s+journal_entry_lines_finance_read\s+on\s+(?:public\s*\.\s*)?journal_entry_lines\b/i.test(sql)
);
const journalFinancePolicyBaselineValid =
  /READ-ONLY CATALOG-DERIVED TEST-ONLY POLICY COMPATIBILITY BASELINE/.test(journalFinancePolicyBaseline) &&
  /2026-10-13/.test(journalFinancePolicyBaseline) &&
  /moyhiluyhjsujhwlyeuu/.test(journalFinancePolicyBaseline) &&
  /NOT recovered historical policy-creation DDL/i.test(journalFinancePolicyBaseline) &&
  /MUST NOT be applied to production/i.test(journalFinancePolicyBaseline) &&
  /CREATE POLICY journal_entries_finance_read[\s\S]*ON public\.journal_entries[\s\S]*FOR\s+SELECT\s+TO\s+authenticated/i.test(journalFinancePolicyBaseline) &&
  /um\.tenant_id::text = journal_entries\.tenant_id::text/i.test(journalFinancePolicyBaseline) &&
  /CREATE POLICY journal_entry_lines_finance_read[\s\S]*ON public\.journal_entry_lines[\s\S]*FOR\s+SELECT\s+TO\s+authenticated/i.test(journalFinancePolicyBaseline) &&
  /je\.id::text = journal_entry_lines\.journal_entry_id::text/i.test(journalFinancePolicyBaseline) &&
  /um\.tenant_id::text = je\.tenant_id::text/i.test(journalFinancePolicyBaseline) &&
  /um\.user_id = \(SELECT auth\.uid\(\)\)/i.test(journalFinancePolicyBaseline) &&
  /um\.status::text = 'ACTIVE'/i.test(journalFinancePolicyBaseline) &&
  /OWNER[\s\S]*ADMIN[\s\S]*MANAGER[\s\S]*FINANCE[\s\S]*ACCOUNTANT[\s\S]*FINANCE_MANAGER/i.test(journalFinancePolicyBaseline) &&
  !/create table|alter table|\bgrant\b|\brevoke\b|create trigger/i.test(journalFinancePolicyBaseline) &&
  !/^\s*(?:insert\s+into|copy\s+(?:public|private)\.)/im.test(journalFinancePolicyBaseline);
const journalFinancePolicyFailureReasons = [
  ["missing ALTER POLICY migration", !journalFinancePolicyMigration],
  ["earlier source policy creator exists; fixture may duplicate history", journalFinancePolicyPriorCreation],
  ["live-derived fixture contract invalid", !journalFinancePolicyBaselineValid],
  ["temporary migration file already exists", fs.existsSync(path.join(migrationDirectory, journalFinancePolicyTemporaryName))],
  ["temporary version collision", migrations.some(({ name }) => name.slice(0, 14) === journalFinancePolicyVersion)],
  ["temporary version is not earlier than ALTER POLICY", !journalFinancePolicyMigration || journalFinancePolicyVersion >= journalFinancePolicyMigration.name.slice(0, 14)],
  ["expected ordered ALTER POLICY statements absent", !journalFinancePolicyMigration ||
    !/alter policy journal_entries_finance_read on public\.journal_entries to authenticated;/i.test(journalFinancePolicyMigration.sql) ||
    !/alter policy journal_entry_lines_finance_read on public\.journal_entry_lines to authenticated;/i.test(journalFinancePolicyMigration.sql)],
].filter(([, failed]) => failed);
if (journalFinancePolicyFailureReasons.length) {
  for (const [reason] of journalFinancePolicyFailureReasons) console.error("P0 BLOCKED journal finance policy baseline: " + reason);
  process.exit(1);
}

// Validate the catalog-derived general-ledger finance-read policy required by the same
// historical ALTER POLICY migration. This is a disposable-only compatibility fixture.
const generalLedgerPolicyBaselinePath = "supabase/tests/baselines/general_ledger_finance_read.sql";
const generalLedgerPolicyBaseline = fs.readFileSync(generalLedgerPolicyBaselinePath, "utf8");
const generalLedgerPolicyVersion = "20260927140497";
const generalLedgerPolicyTemporaryName = generalLedgerPolicyVersion + "_test_only_live_derived_general_ledger_finance_read.sql";
const generalLedgerPolicyMigration = migrations.find(({ name }) =>
  name === "20260927140500_remove_anonymous_sensitive_policy_access_v2.sql"
);
const generalLedgerPolicyPriorCreation = migrations.some(({ name, sql }) =>
  name.slice(0, 14) < generalLedgerPolicyMigration?.name.slice(0, 14) &&
  /create\s+policy\s+general_ledger_finance_read\s+on\s+(?:public\s*\.\s*)?general_ledger\b/i.test(sql)
);
const generalLedgerPolicyBaselineValid =
  /READ-ONLY CATALOG-DERIVED TEST-ONLY POLICY COMPATIBILITY BASELINE/.test(generalLedgerPolicyBaseline) &&
  /2026-10-13/.test(generalLedgerPolicyBaseline) &&
  /moyhiluyhjsujhwlyeuu/.test(generalLedgerPolicyBaseline) &&
  /NOT recovered historical policy-creation DDL/i.test(generalLedgerPolicyBaseline) &&
  /MUST NOT be applied to production/i.test(generalLedgerPolicyBaseline) &&
  /CREATE POLICY general_ledger_finance_read[\s\S]*ON public\.general_ledger[\s\S]*FOR\s+SELECT\s+TO\s+authenticated/i.test(generalLedgerPolicyBaseline) &&
  /um\.tenant_id::text = general_ledger\.tenant_id::text/i.test(generalLedgerPolicyBaseline) &&
  /um\.user_id = \(SELECT auth\.uid\(\)\)/i.test(generalLedgerPolicyBaseline) &&
  /um\.status::text = 'ACTIVE'/i.test(generalLedgerPolicyBaseline) &&
  /OWNER[\s\S]*ADMIN[\s\S]*MANAGER[\s\S]*FINANCE[\s\S]*ACCOUNTANT[\s\S]*FINANCE_MANAGER/i.test(generalLedgerPolicyBaseline) &&
  !/create table|alter table|\bgrant\b|\brevoke\b|create trigger/i.test(generalLedgerPolicyBaseline) &&
  !/^\s*(?:insert\s+into|copy\s+(?:public|private)\.)/im.test(generalLedgerPolicyBaseline);
const generalLedgerPolicyFailureReasons = [
  ["missing ALTER POLICY migration", !generalLedgerPolicyMigration],
  ["earlier source policy creator exists; fixture may duplicate history", generalLedgerPolicyPriorCreation],
  ["live-derived fixture contract invalid", !generalLedgerPolicyBaselineValid],
  ["temporary migration file already exists", fs.existsSync(path.join(migrationDirectory, generalLedgerPolicyTemporaryName))],
  ["temporary version collision", migrations.some(({ name }) => name.slice(0, 14) === generalLedgerPolicyVersion)],
  ["temporary version is not earlier than ALTER POLICY", !generalLedgerPolicyMigration || generalLedgerPolicyVersion >= generalLedgerPolicyMigration.name.slice(0, 14)],
  ["expected ordered ALTER POLICY statement absent", !generalLedgerPolicyMigration || !/alter policy general_ledger_finance_read on public\.general_ledger to authenticated;/i.test(generalLedgerPolicyMigration.sql)],
].filter(([, failed]) => failed);
if (generalLedgerPolicyFailureReasons.length) {
  for (const [reason] of generalLedgerPolicyFailureReasons) console.error("P0 BLOCKED general_ledger_finance_read: " + reason);
  process.exit(1);
}

// Validate the catalog-derived commission finance-read policy required by the ordered
// ALTER POLICY migration. This is test-only compatibility, never historical-source recovery.
const commissionPolicyBaselinePath = "supabase/tests/baselines/commission_transactions_finance_read.sql";
const commissionPolicyBaseline = fs.readFileSync(commissionPolicyBaselinePath, "utf8");
const commissionPolicyVersion = "20260927140498";
const commissionPolicyTemporaryName = commissionPolicyVersion + "_test_only_live_derived_commission_transactions_finance_read.sql";
const commissionPolicyMigration = migrations.find(({ name }) =>
  name === "20260927140500_remove_anonymous_sensitive_policy_access_v2.sql"
);
const commissionPolicyPriorCreation = migrations.some(({ name, sql }) =>
  name.slice(0, 14) < commissionPolicyMigration?.name.slice(0, 14) &&
  /create\s+policy\s+commission_transactions_finance_read\s+on\s+(?:public\s*\.\s*)?commission_transactions\b/i.test(sql)
);
const commissionPolicyBaselineValid =
  /READ-ONLY CATALOG-DERIVED TEST-ONLY POLICY COMPATIBILITY BASELINE/.test(commissionPolicyBaseline) &&
  /2026-10-13/.test(commissionPolicyBaseline) &&
  /moyhiluyhjsujhwlyeuu/.test(commissionPolicyBaseline) &&
  /NOT recovered historical policy-creation DDL/i.test(commissionPolicyBaseline) &&
  /MUST NOT be applied to production/i.test(commissionPolicyBaseline) &&
  /CREATE POLICY commission_transactions_finance_read[\s\S]*ON public\.commission_transactions[\s\S]*FOR\s+SELECT\s+TO\s+authenticated/i.test(commissionPolicyBaseline) &&
  /um\.tenant_id::text = commission_transactions\.tenant_id::text/i.test(commissionPolicyBaseline) &&
  /um\.user_id = \(SELECT auth\.uid\(\)\)/i.test(commissionPolicyBaseline) &&
  /um\.status::text = 'ACTIVE'/i.test(commissionPolicyBaseline) &&
  /OWNER[\s\S]*ADMIN[\s\S]*MANAGER[\s\S]*FINANCE[\s\S]*ACCOUNTANT[\s\S]*FINANCE_MANAGER/i.test(commissionPolicyBaseline) &&
  !/create table|alter table|\bgrant\b|\brevoke\b|create trigger/i.test(commissionPolicyBaseline) &&
  !/^\s*(?:insert\s+into|copy\s+(?:public|private)\.)/im.test(commissionPolicyBaseline);
const commissionPolicyFailureReasons = [
  ["missing ALTER POLICY migration", !commissionPolicyMigration],
  ["earlier source policy creator exists; fixture may duplicate history", commissionPolicyPriorCreation],
  ["live-derived fixture contract invalid", !commissionPolicyBaselineValid],
  ["temporary migration file already exists", fs.existsSync(path.join(migrationDirectory, commissionPolicyTemporaryName))],
  ["temporary version collision", migrations.some(({ name }) => name.slice(0, 14) === commissionPolicyVersion)],
  ["temporary version is not earlier than ALTER POLICY", !commissionPolicyMigration || commissionPolicyVersion >= commissionPolicyMigration.name.slice(0, 14)],
  ["expected ordered ALTER POLICY statement absent", !commissionPolicyMigration || !/alter policy commission_transactions_finance_read on public\.commission_transactions to authenticated;/i.test(commissionPolicyMigration.sql)],
].filter(([, failed]) => failed);
if (commissionPolicyFailureReasons.length) {
  for (const [reason] of commissionPolicyFailureReasons) console.error("P0 BLOCKED commission_transactions_finance_read: " + reason);
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

// Validate the live-derived SMM wallet table before RC456 hardens its table grants.
const smmWalletsBaselinePath = "supabase/tests/baselines/smm_wallets.sql";
const smmWalletsBaseline = fs.readFileSync(smmWalletsBaselinePath, "utf8");
const smmWalletsBoundaryMigration = migrations.find(({ name }) =>
  name === "20260927140500_remove_anonymous_sensitive_policy_access_v2.sql"
);
const smmWalletsBaselineVersion = "20260927140487";
const smmWalletsTemporaryName = smmWalletsBaselineVersion + "_test_only_live_derived_smm_wallets_baseline.sql";
const smmWalletsBaselineValid =
  /READ-ONLY CATALOG-VERIFIED TEST-ONLY COMPATIBILITY BASELINE/.test(smmWalletsBaseline) &&
  /2026-10-13/.test(smmWalletsBaseline) &&
  /moyhiluyhjsujhwlyeuu/.test(smmWalletsBaseline) &&
  /NOT recovered historical creation DDL/.test(smmWalletsBaseline) &&
  /MUST NEVER be applied to production/.test(smmWalletsBaseline) &&
  /create table public\.smm_wallets/i.test(smmWalletsBaseline) &&
  /user_id uuid primary key references auth\.users\(id\) on delete cascade/i.test(smmWalletsBaseline) &&
  /balance numeric\(18,8\) not null default 0 check \(balance >= 0\)/i.test(smmWalletsBaseline) &&
  /currency text not null default 'USD'/i.test(smmWalletsBaseline) &&
  /updated_at timestamptz not null default now\(\)/i.test(smmWalletsBaseline) &&
  /alter table public\.smm_wallets enable row level security/i.test(smmWalletsBaseline) &&
  /create policy smm_wallet_owner_read[\s\S]*for select[\s\S]*to authenticated[\s\S]*auth\.uid\(\)[\s\S]*user_id/i.test(smmWalletsBaseline) &&
  !/^\s*(?:insert\s+into|copy\s+public\.)/im.test(smmWalletsBaseline) &&
  !/force row level security|\bgrant\b|\btrigger\b/i.test(smmWalletsBaseline);
if (!smmWalletsBoundaryMigration || !smmWalletsBaselineValid ||
    fs.existsSync(path.join(migrationDirectory, smmWalletsTemporaryName)) ||
    migrations.some(({ name }) => name.slice(0, 14) === smmWalletsBaselineVersion) ||
    smmWalletsBaselineVersion >= smmWalletsBoundaryMigration.name.slice(0, 14)) {
  console.error("P0 BLOCKED: SMM wallet live-derived baseline or chronological policy-alter contract is invalid.");
  process.exit(1);
}

// Validate the live-derived SMM wallet-transaction table and owner-read policy
// required by the historical migration that changes policy role scope.
const smmWalletTransactionsBaselinePath = "supabase/tests/baselines/smm_wallet_transactions.sql";
const smmWalletTransactionsBaseline = fs.readFileSync(smmWalletTransactionsBaselinePath, "utf8");
const smmWalletTransactionsPolicyMigration = migrations.find(({ name }) =>
  name === "20260927140500_remove_anonymous_sensitive_policy_access_v2.sql"
);
const smmWalletTransactionsBaselineVersion = "20260927140488";
const smmWalletTransactionsTemporaryName = smmWalletTransactionsBaselineVersion + "_test_only_live_derived_smm_wallet_transactions_baseline.sql";
const smmWalletTransactionsBaselineValid =
  /READ-ONLY CATALOG-VERIFIED TEST-ONLY COMPATIBILITY BASELINE/.test(smmWalletTransactionsBaseline) &&
  /2026-10-13/.test(smmWalletTransactionsBaseline) &&
  /moyhiluyhjsujhwlyeuu/.test(smmWalletTransactionsBaseline) &&
  /NOT recovered historical creation DDL/.test(smmWalletTransactionsBaseline) &&
  /MUST NEVER be applied to production/.test(smmWalletTransactionsBaseline) &&
  /create table public\.smm_wallet_transactions/i.test(smmWalletTransactionsBaseline) &&
  /id uuid primary key default gen_random_uuid\(\)/i.test(smmWalletTransactionsBaseline) &&
  /user_id uuid not null references auth\.users\(id\) on delete cascade/i.test(smmWalletTransactionsBaseline) &&
  /amount numeric\(18,8\) not null/i.test(smmWalletTransactionsBaseline) &&
  /type text not null check \(type = any \(array\['CREDIT','DEBIT','REFUND','ADJUSTMENT'\]::text\[\]\)\)/i.test(smmWalletTransactionsBaseline) &&
  /reference_id uuid/i.test(smmWalletTransactionsBaseline) &&
  /alter table public\.smm_wallet_transactions enable row level security/i.test(smmWalletTransactionsBaseline) &&
  /create policy smm_wallet_tx_owner_read[\s\S]*for select[\s\S]*to authenticated[\s\S]*auth\.uid\(\)[\s\S]*user_id/i.test(smmWalletTransactionsBaseline) &&
  !/^\s*(?:insert\s+into|copy\s+public\.)/im.test(smmWalletTransactionsBaseline) &&
  !/force row level security|\bgrant\b|\btrigger\b/i.test(smmWalletTransactionsBaseline);
if (!smmWalletTransactionsPolicyMigration || !smmWalletTransactionsBaselineValid ||
    fs.existsSync(path.join(migrationDirectory, smmWalletTransactionsTemporaryName)) ||
    migrations.some(({ name }) => name.slice(0, 14) === smmWalletTransactionsBaselineVersion) ||
    smmWalletTransactionsBaselineVersion >= smmWalletTransactionsPolicyMigration.name.slice(0, 14)) {
  console.error("P0 BLOCKED: SMM wallet transaction live-derived baseline or chronological policy contract is invalid.");
  process.exit(1);
}

// Validate the live-derived SMM service catalog and its public-active read policy.
// This compatibility source exists only in the disposable replay.
const smmServicesBaselinePath = "supabase/tests/baselines/smm_services.sql";
const smmServicesBaseline = fs.readFileSync(smmServicesBaselinePath, "utf8");
const smmServicesPolicyMigration = migrations.find(({ name }) =>
  name === "20260927140500_remove_anonymous_sensitive_policy_access_v2.sql"
);
const smmServicesBaselineVersion = "20260927140489";
const smmServicesTemporaryName = smmServicesBaselineVersion + "_test_only_live_derived_smm_services_baseline.sql";
const smmServicesBaselineValid =
  /READ-ONLY CATALOG-VERIFIED TEST-ONLY COMPATIBILITY BASELINE/.test(smmServicesBaseline) &&
  /2026-10-13/.test(smmServicesBaseline) &&
  /moyhiluyhjsujhwlyeuu/.test(smmServicesBaseline) &&
  /NOT recovered historical creation DDL/.test(smmServicesBaseline) &&
  /MUST NEVER be applied to production/.test(smmServicesBaseline) &&
  /create table public\.smm_services/i.test(smmServicesBaseline) &&
  /id uuid primary key default gen_random_uuid\(\)/i.test(smmServicesBaseline) &&
  /provider_id uuid not null references public\.smm_providers\(id\) on delete cascade/i.test(smmServicesBaseline) &&
  /external_service_id text not null/i.test(smmServicesBaseline) &&
  /provider_cost numeric\(18,8\) not null default 0 check \(provider_cost >= 0\)/i.test(smmServicesBaseline) &&
  /selling_price numeric\(18,8\) not null default 0 check \(selling_price >= 0\)/i.test(smmServicesBaseline) &&
  /min_quantity bigint not null default 1 check \(min_quantity > 0\)/i.test(smmServicesBaseline) &&
  /max_quantity bigint not null default 1000000 check \(max_quantity >= min_quantity\)/i.test(smmServicesBaseline) &&
  /unique \(provider_id, external_service_id\)/i.test(smmServicesBaseline) &&
  /create index smm_services_platform_idx on public\.smm_services\(platform, active\)/i.test(smmServicesBaseline) &&
  /alter table public\.smm_services enable row level security/i.test(smmServicesBaseline) &&
  /create policy smm_services_public_read[\s\S]*for select[\s\S]*to anon, authenticated[\s\S]*using \(active = true\)/i.test(smmServicesBaseline) &&
  !/^\s*(?:insert\s+into|copy\s+public\.)/im.test(smmServicesBaseline) &&
  !/force row level security|\bgrant\b|\btrigger\b/i.test(smmServicesBaseline);
if (!smmServicesPolicyMigration || !smmServicesBaselineValid ||
    fs.existsSync(path.join(migrationDirectory, smmServicesTemporaryName)) ||
    migrations.some(({ name }) => name.slice(0, 14) === smmServicesBaselineVersion) ||
    smmServicesBaselineVersion >= smmServicesPolicyMigration.name.slice(0, 14)) {
  console.error("P0 BLOCKED: SMM services live-derived baseline or chronological policy contract is invalid.");
  process.exit(1);
}

// Validate the live-derived SMM order table and its owner policies before the
// historical migration that alters those policies. Disposable compatibility only.
const smmOrdersBaselinePath = "supabase/tests/baselines/smm_orders.sql";
const smmOrdersBaseline = fs.readFileSync(smmOrdersBaselinePath, "utf8");
const smmOrdersPolicyMigration = migrations.find(({ name }) =>
  name === "20260927140500_remove_anonymous_sensitive_policy_access_v2.sql"
);
const smmOrdersBaselineVersion = "20260927140490";
const smmOrdersTemporaryName = smmOrdersBaselineVersion + "_test_only_live_derived_smm_orders_baseline.sql";
const smmOrdersBaselineValid =
  /READ-ONLY CATALOG-VERIFIED TEST-ONLY COMPATIBILITY BASELINE/.test(smmOrdersBaseline) &&
  /2026-10-13/.test(smmOrdersBaseline) &&
  /moyhiluyhjsujhwlyeuu/.test(smmOrdersBaseline) &&
  /NOT recovered historical creation DDL/.test(smmOrdersBaseline) &&
  /MUST NEVER be applied to production/.test(smmOrdersBaseline) &&
  /create table public\.smm_orders/i.test(smmOrdersBaseline) &&
  /id uuid primary key default gen_random_uuid\(\)/i.test(smmOrdersBaseline) &&
  /user_id uuid not null references auth\.users\(id\) on delete cascade/i.test(smmOrdersBaseline) &&
  /service_id uuid not null references public\.smm_services\(id\)/i.test(smmOrdersBaseline) &&
  /quantity bigint not null check \(quantity > 0\)/i.test(smmOrdersBaseline) &&
  /selling_price numeric\(18,8\) not null check \(selling_price >= 0\)/i.test(smmOrdersBaseline) &&
  /provider_cost numeric\(18,8\) not null default 0 check \(provider_cost >= 0\)/i.test(smmOrdersBaseline) &&
  /status text not null default 'PENDING'[\s\S]*'REFUNDED'[\s\S]*'FAILED'/i.test(smmOrdersBaseline) &&
  /metadata jsonb not null default '\{\}'::jsonb/i.test(smmOrdersBaseline) &&
  /create index smm_orders_status_idx on public\.smm_orders\(status, created_at desc\)/i.test(smmOrdersBaseline) &&
  /create index smm_orders_user_idx on public\.smm_orders\(user_id, created_at desc\)/i.test(smmOrdersBaseline) &&
  /alter table public\.smm_orders enable row level security/i.test(smmOrdersBaseline) &&
  /create policy smm_orders_owner_insert[\s\S]*for insert[\s\S]*to authenticated[\s\S]*with check \(/i.test(smmOrdersBaseline) &&
  /create policy smm_orders_owner_read[\s\S]*for select[\s\S]*to authenticated[\s\S]*auth\.uid\(\)[\s\S]*user_id/i.test(smmOrdersBaseline) &&
  !/^\s*(?:insert\s+into|copy\s+public\.)/im.test(smmOrdersBaseline) &&
  !/force row level security|\bgrant\b|\btrigger\b/i.test(smmOrdersBaseline);
if (!smmOrdersPolicyMigration || !smmOrdersBaselineValid ||
    fs.existsSync(path.join(migrationDirectory, smmOrdersTemporaryName)) ||
    migrations.some(({ name }) => name.slice(0, 14) === smmOrdersBaselineVersion) ||
    smmOrdersBaselineVersion >= smmOrdersPolicyMigration.name.slice(0, 14) ||
    !/alter policy smm_orders_owner_read on public\.smm_orders to authenticated;/i.test(smmOrdersPolicyMigration.sql)) {
  console.error("P0 BLOCKED: SMM orders live-derived baseline or chronological policy-alter contract is invalid.");
  process.exit(1);
}

// Validate the live-derived SMM order-event table and owner-read policy required by
// the historical migration that alters this policy. This fixture is schema-only and
// exists only in the disposable replay; it does not grant access or insert rows.
const smmOrderEventsBaselinePath = "supabase/tests/baselines/smm_order_events.sql";
const smmOrderEventsBaseline = fs.readFileSync(smmOrderEventsBaselinePath, "utf8");
const smmOrderEventsPolicyMigration = migrations.find(({ name }) =>
  name === "20260927140500_remove_anonymous_sensitive_policy_access_v2.sql"
);
const smmOrderEventsBaselineVersion = "20260927140491";
const smmOrderEventsTemporaryName = smmOrderEventsBaselineVersion + "_test_only_live_derived_smm_order_events_baseline.sql";
const smmOrderEventsBaselineValid =
  /READ-ONLY CATALOG-VERIFIED TEST-ONLY COMPATIBILITY BASELINE/.test(smmOrderEventsBaseline) &&
  /2026-10-13/.test(smmOrderEventsBaseline) &&
  /moyhiluyhjsujhwlyeuu/.test(smmOrderEventsBaseline) &&
  /NOT recovered historical creation DDL/.test(smmOrderEventsBaseline) &&
  /MUST NEVER be applied to production/.test(smmOrderEventsBaseline) &&
  /create table public\.smm_order_events/i.test(smmOrderEventsBaseline) &&
  /id uuid primary key default gen_random_uuid\(\)/i.test(smmOrderEventsBaseline) &&
  /order_id uuid not null references public\.smm_orders\(id\) on delete cascade/i.test(smmOrderEventsBaseline) &&
  /event_type text not null/i.test(smmOrderEventsBaseline) &&
  /payload jsonb not null default '\{\}'::jsonb/i.test(smmOrderEventsBaseline) &&
  /created_at timestamptz not null default now\(\)/i.test(smmOrderEventsBaseline) &&
  /alter table public\.smm_order_events enable row level security/i.test(smmOrderEventsBaseline) &&
  /create policy smm_order_events_owner_read[\s\S]*for select[\s\S]*to authenticated[\s\S]*o\.id = smm_order_events\.order_id[\s\S]*o\.user_id = \(select auth\.uid\(\)\)/i.test(smmOrderEventsBaseline) &&
  !/^\s*(?:insert\s+into|copy\s+public\.)/im.test(smmOrderEventsBaseline) &&
  !/force row level security|\bgrant\b|\btrigger\b/i.test(smmOrderEventsBaseline);
if (!smmOrderEventsPolicyMigration || !smmOrderEventsBaselineValid ||
    fs.existsSync(path.join(migrationDirectory, smmOrderEventsTemporaryName)) ||
    migrations.some(({ name }) => name.slice(0, 14) === smmOrderEventsBaselineVersion) ||
    smmOrderEventsBaselineVersion >= smmOrderEventsPolicyMigration.name.slice(0, 14) ||
    !/alter policy smm_order_events_owner_read on public\.smm_order_events to authenticated;/i.test(smmOrderEventsPolicyMigration.sql)) {
  console.error("P0 BLOCKED: SMM order-event live-derived baseline or chronological policy-alter contract is invalid.");
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
// Test-only compatibility version: exact live schema, not historical DDL or a production migration.
const adminsBaselineVersion = "20260927033923";
const createsAdminsTable = migrations.some(({ sql }) =>
  /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:(?:"?public"?)\s*\.\s*)?"?smm_admins"?\b/i.test(sql)
);

for (const baselinePath of [adminsBaselinePath, providerBaselinePath, credentialsBaselinePath]) {
  if (!fs.existsSync(baselinePath)) {
    console.error("P0 BLOCKED: owner-approved test-only schema baseline is missing at " + baselinePath);
    process.exit(1);
  }
}

const smmProviderPolicyMigration = migrations.find(({ name }) => name === "20261001000000_security_hardening_private_tables_geo_rpc.sql");
const providerBaseline = fs.readFileSync(providerBaselinePath, "utf8");
const providerChecks = [
  ["observed provider columns and defaults", /id\s+uuid\s+not\s+null\s+default\s+gen_random_uuid\(\)/i.test(providerBaseline) && /name\s+text\s+not\s+null/i.test(providerBaseline) && /api_url\s+text\s+not\s+null/i.test(providerBaseline) && /api_style\s+text\s+not\s+null\s+default\s+'generic'/i.test(providerBaseline) && /active\s+boolean\s+not\s+null\s+default\s+false/i.test(providerBaseline) && /priority\s+integer\s+not\s+null\s+default\s+100/i.test(providerBaseline) && /created_at\s+timestamptz\s+not\s+null\s+default\s+now\(\)/i.test(providerBaseline) && /updated_at\s+timestamptz\s+not\s+null\s+default\s+now\(\)/i.test(providerBaseline)],
  ["provider primary key and unique name", /primary\s+key\s*\(\s*id\s*\)/i.test(providerBaseline) && /unique\s*\(\s*name\s*\)/i.test(providerBaseline)],
  ["provider RLS enabled without duplicating policies owned by chronology", /enable\s+row\s+level\s+security/i.test(providerBaseline) && !/create\s+policy/i.test(providerBaseline) && !!smmProviderPolicyMigration && /create\s+policy\s+"deny_direct_access_authenticated"\s+on\s+public\.smm_providers/i.test(smmProviderPolicyMigration.sql) && /create\s+policy\s+"deny_direct_access_anon"\s+on\s+public\.smm_providers/i.test(smmProviderPolicyMigration.sql)],
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

const adminsBaseline = fs.readFileSync(adminsBaselinePath, "utf8");
const adminsChecks = [
  ["admin table has exact observed UUID user_id and timestamp columns", /user_id\s+uuid\s+not\s+null/i.test(adminsBaseline) && /created_at\s+timestamptz\s+not\s+null\s+default\s+now\(\)/i.test(adminsBaseline)],
  ["admin table has primary key and auth.users cascade foreign key", /primary\s+key\s*\(\s*user_id\s*\)/i.test(adminsBaseline) && /foreign\s+key\s*\(\s*user_id\s*\)[\s\S]*references\s+auth\.users\s*\(\s*id\s*\)[\s\S]*on\s+delete\s+cascade/i.test(adminsBaseline)],
  ["admin table enables RLS without inventing policies or FORCE RLS", /enable\s+row\s+level\s+security/i.test(adminsBaseline) && !/force\s+row\s+level\s+security|create\s+policy/i.test(adminsBaseline)],
  ["admin table has no direct privileges and matches observed service_role ACL", /revoke\s+all[\s\S]*from\s+public\s*,\s*anon\s*,\s*authenticated\s*,\s*service_role/i.test(adminsBaseline) && /grant\s+references\s*,\s*trigger\s*,\s*truncate[\s\S]*to\s+service_role/i.test(adminsBaseline)],
  ["admin baseline has approved source provenance and test-only warning", /2026-10-14/i.test(adminsBaseline) && /moyhiluyhjsujhwlyeuu/i.test(adminsBaseline) && /read-only PostgreSQL catalog introspection/i.test(adminsBaseline) && /NOT recovered historical DDL/i.test(adminsBaseline) && /Never apply this file to production/i.test(adminsBaseline)],
  ["admin baseline contains no production data or operational mutations", !/^\s*(?:insert\s+into|update\s+public\.|delete\s+from|copy\s+public\.)/im.test(adminsBaseline)],
];
const failed = [...providerChecks, ...credentialsChecks, ...adminsChecks].filter(([, ok]) => !ok);
if (failed.length) {
  for (const [name] of failed) console.error("P0 BLOCKED: test baseline validation failed: " + name);
  process.exit(1);
}
if (createsCredentialsTable || createsProvidersTable || createsAdminsTable) {
  console.error("P0 BLOCKED: do not add guessed/backdated production migrations for the SMM baseline tables; reconcile any authoritative historical creation migration before replay.");
  process.exit(1);
}
if (!firstCredentialReference) {
  console.error("P0 BLOCKED: no migration references smm_provider_credentials; expected historical privilege migration was not found.");
  process.exit(1);
}
const firstAdminsReference = migrations.find(({ sql }) => /smm_admins/i.test(sql));
if (!firstAdminsReference || adminsBaselineVersion >= firstAdminsReference.name.slice(0, 14)) {
  console.error("P0 BLOCKED: SMM admins baseline does not sort before its first dependent migration.");
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
  [adminsBaselineVersion, adminsBaselineVersion + "_test_only_approved_smm_admins_baseline.sql"],
]) {
  if (fs.existsSync(path.join(migrationDirectory, temporaryName))) {
    console.error("P0 BLOCKED: temporary test-only migration filename already exists in repository: " + temporaryName);
    process.exit(1);
  }
}

 // Wallet transactions policy fixture: exact predicate from read-only live pg_policies.
 // Test-only compatibility input; not historical DDL and never for production.
 const walletTransactionsPolicyMigration = migrations.find(({ name }) => name === "20260927140500_remove_anonymous_sensitive_policy_access_v2.sql");
 const walletTransactionsPolicyBaselinePath = "supabase/tests/baselines/wallet_transactions_finance_read.sql";
 const walletTransactionsPolicyBaseline = fs.existsSync(walletTransactionsPolicyBaselinePath) ? fs.readFileSync(walletTransactionsPolicyBaselinePath, "utf8") : "";
 const walletTransactionsPolicyBaselineVersion = "20260927140485";
 const walletTransactionsPolicyTemporaryName = walletTransactionsPolicyBaselineVersion + "_test_only_live_derived_wallet_transactions_finance_read.sql";
 const walletTransactionsPolicyBaselineValid =
   /READ-ONLY CATALOG-DERIVED TEST-ONLY POLICY COMPATIBILITY BASELINE/.test(walletTransactionsPolicyBaseline) &&
   /moyhiluyhjsujhwlyeuu/.test(walletTransactionsPolicyBaseline) &&
   /2026-10-13/.test(walletTransactionsPolicyBaseline) &&
   /NOT recovered historical policy-creation DDL/.test(walletTransactionsPolicyBaseline) &&
   /MUST NOT be applied to production/.test(walletTransactionsPolicyBaseline) &&
   /CREATE POLICY wallet_transactions_finance_read[\s\S]*ON public\.wallet_transactions[\s\S]*FOR SELECT[\s\S]*TO authenticated[\s\S]*um\.tenant_id::text = wallet_transactions\.tenant_id::text[\s\S]*um\.status::text = 'ACTIVE'[\s\S]*OWNER','ADMIN','MANAGER','FINANCE','ACCOUNTANT','FINANCE_MANAGER/.test(walletTransactionsPolicyBaseline) &&
   !/\b(insert\s+into|copy\s+(public|private)\.)/i.test(walletTransactionsPolicyBaseline);
 if (!walletTransactionsPolicyMigration || !walletTransactionsPolicyBaselineValid ||
     fs.existsSync(path.join(migrationDirectory, walletTransactionsPolicyTemporaryName)) ||
     migrations.some(({ name }) => name.slice(0, 14) === walletTransactionsPolicyBaselineVersion) ||
     walletTransactionsPolicyBaselineVersion >= walletTransactionsPolicyMigration.name.slice(0, 14) ||
     !/alter policy wallet_transactions_finance_read on public\.wallet_transactions to authenticated;/i.test(walletTransactionsPolicyMigration.sql)) {
   console.error("P0 BLOCKED: wallet_transactions finance-read test fixture failed provenance, tenant-scope, no-data, no-collision, or ordering validation.");
   process.exit(1);
 }

// MantiGO open-rides compatibility function: exact definition from the captured live
// schema at the RC424 checkpoint, injected only into disposable replay before an earlier GRANT.
// It is not the historical creation migration and cannot close source-provenance review.
const mantigoOpenRidesBaselinePath = "supabase/tests/baselines/mantigo_open_rides_function.sql";
const mantigoOpenRidesBaseline = fs.existsSync(mantigoOpenRidesBaselinePath)
  ? fs.readFileSync(mantigoOpenRidesBaselinePath, "utf8")
  : "";
const mantigoOpenRidesWorkflowPath = ".github/workflows/migration-chain-replay.yml";
const mantigoOpenRidesWorkflow = fs.existsSync(mantigoOpenRidesWorkflowPath)
  ? fs.readFileSync(mantigoOpenRidesWorkflowPath, "utf8")
  : "";
const mantigoOpenRidesTemporaryVersion = "20261006101047";
const mantigoOpenRidesTemporaryName = mantigoOpenRidesTemporaryVersion + "_test_only_live_derived_mantigo_open_rides_baseline.sql";
const mantigoOpenRidesBaselineValid =
  /TEST-ONLY compatibility baseline for disposable migration-chain replay/i.test(mantigoOpenRidesBaseline) &&
  /production schema-only snapshot captured 2026-10-17T02:10:22Z/i.test(mantigoOpenRidesBaseline) &&
  /8d096904c777b4c7eae096014b45c59859c96cee/.test(mantigoOpenRidesBaseline) &&
  /NOT claimed to be the original creation migration/i.test(mantigoOpenRidesBaseline) &&
  /Never apply this file to production/i.test(mantigoOpenRidesBaseline) &&
  /CREATE OR REPLACE FUNCTION public\.list_open_mantigo_rides_backend\s*\(\s*p_user_id\s+uuid\s*\)[\s\S]*RETURNS TABLE/i.test(mantigoOpenRidesBaseline) &&
  /CREATE OR REPLACE FUNCTION public\.list_mantigo_captain_rides_backend\s*\(\s*p_user_id\s+uuid\s*\)[\s\S]*RETURNS TABLE/i.test(mantigoOpenRidesBaseline) &&
  /SECURITY DEFINER[\s\S]*SET search_path = public/i.test(mantigoOpenRidesBaseline) &&
  /USER_CONTEXT_MISMATCH/i.test(mantigoOpenRidesBaseline) &&
  /status IN \('OPEN', 'OPEN_FOR_BIDS'\)/i.test(mantigoOpenRidesBaseline) &&
  /b\.status = 'ACCEPTED'/i.test(mantigoOpenRidesBaseline) &&
  /GROUP BY r\.id/i.test(mantigoOpenRidesBaseline) &&
  !/\b(insert\s+into|update\s+public\.|delete\s+from|copy\s+(public|private)\.)/i.test(mantigoOpenRidesBaseline);
const mantigoOpenRidesWorkflowValid =
  mantigoOpenRidesWorkflow.includes(mantigoOpenRidesBaselinePath) &&
  mantigoOpenRidesWorkflow.includes(mantigoOpenRidesTemporaryName) &&
  mantigoOpenRidesWorkflow.includes('cp "$mantigo_open_rides_baseline" "$mantigo_open_rides_migration"') &&
  mantigoOpenRidesWorkflow.includes('cmp -s "$mantigo_open_rides_baseline" "$mantigo_open_rides_migration"') &&
  mantigoOpenRidesWorkflow.includes('mantigo_open_rides_migration=') &&
  mantigoOpenRidesWorkflow.includes('git ls-files --error-unmatch "$file"') &&
  /for file in [^\n]*"\$mantigo_open_rides_migration"[^\n]*; do ! git ls-files --error-unmatch "\$file"/.test(mantigoOpenRidesWorkflow);
if (!mantigoOpenRidesBaselineValid || !mantigoOpenRidesWorkflowValid ||
    fs.existsSync(path.join(migrationDirectory, mantigoOpenRidesTemporaryName)) ||
    migrations.some(({ name }) => name.slice(0, 14) === mantigoOpenRidesTemporaryVersion)) {
  console.error("P0 BLOCKED: MantiGO open-rides test-only baseline failed provenance, function-contract, no-data, workflow-injection, or no-collision validation.");
  process.exit(1);
}

// MantiGO financial-config table compatibility: use only the exact CREATE TABLE
// statement from the tracked RC financial-ledger migration. This addresses the
// replay's timestamp ordering (the earlier RLS hardening migration runs first),
// without fabricating schema or modifying historical migrations.
const mantigoFinancialConfigBaselinePath = "supabase/tests/baselines/mantigo_financial_config.sql";
const mantigoFinancialConfigBaseline = fs.existsSync(mantigoFinancialConfigBaselinePath)
  ? fs.readFileSync(mantigoFinancialConfigBaselinePath, "utf8")
  : "";
const mantigoFinancialConfigSource = migrations.find(({ name }) => name === "20261006152000_mantigo_financial_ledger_v1.sql");
const mantigoFinancialConfigSourceDdl = mantigoFinancialConfigSource?.sql.match(/create table if not exists public\.mantigo_financial_config\s*\([\s\S]*?\);/i)?.[0] ?? "";
const mantigoFinancialConfigBaselineDdl = mantigoFinancialConfigBaseline.match(/create table if not exists public\.mantigo_financial_config\s*\([\s\S]*?\);/i)?.[0] ?? "";
const normalizeSql = (sql) => sql.replace(/\s+/g, " ").trim().replace(/;$/, "").toLowerCase();
const mantigoFinancialConfigTemporaryVersion = "20261006122110";
const mantigoFinancialConfigTemporaryName = mantigoFinancialConfigTemporaryVersion + "_test_only_tracked_source_mantigo_financial_config_baseline.sql";
const mantigoFinancialConfigWorkflowPath = ".github/workflows/migration-chain-replay.yml";
const mantigoFinancialConfigWorkflow = fs.existsSync(mantigoFinancialConfigWorkflowPath)
  ? fs.readFileSync(mantigoFinancialConfigWorkflowPath, "utf8")
  : "";
const mantigoFinancialConfigBaselineValid =
  /TEST-ONLY schema compatibility baseline for disposable migration-chain replay/i.test(mantigoFinancialConfigBaseline) &&
  /tracked migration 20261006152000_mantigo_financial_ledger_v1\.sql/i.test(mantigoFinancialConfigBaseline) &&
  /must never[\s\S]{0,40}be applied to production/i.test(mantigoFinancialConfigBaseline) &&
  /id boolean primary key default true check \(id=true\)/i.test(mantigoFinancialConfigBaseline) &&
  /commission_rate numeric\(6,3\) not null check \(commission_rate>=0 and commission_rate<=100\)/i.test(mantigoFinancialConfigBaseline) &&
  mantigoFinancialConfigSourceDdl.length > 0 &&
  normalizeSql(mantigoFinancialConfigBaselineDdl) === normalizeSql(mantigoFinancialConfigSourceDdl) &&
  !/\b(insert\s+into|update\s+public\.|delete\s+from|copy\s+(public|private)\.)/i.test(mantigoFinancialConfigBaseline);
const mantigoFinancialConfigWorkflowValid =
  mantigoFinancialConfigWorkflow.includes(mantigoFinancialConfigBaselinePath) &&
  mantigoFinancialConfigWorkflow.includes(mantigoFinancialConfigTemporaryName) &&
  mantigoFinancialConfigWorkflow.includes('cp "$mantigo_financial_config_baseline" "$mantigo_financial_config_migration"') &&
  mantigoFinancialConfigWorkflow.includes('cmp -s "$mantigo_financial_config_baseline" "$mantigo_financial_config_migration"') &&
  mantigoFinancialConfigWorkflow.includes('mantigo_financial_config_migration=') &&
  mantigoFinancialConfigWorkflow.includes('git ls-files --error-unmatch "$file"') &&
  /for file in [^\n]*"\$mantigo_financial_config_migration"[^\n]*; do ! git ls-files --error-unmatch "\$file"/.test(mantigoFinancialConfigWorkflow);
if (!mantigoFinancialConfigBaselineValid || !mantigoFinancialConfigWorkflowValid ||
    fs.existsSync(path.join(migrationDirectory, mantigoFinancialConfigTemporaryName)) ||
    migrations.some(({ name }) => name.slice(0, 14) === mantigoFinancialConfigTemporaryVersion) ||
    !mantigoFinancialConfigSource || mantigoFinancialConfigTemporaryVersion >= mantigoFinancialConfigSource.name.slice(0, 14) ||
    mantigoFinancialConfigTemporaryVersion >= "20261006122111") {
  console.error("P0 BLOCKED: MantiGO financial-config replay baseline failed source equality, no-data, workflow-injection, or version-order validation.");
  process.exit(1);
}
console.warn("P0 LIMITATION: MantiGO financial-config table replay baseline is copied from a later tracked migration only for disposable replay; chronological source ordering remains unresolved.");

// MantiGO financial-ledger table compatibility: exact table DDL from the later
// tracked ledger migration, injected only before an earlier function consumer in
// disposable replay. No historical migration is rewritten and no production DDL runs.
const mantigoFinancialLedgerBaselinePath = "supabase/tests/baselines/mantigo_financial_ledger.sql";
const mantigoFinancialLedgerBaseline = fs.existsSync(mantigoFinancialLedgerBaselinePath)
  ? fs.readFileSync(mantigoFinancialLedgerBaselinePath, "utf8")
  : "";
const mantigoFinancialLedgerSource = migrations.find(({ name }) => name === "20261006152000_mantigo_financial_ledger_v1.sql");
const mantigoFinancialLedgerSourceDdl = mantigoFinancialLedgerSource?.sql.match(/create table if not exists public\.mantigo_financial_ledger\s*\([\s\S]*?\);/i)?.[0] ?? "";
const mantigoFinancialLedgerBaselineDdl = mantigoFinancialLedgerBaseline.match(/create table if not exists public\.mantigo_financial_ledger\s*\([\s\S]*?\);/i)?.[0] ?? "";
const mantigoFinancialLedgerTemporaryVersion = "20261006140559";
const mantigoFinancialLedgerTemporaryName = mantigoFinancialLedgerTemporaryVersion + "_test_only_tracked_source_mantigo_financial_ledger_baseline.sql";
const mantigoFinancialLedgerWorkflowPath = ".github/workflows/migration-chain-replay.yml";
const mantigoFinancialLedgerWorkflow = fs.existsSync(mantigoFinancialLedgerWorkflowPath)
  ? fs.readFileSync(mantigoFinancialLedgerWorkflowPath, "utf8")
  : "";
const mantigoFinancialLedgerBaselineValid =
  /TEST-ONLY schema compatibility baseline for disposable migration-chain replay/i.test(mantigoFinancialLedgerBaseline) &&
  /tracked migration 20261006152000_mantigo_financial_ledger_v1\.sql/i.test(mantigoFinancialLedgerBaseline) &&
  /must never apply to production/i.test(mantigoFinancialLedgerBaseline) &&
  /id text primary key/i.test(mantigoFinancialLedgerBaseline) &&
  /ride_id text not null unique references public\.mantigo_rides\(id\) on delete restrict/i.test(mantigoFinancialLedgerBaseline) &&
  /idempotency_key text not null unique/i.test(mantigoFinancialLedgerBaseline) &&
  mantigoFinancialLedgerSourceDdl.length > 0 &&
  normalizeSql(mantigoFinancialLedgerBaselineDdl) === normalizeSql(mantigoFinancialLedgerSourceDdl) &&
  !/\b(insert\s+into|update\s+public\.|delete\s+from|copy\s+(public|private)\.)/i.test(mantigoFinancialLedgerBaseline);
const mantigoFinancialLedgerWorkflowValid =
  mantigoFinancialLedgerWorkflow.includes(mantigoFinancialLedgerBaselinePath) &&
  mantigoFinancialLedgerWorkflow.includes(mantigoFinancialLedgerTemporaryName) &&
  mantigoFinancialLedgerWorkflow.includes('cp "$mantigo_financial_ledger_baseline" "$mantigo_financial_ledger_migration"') &&
  mantigoFinancialLedgerWorkflow.includes('cmp -s "$mantigo_financial_ledger_baseline" "$mantigo_financial_ledger_migration"') &&
  mantigoFinancialLedgerWorkflow.includes('mantigo_financial_ledger_migration=') &&
  mantigoFinancialLedgerWorkflow.includes('git ls-files --error-unmatch "$file"') &&
  /for file in [^\n]*"\$mantigo_financial_ledger_migration"[^\n]*; do ! git ls-files --error-unmatch "\$file"/.test(mantigoFinancialLedgerWorkflow);
if (!mantigoFinancialLedgerBaselineValid || !mantigoFinancialLedgerWorkflowValid ||
    fs.existsSync(path.join(migrationDirectory, mantigoFinancialLedgerTemporaryName)) ||
    migrations.some(({ name }) => name.slice(0, 14) === mantigoFinancialLedgerTemporaryVersion) ||
    !mantigoFinancialLedgerSource || mantigoFinancialLedgerTemporaryVersion >= mantigoFinancialLedgerSource.name.slice(0, 14) ||
    mantigoFinancialLedgerTemporaryVersion >= "20261006140601") {
  console.error("P0 BLOCKED: MantiGO financial-ledger replay baseline failed source equality, no-data, workflow-injection, or version-order validation.");
  process.exit(1);
}
console.warn("P0 LIMITATION: MantiGO financial-ledger table replay baseline is copied from a later tracked migration only for disposable replay; chronological source ordering remains unresolved.");

console.warn("P0 LIMITATION: MantiGO read functions are live-derived test-only compatibility scaffolding; original historical creation provenance remains unresolved.");

console.log("Disposable compatibility preflight PASS: digital-page compatibility fixtures, approved live-derived credit table fixtures, legacy pre-existing table fixtures, core live-derived table baselines, approved SMM fixtures, MantiGO function fixtures, and tracked-source MantiGO financial-config fixture validated.");
console.warn("This is not proof of a clean historical replay: test-only live-derived baselines replace missing historical DDL only in disposable CI.");
