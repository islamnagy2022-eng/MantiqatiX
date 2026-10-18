# Financial Journal — Production Boundary Audit

**Checked:** 2026-10-16 (UTC)  
**Project:** `moyhiluyhjsujhwlyeuu`  
**Repository:** `islamnagy2022-eng/MantiqatiX`  
**Method:** read-only production SQL and Edge Function source inspection.

## Findings

### 1. Deployed Edge Function differs from tracked source

The active production `financial-journal` function is version 3 with `verify_jwt=true`. Its deployed entrypoint is 1,591 characters; the tracked `main` entrypoint is 3,387 characters.

Read-only source inspection confirmed:

- Production calls legacy RPC `post_financial_journal(jsonb,jsonb)`.
- Tracked `main` calls `post_financial_journal_backend(uuid,jsonb,jsonb)`.
- Production source uses wildcard `Access-Control-Allow-Origin: *`.
- The source difference is substantive, not formatting-only.

### 2. Current production RPC ACL and function configuration

A read-only query against `pg_proc` and `has_function_privilege` returned:

| Function | SECURITY DEFINER | Function setting | service_role EXECUTE | authenticated EXECUTE | anon EXECUTE |
|---|---:|---|---:|---:|---:|
| `post_financial_journal_backend(uuid,jsonb,jsonb)` | Yes | `search_path=public` | No | No | No |
| `post_financial_journal(jsonb,jsonb)` | Yes | `search_path=public` | No | No | No |

The backend RPC is not executable by `service_role` in the current production ACL state, so simply deploying the tracked `main` Edge Function would break its expected call path. Both routines are SECURITY DEFINER and currently set `search_path=public`; review the exact migration definitions and dependency resolution before any ACL or function configuration change.

### 3. Migration ledger remains behind the proposed rollout

The live migration ledger contains **283 entries**, latest version `20261008222845`. Both proposed prerequisites remain absent:

- `20261010175000_rc449a_financial_journal_schema_prerequisites.sql`
- `20261010180000_rc450_financial_journal_service_role_boundary.sql`

RC449A changes schema and performs backfills; RC450 establishes the intended backend RPC boundary. The live state therefore does not satisfy the assumptions of the tracked `main` Edge Function.

## Decision

**Do not deploy the tracked `financial-journal` source or apply RC449A/RC450 ad hoc.** Keep the release blocked until all of the following are completed in a reviewed change window:

1. Reconcile the canonical migration source chain and prove the exact ordered prerequisites.
2. Review RC449A schema effects and backfill preconditions against a verified production schema baseline.
3. Apply RC449A then RC450 only with explicit approval and documented rollback/recovery steps.
4. Verify function signatures, ACLs, `search_path`, tenant/business/branch scope binding, and exact ledger effects.
5. Run the RC450 disposable/staging integration suite, including unauthorized actors, wrong-scope requests, duplicate/idempotent calls, and audit/ledger consistency.
6. Deploy the matching Edge Function only after database and staging evidence is approved.

No migration, function, grant, RLS policy, row, wallet, or payment state was changed during this audit. No synthetic journal entries were created in production.
