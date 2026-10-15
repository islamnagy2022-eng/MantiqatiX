# S02 — Live MantiGO Platform-Admin Authorization Recheck

**Observed:** 2026-10-13 UTC  
**Repository / PR:** `islamnagy2022-eng/MantiqatiX`, [PR #218](https://github.com/islamnagy2022-eng/MantiqatiX/pull/218)  
**Supabase project:** `moyhiluyhjsujhwlyeuu`  
**Disposition:** **P0 BLOCKER — NOT CERTIFIED**  
**Method:** read-only SQL against the live project; no database or permission changes.

## 1. Direct production evidence

A read-only catalog query evaluated the live function definitions, SECURITY DEFINER flag, configured search path, and effective EXECUTE privileges for the four platform-wide MantiGO RPCs.

| Function signature | SECURITY DEFINER | `search_path` | authenticated EXECUTE | anon EXECUTE | Platform guard found in live definition |
|---|---:|---|---:|---:|---:|
| `get_mantigo_admin_dashboard_backend(uuid)` | true | `public` | true | false | no |
| `get_mantigo_admin_financial_report_backend(uuid,timestamptz,timestamptz)` | true | `public` | true | false | no |
| `settle_mantigo_captain_backend(uuid,text,text)` | true | `public` | true | false | no |
| `expire_stale_mantigo_rides_backend(uuid,integer)` | true | `public` | true | false | no |

The query searched the current deployed definitions for both `mnty_can_platform_admin` and `PLATFORM_ADMIN_REQUIRED`; both checks were absent from all four live definitions. This is direct live catalog evidence, not inferred from repository source.

A separate read-only catalog query returned:

- `public.digital_page_payment_events`: RLS enabled = true; FORCE RLS = false; policy count = 0.

No policy should be added until the intended actor/data-access contract is specified. Zero policies can mean deliberate deny-by-default for ordinary API roles; it is not permission to create a broad policy.

## 2. Risk and severity

**P0 release blocker.** The four functions are SECURITY DEFINER and executable by the authenticated role while the deployed bodies lack the expected platform-admin check. A function parameter named `p_admin_user_id` is not an authorization boundary by itself. The financial-report RPC also exposes platform-wide financial aggregates; settlement and stale-ride expiration are mutations, so they require a strong server-side actor check before any side effect.

The live metadata does not, by itself, prove a successful exploit or establish whether every body independently checks `auth.uid()`. It does prove the platform-admin guard is absent from the live definitions, so release acceptance cannot rely on the newer branch tests.

## 3. Required forward-only remediation

1. Keep the production migration ledger immutable. Do not mark RC441/RC449/RC462/RC523 as applied without independent evidence.
2. Reconcile the canonical function signatures and live bodies against the reviewed migration chain, then prepare a new forward-only migration with a unique, collision-free version after the chain is resolved.
3. In each of the four functions, verify the authenticated actor is non-null and matches the supplied admin identity where that parameter remains part of the contract; then call the canonical platform-admin guard and raise the stable `PLATFORM_ADMIN_REQUIRED` error before reading platform-wide data or performing mutations.
4. Use a hardened search path (prefer empty path plus schema-qualified object references) and explicit grants. Preserve response JSON and financial-ledger semantics.
5. Add disposable-PostgreSQL regression tests for unauthenticated, ordinary tenant owner/admin, tenant-scoped SUPER_ADMIN, malformed permissions, revoked/inactive platform membership, and explicitly authorized platform SUPER_ADMIN. Verify unauthorized settlement/expiry calls leave all affected rows and ledger balances unchanged.
6. Run the focused integration suite, full chronological clean replay, migration uniqueness/history-immutability checks, and then re-query the deployed function catalog after an explicitly approved production release.

## 4. Verification boundary

- **Verified now:** four live RPCs are SECURITY DEFINER; authenticated EXECUTE is true; anon EXECUTE is false; configured search path is `public`; expected platform guard/error marker is absent from each live definition.
- **Verified now:** `digital_page_payment_events` has RLS enabled and zero policies.
- **Not verified:** exploitability through each function's remaining internal checks, remediation deployment, full-chain replay, end-to-end financial tests, or production acceptance.
- **Not performed:** production writes, grants/revokes, policy changes, migration application, financial mutations, deployment, or merge.

**Decision:** keep PR #218 draft and release **BLOCKED / NOT CERTIFIED** until an approved forward-only fix is applied and the live post-release verification passes.
