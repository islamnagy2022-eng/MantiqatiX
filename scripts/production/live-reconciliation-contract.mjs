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
  "20261031100000",
  "20261113214500", // RC464
  "20261113220000", // RC464B — fail-closed order read-policy preflight before RC465
  "20261114010000", // RC465
  "20261114020000", // RC466
  "20261115010000", // RC467
  "20261115030000", // RC468
  "20261117010000", // RC469
  "20261117020000", // RC470
  "20261117190000", // RC471
  "20261118010000", // RC472
  "20261118020000", // RC473
  "20261118030000", // RC474
  "20261118040000", // RC475
  "20261118050000", // RC476
  "20261118060000", // RC477
  "20261118070000", // RC478
  "20261118190000", // RC479 — revoke direct anonymous provider-profile base-table read
  "20261118210000", // RC480 — restrict anonymous digital-page reads to public renderer columns
  "20261118220000", // RC481 — least-privilege Legal Edge service-role column grants
  "20261119020000", // RC482 — bind global legal admin to protected platform-admin registry
  "20261119030000", // RC483 — atomic Legal CMS create/audit and remove direct service-role INSERT
  "20261119040000", // RC484 — registry-backed global is_platform_admin for 57 RLS policies
  "20261120200000", // RC485 — bind seven catalog RPC global-root paths to the platform registry
  "20261120210000", // RC486 — serialize item/branch price versions and enforce uniqueness
  "20261120220000", // RC487 — remove public first-Auth-user SMM admin bootstrap
  "20261120230000", // RC488 — block anonymous Auth writes to Storage objects
  "20261120240000", // RC489 — require confirmed Auth identity for private financial reads
  "20261120250000", // RC490 — require confirmed Auth identity for medical appointment reads
  "20261120260000", // RC491 — require confirmed Auth identity for support ticket reads
  "20261120270000", // RC492 — require confirmed Auth identity for InDrive request writes
  "20261120280000", // RC493 — require confirmed Auth identity for private CRM/project/notification reads
  "20261120290000", // RC494 — registry-backed platform settlement and tenant/business scope
  "20261121020000", // RC495 — repair Storage filename policies and use canonical platform-root registry
];

export const REQUIRED_MIGRATION_ALIASES = [
  {
    source_version: "20261009010000",
    target_ledger_version: "20261008222845",
    evidence_type: "EXACT_STATEMENT_ALIAS",
  },
  {
    source_version: "20261027100000",
    target_ledger_version: "20261027041411",
    evidence_type: "EXACT_SOURCE_BLOB_ALIAS",
  },
];

export const REQUIRED_CORE_OBJECTS = [
  "public.mantigo_payment_provider_events",
  "public.process_verified_mantigo_payment_backend",
  "public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)",
  "public.uq_payment_intents_one_active_per_order",
  "public.process_verified_provider_payment_failure",
  "public.process_verified_provider_payment",
  "public.process_verified_subscription_payment_failure",
  "public.process_verified_subscription_payment_backend",
  "public.process_verified_digital_page_payment_backend",
  "public.review_directory_listing_claim_atomic(uuid,text,uuid,text,uuid,boolean,boolean)",
  "public.smm_wallet_transactions_reference_type_uidx",
  "public.receive_purchase_stock_atomic_backend",
  "public.create_subscription_payment_intent_claimable_backend",
  "public.claim_subscription_provider_intent_creation_backend",
  "public.post_financial_journal_atomic_backend",
  "public.journal_entry_lines_entry_line_uidx",
  "public.journal_entries_tenant_entry_number_uidx",
  "public.erp_purchase_order_lines",
  "public.receive_purchase_stock_with_order_line_backend",
  "public.set_purchase_order_lines_backend",
  "public.erp_purchase_orders_business_order_number_uidx",
  "public.erp_purchase_order_lines_scope_idx",
  "public.create_purchase_order_with_lines_backend",
  "public.update_purchase_order_status_backend(varchar,varchar)",
  "public.mnty_can_platform_admin",
  "public.get_mantigo_admin_dashboard_backend",
  "public.get_mantigo_admin_financial_report_backend",
  "public.settle_mantigo_captain_backend",
  "public.expire_stale_mantigo_rides_backend",
  "private.platform_admins",
  "public.is_platform_admin()",
];

