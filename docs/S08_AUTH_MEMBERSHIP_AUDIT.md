# S08 — Authentication & Membership Flow Audit

**Date:** 2026-10-13  
**Scope:** source-level review and isolated regression contracts only  
**Repository baseline:** `main`; work branch: `agent/s08-auth-flows`  
**Related release context:** PR #218 (draft; not merged)

## Verified from current source

- Main web authentication calls Google OAuth through `signInWithOAuth`; it does not expose `signInWithOtp` or `verifyOtp`.
- SMM authentication also calls Google OAuth; its Supabase client sets `flowType: 'pkce'` and `detectSessionInUrl: true`.
- Main client configuration includes `autoRefreshToken: true`, `persistSession: true`, and `detectSessionInUrl: true`.
- Main OAuth redirect helper derives the redirect from the current page's `origin`, `pathname`, and query string. SMM derives `redirectTo` from `origin + pathname`.
- Main source reads `user_memberships` scoped to the current user's ID and `status = ACTIVE`.
- The existing source-level validator checks that membership rows and registration-review rows are not directly inserted/updated/deleted by the client, and checks duplicate pending/approved registration protection.
- Existing source validator also checks that automatic auth boot does not sign out the user and that the main web source has one explicit `signOut()` path.

## New isolated regression check

Added `scripts/test-s08-auth-flows.mjs` on this branch. It adds source-contract checks for OAuth provider usage, removal of the legacy OTP flow, session flags, PKCE, redirect construction, user-scoped active memberships, server-routed registration/review, duplicate-request protection, and explicit logout boundaries.

## Not tested / NOT VERIFIED

- **Interactive Google OAuth:** no real browser/provider round trip was run.
- **Service behavior:** no Supabase Auth API calls were made. Correct/incorrect/expired OTP and resend tests are **not applicable to the current web flow**, because the current source has removed the OTP path; they must not be reported as passed.
- **Callback allow-list / deployed redirect configuration:** source-derived URLs were inspected, but the Supabase dashboard allow-list and the live deployed callback were not independently read in this audit.
- **Membership creation and institution linking:** source contracts were inspected, but no disposable-tenant end-to-end registration was run. No production membership/account was created or changed.
- **Session expiry, refresh/reuse, logout invalidation, and recovery:** not exercised against a real Auth service or browser.
- **Email enumeration resistance:** not proven by static inspection; requires isolated service-level tests using synthetic accounts and identical outward responses.
- **Leaked-password protection:** prior repository continuity/security evidence records this setting as disabled. This audit did not read or change the live dashboard setting; current live state remains **NOT VERIFIED** until read-only confirmation.
- **Real account inventory:** no Auth account list was requested or read, and no personal account identifiers are included.

## Execution evidence and limits

- Repository source was inspected through the connected GitHub source view on `main`.
- The uploaded RC40 ZIP is a different Android-oriented snapshot; its SHA-256 is `e3e564dd8c142028d8aca94fee328c9e1ab6407f02bd98465d335cc0c180a09e`. It must not be treated as the current web source.
- The local environment could not clone the repository because outbound DNS/network access was unavailable. Therefore the new script has **not yet been executed against a local checkout**; do not mark its assertions PASS until CI or a checkout run confirms them.
- No production settings, secrets, user accounts, memberships, RLS policies, deployment, merge, or release were changed.

## Next actions

1. Run `node scripts/test-s08-auth-flows.mjs` on this branch in a repository checkout and retain the exact commit/run result.
2. Run isolated browser tests with synthetic accounts for OAuth success/cancel/error, callback replay, expired session, explicit logout, and membership absence/presence.
3. Verify the deployed Supabase Auth URL allow-list and Google provider configuration read-only; compare exact redirect URIs with main and SMM origins.
4. Confirm leaked-password protection read-only with the project owner; enable only through a separately approved production change.
5. Run non-enumeration tests using synthetic addresses and compare outward status/body/timing within an agreed tolerance.
6. Keep all production-facing checks **NOT VERIFIED** until independently evidenced. Do not merge or deploy this branch.
