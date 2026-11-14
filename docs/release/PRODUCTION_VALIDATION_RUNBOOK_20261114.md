# Production validation runbook — 2026-11-14

**Current decision:** `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`. This runbook is a preparation checklist, not approval to mutate Production. Use isolated staging/sandbox resources until every prerequisite is evidenced and the release owner explicitly approves rollout.

## 0. Non-negotiable safety rules

- Never use live Paymob credentials or real customer payment methods for E2E.
- Never replay a webhook against Production as a test.
- Never repair migration history by inserting fabricated `schema_migrations` rows or renaming historical migrations.
- Never restore a backup over the active Production project during a rehearsal.
- Never deploy a stale Edge Function entrypoint over a newer live version without reviewing the deployed source snapshot.
- Capture sanitized request IDs, event IDs, timestamps and pass/fail evidence; do not log API keys, tokens, provider secrets or full payment payloads.

## 1. Schema and migration reconciliation

Current evidence:
- Live ledger: 310 rows through `20261110150618`.
- Exact required release migration identifiers: 0/42 present.
- Required object contract: 60 objects; 31 physically present, 29 absent; semantic status 28 PASS / 32 non-PASS.

Before release:
1. Map each required migration version to its exact source file, expected object effects, live object state and any approved alias.
2. For every physically present object with a missing ledger identity, identify the migration that actually created it from database history and source review. Do not infer identity from name alone.
3. For each absent object, prepare a forward-only migration with explicit preconditions, postconditions and rollback/compensation notes.
4. Rehearse the complete ordered migration chain on a fresh disposable database and on a restored copy of the latest backup.
5. Re-run the object verifier and confirm all 60 required objects and migration identities are reconciled before changing Production.

## 2. Edge Function source parity

Current evidence:
- 7/11 critical entrypoints differ from current `main`: `order-create`, `payment-intent`, `paymob-webhook`, `digital-page-payment-intent`, `subscription-payment-intent`, `financial-journal`, and `directory-listings` v16.
- Four entrypoints match source exactly, but still need runtime authorization, webhook, order-state and deferred SMM tests.
- Live `directory-listings` v16 has a source snapshot in the production audit branch. Its direct doctor `UPSERT_LISTING` path bypasses the source-evidence publication gate; draft PR #728 prepares a safer source candidate.

Before release:
1. Reconcile each deployed entrypoint and every local helper file against a reviewed source commit.
2. For `directory-listings`, retain the main publication gate and staging-only import, preserve the public metadata sanitizer, strip internal claim/verifier IDs, and do not expose an owner-claim boolean as professional verification.
3. For the six payment/order/finance functions, verify the required schema objects, RPC signatures, grants and secrets before deployment.
4. Deploy the functions as one coordinated release after migration rehearsal; capture each resulting deployed version and bundle hash.
5. Run negative authorization tests for anon, wrong tenant, wrong business, wrong branch and non-admin callers.

## 3. Paymob sandbox and finance E2E

**Current block:** `public.tenant_payment_methods` has zero rows. Provider secrets were not inspected, sandbox readiness is unverified, and no payment E2E was run. Do not use Production for these tests.

Sandbox prerequisites:
1. Create a dedicated test tenant, business, branch, test order and test subscription in an isolated staging environment.
2. Configure Paymob sandbox credentials through the approved secret store; keep secret values out of database rows, source code, logs and PRs.
3. Confirm the configured environment is explicitly `sandbox`, and confirm the webhook endpoint points only to the staging Edge Function.
4. Confirm the expected currency, minor-unit amount conversion, order reference and idempotency key contract.

Required scenarios:
- **Success:** create intent, receive provider reference, complete sandbox checkout, validate webhook signature, amount, currency and order binding, then verify order state and payment event.
- **Duplicate webhook:** replay the same event; assert no duplicate payment event, ledger entry, journal entry or order transition.
- **Invalid signature:** reject without changing order/payment/ledger state.
- **Amount/currency mismatch:** reject without settling or marking the order paid.
- **Unknown or cross-tenant order reference:** reject and emit a sanitized audit event.
- **Failure/cancel/timeout:** persist a terminal or retryable state consistently; do not create a paid ledger row.
- **Refund:** verify provider refund reference, refund event idempotency and accounting reversal.
- **Settlement:** verify captain/vendor/platform amounts, settlement state, journal balancing and report totals.
- **Tenant isolation:** tenant A cannot read or mutate tenant B payment intents, orders, events, ledger or journal records.

