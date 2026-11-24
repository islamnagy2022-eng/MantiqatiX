# Pass 2051–2060 — Post-merge Security Advisor and public-policy reconciliation
**Date:** 2026-11-24
**Canonical main:** a4114ebf30a48aeeff8d41884aa57613e6c6e998
**Production Supabase:** MANTIQATIX FINAL / moyhiluyhjsujhwlyeuu
**Mode:** read-only Production checks plus GitHub/source evidence
**Production mutations:** NONE

## 1. Merged source work and exact-head validation

- PR #1023 merged doctor source-rights publication gating (5ef35e5f9b0d90e05cf3e76558f614c63e194b8a).
- PR #1021 merged the source authority map and Pass 2041–2050 audit (be7989b0587d96d5418c9446042c60dcd4e32158).
- PR #1026 restored the last reviewed directory entrypoint after an unreviewed direct-main commit was detected. It passed all associated validation before merge.
- PR #1027 merged the reviewed registry-outage isolation refinement (a4114ebf30a48aeeff8d41884aa57613e6c6e998). The nullable evidence contract denies doctor rows when the private rights registry is unavailable or reaches its 1,000-row cap, while preserving the explicit non-doctor allowlist; unknown/missing listing types remain blocked.
- PR #1027 exact-head CI passed: Doctor Incremental Import Contract/Deno, Directory Contact Consent, RC425 Paymob, MantiGO Open Ride Privacy, Backend-only Module Boundary, Module Professionalization (Platform Admin/Legal/Privacy PG suites), Primary Catalog Frontend build/RBAC/Browser E2E, and Pages validation. The PR deploy job was skipped as required for pull_request events.
- Latest main push run 45376506890 passed catalog build, employee RBAC PostgreSQL and dashboard browser E2E. Pages run 45376507114 had validation and public-only gates pass; deployed-origin legacy catalog/dashboard/mobile/QR checks were still in progress at the checkpoint.

## 2. Fresh Production aggregate snapshot

| Check | Live result |
|---|---:|
| Migration ledger rows | 310 |
| Latest live migration version | 20261110150618 |
| Exact required release migration IDs | 0 / 79 |
| Public directory total | 965 |
| PUBLISHED records | 869 |
| PUBLISHED doctor records | 568 |
| PUBLISHED unclaimed doctor records | 567 |
| Source-republication evidence rows | 0 |
| Approved source-republication evidence rows | 0 |
| public.directory_listing_contact_consents | absent |
| private.directory_listing_contact_consents | absent |
| private.platform_admins rows | 1 |

The 0/79 exact-ledger comparison is not proof that all physical effects are absent. Reconcile physical objects, historical aliases, and the exact source chain before any Production migration. The current Edge directory-listings remains ACTIVE v18 and intentionally fail-closed (empty GET / 503 POST); no Edge bundle or feature flag was changed.

## 3. Security Advisor — fresh 2026-11-24 10:35Z

| Advisor category | Count | Level / interpretation |
|---|---:|---|
| RLS enabled, no policy | 9 | INFO; known backend/service-role-only tables; no blanket policies recommended |
| anon-callable SECURITY DEFINER | 1 | WARN; intentional public targeted-ad RPC; retain only with reviewed allowlisted seven-field output and bounded query contract |
| authenticated-callable SECURITY DEFINER | 65 | WARN inventory, not 65 confirmed vulnerabilities; review each body/call-chain/tenant scope |
| anonymous Auth-session policy findings | 90 | WARN; inspect authenticated-role policies against is_anonymous=true and full policy composition |
| leaked-password protection disabled | 1 | WARN; owner-managed Supabase Auth setting remains outstanding |
| Unindexed foreign keys | 132 | INFO |
| RLS initplan notices | 375 | WARN |
| Unused indexes | 66 | INFO; do not drop without workload verification |
| Multiple permissive policies | 28 | WARN; optimize only after confirming policy semantics |
| Health Advisor lints | 0 | No health lints returned |

Important distinction: the current auth_allow_anonymous_sign_ins Advisor category describes RLS policies that allow anonymous users; it is not, by itself, proof of a single global Auth Anonymous Sign-Ins setting. It remains distinct from leaked-password protection.

