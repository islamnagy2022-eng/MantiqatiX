# PASS 2461–2470 — Anonymous Auth Policy Triage and RC927 Digital-Page Boundary

**Date:** 2026-11-25  
**Production:** `MANTIQATIX FINAL / moyhiluyhjsujhwlyeuu`  
**Method:** Fresh Security Advisor snapshot, direct `pg_policies` and effective privilege inspection, source review of the raw public digital-page renderer, plus a source-only RC927 candidate and isolated PG17 regression.  
**Production impact:** Read-only. No Production SQL, DML, grants, RLS changes, Auth changes, Edge deployment or business-data mutation.

## 1. Anonymous Auth advisor cohort

The current Security Advisor returned **90** `auth_allow_anonymous_sign_ins` findings across **90 distinct tables** in the public schema. Direct catalog inspection shows:

| Aggregate | Result |
|---|---:|
| Flagged tables | 90 |
| Tables existing in Production | 90 |
| Tables with RLS enabled | 90 |
| Tables with FORCE RLS disabled | 16 |
| Tables with permissive authenticated policies | 86 |
| Tables with a restrictive authenticated policy containing an `is_anonymous` claim condition | 46 |
| Effective authenticated SELECT grants | 56 |
| Effective authenticated INSERT/UPDATE/DELETE grants | 18 |
| Effective anon SELECT grants | 5 |
| Effective anon INSERT/UPDATE/DELETE grants | 1 |

The 90 Advisor findings are not 90 confirmed vulnerabilities. RLS is enabled on all 90 tables, and many permissive authenticated policies include owner, tenant, membership or other row predicates. The 40-table cohort with no explicit restrictive `is_anonymous` marker is a review queue, not a proof of unauthorized access. Each policy must be analyzed with its effective grant, command, predicate, table ownership and call path.

## 2. Effective raw-anon SELECT paths

Five flagged tables currently expose some SELECT privilege to the raw `anon` role:

| Table | Intended/observed public purpose | Current finding |
|---|---|---|
| `public.digital_pages` | Published page metadata for public renderer | RC480 is source-only; live raw-anon SELECT currently covers all 19 columns, including owner/provider/order metadata. |
| `public.digital_page_sections` | Active content sections under published pages | Public read policy targets anon + authenticated; section fields are display content. |
| `public.marketing_provider_profiles` | Public provider projections | Raw anonymous base-table SELECT remains a live privacy boundary issue; RC479/RC926 source corrections are not applied. |
| `public.platform_geo_areas` | Active Egypt geographic reference data | Intended public geography. |
| `storage.objects` | Public object reads for the `mantiqatix-profile-media` bucket | Public media reads are intentional; anon also has DML ACL grants, but no anon write policy was found. Treat DML ACL as excess privilege, not proof a write succeeded. |

`storage.objects` is the only flagged table with raw anon INSERT/UPDATE/DELETE privileges. RLS is enabled, and its policy inventory did not show an anon write policy. No anonymous write was attempted in Production; the access path remains a least-privilege cleanup item.

`public.digital_page_products` has named public-read/admin policies in the policy catalog, but direct column SELECT privileges for anon/authenticated are absent in the current privilege read-back. A policy without an effective SQL grant does not create a client read path; separately validate the storefront's product reader rather than assuming the policy works.

## 3. Digital-page owner/authenticated bypass — RC927

Live `digital_pages` policies:

- `digital_pages_public_read`: permissive SELECT for `anon, authenticated`, published rows.
- `digital_pages_owner_select`: authenticated owner SELECT.
- `digital_pages_owner_insert`: authenticated owner INSERT.
- `digital_pages_owner_update_draft`: authenticated draft UPDATE.
- `digital_pages_admin_manage`: authenticated global-admin ALL.

Live `digital_page_sections` policies:

- `digital_page_sections_public_read`: permissive SELECT for `anon, authenticated`, active sections of published parents.
- `digital_page_sections_owner_manage`: authenticated owner ALL.

RC480's source migration grants only ten page columns to raw anon and revokes table-level SELECT, but that source migration is not applied to Production. The current live state still exposes all 19 columns to raw anon. Because Anonymous Auth uses the Postgres `authenticated` role, the broad published-row policies also allow an anonymous session to take the authenticated route unless an additional restrictive identity predicate exists.

The public renderer `web/digital-page.js` uses a stateless anon-key client; no application call to `signInAnonymously` was found. RC927 therefore preserves raw-anon public rendering and removes authenticated from broad public-read policies.

RC927 source migration `20261125120000_rc927_digital_page_authenticated_identity_scope.sql`:
- Requires RC480's exact ten-column anon allowlist as a preflight.
- Retargets published-page and active-section public-read policies to raw `anon` only.
- Adds restrictive `FOR ALL TO authenticated` policies requiring `auth.jwt()->>'is_anonymous' IS NOT DISTINCT FROM 'false'` for pages and sections.
- Preserves the existing owner SELECT/INSERT/draft UPDATE, admin management and section-owner policies.

The test was strengthened so the Anonymous Auth and missing-claim subjects use the same UUID as the actual synthetic page owner. Their owner policies would otherwise match; successful denial therefore demonstrates the restrictive identity guard rather than simply a foreign-owner check. The test covers raw-anon public reads, raw-anon internal-column denial, anonymous/missing-claim read/write denial, confirmed owner read/update/insert, and confirmed non-owner denial.

## 4. Remaining related controls

| Source candidate / area | Boundary | State |
|---|---|---|
| RC480 | Raw-anon digital page ten-column allowlist | Source-only; not applied to Production |
| RC479 / RC926 | Provider-profile confirmed-identity SELECT | RC926 source merged and isolated CI passed; not applied |
| RC927 | Digital-page authenticated identity isolation | Candidate; exact-head PG17 replay pending |
| RC488 | Storage anonymous Auth write guard | Existing source candidate; not deployed |
| RC489–RC492 | Finance, medical, support and InDrive Anonymous Auth boundaries | Source-side release candidates; require full ordered replay and live verification |

Current release contract includes 84 exact migration versions. The live ledger remains 310 rows through `20261110150618`, with 0/84 exact identifiers. This identity mismatch is not proof all physical effects are absent.

## 5. Required actions and non-actions

1. Complete RC927's exact-head static validation and PostgreSQL 17 chronological replay, including the RC480 dependency and all owner/anonymous test cases.
2. Continue per-table triage of the 40 authenticated-policy review candidates, beginning with the seven tables that have authenticated write grants and permissive write policies without an explicit restrictive anonymous-claim guard.
3. Keep RC480/RC926/RC927/RC488–RC492 in one timestamp-ordered, backup-backed release plan. Do not deploy individual migrations or Edge functions.
4. Independently verify owner-created encrypted database and Storage exports, Auth/Vault recovery, restore/rollback and measured RPO/RTO before any Production write.
5. After an approved coordinated release only, run deployed-origin positive and negative tests under raw anon, Anonymous Auth, missing-claim, confirmed owner and confirmed non-owner identities.

**Production mutations:** NONE.  
**RC927:** source candidate / not applied / exact-head tests pending.  
**FULL_PLATFORM_GATE:** **BLOCKED / NOT CERTIFIED**.
