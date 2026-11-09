# V6 public login — production Google OAuth restoration

**Date:** 2026-11-09  
**Scope:** tracked V6 public root only; no production deployment is part of this change.

## User requirement

Keep the existing production Google/Gmail login as the primary sign-in method. Do not replace it with email OTP, local passwords, demo credentials, or a separate identity system.

## Implementation

- Uses the existing Supabase Auth project, Google provider and current allowlisted GitHub Pages callback: `https://islamnagy2022-eng.github.io/MantiqatiX/`.
- Implements Supabase PKCE with S256. The one-time verifier is held in tab-scoped `sessionStorage` and expires after five minutes. Callback origin and path must match the originally requested redirect.
- Exchanges the authorization code through the existing Supabase Auth REST endpoint, then independently verifies the returned user through `/auth/v1/user`. Anonymous Auth users and identity mismatch are rejected and the acquired token is revoked where possible.
- After Auth verification, loads active memberships and authorized business choices from the existing `api /api/v1/me` and existing `catalog-admin BUSINESS_LIST` backend contracts. A user must explicitly select a returned membership. Google authentication by itself does not assign an application role.
- Current-tab session restoration persists only Supabase session tokens, expiry, user ID and email. It does not persist application roles, memberships, tenant scope, or permissions. Refresh revalidates user identity and memberships; revoked membership drops the application role.
- The visible public login modal now offers “المتابعة باستخدام Google” as the primary action. It states that the user authenticates on Google's official page and that the site never asks for the Gmail password. Email OTP code remains available only as an internal compatibility function, not as the primary visible sign-in flow.

## Reproducible source integration

The overlay bundle is pinned by SHA-256 in `scripts/apply-v6-google-oauth-overlay.py`. The existing V6 preview-source preparation script applies it to the known tracked V6 source package before tests and the build. The overlay applies three fail-closed source patches and installs the new helper, tests, modal and UI contract test. Unexpected bundle contents, checksum changes, or patch mismatches fail the workflow.

## Verification

Local exact-source replay:
- Google OAuth UI contract: PASS.
- Service tests: **47/47 PASS**, including the new PKCE, callback binding, expiry, identity verification, token revocation and tab-storage tests.
- TypeScript/TSX syntax transpilation: **5/5 changed files PASS**.

Remaining:
- Exact-head GitHub Actions install, lint, full build and release tests must pass before merge.
- A real user browser sign-in/callback and membership selection still require browser confirmation. The latest production Pages workflow separately verified the existing Supabase Google authorization handshake redirects to `accounts.google.com`; that handshake is not a full end-to-end user login test.
- No Auth dashboard settings, database/RLS/grants, Edge Functions or production data were modified.

## Release boundary

The deployed V6 root and `/legacy/` rollback remain unchanged until CI and release review. The canonical R6 archive `bizcatalog-manager (6).zip` remains the user's approved future source tree; the current runtime could not materialize its raw bytes. This patch restores Google login in the tracked V6 public application and does not claim a full R6 source import or full-platform production certification.
