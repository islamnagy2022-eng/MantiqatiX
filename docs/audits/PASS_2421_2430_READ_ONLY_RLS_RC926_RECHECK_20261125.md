# PASS 2421–2430 — Read-only RLS / Security Advisor recheck and RC926 candidate — 2026-11-25

**Production:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Source base:** `main @ 3f67694a5a1da9c8f217d1883dda4a324710bc0e`  
**Method:** read-only Supabase Security Advisor, PostgreSQL catalog, policy and effective-grant inspection. No application rows, profile values, financial rows, customer data, payment payloads, Storage object keys or secrets were selected. No Production mutation occurred.

## 1. Security Advisor snapshot

Observed at `2026-11-25T00:20:16.773Z`:

| Finding | Count | Level |
|---|---:|---|
| RLS enabled, no policy | 9 | INFO |
| SECURITY DEFINER executable by anon | 1 | WARN |
| SECURITY DEFINER executable by authenticated | 65 | WARN |
| Anonymous-session policy warnings | 90 | WARN |
| Leaked-password protection disabled | 1 | WARN |
| **Total findings** | **94** | |

These are Advisor findings requiring review, not 94 confirmed exploitable vulnerabilities.

## 2. Anonymous Auth policy triage

A read-only scan of 485 public-schema policies classified their expressions syntactically:

| Class | Policies | Tables | Targeting anon | Targeting authenticated |
|---|---:|---:|---:|---:|
| Legacy/COALESCE or fail-open-style anonymous claim guard | 283 | 81 | 2 | 283 |
| No explicit anonymous claim check | 202 | 101 | 16 | 200 |
| Exact explicit-confirmed false match | 0 | — | — | — |

This is a triage inventory, not an exploit count. It does not alone determine effective reachability; table grants, role membership, the full permissive/restrictive policy combination, ownership and application behavior still matter. Anonymous Auth sessions use PostgreSQL role `authenticated`, so role-only separation is insufficient.

## 3. Direct anon SELECT surfaces

The live catalog shows direct `anon SELECT` grants on eight public tables:

- `digital_page_sections`
- `digital_pages`
- `legal_document_versions`
- `legal_documents`
- `marketing_provider_profiles`
- `marketing_provider_services`
- `marketing_services`
- `platform_geo_areas`

These are not to be blanket-revoked: several represent intentional public catalog, legal-version or geographic discovery surfaces. The sensitive exception is `marketing_provider_profiles`.

## 4. Confirmed provider-profile exposure path

Live read-back:

| Control | Result |
|---|---|
| `marketing_provider_profiles` RLS | Enabled |
| FORCE RLS | Enabled |
| Effective `anon SELECT` | **Granted** |
| `Public can view active marketing providers` | Permissive; roles `anon, authenticated`; predicate `status='ACTIVE'` |
| Restrictive `marketing_provider_profiles_confirmed_auth_select` | **Absent** |
| Columns | 19 |

The table includes `owner_user_id`, `settings`, `profile_image_path`, `portfolio`, `service_areas` and `ranking_weight`. The current public-active policy is a full base-row policy, not a column allowlist. This is a real privacy-boundary defect in the current effective ACL + policy combination.

The source already contains:
- `20261118190000` RC479 raw-anon revoke, not yet reflected in the live ACL.
- `20261120193000` RC479 restrictive Auth-session policy, absent from the live policy catalog. Its source predicate uses COALESCE and treats a missing claim as confirmed.

Confirmed-user access to the base table remains broader than a minimal public card projection; that is a separate column-projection/consumer-compatibility task.

## 5. RC926 forward-only candidate

Added on branch `security/rc926-strict-provider-profile-auth-20261125`:

- Migration `20261125110000_rc926_provider_profile_confirmed_identity_strict_guard.sql`.
- SQL integration test `supabase/tests/rc926_provider_profile_confirmed_identity_strict_integration.sql`.
- Static source validator `scripts/validate-rc926-provider-profile-confirmed-identity-strict-guard.mjs`.
- Release contract now tracks 83 required migration versions; RC926 is explicitly marked missing/unapplied in Production.
- Targeted RC479 and full PostgreSQL 17 replay workflows include RC926.

The migration reasserts raw `anon` SELECT revocation, replaces only the restrictive SELECT policy, and requires exact confirmed identity:

`(auth.jwt() ->> 'is_anonymous') IS NOT DISTINCT FROM 'false'`.

The tests cover raw anon denial, `is_anonymous=true` denial, missing-claim denial, confirmed-user read compatibility, confirmed owner update compatibility and wrong-owner update denial. This is a new forward migration; no historical migration is edited.

**Verification status:** RC926 targeted PostgreSQL 16 integration initially passed its six authorization cases. The first full chronological replay reached RC926 but exposed a test-harness defect: the schema-only baseline contained no provider profile row, while the integration expected a pre-existing synthetic row. The integration now seeds an idempotent synthetic row and uses the replay prerequisite's synthetic Auth principal. A portability correction uses dynamic catalog lookup where `auth.users` is absent. The corrected full PostgreSQL 17 replay and exact-head CI remain pending. This report does not call the migration fully replay-verified or merged.

## 6. External Auth control

Leaked-password protection is still disabled. Supabase documentation states that leaked-password protection is available on Pro and above. The current project plan is Free, so this item is an external plan/owner dependency, not a database SQL change:

https://supabase.com/docs/guides/auth/password-security

Anonymous Auth sign-ins also remain enabled. Do not switch them off blindly: the public catalog and guest journeys may depend on the current identity flow. Use the tested RLS/ACL controls and complete a separate product-flow compatibility decision.

## 7. Release disposition

- Production mutation: **NONE**.
- Production RLS/GRANT/Auth/Storage/Edge/Payment changes: **NONE**.
- RC926: **SOURCE MERGED / EXACT-HEAD CI PASS / NOT DEPLOYED TO PRODUCTION**.
- Overall platform release: **BLOCKED / NOT CERTIFIED** pending the immutable 83-version chronology, exhaustive physical effect and ACL/RLS reconciliation, signed payment runtime contracts, and encrypted backup + independent restore rehearsal with measured RPO/RTO.


## Exact-head CI and merge verification — 2026-11-25
- PR #1097 exact head: `d2e265f581a39b80ca8bdbbf472b68b84a098ac2`.
- Full forward-chain run `45520980163` passed the strict exact 83-version release gate, RC926 static source validation, RC479 anonymous-Auth boundary validation, and chronological PostgreSQL 17 checkpoint restore plus timestamp-ordered migration replay. The RC926 validation ran before the restore/replay steps.
- Targeted RC479 anonymous-Auth PostgreSQL workflow `45520979889` passed both the source-contract step and the disposable migration/boundary regression step.
- PR #1097 merged source-only as `a2dba687848998da0dff3d40e6db44c578a85692`. No Production SQL, migration, GRANT, RLS, Auth, Storage, Edge, payment, settlement or customer-data mutation was performed. The pass evidence does not certify Production deployment.
