/**
 * Explicit release evidence contract for the Production migration gate.
 * Source presence and disposable replay are necessary but never sufficient.
 */
export const REQUIRED_RELEASE_MIGRATION_VERSIONS = [
  "20261009120000", "20261009130000", "20261009140000", "20261009150000",
  "20261009160000", "20261009170000", "20261009180000", "20261009190000",
  "20261009200000", "20261009210000", "20261009220000", "20261009230000",
  "20261009240000", "20261010010000", "20261010020000", "20261010030000",
  "20261010060000", "20261010120000", "20261010140000", "20261010150000",
  "20261010161000", "20261010170000", "20261010175000", "20261010180000",
  "20261010200000", "20261010210000", "20261010220000", "20261011010000",
  "20261014230000", "20261023020000", "20261023030000", "20261023040000",
  "20261023050000", "20261023060000",
  "20261027030000", "20261027040000", "20261027050000",
  "20261027060000", "20261027070000", "20261027090000", "20261027093000",
];

export const REQUIRED_CORE_OBJECTS = [
  "public.mantigo_payment_provider_events",
  "public.process_verified_mantigo_payment_backend",
  "public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)",
  "public.uq_payment_intents_one_active_per_order",
  "public.process_verified_provider_payment_failure",
  "public.process_verified_subscription_payment_failure",
  "public.process_verified_subscription_payment_backend",
  "public.process_verified_digital_page_payment_backend(uuid,text,text,text,boolean,numeric,text,text,text,jsonb)",
  "public.smm_wallet_transactions_reference_type_uidx",
  "public.receive_purchase_stock_atomic_backend",
  "public.create_subscription_payment_intent_claimable_backend and claim_subscription_provider_intent_creation_backend",
  "public.post_financial_journal_atomic_backend and journal uniqueness indexes",
  "public.erp_purchase_order_lines, receive_purchase_stock_with_order_line_backend, set_purchase_order_lines_backend and RC437 indexes",
  "public.create_purchase_order_with_lines_backend",
  "public.update_purchase_order_status_backend(varchar,varchar)",
  "public.mnty_can_platform_admin and MantiGo admin RPCs",
];

export const REQUIRED_CONTROL_CENTER_OBJECTS = [
  "public.platform_custom_roles",
  "public.platform_role_assignments",
  "public.mnty_platform_admin_list_custom_roles",
  "public.mnty_platform_admin_upsert_custom_role",
  "public.mnty_platform_admin_assign_custom_role",
  "public.business_job_positions",
  "public.business_employees",
  "public.platform_role_assignments_active_unique",
  "public.platform_role_assignments_user_scope_idx",
  "public.business_employees_email_per_business_unique",
  "public.business_job_positions_business_active_idx",
  "public.business_employees_business_status_idx",
  "public.business_employees_user_active_idx",
  "public.mnty_business_employee_position_upsert",
  "public.mnty_business_employee_upsert",
  "public.mnty_platform_has_permission",
  "public.mnty_platform_admin_list_people",
  "public.mnty_platform_admin_list_role_assignments",
  "public.mnty_business_employee_list",
  "public.mnty_platform_admin_list_audit",
  "public.mnty_platform_admin_list_businesses",
  "public.mnty_platform_admin_manage_business",
  "public.mnty_platform_admin_manage_membership",
  "public.mnty_default_image_url",
  "public.mnty_default_business_images_trigger",
  "public.mnty_default_catalog_item_image_trigger",
  "public.mnty_default_marketing_service_image_trigger",
  "public.businesses.mnty_business_default_images",
  "public.catalog_items.mnty_catalog_item_default_image",
  "public.marketing_services.mnty_marketing_service_default_image",
  "public.marketing_services.image_url",
  "public.marketing_services.image_source",
  "public.ux_user_memberships_user_business_branch_nullsafe",
];

const REQUIRED_EDGE_FUNCTIONS = [
  "payment-intent",
  "paymob-webhook",
  "digital-page-payment-intent",
  "subscription-payment-intent",
  "financial-journal",
  "smm-gateway",
];

const RC449A_VERSION = "20261010175000_rc449a_financial_journal_schema_prerequisites";
const RC450_VERSION = "20261010180000_rc450_financial_journal_service_role_boundary";
const FINANCIAL_JOURNAL_BACKEND_SIGNATURE = "post_financial_journal_backend(uuid,jsonb,jsonb)";
const RC451_VERSION = "20261010200000";

