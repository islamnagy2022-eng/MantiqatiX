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

## Additional registration endpoint review

The customer-registration and registration-review Edge Function sources were inspected read-only:

- Both require a bearer token and validate it through `admin.auth.getUser(token)`; both reject anonymous actors.
- Customer registration restricts the requested tenant to `MNTY-PLATFORM` and calls `activate_customer_registration_atomic`.
- Registration review requires a request ID/decision and calls `review_registration_request_atomic`.
- Both reject non-POST requests and reject a present browser Origin that differs from the configured GitHub Pages origin. They intentionally do not reject a missing Origin; the bearer token remains required. Confirm this is consistent with the intended non-browser caller policy.
- **Security observation (not changed):** both functions return database/RPC error text derived from `error.message` to the caller. Review the outward error contract for accidental internal-detail disclosure and prefer stable public error codes while retaining detailed diagnostics only in protected server logs. This touches the registration-review function's error contract; it is documented for coordinated review rather than changed in parallel.
- Four additional static assertions were added to the S08 script for server-side token validation, tenant/RPC constraints, and method/origin guards. The script is wired into the PR validation workflow immediately after `validate-auth-flow`. The workflow's deploy guard remains limited to `main` pushes or manual dispatch, so the PR path does not qualify for deployment.

## Execution evidence and limits

- Repository source was inspected through the connected GitHub source view on `main`.
- The uploaded RC40 ZIP is a different Android-oriented snapshot; its SHA-256 is `e3e564dd8c142028d8aca94fee328c9e1ab6407f02bd98465d335cc0c180a09e`. It must not be treated as the current web source.
- A source-contract evaluation against the fetched `main` blobs passed **13/13 assertions** (main blob SHA `e009bd28460772e07b0ff2e892d77787a0c2996f`; SMM blob SHA `982c4d62fb31f917e20e3f39b58326a49f88ce5f`). A separate current-branch source evaluation manually checked **19/19 contracts**, but this is not execution of `scripts/test-s08-auth-flows.mjs` by Node. An earlier version of that script passed `node --check`; the current expanded script has not been syntax-checked or executed locally because outbound DNS/network access prevented cloning.
- Earlier Pages validation runs were repeatedly cancelled before steps reported results. The Pages workflow concurrency group was changed from global `pages` to `pages-${{ github.ref }}` to isolate refs; the deploy condition remains limited to pushes to `main` or manual dispatch. Added `.github/workflows/s08-auth-contracts.yml` as a dedicated, lightweight workflow that runs `node --check scripts/test-s08-auth-flows.mjs` and `node scripts/test-s08-auth-flows.mjs` on relevant pull-request changes. Its first run, `38339833378`, was queued at last inspection; its result remains pending. No successful S08 CI execution is evidenced yet.
- No production settings, secrets, user accounts, memberships, RLS policies, deployment, merge, or release were changed.

## Next actions

1. Check dedicated S08 run `38339833378` (and the latest run for the branch head); retain exact syntax-check and static-contract results. If the queue persists, diagnose Actions queue status and use a full checkout for both commands.
2. Run isolated browser tests with synthetic accounts for OAuth success/cancel/error, callback replay, expired session, explicit logout, and membership absence/presence.
3. Verify the deployed Supabase Auth URL allow-list and Google provider configuration read-only; compare exact redirect URIs with main and SMM origins.
4. Confirm leaked-password protection read-only with the project owner; enable only through a separately approved production change.
5. Run non-enumeration tests using synthetic addresses and compare outward status/body/timing within an agreed tolerance.
6. Keep all production-facing checks **NOT VERIFIED** until independently evidenced. Do not merge or deploy this branch.
