# MantiqaTix — Fresh Read-Only Production Security & Edge Function Parity Checkpoint

**Observed:** 2026-10-30 04:58–04:59 UTC  
**Project:** `moyhiluyhjsujhwlyeuu`  
**Scope:** read-only Supabase project metadata, migration ledger, Security Advisor, `pg_policies`, and deployed Edge Function source retrieval.  
**No production mutation was performed.**

## 1. Project and migration baseline

- Supabase project status: `ACTIVE_HEALTHY`.
- PostgreSQL: `17.6.1.155` (engine 17, GA).
- Production migration ledger: 308 records.
- Latest recorded ledger version: `20261029083845` (`require_phone_for_published_directory_listings`).
- This is a ledger observation only; it does not prove that all source migrations or object effects reconcile.

## 2. Fresh Security Advisor findings

Advisor findings were observed at approximately `2026-10-30T04:58:43Z`:

| Finding | Count | Level |
|---|---:|---|
| RLS enabled, no policy | 8 tables | INFO |
| Anon-executable SECURITY DEFINER | 3 functions | WARN |
| Authenticated-executable SECURITY DEFINER | 67 functions | WARN |
| `auth_allow_anonymous_sign_ins` | 90 table findings | WARN |
| Leaked Password Protection disabled | 1 Auth setting | WARN |

The 90 anonymous-access findings must not be interpreted as 90 tables directly granted to the Postgres `anon` role. Supabase anonymous sign-in users assume the `authenticated` Postgres role and are distinguished by the JWT `is_anonymous` claim. See the current Supabase documentation: [Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous) and [Advisors](https://supabase.com/docs/guides/observability/advisors).

## 3. Read-only RLS policy inventory

A read-only query of `pg_policies` returned:

- 485 total policies in the public schema.
- 483 policies targeting `authenticated`.
- 19 policies explicitly targeting `anon` or `public`.
- Among the 483 authenticated policies, 283 reference the JWT `is_anonymous` claim and 200 do not reference it textually.
- Among the 19 explicit anon/public policies, the aggregate check found zero potentially mutating permissive policies; 1 unconditional SELECT, 9 conditional SELECTs, and 6 explicit false-deny policies were identified by the query. The remaining rows require exact policy-level review rather than assumptions.

A targeted read of sensitive tables (payments, payment events, subscriptions, wallet/ledger/journal, settlements, marketing leads, digital-page orders, support, notifications, tenants, and businesses) showed several access patterns:
- Financial read policies generally require an active membership in the same tenant and an allowed finance/owner role.
- User-owned order/notification policies bind rows to `auth.uid()`.
- Some tenant/business policies explicitly reject JWTs with `is_anonymous=true`.
- Some policies rely on ownership or active-membership predicates without an explicit anonymous-claim check.

**Interpretation:** the 200 policies without a textual `is_anonymous` reference are not automatically vulnerabilities; ownership and membership predicates may still deny an anonymous user. However, no adversarial runtime test using an anonymous JWT was performed in this checkpoint. The full anonymous-session policy review and runtime test remain OPEN. Do not mass-revoke grants or add blanket restrictive policies.

## 4. Critical deployed Edge Function parity

Read-only retrieval compared the deployed `index.ts` text with the corresponding `main` source file. Exact text parity was false for all six critical entrypoints:

| Function | Live version | `verify_jwt` | Live source chars | Main source chars | Exact text parity |
|---|---:|---|---:|---:|---|
| `order-create` | 8 | true | 10,083 | 13,988 | NOT MATCH |
| `payment-intent` | 8 | true | 8,114 | 10,366 | NOT MATCH |
| `paymob-webhook` | 10 | false | 11,538 | 12,665 | NOT MATCH |
| `digital-page-payment-intent` | 5 | true | 5,345 | 6,532 | NOT MATCH |
| `subscription-payment-intent` | 4 | true | 5,196 | 11,100 | NOT MATCH |
| `financial-journal` | 3 | true | 1,591 | 3,387 | NOT MATCH |

A text mismatch is a parity failure requiring a semantic diff and release review; it is not by itself proof that the deployed function is exploitable or that the repository version is safe to deploy. No Edge Function was deployed or modified.

## 5. Release decision and next work

Overall release remains **BLOCKED / NOT CERTIFIED**.

Priority actions:
1. Build a policy-by-policy matrix for the 90 anonymous-access advisor findings, distinguishing explicit `anon/public` access from `authenticated` policies; test the latter with anonymous and permanent-user JWT fixtures in isolated PostgreSQL.
2. Review the 67 authenticated and 3 anonymous SECURITY DEFINER function ACLs, search paths, and callers; preserve intended public catalog behavior and trigger contracts.
3. Produce semantic diffs and isolated integration tests for the six deployed Edge Functions before proposing any deployment.
4. Reconcile the 308-row production ledger with the ordered release migration manifest and required object contracts. Never apply migrations directly to production as part of this audit.
5. Obtain authorized Supabase Auth dashboard action to enable Leaked Password Protection, then rerun Security Advisor. No setting was changed here.
6. Continue the backup/restore rehearsal and real Paymob sandbox/payment E2E gates separately.

## 6. Safety boundary

This checkpoint performed only reads. It did not change production schema/data, migrations, RLS policies, grants, Auth settings, Edge Functions, secrets, payments, wallets, settlements, or financial postings.