export function isLiveReconciliationVerified(reconciliation) {
  if (!reconciliation || typeof reconciliation !== "object") return false;

  const ledger = reconciliation.required_release_migration_ledger_check;
  const objects = reconciliation.required_release_object_presence_check;
  const edgeParity = reconciliation.critical_edge_function_source_parity_check;
  const finance = reconciliation.financial_journal_runtime_prerequisite_check;
  const functions = Array.isArray(edgeParity?.functions) ? edgeParity.functions : [];
  const objectFindings = Array.isArray(objects?.observed) ? objects.observed : [];
  const missingVersions = Array.isArray(ledger?.missing_versions) ? ledger.missing_versions : null;
  const requiredVersions = Array.isArray(ledger?.required_versions) ? ledger.required_versions : null;
  const recordedRequiredVersions = Array.isArray(ledger?.recorded_required_versions) ? ledger.recorded_required_versions : null;
  const securityDefiner = reconciliation.security_definer_search_path_check;
  const missingColumns = Array.isArray(finance?.schema_preflight?.missing_columns)
    ? finance.schema_preflight.missing_columns
    : null;
  const backendRpc = Array.isArray(finance?.rpc_privileges)
    ? finance.rpc_privileges.find(row => row?.signature === FINANCIAL_JOURNAL_BACKEND_SIGNATURE)
    : null;

  const requiredEdgeParityPassed = REQUIRED_EDGE_FUNCTIONS.every(slug =>
    functions.some(row => row?.slug === slug && row?.exact_match === true)
  );

  const requiredLiveObjectsPassed = [...REQUIRED_CORE_OBJECTS, ...REQUIRED_CONTROL_CENTER_OBJECTS].every(name =>
    objectFindings.some(row =>
      (row?.name ?? row?.object) === name &&
      row?.exists === true &&
      row?.status === "PASS"
    )
  );

  return Boolean(
    reconciliation.status === "VERIFIED" &&
    reconciliation.verified === true &&
    reconciliation.source_ledger_identity_reconciled === true &&
    reconciliation.rc424_reconciliation?.exact_statement_match === true &&
    reconciliation.rc424_reconciliation?.ledger_version === "20261008222845" &&
    reconciliation.rc424_reconciliation?.source_filename_version === "20261009010000" &&
    reconciliation.rc424_reconciliation?.history_rewritten === false &&
    reconciliation.required_release_migrations_applied === true &&
    reconciliation.chronological_replay === "PASS" &&
    reconciliation.tenant_isolation_tests === "PASS" &&
    reconciliation.payment_finance_e2e === "PASS" &&
    reconciliation.backup_restore_rehearsal === "PASS" &&
    reconciliation.edge_function_contracts === "PASS" &&
    reconciliation.smm_gateway_parity === "PASS" &&
    reconciliation.auth_security_settings === "PASS" &&
    typeof reconciliation.evidence_ref === "string" &&
    reconciliation.evidence_ref.trim().length > 0 &&
    typeof reconciliation.checked_at === "string" &&
    reconciliation.checked_at.trim().length > 0 &&

    // The live ledger inventory must positively prove every required version.
    ledger?.status === "VERIFIED_APPLIED" &&
    Number.isInteger(ledger.expected_migration_versions) &&
    ledger.expected_migration_versions === REQUIRED_RELEASE_MIGRATION_VERSIONS.length &&
    ledger.found_in_live_ledger === REQUIRED_RELEASE_MIGRATION_VERSIONS.length &&
    requiredVersions !== null &&
    requiredVersions.length === REQUIRED_RELEASE_MIGRATION_VERSIONS.length &&
    requiredVersions.every((version, index) => version === REQUIRED_RELEASE_MIGRATION_VERSIONS[index]) &&
    recordedRequiredVersions !== null &&
    recordedRequiredVersions.length === REQUIRED_RELEASE_MIGRATION_VERSIONS.length &&
    recordedRequiredVersions.every((version, index) => version === REQUIRED_RELEASE_MIGRATION_VERSIONS[index]) &&
    missingVersions !== null &&
    missingVersions.length === 0 &&

    // RC451 must leave the intentionally public discovery boundary intact while hardening search_path.
    securityDefiner?.status === "PASS" &&
    securityDefiner.migration_version === RC451_VERSION &&
    securityDefiner.migration_version_recorded === true &&
    securityDefiner.security_definer === true &&
    Array.isArray(securityDefiner.current_search_path) &&
    securityDefiner.current_search_path.length === 0 &&
    Array.isArray(securityDefiner.expected_search_path) &&
    securityDefiner.expected_search_path.length === 0 &&
    securityDefiner.anon_execute === true &&
    securityDefiner.authenticated_execute === true &&

    // Each selected required object must be present and its contract explicitly checked.
    objects?.status === "PASS" &&
    objectFindings.length > 0 &&
    objectFindings.every(row => row?.exists === true && row?.status === "PASS") &&
    requiredLiveObjectsPassed &&

    // Source parity must cover every deployed critical entrypoint, not just one function.
    edgeParity?.status === "PASS" &&
    requiredEdgeParityPassed &&

    // RC449A -> RC450 schema/grant prerequisites must be live and validated.
    finance?.status === "PASS" &&
    finance.live_migrations?.[RC449A_VERSION] === true &&
    finance.live_migrations?.[RC450_VERSION] === true &&
    missingColumns !== null &&
    missingColumns.length === 0 &&
    backendRpc?.service_role_execute === true
  );
}