// Require exact runtime function signatures and persisted Paymob/checkout
// correlation columns. A legacy overload or an RPC with the same name is not
// sufficient evidence that current Edge bundles can safely call Production.
export const REQUIRED_PAYMENT_CONTRACT_OBJECTS = [
  "public.process_verified_provider_payment(character varying,character varying,character varying,character varying,character varying,character varying,boolean,numeric,character varying,numeric)",
  "public.process_verified_provider_payment_failure(text,text,text,text,text,text,boolean,numeric,text,text,text,jsonb)",
  "public.process_verified_subscription_payment_backend(text,text,uuid,text,numeric,text,text,boolean,jsonb)",
  "public.process_verified_subscription_payment_failure(text,text,uuid,text,numeric,text,text,boolean,jsonb)",
  "public.create_subscription_payment_intent_claimable_backend(uuid,text,text,text,text,uuid)",
  "public.claim_subscription_provider_intent_creation_backend(uuid,uuid)",
  "public.process_verified_mantigo_payment_backend(text,text,text,boolean,numeric,text,text,jsonb)",
  "public.payment_intents.provider_order_id",
  "public.digital_page_orders.provider_order_id",
  "public.subscription_payment_intents.provider_creation_state",
  "public.subscription_payment_intents.provider_creation_claimed_at",
  "public.subscription_payment_intents.client_secret_ciphertext",
  "public.subscription_payment_intents.client_secret_iv",
  "public.subscription_payment_intents.client_secret_key_version",
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
  "api",
  "order-create",
  "order-status-update",
  "payment-intent",
  "payment-webhook",
  "paymob-webhook",
  "digital-page-payment-intent",
  "subscription-payment-intent",
  "financial-journal",
  "smm-gateway",
  "directory-listings",
];

const RC449A_VERSION = "20261010175000_rc449a_financial_journal_schema_prerequisites";
const RC450_VERSION = "20261010180000_rc450_financial_journal_service_role_boundary";
const FINANCIAL_JOURNAL_BACKEND_SIGNATURE = "post_financial_journal_backend(uuid,jsonb,jsonb)";
const RC451_VERSION = "20261010200000";
const RC463_VERSION = "20261031100000";