## 4. Direct anon/public policy-role reconciliation

A fresh pg_policies and effective-grant review returned:
- 21 policy rows include role anon or public: 19 explicitly name anon; 2 name public.
- Six explicit-anon policies are deny-all (USING false / WITH CHECK false) for private platform-admin registry, ERP purchasing/receipt/transfer tables, smm_admins and smm_provider_credentials.
- Thirteen explicit-anon SELECT policy definitions exist. Only eight public-schema tables have an effective direct anon SELECT grant; the other five policy definitions do not create a PostgREST read path without a matching table privilege.
- The eight public-schema tables with anon SELECT are digital_page_sections, digital_pages, legal_document_versions, legal_documents, marketing_provider_profiles, marketing_provider_services, marketing_services, and platform_geo_areas. Their RLS predicates limit rows, but direct base-table SELECT still exposes every column permitted by the table projection.
- Highest-priority known exposure remains marketing_provider_profiles: all 19 columns are directly selectable, including owner_user_id, settings and profile_image_path; the public policy is ACTIVE-only. RLS and FORCE RLS are enabled, but the policy is not a curated column projection. Issue #928 remains open and tracks the column/privacy/tenant-scope repair.
- digital_pages public SELECT still exposes the whole published row projection; RC480 source is not applied in Production. legal_documents and legal_document_versions are published-only, but internal metadata/tenant/actor columns remain visible at the base-table level. Keep these under issue #928.
- Storage objects has an anon/public SELECT policy restricted to bucket mantiqatix-profile-media. Storage object write policies are assigned to authenticated and constrain owner/business/platform paths. Storage system tables have RLS enabled; broad ACL entries alone do not prove an anonymous write path when no corresponding anon/public allow policy exists.
- No anon INSERT/UPDATE/DELETE privileges were found on the eight public-schema tables listed above. No row values, owner contact values, or private credentials were selected.

The 21 direct role policies are not the same population as the 90 authenticated-role anonymous-session Advisor warnings. Continue the separate anonymous Auth-session matrix and synthetic PostgreSQL tests; do not suppress warnings by mass policy or grant changes.

## 5. Platform Admin P0 unchanged

- Live is_platform_admin() still derives platform-wide authority from active tenant ADMIN/SUPER_ADMIN membership rather than the protected platform registry.
- Live mnty_can_platform_admin() still delegates to tenant RBAC.
- private.platform_admins has one row, RLS enabled, but FORCE RLS remains false.
- 56 public policies + 1 storage policy still reference the old global helper (57 consumers).
- RC464/RC471/RC484 source and isolated PostgreSQL 17 tests exist in main; they are not applied to Production. Issue #867 remains OPEN / P0.

## 6. Auth setting gate

Leaked Password Protection remains disabled in the current Advisor snapshot. The connected tools expose no safe Auth-setting mutation path. Owner must enable it through the Production Supabase Dashboard (Authentication → Password Security) and run synthetic compromised-password and normal-password regression tests. Issue #924 remains OPEN / P1.

## 7. Release disposition

**FULL PLATFORM: BLOCKED / NOT CERTIFIED.** Still required:
1. Operator-owned encrypted database and Storage exports, including Auth/Vault/configuration coverage and off-site copy.
2. Independent PostgreSQL 17 restore and rollback rehearsal; record measured RPO/RTO.
3. Exact 79-version source-ledger/physical-object/alias reconciliation.
4. Coordinated RC464/RC471/RC484 Platform Admin rollout and RC472/RC473 directory contact-consent rollout.
5. Approved source-republication evidence for existing doctor profiles, with public directory remaining disabled until evidence/consent gates and the complete Edge bundle are deployed together.
6. Function-by-function SECURITY DEFINER call-chain review and anonymous Auth-session tenant/privacy tests.
7. Deployed-origin adversarial tests and exact Edge version/source readback.

No Production migration, table/row mutation, Auth configuration, RLS/GRANT, Storage, Edge deployment, payment, wallet, settlement, or customer-data change occurred in this pass.