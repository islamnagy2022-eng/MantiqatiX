# MantiGO Live Source Convergence Evidence — 2026-10-07

## Verified live-to-main comparisons

The following active production Edge Functions were retrieved from Supabase and compared byte-for-byte with the corresponding files on the repository main branch.

| Function | Production version | Result |
|---|---:|---|
| mantigo-payment-intent | 2 | PASS — exact index.ts match |
| paymob-webhook | 7 | PASS — exact index.ts match |

## Additional database hardening verified

- All public SECURITY DEFINER functions currently have an explicit search_path configuration.
- Five legacy MantiGO SECURITY DEFINER RPCs that are no longer client-callable were hardened with search_path = public, pg_temp and explicit EXECUTE revocation for anon and authenticated.
- Live verification confirmed those five legacy RPCs have anon_exec=false and authenticated_exec=false.
- The MantiGO production security regression contract passed its live RLS/RPC assertions.

## Release interpretation

These checks close only source-convergence and database-boundary evidence covered above. They do not certify real Paymob transaction E2E, settlement reconciliation, multi-user adversarial E2E, browser/device E2E, backup restore/RPO/RTO, Android release validation, or managed Auth leaked-password protection.