Evidence to retain:
- Test run ID, sanitized order ID, provider reference, webhook event ID, status transitions, ledger/journal row IDs, duplicate-replay result, and reconciliation totals.
- Confirm no real funds moved and no production customer data was used.

## 4. Backup and disaster recovery rehearsal

**Current block:** backup inventory and restore rehearsal are not exposed through the available connector; no restore was performed and RPO/RTO are unmeasured.

Required owner-side steps:
1. Confirm backup schedule, retention, encryption and point-in-time recovery availability in the Supabase project dashboard.
2. Record the exact backup/PITR timestamp selected for rehearsal.
3. Restore to a separate recovery project; never overwrite the active Production project.
4. Measure RPO (data loss window) and RTO (time to usable service).
5. Verify migration ledger, required tables/indexes/functions, RLS/GRANTS, Auth configuration, Edge Function secrets by presence only, and sanitized row-count checks.
6. Run smoke tests against the recovery project, including sign-in, public catalog, directory pagination, contact consent, order flow and finance read paths.
7. Document recovery gaps and the tested rollback/forward-fix plan.

## 5. Auth and security settings

**Current block:** project Auth configuration is not readable through the available connector. Prior 2026-11-06 evidence reported leaked-password protection disabled; current owner-dashboard confirmation is required.

Owner-side verification checklist:
- Enable leaked-password protection and capture the resulting setting state.
- Verify email OTP/confirmation behavior and redirect allowlist.
- Verify Google OAuth client configuration and allowed callback URLs.
- Review signup policy, password policy, session lifetime, refresh-token rotation and rate limits.
- Confirm service-role credentials are server-side only and never bundled into browser code.
- Test unauthenticated, expired-session, wrong-tenant and revoked-user behavior.
- Record settings and timestamps without exporting secret values.

## 6. RLS and SECURITY DEFINER adversarial tests

Current advisor snapshot:
- 9 RLS-enabled tables without policies; none has direct `anon` or `authenticated` table grants.
- 1 intentionally public approved-active-ad SECURITY DEFINER RPC with an empty search_path.
- 65 SECURITY DEFINER functions executable by `authenticated`; review individually, do not blanket-revoke.
- 28 multiple-permissive-policy lints; relevant business/branch/order changes are in draft PRs #725/#727.

Required tests:
1. Tenant A cannot read or mutate tenant B business, branch, employee, order, payment, wallet, ledger or journal data.
2. Branch-scoped users cannot access sibling branches unless an explicit role grants it.
3. Anonymous callers can invoke only the intentionally public, bounded ad retrieval RPC and public read endpoints.
4. Every SECURITY DEFINER function has a reviewed owner, fixed search_path, explicit actor check, tenant/branch scope and least-privilege EXECUTE grants.
5. Service-role-only tables remain inaccessible to anon/authenticated direct table access.
6. Re-run security and performance advisors after the reviewed migrations.

## 7. Controlled release order

1. Approve a fresh backup and rollback/compensation plan.
2. Reconcile and rehearse the complete migration chain on a restored disposable copy.
3. Apply reviewed forward migrations in dependency order, verifying each postcondition.
4. Deploy the exact reviewed Edge Function bundle set and record deployed versions/hashes.
5. Run Paymob sandbox E2E and adversarial tenant-isolation tests.
6. Deploy frontend assets only after their backend contract is live.
7. Run production smoke tests that do not create payments or mutate customer data.
8. Re-run migration, object, Edge Function, RLS, Auth and advisor checks.
9. Obtain explicit release-owner approval before declaring Production ready.

## Stop conditions

Stop the rollout if any migration identity is unresolved, any required object is absent, any Edge Function source is unreviewed, any signature/amount/order binding fails, any webhook replay duplicates financial state, any tenant-isolation test leaks data, any restore rehearsal fails, or any rollback step is unproven.

**No Production deployment or payment test is authorized by this runbook.**
