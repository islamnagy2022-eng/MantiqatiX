# Pass 1671–1680 — Live Production Security Recheck
**Date:** 2026-11-22  
**Repository main at inspection:** `deb906cf0b3817ffbee52ab697fb53e3323fb0c6`  
**Supabase project:** `moyhiluyhjsujhwlyeuu`  
**Disposition:** **PRODUCTION BLOCKED / NOT CERTIFIED**

## Source baseline
- PR #961 is merged; its recorded exact-head validation was 19/19 workflows, including 112-migration chronological replay and catalog browser E2E.
- PR #962 is merged; its recorded exact-head validation was 12/12 workflows. Current-business-owner checks are now in main for listing detail, consent changes and listing updates.
- The uploaded `bizcatalog-manager (11).zip` is the R7 archive dated 2026-11-10, not a replacement for current main. Its manifest contains a Supabase project-ref mismatch; retain it as a feature/mobile reference and preserve its Android files.

## Read-only Production evidence
- Project is `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.155`.
- Live migration ledger: **310** rows; latest version `20261110150618`.
- The live release verifier's exact **76-version** set was extracted from current main and checked against the live ledger: **0/76 present**.
- `public.directory_listing_contact_consents` does not exist. The public directory view has **869** published rows; all **869** have a phone and all **869** have an address.
- Live `directory-listings` Edge Function: ACTIVE v16, `verify_jwt=false`, SHA-256 `13f83fcf2faec148af34c08a006ab7bd8f9aa5946bc8af971ebf3e58a9120de0`. Its deployed source lacks the current-main consent-pagination and public-output sanitization modules; the deployed GET code selects and returns contact columns without the new consent contract.
- Current main contains the consent-aware/fail-closed Edge source and RC472/RC473 migration sources. Do not deploy the function alone because the production schema and platform authorization helpers are behind.
- Live `public.is_platform_admin()` remains SECURITY INVOKER with `search_path=public` and grants global status from any active tenant ADMIN/SUPER_ADMIN membership. A fresh `pg_policies` count found **57 policies across 24 tables** referencing it. `private.platform_admins` exists with RLS enabled, but FORCE RLS is false. RC484 source is present in main but unapplied.
- Live `public.mnty_can_platform_admin()` remains SECURITY DEFINER with `search_path=public, pg_temp` and delegates to `public.mnty_can('admin',NULL,NULL,NULL)`. RC464/RC471 source hardening is present in main but unapplied.
- Live `auth.users` still has trigger `trg_smm_bootstrap_admin`; its SECURITY DEFINER function `public.smm_bootstrap_first_admin()` remains present. RC487 removes this first-user bootstrap in source but is unapplied.
- Security Advisor snapshot: 90 anonymous-access policy findings, 65 authenticated-callable SECURITY DEFINER findings, 1 anon-callable SECURITY DEFINER finding, 9 RLS-enabled/no-policy informational findings, and leaked-password protection disabled.

## What passed / what did not
- Source migration replay and isolated PostgreSQL/browser checks are documented as passing on the merged source candidate. They are not a real Production backup restore and do not prove live DB/Edge parity.
- This recheck was read-only. No Production SQL/DDL/DML, migration application, Auth/RLS/GRANT setting change, Storage change, Edge deployment, payment, wallet, settlement or customer-data mutation was performed.

## Next release gates
1. Obtain encrypted off-site database **and Storage** backups; prove retrieval and Vault/key recovery.
2. Restore to a separate PostgreSQL 17 environment; verify rollback and record measured RPO/RTO.
3. Reconcile the complete 76-migration ordered chain against the live physical schema and exact objects/ACLs.
4. Apply the coordinated database release and deploy the full consent-aware directory Edge bundle as one controlled release.
5. Run deployed positive/negative tests for public contact consent, owner scope, platform-root registry, anonymous sessions, SMM bootstrap removal, payments and finance.
6. Enable leaked-password protection and re-run Security Advisor with reviewed policy semantics.

**Do not certify or deploy Production until these gates pass.**
