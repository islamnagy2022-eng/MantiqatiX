# RC447 — Matrimony Privacy Boundary Rollout Runbook

**Status:** prepared for review; **not approved for production execution**.  
**Migration:** `supabase/migrations/20261010150000_rc447_matrimony_profile_privacy_boundary.sql`  
**Release order:** database migration first, then the matching web bundle. Do not publish the web bundle alone because it calls `matrimony_discover_profiles_backend`.

## Why this gate exists

A read-only production policy inspection on 2026-10-10 found that the permissive `matrimony_profiles_select` policy allowed any non-anonymous authenticated session to select raw profile rows. Existing restrictive policies only blocked anonymous sessions. Raw rows include sensitive biography, financial/housing details, and contact fields. RC447 replaces the permissive policy with owner-only access and exposes only an allowlisted verified-profile discovery projection.

Production schema inspection confirmed the referenced columns exist and `matrimony_requests.status` is `NOT NULL`. The migration still uses `IS DISTINCT FROM` so contact retrieval fails closed for every status except `ACCEPTED_MUTUAL`.

## Preflight — read-only

1. Confirm the production project and the approved maintenance window.
2. Re-read `supabase_migrations.schema_migrations` (or the supported migration ledger) and confirm version `20261010150000` is not already applied. Never edit or replay an applied migration.
3. Reconfirm the exact live policy/function definitions and grants. Confirm `matrimony_profiles_select` is the permissive SELECT policy being replaced; do not bulk-delete unrelated restrictive policies.
4. Confirm the RC447 source, its PostgreSQL 16 integration test, and all required GitHub checks pass on the exact release commit.
5. Confirm a rollback/recovery owner is available and record the pre-release policy/function definitions for audit.

## Approved deployment order

1. Apply RC447 once through the approved migration pipeline. Do not run its SQL manually in production as a workaround for a failed migration pipeline.
2. Verify the migration ledger records the exact version and filename.
3. Verify the raw SELECT policy is owner-only, and all existing restrictive anonymous-session policies remain in place.
4. Verify RPC ACLs: `anon` and `PUBLIC` cannot execute either privacy RPC; `authenticated` can execute only the intended RPCs.
5. Deploy the matching web asset bundle only after the database migration is confirmed applied.
6. Run the post-deployment tests below with dedicated test accounts. Do not use real customer profiles or real contact details for test fixtures.

## Post-deployment acceptance tests

- **Raw profile reads:** owner can read their own profile; a different authenticated user cannot read the raw row; an anonymous Auth session is denied.
- **Discovery projection:** signed-in non-anonymous users see verified profiles belonging to other users only. Returned fields must not include direct/wali phone numbers, biography free text, partner requirements, financial status, housing status, or religiosity details.
- **Contact retrieval:** pending/rejected requests fail; accepted mutual requests without an unlock row fail; an accepted mutual request with an unlock row returns only the counterpart's allowed contact fields to one of the two participants.
- **Request ownership:** an unrelated authenticated user cannot retrieve contacts using another user's request ID.
- **Verification:** a profile owner cannot set `is_verified=true` on insert or update. Only the trusted server role or explicitly authorized platform admin path can perform verification.
- **Frontend honesty:** failed/denied data sources render an explicit unavailable state rather than a zero-record claim.
- **Regression:** run the complete module, backend-only, migration-history, migration-version, collision, and PostgreSQL privacy test suites.

## Failure and rollback policy

- If the migration fails before commit, stop and inspect the error; do not edit applied migration history or rerun altered SQL under the same version.
- If web deployment fails after the migration succeeds, keep the owner-only policy in place and roll the web assets back to a compatible release or disable the affected discovery screen until a corrected bundle is approved.
- **Never roll back by restoring the broad authenticated raw-profile SELECT policy.** A fix-forward migration is preferred. Keep the allowlisted RPC and owner-only policy in place while correcting application behavior.
- If any unauthorized contact or profile read is observed, stop rollout, preserve audit evidence, revoke only the implicated access path through an approved incident procedure, and investigate before reopening traffic.

## Safety boundary

This runbook does not authorize production changes. No production migration, policy/grant change, Edge Function deployment, profile data access beyond read-only schema/policy inspection, or customer-contact retrieval is performed by this document.
