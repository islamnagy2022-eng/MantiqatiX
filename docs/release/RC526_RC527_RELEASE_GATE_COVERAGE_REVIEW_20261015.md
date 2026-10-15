# RC526–RC527 Release-Gate Coverage Review — 2026-10-15

## Status

**REVIEW ONLY — NOT A SECURITY CERTIFICATION — RELEASE BLOCKED**

Reviewed source refs:
- `supabase/migrations/20261015010000_rc526_marketing_services_platform_scope.sql`
- `supabase/migrations/20261015020000_rc527_marketing_platform_permission_boolean_hardening.sql`
- `scripts/validate-marketing-crm-tenant-scope.mjs`
- `scripts/validate-production-migration-chain-gate.mjs`
- `scripts/production/verify-production.mjs`
- `docs/MASTER_PRODUCTION_TODO.md`

## Confirmed source-level observations

1. RC526 restricts writes to the shared `public.marketing_services` catalogue to an active `SUPER_ADMIN` membership in tenant `MNTY-PLATFORM` whose JSON permissions contain the exact JSON boolean `"full_control": true`; anonymous JWT sessions are rejected by the policy predicate.
2. RC527 replaces text extraction checks for platform `full_control` with JSONB containment in selected marketing CRM policies. The migration comments say it is a forward-only correction and must run after RC452 and RC526.
3. The CRM source-contract validator references RC452, RC526, and RC527 and checks that string `"true"` is not accepted by these policy contracts. This is source-contract validation; it does not itself prove runtime RLS behavior.
4. The release-gate's explicit required migration list contains 28 source files and ends at RC456. It does not list RC462, RC526, or RC527. Consequently, the current source contract does not require those later candidate migrations to exist. Their release scope must be decided explicitly; if in scope, add them to the required set and test their timestamp/dependency order.
5. The master production TODO still marks CRM E2E and the marketing lead lifecycle as not verified/outstanding. The current RC527 policy changes do not by themselves implement or prove a complete lead lifecycle.

## Required acceptance evidence before release

- [ ] Release owner explicitly decides whether RC462, RC526, and RC527 are in the target release scope.
- [ ] If in scope, the migration gate asserts exact filenames, uniqueness, ordering, and required dependency sequence RC452 → RC526 → RC527, plus RC441 → RC462 where applicable.
- [ ] Tests prove malformed JSON, string `"true"`, boolean `false`, missing scope, inactive platform membership, tenant-scoped admin, and valid platform admin outcomes.
- [ ] Runtime PostgreSQL/Supabase RLS tests prove tenant A cannot read or mutate tenant B's leads/providers, and cannot mutate the shared service catalogue; assigned-provider visibility is limited to assigned leads.
- [ ] Negative tests cover anonymous and unauthenticated sessions, and no test depends solely on regex/source matching.
- [ ] Complete lead lifecycle (create, assign, update/status transitions, audit, notification) is specified and tested, or explicitly excluded from this release.
- [ ] Full disposable forward replay succeeds against an approved, hash-verified baseline and exact release commit.
- [ ] Live reconciliation, payment/finance E2E, tenant isolation, Edge Function parity, Auth settings, and backup/restore evidence are recorded in the release reconciliation manifest.

## Safety constraints

- Do not change the production database, migration ledger, RLS/grants, Auth settings, Edge Functions, payment state, or secrets during this review.
- Do not mark the baseline approved or the reconciliation verified from source-only evidence.
- Do not merge or deploy while any P0 release gate is blocked.
