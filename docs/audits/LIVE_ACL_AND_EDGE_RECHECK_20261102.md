# Live database follow-up — 2026-11-02

## Scope
Read-only recheck of the Supabase production project `moyhiluyhjsujhwlyeuu` after the catalog release. No DDL, DML, ACL change, migration, Edge deployment, payment/provider request, or financial operation was performed.

## Migration ledger
- Live migration ledger: **309 rows**.
- Latest recorded version: `20261101140105` (`directory_source_permission_evidence`).
- RC463 source migration exists on GitHub `main`: `supabase/migrations/20261031100000_rc463_trigger_only_security_definer_acl.sql`.
- RC463 is not present as a later ledger version in the current live inventory. Do not infer application from PR #617 merge: source merge and production migration application are separate events.

## Direct function ACL and trigger inspection
Read-only catalog query returned:

| Function | SECURITY DEFINER | search_path setting | anon EXECUTE | authenticated EXECUTE | service_role EXECUTE | enabled trigger |
|---|---:|---|---:|---:|---:|---:|
| `assign_default_owner_to_unowned_business()` | yes | `public, auth` | yes | yes | yes | yes |
| `capture_commission_rule_audit()` | yes | empty | yes | yes | yes | yes |
| `get_mnty_targeted_advertisements(...)` | yes | empty | yes | yes | no | no |

Interpretation:
- The first two functions are intended trigger-only functions in RC463. Their enabled triggers exist, but direct execution remains possible for API roles in the live database.
- The first function's live search_path is not pinned to empty; the second already has an empty search_path, but its direct ACL remains open.
- The public targeted-advertisement RPC is a separate intentional public discovery contract. Do not revoke it as part of blanket cleanup; review its body, output columns and bounded query behavior independently.
- The live result is consistent with the Security Advisor warning; it does not prove exploitation or unauthorized use.

## Current deployed critical Edge versions
Live Supabase Edge inventory confirms these versions:

| Function | Live version | Release status |
|---|---:|---|
| `order-create` | 8 | mismatch remains open |
| `payment-intent` | 8 | mismatch remains open |
| `paymob-webhook` | 10 | mismatch remains open |
| `digital-page-payment-intent` | 5 | mismatch remains open |
| `subscription-payment-intent` | 4 | mismatch remains open |
| `financial-journal` | 3 | mismatch remains open |

These functions must not be deployed individually. Their rollout depends on database schema, ACLs, Paymob callback verification, idempotency, ledger integrity, rollback and exact-head integration evidence.

## Next safe action
1. Rehearse RC463 against the exact live schema in a restorable isolated database.
2. Prove trigger execution still succeeds while direct anon/authenticated/service_role invocation fails.
3. Confirm empty search_path and exact trigger-function linkage.
4. Run Supabase Security Advisor and targeted ACL SQL against the rehearsal.
5. Verify the restore and rollback rehearsal before requesting any production rollout approval.

## Release gate
`FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`.

This is a read-only evidence note, not a production change authorization or a claim that RC463 has been applied.
