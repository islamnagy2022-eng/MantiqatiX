# Pass 1833–1842 — Live Production and current-main recheck — 2026-11-23

## Scope and source
- Canonical repository: `islamnagy2022-eng/MantiqatiX`, branch `main`.
- Current main head observed: `3c24d840f279e0e2f5c0b66302a2ee12ddedab9c`.
- Marketing route implementation commit: `58e42a5349c070e9ab99281487015824f60ef9a2`.
- Browser E2E commit: `3c24d840f279e0e2f5c0b66302a2ee12ddedab9c`.
- The uploaded `bizcatalog-manager (11).zip` remains an R7 historical/reference archive; it was not copied over current main.

## Completed read-only checks
- [x] 1833 — Confirmed the current mainline marketing action resolves the official activity using canonical business code `MNTY-MARKETING`, navigates with the persisted business UUID, and fails closed when the official activity is unavailable.
- [x] 1834 — Confirmed the browser E2E source asserts the exact persisted UUID, official MantiqatiX storefront heading and catalog rendering.
- [x] 1835 — Queried the live Supabase project `MANTIQATIX FINAL`: PostgreSQL 17.6.1.155; 310 migration rows; latest version `20261110150618`.
- [x] 1836 — Confirmed 42 active Edge Functions. Current relevant deployed versions: `directory-listings` v18, `catalog-admin` v20, `public-catalog-directory` v19, `public-catalog` v9.
- [x] 1837 — Retrieved the live `directory-listings` v18 source and SHA-256 `bb65d74325f8bdf08f060f7ae2517bb30901630635d1de4f35523d7cef6afe48`. It is deliberately fail-closed: GET returns an empty result with `directoryDisabled=true`; POST returns 503 `DIRECTORY_LISTINGS_DISABLED_FOR_V1`. Preserve this state.
- [x] 1838 — Fresh Security Advisor snapshot at 2026-11-23 11:57:41 UTC: 9 RLS-enabled/no-policy INFO findings, 65 authenticated-callable SECURITY DEFINER WARN findings, 1 anon-callable SECURITY DEFINER WARN finding.
- [x] 1839 — Fresh Performance Advisor snapshot: 28 multiple-permissive-policy WARN findings. These advisor counts are triage inputs, not proof that every finding is exploitable; no blanket policy/grant changes are authorized.
- [x] 1840 — Read-only PostgreSQL inspection confirms `private.platform_admins` has RLS enabled but FORCE RLS false; `public.is_platform_admin()` remains SECURITY INVOKER and trusts ACTIVE tenant ADMIN/SUPER_ADMIN membership; `public.mnty_can_platform_admin()` remains SECURITY DEFINER and delegates to `mnty_can('admin', NULL, NULL, NULL)`. 57 policy expressions across 24 tables reference the legacy helper.
- [x] 1841 — Read-only ACL/policy inspection confirms `public.marketing_provider_profiles` has RLS and FORCE RLS enabled but still grants anon SELECT and has a public-active SELECT policy. No provider profile values were selected. Effective anon INSERT is false.
- [x] 1842 — Confirmed `public.directory_listing_contact_consents` and `public.migration_release_registry` are absent from the live database catalog.

## Remaining work — not certified
- [ ] Obtain operator-controlled encrypted off-site database and Storage backups; verify Vault/key recovery.
- [ ] Perform an independent PostgreSQL 17 restore and rollback rehearsal; record measured RPO/RTO and reviewer evidence.
- [ ] Reconcile and replay the exact chronological migration release chain in an isolated environment before any Production release.
- [ ] Coordinate registry-backed platform-admin repairs (RC464/RC484 family) with all 57 policy consumers and dependent RPCs; verify positive and negative tenant/branch cases.
- [ ] Release the RC479 public-provider anonymous-session SELECT guard only through the approved migration chain; verify anon, anonymous Auth JWT, confirmed user and owner CRUD cases.
- [ ] Release RC472/RC473 consent schema, owner audit writer, public readers and authorization dependencies as one coordinated bundle.
- [ ] Keep national directory publication disabled until source permissions, owner consent, exact Edge bundle parity and deployed-origin negative/positive tests pass.
- [ ] Complete exact-head CI and deployed-origin browser verification for the current-main marketing route change. GitHub commit-status and PR-triggered workflow lookups returned no evidence in this inspection; do not mark CI or deployment PASS.
- [ ] Reconcile critical Edge Function source/deployed bundle parity and verify monthly subscription checkout only after signed Paymob sandbox callbacks and matching backend contracts pass.

## Safety and release decision
- This pass was read-only against Production. No Production DDL/DML, migration, Auth, RLS, GRANT/REVOKE, Storage, Edge deployment, payment, wallet, settlement, customer-data write or public directory publication occurred.
- `directory-listings` v18 remains fail-closed.
- **Website V1 deployment is not equivalent to full-platform certification. Full Production remains BLOCKED / NOT CERTIFIED.**


## Follow-on pass
See `docs/audits/PASS_1843_1852_R7_SOURCE_AND_CURRENT_AUTH_RECONCILIATION_20261123.md` for the next source/archive reconciliation and current-main auth review. No Production mutation or deployment occurred; full Production remains BLOCKED / NOT CERTIFIED.
