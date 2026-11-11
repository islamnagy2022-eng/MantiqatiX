# RC257 Security Definer Access Review

Date: 2026-10-02

## Live Production evidence

Direct PostgreSQL inspection of public SECURITY DEFINER functions found:

- No SECURITY DEFINER function without an explicit `search_path` configuration.
- The authenticated-executable exceptions are limited to workflow-specific functions and are not anonymous-executable, except the intentionally public advertisement delivery function.
- Sensitive backend/financial/refund/settlement functions inspected in the live ACL snapshot are not executable by `anon`.
- `get_mnty_targeted_advertisements` is executable by `anon` and `authenticated` by design for public advertisement delivery.
- `create_payment_intent_backend` is executable by `authenticated` by design for the user-scoped payment path; its authorization and authoritative pricing checks are implemented at the database/Edge Function boundary.
- Functions using an explicitly empty quoted search_path are present in the live database for selected legal/subscription/Mantigo/payment workflows. They are not missing a search_path setting.

## Database baseline

- public base tables: 123
- RLS enabled: 123/123
- RLS disabled: 0
- tables without primary key: 0

## Decision

No blanket ACL revocation or SECURITY DEFINER rewrite is justified by this inspection. Changes to these functions must preserve their documented caller contract and must be followed by a fresh privilege inspection.


## Live re-verification addendum — 2026-11-11

Read-only inspection of the active production project confirms:

- Public base tables: **137**, with RLS enabled on **137/137**.
- Public SECURITY DEFINER functions: **149/149** have an explicit `search_path` setting; none are missing one.
- EXECUTE surface: **1** SECURITY DEFINER function is callable by `anon` (`get_mnty_targeted_advertisements`); **65** are callable by `authenticated`. The public advertisement RPC is already documented in RC206/RC335/RC257 as an intentional public read-only ad-serving contract; its current definition has an empty search_path and schema-qualified application relations, filters to active/approved/in-window ads and clamps the limit to 1–50.
- Six authenticated-callable SECURITY DEFINER functions did not contain a direct `auth.uid()` reference. Their delegated authorization paths were inspected: `mnty_business_employee_list → mnty_business_employee_list_scoped` (rejects null/anonymous actor and verifies tenant/business/branch plus HR/platform permission); `mnty_can → mnty_active_membership` and `mnty_can_platform_admin → mnty_can` (active membership is filtered by `auth.uid()`); `preview_commission_backend → assert_financial_membership` (auth.uid(), active tenant membership and finance-role check); `upsert_catalog_item_and_price_backend → upsert_catalog_item_backend + upsert_catalog_price_backend` (both delegated writers bind authorization to auth.uid() and validate tenant/business/branch).
- The nine current RLS-enabled/no-policy tables are `business_employees`, `business_job_positions`, `commission_rule_audit`, `digital_page_payment_events`, `directory_listing_claim_requests`, `directory_source_permission_evidence`, `platform_custom_roles`, `platform_role_assignments`, and `public_directory_listings`. Read-only privilege checks show no direct `anon` or `authenticated` SELECT/INSERT/UPDATE/DELETE privileges on any of the nine. Three have direct `service_role` SELECT (`directory_listing_claim_requests`, `directory_source_permission_evidence`, `public_directory_listings`); the remaining six have no direct service_role SELECT either. These remain fail-closed; no policies or grants were added.
- Leaked Password Protection remains disabled and is a managed Auth configuration item. No Auth setting, function ACL, RLS policy, table grant or production data was changed in this review.

**Decision:** No blanket revoke or policy creation is justified. The intentional public ad RPC should remain under documented owner intent; continue targeted call-site/tenant-isolation tests and obtain authorized managed Auth action for leaked-password protection.
