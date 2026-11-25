# PASS 2461–2470 — RC480 / RC927 Public Digital-Page and Anonymous Auth Read Boundary

**Date:** 2026-11-25  
**Production:** `MANTIQATIX FINAL / moyhiluyhjsujhwlyeuu`  
**Method:** Direct read-only Supabase PostgreSQL catalog/ACL/policy inspection, current migration inventory, and current-main source/test inspection. No application rows or customer records were selected.  
**Production impact:** Read-only. No migration, DDL, GRANT, RLS, Auth, Storage, Edge, payment, settlement, or data mutation.

## 1. Direct Production catalog evidence

The live `public.digital_pages` table currently reports:

| Control | Current live value |
|---|---|
| RLS enabled | **Yes** |
| FORCE RLS | **No** |
| `anon SELECT` table privilege | **Granted** |
| `anon SELECT` on `created_by` | **Granted** |
| `authenticated SELECT` | **Granted** |
| `authenticated INSERT / UPDATE` | **Granted** |
| Permissive `digital_pages_public_read` | **Present** for roles `anon, authenticated`, predicate `status='PUBLISHED'` |
| Restrictive SELECT policy requiring `is_anonymous=false` | **Absent** |
| Live `20261118210000` RC480 ledger ID | **Absent** |
| Live `20261125120000` RC927 ledger ID | **Absent** |

The current live policy inventory also includes owner SELECT/INSERT/UPDATE policies and a platform-admin ALL policy. No restrictive SELECT policy was present to separate anonymous Auth identities from confirmed Auth identities.

This is a confirmed effective ACL + permissive-policy path to published base-table rows, including internal columns such as `created_by`; it is **not** evidence that a specific person used the path or that a row was downloaded. No row values were queried.

## 2. First-party public renderer and RC480 source

Current `web/digital-page.js`:

- Selects exactly `id,page_type,slug,title,subtitle,description,seo_title,seo_description,status,version`.
- Creates its Supabase client with `persistSession:false` and `autoRefreshToken:false`.
- Source search found no first-party `signInAnonymously()` call.

That narrows the first-party page-renderer behavior, but does not prove that there are no external integrations or existing anonymous Auth sessions.

RC480 source `20261118210000_rc480_digital_pages_anon_column_boundary.sql` intends to revoke raw anon table-level SELECT and grant only the ten public renderer columns. Its existing PostgreSQL integration test checks raw `anon` and ordinary `authenticated` owner read. However, the RC480 source migration is **not applied to Production**; current live `anon SELECT` and `anon created_by SELECT` remain granted.

## 3. RC927 source candidate and required order

RC927 candidate `20261125120000_rc927_digital_pages_anonymous_auth_read_guard.sql` adds a restrictive SELECT policy to role `authenticated`:

- requires `(auth.jwt()->>'is_anonymous')::boolean IS FALSE`;
- denies both `is_anonymous=true` and a missing/NULL claim;
- preserves confirmed-user reads through the existing permissive public-page/owner policies;
- leaves raw-anon public access governed by RC480's ten-column allowlist;
- preflight-fails unless RC480's table-level revoke and public-column allowlist are already installed.

**Order is mandatory:** RC480 first, then RC927. RC927 alone is not a fix while raw anon still has table-level SELECT, and it deliberately refuses to install before RC480's allowlist prerequisite is present.

## 4. Verification added; CI still pending at audit creation

The candidate branch `security/rc927-anonymous-digital-page-boundary-20261125` adds:

- PostgreSQL integration cases for Anonymous Auth, missing identity claim, confirmed Auth, and raw-anon public-page/internal-column compatibility.
- A static validator that checks the restrictive fail-closed policy, RC480 allowlist, first-party renderer contract, and exact 84-version release manifest.
- Module-professionalization RC480→RC927 PostgreSQL 16 test wiring.
- Full chronological release replay path wiring, with RC927 as required migration version 84.

At the time of this report, exact-head workflow execution has **not yet been established**. The source and tests must not be described as CI-passed until the relevant runs complete successfully.

## 5. Release disposition

1. Keep Production read-only.
2. Retain RC480 and RC927 in the same chronological, approved release bundle; do not cherry-pick RC927.
3. Pass RC480 then RC927 PostgreSQL regression, full 84-version strict gate and PostgreSQL 17 chronological replay.
4. After a future approved deployment, run deployed-origin tests for raw anon public page projection, Anonymous Auth denial, missing-claim denial, confirmed-owner compatibility, draft-page denial and cross-business isolation.
5. Keep RC927 unapplied until the coordinated database/Edge release, verified encrypted DB + Storage backups, independent restore/rollback, measured RPO/RTO and explicit owner approval are complete.

**Production mutations:** NONE.  
**RC480:** source exists / not applied; raw anon base-table and internal-column access remains live.  
**RC927:** source candidate / CI pending / not applied.  
**FULL_PLATFORM_GATE:** **BLOCKED / NOT CERTIFIED**.
