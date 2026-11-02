# MantiqatiX — Production Gate Evidence (Read-only)
## 2026-11-02

## Scope and method

This is a dated read-only evidence refresh. Historical checkpoints are retained. Sources: current GitHub main, GitHub Actions, Supabase project metadata, live migration inventory, Security/Performance Advisors, and exact UTF-8 comparison of deployed Edge entrypoints against current main source (line endings normalized only).

- Repository: `islamnagy2022-eng/MantiqatiX`
- Main commit: `25d486c592d6ed9b057f8ef179fbbeae1fc79ba5`
- Supabase project: `moyhiluyhjsujhwlyeuu`
- Supabase status: `ACTIVE_HEALTHY`
- PostgreSQL: `17.6.1.155`
- Advisor observation time: `2026-11-02T11:20:50Z`

## Scoped catalog release

- PR #650 merged: https://github.com/islamnagy2022-eng/MantiqatiX/pull/650
- Merge commit: `25d486c592d6ed9b057f8ef179fbbeae1fc79ba5`
- Pages deployment run [41433049776](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41433049776): SUCCESS.
- Main validation run [41433049782](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41433049782): SUCCESS.
- Verified scope includes build, employee RBAC PostgreSQL, browser E2E, deployed root, dashboard routes, mobile layout, membership scopes and permanent QR journeys.
- This is a scoped catalog release only, not full-platform production certification.

## Live migration inventory

- Current Supabase migration ledger: **309 records**.
- Latest live version: `20261101140105` (`directory_source_permission_evidence`).
- Canonical release gate tracks **42 exact migration version IDs**.
- Exact comparison of those 42 IDs against the live ledger: **0/42 present**.
- Absence of an exact version ID does not prove every corresponding SQL effect is absent. Physical objects and semantics are checked separately. Do not fabricate ledger rows, rewrite history, or replay missing migrations blindly.

## Security Advisor snapshot

| Finding | Count | Level |
|---|---:|---|
| RLS enabled, no policy | 9 tables | INFO |
| SECURITY DEFINER executable by anon | 3 functions | WARN |
| SECURITY DEFINER executable by authenticated | 67 functions | WARN |
| Leaked Password Protection disabled | 1 setting | WARN |
| Anonymous sign-in warning | Present | WARN |

The nine RLS-enabled/no-policy tables are:
`public.business_employees`, `public.business_job_positions`, `public.commission_rule_audit`, `public.digital_page_payment_events`, `public.directory_listing_claim_requests`, `public.directory_source_permission_evidence`, `public.platform_custom_roles`, `public.platform_role_assignments`, and `public.public_directory_listings`.

The three anon-executable SECURITY DEFINER functions are:
- `public.assign_default_owner_to_unowned_business()`
- `public.capture_commission_rule_audit()`
- `public.get_mnty_targeted_advertisements(...)`

The first two are intended to be trigger-only and are covered by unmerged/unapplied RC463 hardening work; current direct API execution warnings remain open until the ACL correction is applied and verified. Targeted advertisements is an intentional public discovery boundary and must keep its reviewed public contract while the function body, search path and returned fields remain constrained.

The 67 authenticated-executable functions require individual review of function body, tenant/business/branch scope, JWT claim trust, search_path, effective grants and negative cross-tenant tests. Advisor presence alone is not proof that each function is exploitable; blanket revocation could break legitimate server workflows.

## Performance Advisor snapshot

| Finding | Count | Level |
|---|---:|---|
| Unindexed foreign keys | 132 | INFO |
| Auth RLS initialization-plan findings | 375 | WARN |
| Unused indexes | 75 | INFO |
| Multiple permissive policies | 28 | WARN |

These are performance/policy-shape findings, not proof of a security incident. Review actual query workload, policy semantics and overlap before changing indexes or policies.

## Critical Edge Function parity

Deployed entrypoint content was compared against the corresponding `main` source. All six critical functions differ:

| Function | Live version | Current main-source difference |
|---|---:|---|
| `order-create` | 8 | Missing bounded streaming request-body handling, strict body/JSON validation, exact branch-scoped membership lookup, duplicate-option checks and option-to-item relationship validation. |
| `payment-intent` | 8 | Missing current Paymob intention-correlation helper and exact amount/intent binding checks. |
| `paymob-webhook` | 10 | Missing explicit finite-amount guard; signature, amount, currency, intent/order binding and replay idempotency must be validated together. |
| `digital-page-payment-intent` | 5 | Missing current Paymob intention-correlation helper. |
| `subscription-payment-intent` | 4 | Missing current intent correlation and encrypted checkout-secret protections. |
| `financial-journal` | 3 | Live uses wildcard CORS and legacy `post_financial_journal`; main uses allow-listed CORS and `post_financial_journal_backend`. |

Do not deploy these functions individually. Their contracts are coupled to schema, ACL, provider callbacks, finance and rollback prerequisites. Resolve those together in a restorable isolated environment and complete Paymob sandbox signature/idempotency and finance E2E first.

Other manifest functions observed at exact source parity: `directory-listings` v8, `api` v17, `order-status-update` v4 and `payment-webhook` v3. `smm-gateway` v13 matches main with launch deferred; negative runtime tests remain open.

## Latest full release-verifier snapshot

The main Pages verifier in run [41433049776](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41433049776), at 2026-11-02 10:59 UTC, recorded:

- `CATALOG_PILOT_GATE=PASS`; `FULL_PLATFORM_GATE=BLOCKED`.
- 32 of 60 selected physical-object checks non-PASS.
- RC449A/RC450 journal prerequisites absent: `journal_entries.entry_number`, `total_debit`, `total_credit`, `posted_at`, and `journal_entry_lines.line_number`; expected backend `service_role EXECUTE` is absent.
- Six critical Edge source mismatches remain.
- Two migration source aliases are pending controlled repair; do not rewrite migration history or execute duplicate SQL.
- Paymob/payment/finance E2E, backup/restore/rollback and measured RPO/RTO, Auth managed security settings, real Google-account/session and full adversarial multi-tenant E2E, SMM negative runtime tests, Android signed/device tests remain NOT VERIFIED / WAIT.

## Next work in dependency order

1. Refresh the 60-object/function/ACL preflight against current live schema and classify physical effects as present, absent, blocked or semantically unverified.
2. Build a restorable, schema-faithful isolated Production snapshot; rehearse chronological migration replay and rollback. Never apply missing migrations directly to Production.
3. Review RC463 trigger-only SECURITY DEFINER candidates and all exposed SECURITY DEFINER functions individually; preserve the intentional public-ad discovery contract.
4. Resolve RC449A → RC450 schema/ACL dependencies before financial-journal Edge deployment.
5. Complete signed Paymob sandbox E2E, webhook signature/idempotency, order/finance/commission/settlement/journal reconciliation, tenant-isolation negative tests, Auth settings, backup/restore, monitoring drill, RPO/RTO and device release evidence.
6. Keep `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED` until every independent gate passes and the owner explicitly authorizes the full rollout.

## Changes made during this audit

Read-only inventories and source comparisons only. No Production DDL/DML, migration apply/repair, GRANT/REVOKE, RLS/Auth configuration change, Edge deployment, provider call, financial transaction, backup restore or production release action was performed.
