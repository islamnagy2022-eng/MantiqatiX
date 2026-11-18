# Pass 541–560 — live P0 Auth and SECURITY DEFINER baseline (2026-11-18)

## Scope and method

Read-only inspection of Supabase Production project `moyhiluyhjsujhwlyeuu`, current repository `main`, the canonical production TODO and release contract. No SQL mutation, migration, Auth-setting change, grant change, Edge deployment, payment, or settlement was performed.

## Live Production facts

- Project status: `ACTIVE_HEALTHY`; PostgreSQL 17.6.1.155.
- Migration ledger: 310 rows; latest applied version `20261110150618`. The required release set is 54 exact source versions through RC475; the current release manifest records 0/54 exact versions in the live ledger. Do not fabricate ledger rows or infer physical schema absence from version identity alone.
- Security Advisor snapshot at 2026-11-18 04:10 UTC:
  - 9 public tables have RLS enabled and no policies. Existing audit evidence records direct anon/authenticated table access denied; preserve this private-by-default posture unless a specific feature contract proves a narrower policy is required.
  - 65 public SECURITY DEFINER functions are executable by `authenticated`.
  - 1 SECURITY DEFINER function is executable by `anon`: `public.get_mnty_targeted_advertisements(...)`. It is the intentional public-ad discovery RPC; its current `search_path` is empty and the output is bounded. Keep its public contract under regression coverage rather than blindly revoking it.
  - Leaked-password protection is disabled (WARN). The available Supabase connector exposes no Auth security-settings update operation, so this setting remains an external dashboard action and is not represented as fixed.
  - Advisor reports policies on multiple tables as allowing anonymous-role access. A privacy-preserving aggregate query found 8 registered users and 0 anonymous users at the time of inspection. Zero current anonymous accounts does not prove the Auth anonymous-sign-in setting is disabled; confirm the setting and either disable anonymous sign-ins if not required or add explicit non-anonymous checks to the affected policies after contract review.
- Catalog query confirmed all 65 listed public SECURITY DEFINER functions have a function-level search_path setting; this is not proof that every configured path is safe or that every function is correctly authorized.
- Read-only body review confirmed several user-scoped MantiGO and catalog RPCs compare supplied user IDs with `auth.uid()` or delegate to scoped helpers. Do not classify a function as safe merely because its name contains `backend`.
- The live `settle_mantigo_captain_backend` and `expire_stale_mantigo_rides_backend` definitions still accept broad active membership roles for platform-wide operations. The canonical RC464/RC471 source repairs exist in the repository but are not applied to Production. These remain P0 release blockers; no live invocation was made.

## Live Edge inventory highlights

- `paymob-webhook` v10, `payment-intent` v8, `digital-page-payment-intent` v5, `subscription-payment-intent` v4, `financial-journal` v3, `directory-listings` v16, `public-catalog` v8, `public-catalog-directory` v18, `catalog-admin` v20, `catalog-platform-admin` v23, `smm-gateway` v13.
- Function versions and ACTIVE status are inventory only; they do not establish source parity or runtime correctness. Keep payment/finance deployment coordinated with its full migration prerequisites and sandbox checks.

## Decisions

1. Do not mass-revoke authenticated EXECUTE from the 65 SECURITY DEFINER functions: these are intended backend RPC boundaries and must be reviewed function-by-function for auth identity, tenant/business/branch scope, search_path, and grants.
2. Do not add broad policies to the 9 RLS/no-policy tables.
3. Keep the public targeted-ad RPC as a documented, tested public exception.
4. Keep RC464–RC475 Production rollout blocked until an encrypted off-site logical backup and successful restore rehearsal are evidenced, migration drift/aliases are reconciled, and matching Edge/Auth/finance checks pass.
5. Resolve leaked-password protection and the anonymous-sign-in policy warnings through supported Auth settings and targeted tests; no Auth configuration was changed here.

## Evidence boundary

All findings above are based on read-only Production catalog/advisor queries and repository source inspection at the time stated. They are not a complete adversarial penetration test, do not certify all 65 function bodies, and do not authorize Production rollout.
