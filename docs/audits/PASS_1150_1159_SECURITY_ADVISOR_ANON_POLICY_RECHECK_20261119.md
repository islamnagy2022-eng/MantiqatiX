# Pass 1150–1159 — Security Advisor and effective anonymous access review

**Date:** 2026-11-19  
**Project:** `moyhiluyhjsujhwlyeuu`  
**Advisor observation:** 2026-11-19 18:20:53Z  
**Method:** read-only Security Advisor, pg_policies, effective table privilege and RLS catalog queries.  
**Production changes:** none.

## Security Advisor snapshot

| Finding | Count | Interpretation |
|---|---:|---|
| RLS enabled, no policy | 9 | INFO; must be reconciled with effective grants and table intent |
| anon-executable SECURITY DEFINER | 1 | Public targeted-ad discovery RPC; reviewed below |
| authenticated-executable SECURITY DEFINER | 65 | Requires per-function authz review; not a blanket-revoke instruction |
| anonymous-access policy lint | 90 | Must be reconciled with role arrays and JWT anonymous guards; not 90 proven raw anon exposures |
| leaked-password protection disabled | 1 | Current Auth configuration warning; still open |

## Effective anonymous policy review

Direct catalog query found **19 policies** assigned to `anon` and/or `public` roles. This set includes:
- intended public SELECT surfaces for active/published directory, marketing, geo, digital-page, legal-document and brand content;
- explicit `USING(false)` / `WITH CHECK(false)` deny policies on sensitive tables;
- public profile-media read scoped to the `mantiqatix-profile-media` bucket.

Many other policies are assigned only to `authenticated`, including explicit JWT `is_anonymous` guards. The Advisor's 90 anonymous-access lint findings are therefore not evidence that 90 application tables are writable/readable by the raw `anon` database role.

Effective privilege review found no raw anon INSERT/UPDATE/DELETE grant on the inspected public application tables. Public application grants were limited to intentional SELECT surfaces. Storage system tables carry broad underlying grants, but RLS is enabled:
- `storage.objects`: public policy is SELECT only for `mantiqatix-profile-media`; write/delete policies are authenticated-only and owner/path scoped.
- `storage.buckets`, `storage.buckets_analytics`, `storage.s3_multipart_uploads`, `storage.s3_multipart_uploads_parts`: RLS enabled and no policies observed; do not infer row access from table grants alone.

## Intentional public SECURITY DEFINER ad RPC

`public.get_mnty_targeted_advertisements(...)` is SECURITY DEFINER and executable by anon/authenticated. Its live definition:
- pins `search_path = ''`;
- returns only ACTIVE and APPROVED advertisements;
- respects start/end windows;
- filters by ad-space and country/center/governorate/geographic targeting;
- caps `p_limit` to 1–50.

This matches the public ad-discovery use case. Retain pending a focused review of the returned creative/target fields and abuse/rate limiting; do not blindly revoke EXECUTE.

## Auth configuration blocker

The Security Advisor continues to report leaked-password protection disabled. This is an Auth dashboard configuration, not an application migration. No authorized Auth configuration-write action is available in this execution. Keep it NOT VERIFIED until an authorized project owner enables it, signup/password-reset flows are regression-tested, and a fresh Advisor check confirms closure.

Issue #422 updated with this current evidence (comment 7018060567).

## Required next steps

1. Enable leaked-password protection through the authorized Supabase Auth dashboard workflow and test signup/password reset.
2. Continue per-function review of the 65 authenticated SECURITY DEFINER functions: actor binding, tenant/business/branch scope, idempotency, search_path, ACLs and side effects.
3. Review public SELECT projections and Storage bucket visibility as intended disclosure contracts.
4. Preserve explicit false-deny RLS policies; do not replace them with broad grants.
5. Keep full platform **BLOCKED / NOT CERTIFIED** until all release gates pass.
