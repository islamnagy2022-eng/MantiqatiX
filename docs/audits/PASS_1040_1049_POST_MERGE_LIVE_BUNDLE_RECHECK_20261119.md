# Pass 1040–1049 — post-merge live bundle and database recheck (2026-11-19)

## Result

**Enterprise release remains BLOCKED / NOT CERTIFIED.** This pass is read-only against Production. No migration, Edge Function, Auth, RLS, GRANT, payment, wallet, settlement, or customer-data mutation was performed.

- Main after PR #845: `18de15f4ea280e85c995d33fd84b3ac00f5ac4f3`.
- PR #845 merged after all 42 exact-head checks completed: 40 success, 2 intentionally skipped; no failures. Browser dashboard E2E, catalog build, directory consent PostgreSQL tests, doctor import contract, and forward migration replay passed.
- Canonical Supabase project `moyhiluyhjsujhwlyeuu`: ACTIVE_HEALTHY, PostgreSQL 17.6.1.155.

## Live database evidence

Read-only migration inventory and SQL recheck:

- Migration ledger: 310 rows; latest `20261110150618`.
- Published directory listings: 869.
- Published rows with both phone and address: 869.
- Published rows with secondary phone: 178.
- `public.directory_listing_contact_consents`: absent.
- `private.directory_listing_contact_consents`: absent.
- RC472/RC473 are not applied.

## Critical Edge Function bundle comparison

Fetched deployed bundle metadata and source files from Supabase and compared every deployed `index.ts` byte-for-byte with the matching `main` file.

| Function | Live version | verify_jwt | Live bundle files | Entry point |
|---|---:|---:|---|---|
| `order-create` | 8 | true | `index.ts` | MISMATCH |
| `payment-intent` | 8 | true | `index.ts` | MISMATCH |
| `paymob-webhook` | 10 | false | `index.ts` | MISMATCH |
| `digital-page-payment-intent` | 5 | true | `index.ts` | MISMATCH |
| `subscription-payment-intent` | 4 | true | `index.ts` | MISMATCH |
| `financial-journal` | 3 | true | `index.ts` | MISMATCH |
| `directory-listings` | 16 | false | `index.ts`, `pagination-filter.mjs`, `doctor-import-contract.mjs` | MISMATCH |

All seven live entrypoints differ from current `main`. A dependency-graph inspection of current main found these additional relative runtime imports outside the individual function folders:

- `payment-intent` → `../_shared/paymob-intent-correlation.mjs`
- `digital-page-payment-intent` → `../_shared/paymob-intent-correlation.mjs`
- `subscription-payment-intent` → `../_shared/paymob-intent-correlation.mjs` and `../_shared/checkout-secret-crypto.mjs`
- `directory-listings` → `./pagination-filter.mjs`, `./doctor-import-contract.mjs`, `./consent-pagination.mjs`, and `./public-directory-output-contract.mjs`

The two shared modules were verified in `supabase/functions/_shared/` and have no further relative imports. `order-create`, `paymob-webhook`, and `financial-journal` have no relative source imports. Supabase's current Edge Functions documentation says the CLI bundles a function and its dependency graph into an ESZip; therefore the per-function source-file listing must not be treated as a complete inventory of the final compiled ESZip. The direct evidence is the byte-mismatched live entrypoint source and its imports, plus the live directory source-file list.

For `directory-listings`, current main requires five runtime source files (`index.ts`, `doctor-import-contract.mjs`, `pagination-filter.mjs`, `consent-pagination.mjs`, `public-directory-output-contract.mjs`); the Management API's live source listing exposes only three and omits the two new consent helpers. Test files are not runtime dependencies.

This confirms source-parity drift and the directory-consent release blocker. It does not establish that every difference is independently exploitable; each function requires its own contract, dependency, secret, JWT, and schema review before coordinated deployment. Supabase documentation: [Edge Functions architecture and bundling](https://supabase.com/docs/guides/functions/architecture) and [development tips / shared code layout](https://supabase.com/docs/guides/functions/development-tips).

## Current security-advisor snapshot

Supabase Security Advisor reported:
- 9 RLS-enabled tables without policies (each requires intended-access-path review; do not add blanket policies).
- 1 anon-executable SECURITY DEFINER function: `get_mnty_targeted_advertisements`.
- 65 authenticated-executable SECURITY DEFINER functions (must be reviewed function-by-function for actor binding, scope, search_path and intended caller).
- Health Advisor returned no findings in this snapshot.

Remediation references:
- [RLS enabled without policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [Anon-executable SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- [Authenticated SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)

## Pass checklist

- [x] 1040 — Verified PR #845 merged into main at the exact expected head.
- [x] 1041 — Verified all 42 exact-head PR checks completed with 40 success, 2 skipped, and zero failures.
- [x] 1042 — Verified browser dashboard E2E, build, consent PostgreSQL, doctor import and forward migration replay.
- [x] 1043 — Rechecked canonical Supabase project health and PostgreSQL version.
- [x] 1044 — Re-read the live migration ledger and latest applied version.
- [x] 1045 — Re-read published directory contact aggregates with read-only SQL.
- [x] 1046 — Reconfirmed public/private contact-consent tables and RC472/RC473 are absent.
- [x] 1047 — Compared all seven mismatched critical Edge entrypoints against current main byte-for-byte.
- [x] 1048 — Compared deployed and repository runtime bundle file inventories; confirmed missing directory helper modules.
- [x] 1049 — Recorded current blockers and preserved Production unchanged; no isolated Edge deploy or migration replay.

**Next execution boundary:** reconcile the chronological migration chain, encrypted backup/restore and rollback evidence, then stage a single coordinated DB + complete Edge bundle release. Do not deploy individual mismatched functions or apply RC472/RC473 alone. The current public directory privacy exposure remains a release blocker.