export function isLiveReconciliationVerified(reconciliation) {
  if (!reconciliation || typeof reconciliation !== "object") return false;

  const ledger = reconciliation.required_release_migration_ledger_check;
  const objects = reconciliation.required_release_object_presence_check;
  const edgeParity = reconciliation.critical_edge_function_source_parity_check;
  const finance = reconciliation.financial_journal_runtime_prerequisite_check;
  const triggerAcl = reconciliation.trigger_only_security_definer_acl_check;
  const triggerAclFunctions = Array.isArray(triggerAcl?.functions) ? triggerAcl.functions : [];
  const functions = Array.isArray(edgeParity?.functions) ? edgeParity.functions : [];
  const objectFindings = Array.isArray(objects?.observed) ? objects.observed : [];
  const missingVersions = Array.isArray(ledger?.missing_versions) ? ledger.missing_versions : null;
  const requiredVersions = Array.isArray(ledger?.required_versions) ? ledger.required_versions : null;
  const recordedRequiredVersions = Array.isArray(ledger?.recorded_required_versions) ? ledger.recorded_required_versions : null;
  const securityDefiner = reconciliation.security_definer_search_path_check;
  const qadam = reconciliation.qadam_catalog_followup_check;
  const directoryContact = reconciliation.directory_contact_consent_boundary;
  const aliasCheck = reconciliation.migration_alias_resolution_check;
  const aliasFindings = Array.isArray(aliasCheck?.aliases) ? aliasCheck.aliases : [];
  const missingColumns = Array.isArray(finance?.schema_preflight?.missing_columns)
    ? finance.schema_preflight.missing_columns
    : null;
  const backendRpc = Array.isArray(finance?.rpc_privileges)
    ? finance.rpc_privileges.find(row => row?.signature === FINANCIAL_JOURNAL_BACKEND_SIGNATURE)
    : null;

  const requiredEdgeParityPassed = REQUIRED_EDGE_FUNCTIONS.every(slug =>
    functions.some(row => row?.slug === slug && row?.exact_match === true)
  );

  const requiredTriggerAclPassed = [
    "assign_default_owner_to_unowned_business",
    "capture_commission_rule_audit"
  ].every(functionName =>
    triggerAclFunctions.some(row =>
      row?.function_name === functionName &&
      row?.security_definer === true &&
      row?.trigger_enabled === true &&
      row?.search_path_empty === true &&
      row?.public_execute === false &&
      row?.anon_execute === false &&
      row?.authenticated_execute === false &&
      row?.service_role_execute === false
    )
  );

  const requiredLiveObjectsPassed = [...REQUIRED_CORE_OBJECTS, ...REQUIRED_PAYMENT_CONTRACT_OBJECTS, ...REQUIRED_CONTROL_CENTER_OBJECTS].every(name =>
    objectFindings.some(row =>
      (row?.name ?? row?.object) === name &&
      row?.exists === true &&
      row?.status === "PASS"
    )
  );

  const requiredMigrationAliasesResolved =
    aliasCheck?.status === "RECONCILED" &&
    aliasCheck.expected_aliases === REQUIRED_MIGRATION_ALIASES.length &&
    aliasCheck.resolved_aliases === REQUIRED_MIGRATION_ALIASES.length &&
    REQUIRED_MIGRATION_ALIASES.every(required =>
      aliasFindings.some(alias =>
        alias?.source_version === required.source_version &&
        alias?.target_ledger_version === required.target_ledger_version &&
        alias?.evidence_type === required.evidence_type &&
        alias?.status === "RECONCILED" &&
        alias?.source_effect_verified === true &&
        alias?.ledger_repair_applied === true
      )
    );

  const qadamCatalogFollowupPassed =
    qadam?.status === "PASS" &&
    qadam.migration_version === "20261027093000" &&
    qadam.migration_version_recorded === true &&
    qadam.business_active === true &&
    qadam.contact_fields_complete === true &&
    qadam.owner_membership_status === "ACTIVE" &&
    qadam.owner_membership_active === true &&
    qadam.expected_product_count === 15 &&
    qadam.active_product_count === 15 &&
    qadam.expected_price_rows === 12 &&
    qadam.matching_price_rows === 12 &&
    qadam.contact_for_price_product_count === 3 &&
    qadam.contact_for_price_without_active_price === 3 &&
    qadam.stock_tracking_enabled_item_count === 0;

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
    requiredMigrationAliasesResolved &&
    qadamCatalogFollowupPassed &&

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
    directoryContact?.status === "PASS" &&
    directoryContact.live_function?.slug === "directory-listings" &&
    directoryContact.live_function?.exact_source_match === true &&
    directoryContact.live_function?.complete_bundle_match === true &&
    directoryContact.live_function?.required_files_present === true &&
    (directoryContact.live_function?.missing_live_files?.length ?? 0) === 0 &&
    directoryContact.live_function?.verify_jwt === false &&
    directoryContact.consent_table_exists === true &&
    directoryContact.public_get_contact_fields_consent_scoped === true &&
    directoryContact.published_contact_rows_without_consent_exposure === 0 &&
    directoryContact.anonymous_contract_tests === "PASS" &&
    directoryContact.owner_consent_grant_revoke_tests === "PASS" &&
    directoryContact.registry_outage_fail_closed === true &&

    // RC449A -> RC450 schema/grant prerequisites must be live and validated.
    finance?.status === "PASS" &&
    finance.live_migrations?.[RC449A_VERSION] === true &&
    finance.live_migrations?.[RC450_VERSION] === true &&
    missingColumns !== null &&
    missingColumns.length === 0 &&
    backendRpc?.service_role_execute === true &&

    // RC463 must close direct API/PUBLIC EXECUTE on both trigger-only SECURITY DEFINER functions.
    triggerAcl?.status === "PASS" &&
    triggerAcl.migration_version === RC463_VERSION &&
    triggerAcl.migration_version_recorded === true &&
    triggerAclFunctions.length === 2 &&
    requiredTriggerAclPassed
  );
}
