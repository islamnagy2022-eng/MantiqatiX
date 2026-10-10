# RC448 — Matrimony Request Lifecycle Authority

**Status:** review candidate only; **not approved for production execution**.  
**Migration:** `supabase/migrations/20261010160000_rc448_matrimony_request_lifecycle_authority.sql`  
**Dependency:** RC447 must be reviewed/applied first, and a matching UI release must be ready. Do not apply this migration while any shipped client still depends on direct request/unlock writes.

## Risk addressed

A read-only production grant/policy audit found that `authenticated` has direct INSERT/UPDATE/DELETE grants on `matrimony_requests` and `matrimony_contact_unlocks`. Existing policies permit participants to update request rows and create unlock rows. That means a participant may be able to change the request state or create the row used by RC447 as the contact-release gate without using a trusted state-transition endpoint.

RC448 moves these mutations behind authenticated, server-authoritative database RPCs. The RPCs verify the real authenticated identity, reject anonymous Auth sessions, require verified profiles for request/accept/unlock/contact operations, scope responses to the recipient, make repeated requests/unlocks idempotent, and constrain state transitions.

## Preflight — read-only

1. Confirm the production project and maintenance window.
2. Confirm RC447 is applied and its post-migration privacy acceptance tests passed. If RC447 is not applied, stop; do not apply RC448 alone.
3. Review active duplicate requests. If more than one `PENDING` or `ACCEPTED_MUTUAL` request exists for the same sender/profile pair, reconcile manually under an approved plan before applying.
4. Confirm there are no duplicate contact-unlock rows and verify the existing unique constraint on `matrimony_contact_unlocks.request_id`.
5. Check all shipped clients and operational workflows. They must call `matrimony_create_request_backend`, `matrimony_respond_request_backend`, and `matrimony_unlock_contact_backend` rather than writing request/unlock tables directly.
6. Confirm the RC448 PostgreSQL 16 integration job passes on the exact release commit and migration-history/version/collision guards pass.

## Deployment order

1. Apply RC448 only through the approved migration pipeline after explicit rollout approval.
2. Verify the migration ledger records the exact version and filename.
3. Verify direct `INSERT`, `UPDATE`, and `DELETE` are denied to `anon`, `authenticated`, and `PUBLIC` for the request and unlock tables, while intended reads remain RLS-scoped.
4. Verify only `authenticated` can execute the four intended request/contact RPCs; `anon` and `PUBLIC` cannot.
5. Deploy the matching client only after database verification. Do not merge/publish the UI merely because CI passes.
6. Test with dedicated synthetic accounts: sender, recipient, unrelated user, unverified profile, and anonymous Auth session.

## Acceptance tests

- A verified user can create a request to a different verified profile; duplicate submissions return the same active request.
- Self-requests and requests to unverified profiles are rejected.
- Only the recipient can accept/reject. The sender and unrelated users cannot set request state directly.
- A rejected request cannot later be accepted; repeating the same decision is idempotent.
- Pending/rejected requests never reveal contact details.
- An accepted request can be unlocked by one of its participants; retries return the same unlock and do not create duplicates.
- Only the two participants can retrieve the counterpart's contact fields, and only while both profiles remain verified and the request is accepted with an unlock row.
- Direct table writes remain denied and anonymous Auth sessions are rejected.

## Rollback / failure handling

- Do not roll back by restoring broad raw-profile SELECT or direct client DML grants.
- If the migration fails, stop and inspect the exact error; do not edit or replay an applied migration.
- If the matching UI fails after migration, keep the restrictive database boundary and roll the web assets back to a compatible release or disable the affected write controls until a corrected client is approved.
- Prefer a forward-fix migration. Record pre-release ACLs and function definitions for audit.

## Safety boundary

This runbook authorizes no production change. RC448 is not applied by this document, and no production data, grants, policies, Edge Functions, payments, or customer contacts are changed.
