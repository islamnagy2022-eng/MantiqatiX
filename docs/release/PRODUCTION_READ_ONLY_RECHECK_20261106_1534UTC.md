# Production read-only reconciliation — refreshed 2026-11-06 15:30–15:34 UTC

## Scope and provenance

- Repository: `islamnagy2022-eng/MantiqaTix`.
- PR: [#685](https://github.com/islamnagy2022-eng/MantiqaTix/pull/685), OPEN / DRAFT / NOT MERGED.
- Latest documentation head reviewed: `7788586cd2ac0e99db77bee40cfb2067095c3d76`.
- Validated V6 application/source head: `0de8917431d2e2ecf5e4cd833cd08d4286e682e8`.
- Supabase project status: `ACTIVE_HEALTHY`; PostgreSQL `17.6.1.155`.
- Snapshot window: 2026-11-06 15:30–15:34 UTC.
- This was a read-only inspection: project metadata, migration inventory, Edge Function inventory and source retrieval, read-only PostgreSQL catalog SELECT queries, and Supabase security advisors.
- **No production writes were made.** No migration, data update, schema change, grant, RLS policy, Auth setting, Edge Function deployment, payment, or finance operation was performed.

## Current V6 Preview and exact-head CI

The latest PR-head workflow set on `7788586cd2ac0e99db77bee40cfb2067095c3d76` completed **8/8 successfully**:

| Workflow | Run | Result |
|---|---:|---|
| Primary Catalog Frontend Validation | [42242408931](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42242408931) | Build, employee/RBAC PostgreSQL and browser E2E jobs — PASS |
| V6 Preview Source Validation | [42242408975](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42242408975) | PASS |
| Pages / Deploy MantiqatiX Web | [42242408959](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42242408959) | `validate` PASS; `validate_public_only` SKIPPED; `deploy` SKIPPED |
| Backend-only Module Boundary | [42242408917](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42242408917) | PASS |
| Module Professionalization Validation | [42242408999](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42242408999) | PASS |
| RC425 MantiGo Paymob Atomicity | [42242408979](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42242408979) | PASS |
| MantiGO Open Ride Privacy Boundary | [42242408949](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42242408949) | PASS |
| SMM Deferred Storefront Contract | [42242409030](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42242409030) | PASS |

The Pages workflow did not deploy because this was a pull-request run. The Preview is validated, not publicly deployed.

### Composed Pages artifact

- Artifact: [13516086964](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42242408959/artifacts/13516086964).
- Downloaded ZIP: `mantiqatix-composed-pages-7788586.zip`.
- SHA-256: `11a86555154213d64ccabdb9724b53323a72852ac34f358d2d6954f075f85e53`.
- ZIP integrity: PASS; 65 files.
- V6 Preview contains its own `index.html`, one JS asset and one CSS asset.
- Static scan of the V6 JS found no private wallet/admin/demo markers, nor references to the legacy `AppContext`, `seedData`, or `utils/rules.ts`.
- V6 HTML points to its own `/v6-preview/assets/` and shared public `/MantiqatiX/config.js`.
- Root HTML continues to point at the existing catalog root bundle; it does not point to V6.

### Source-to-bundle module audit

Artifact [13516241550](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/42242408959/artifacts/13516241550) reports:

- 73 source files inspected; 25 reachable from the V6 public entrypoint.
- Legacy `context/AppContext.tsx` and `utils/rules.ts` contain sensitive/legacy markers but are both unreachable from the public entry.
- Suspicious public bundle assets: 0.
- Unresolved local imports: 0.
- `status=CLEAN`.

This is automated bundle and browser validation, not the separate manual visual comparison against the approved AI Studio r5 reference. That visual acceptance task remains open.

## Live migration ledger — refreshed

A fresh Supabase `list_migrations` inventory returned **309 records**, with latest record:

- Version: `20261101140105`
- Name: `directory_source_permission_evidence`

The canonical reconciliation JSON lists **42 exact release-required version IDs**. Compared with the current 309 live IDs:

- Exact version IDs present: **0 / 42**.
- Exact version IDs missing: **42 / 42**.

This is an identity/ledger comparison only. It does not prove that every migration effect is absent; aliases, forward repairs and physical catalog evidence must be reconciled independently. Do not fabricate migration history, insert synthetic ledger rows, rewrite applied versions, or replay a migration chain blindly.

The source-contract verification artifact from the same Pages run reports 32 PASS, 0 FAIL, 0 PARTIAL, 1 BLOCKED, 0 NOT VERIFIED and `production_gate=BLOCKED`. Its 60-object release preflight has 32 non-PASS objects. The prior isolated chronological rehearsal (run [41914489055](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/41914489055)) passed 76 forward migrations and synthetic Tenant A/B isolation on a disposable database; this does not establish production application or complete backup/restore evidence.

### Alias reconciliation caution

The source-contract record reports the RC424 stored statement byte-matches its source migration and that historical ledger history must remain unchanged. However, the separate alias-resolution status still reports **2 expected aliases / 0 resolved**, with RC424 and the 20261027100000-to-20261027041411 source alias pending controlled resolution. Keep these as two distinct pieces of evidence; do not silently mark the alias register resolved and do not rewrite the ledger.

## Physical schema and RPC preflight — refreshed

Read-only catalog SQL at approximately 2026-11-06 15:32 UTC confirmed the following **10 columns absent**:

- `public.journal_entries.entry_number`
- `public.journal_entries.total_debit`
- `public.journal_entries.total_credit`
- `public.journal_entries.posted_at`
- `public.journal_entry_lines.line_number`
- `public.businesses.mnty_business_default_images`
- `public.catalog_items.mnty_catalog_item_default_image`
- `public.marketing_services.mnty_marketing_service_default_image`
- `public.marketing_services.image_url`
- `public.marketing_services.image_source`

The following **3 tables/indexes are absent**:

- `public.mantigo_payment_provider_events`
- `public.uq_payment_intents_one_active_per_order`
- `public.smm_wallet_transactions_reference_type_uidx`

Targeted RPC evidence:

- `post_financial_journal_backend(uuid,jsonb,jsonb)`: exists, SECURITY DEFINER, `search_path=public`; EXECUTE false for `anon`, `authenticated` and `service_role`.
- `post_financial_journal(jsonb,jsonb)`: exists, SECURITY DEFINER, `search_path=public`; EXECUTE false for all three roles.
- Required 5-argument `finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)`: absent.
- Old 4-argument `finalize_digital_page_payment_intent_backend(uuid,uuid,text,text)`: present, SECURITY DEFINER, `search_path=public, pg_temp`; `authenticated` EXECUTE true; `anon` and `service_role` false.
- `process_verified_digital_page_payment_backend(...)`: present, SECURITY DEFINER; `service_role` EXECUTE true; `anon` and `authenticated` false.
- `process_verified_mantigo_payment_backend(uuid,uuid,text,text,text)`: absent.

These targeted checks corroborate the finance/payment blockers. Do not deploy a dependent Edge Function independently of its schema, RPC, ACL, idempotency and E2E contract.

## Critical Edge Function parity — refreshed

All six critical production functions are ACTIVE but their deployed `index.ts` content differs byte-for-byte from both `main` and the current PR branch source. The corresponding `main` and feature-branch files are identical to each other.

| Function | Live version | Live bytes | Current source bytes | Exact match |
|---|---:|---:|---:|---|
| `order-create` | 8 | 10,083 | 13,988 | NO |
| `payment-intent` | 8 | 8,114 | 10,366 | NO |
| `paymob-webhook` | 10 | 11,538 | 12,665 | NO |
| `digital-page-payment-intent` | 5 | 5,345 | 6,532 | NO |
| `subscription-payment-intent` | 4 | 5,196 | 11,100 | NO |
| `financial-journal` | 3 | 1,591 | 3,387 | NO |

Do not deploy one function at a time. All six require semantic diff, coupled schema/RPC/ACL reconciliation, Paymob sandbox webhook and idempotency E2E, and rollback evidence.

## Security advisor and SECURITY DEFINER review — refreshed

Security advisors returned **94 findings**:

| Advisor category | Count | Level |
|---|---:|---|
| RLS enabled, no policy | 9 | INFO |
| Anonymous can execute SECURITY DEFINER | 3 | WARN |
| Authenticated can execute SECURITY DEFINER | 67 | WARN |
| Anonymous-access policy findings | 90 | WARN |
| Leaked-password protection disabled | 1 | WARN |

The 90 anonymous-access policy findings are advisor scope warnings, not a count of confirmed exploitable vulnerabilities; the role, predicate and live negative access behavior must be reviewed individually.

A focused catalog read confirmed the three anonymous-executable SECURITY DEFINER functions:

- `assign_default_owner_to_unowned_business()` — trigger-returning function; its current search path includes `public, auth`, so the path needs a reviewed hardening decision.
- `capture_commission_rule_audit()` — trigger-returning function; empty search path.
- `get_mnty_targeted_advertisements(...)` — returns approved, active ad selection data; empty search path.

Two are trigger contracts rather than ordinary table RPCs; the ad-selection function is a public presentation path. Treat the advisor output as an audit queue, not as authorization to bulk-revoke. The 67 authenticated-executable SECURITY DEFINER functions also require per-function caller, authorization, search-path and ACL review.

Leaked-password protection remains disabled according to the current advisor. This requires an owner-side Auth dashboard action and subsequent evidence; no setting was changed.

## Available isolated database state

Supabase branch inventory currently shows only the default `main` branch; no disposable database branch is available in the connected project. Do not create a paid branch or project without checking and approving the cost. The prior disposable migration rehearsal is recorded separately above and must not be represented as a backup/restore rehearsal.

## Release blockers and next safe order

1. Preserve `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`.
2. Reconcile all 42 exact migration identities and two alias records against stored statement bytes, physical effects and dependency order. No history rewrite.
3. Obtain or verify a disposable restore target and complete a genuine backup/restore rehearsal with measured RPO/RTO and rollback evidence.
4. In the isolated target, resolve RC117/RC425–RC438 and RC449A/RC450 object, RPC and ACL contracts; then run finance, wallet, Paymob, webhook replay and idempotency tests.
5. Produce semantic diffs for the six critical deployed Edge Functions and release them only as a coupled, tested set.
6. Complete per-function/per-policy anonymous and authenticated negative tests; review `SECURITY DEFINER` callers, ACLs and search paths.
7. Obtain Auth owner-dashboard evidence for leaked-password protection and rerun advisors.
8. Keep SMM gateway deferred until anonymous/authenticated negative runtime tests are recorded.
9. Complete manual visual comparison of V6 r5 with the approved AI Studio reference before seeking Preview release acceptance.
10. Only after those gates pass, seek explicit approval for merge, Pages deployment and eventual root promotion.

No production repair or deployment is authorized by this snapshot.
