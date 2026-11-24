# P0 Anonymous Auth, Storage and Platform Authorization Live Recheck
**Date:** 2026-11-24  
**Production:** MANTIQATIX FINAL / moyhiluyhjsujhwlyeuu  
**Baseline repository main:** 80cd991f6d591c42f77f58531de995d4e1ef2f3f  
**Method:** read-only PostgreSQL catalog, RLS, policy and effective privilege queries; source inspection of RC464/471/479/484/485/488–495.  
**Disposition:** SOURCE RECONCILIATION COMPLETE / PRODUCTION SECURITY RELEASE BLOCKED. No Production object was changed.

## 1. Platform-root helper dependency map (P0.1)

| Item | Live Production observation | Source target | Result |
|---|---|---|---|
| public.is_platform_admin() | STABLE SECURITY INVOKER; search_path=public; returns true for any ACTIVE user_memberships ADMIN/SUPER_ADMIN; anon EXEC=false, authenticated EXEC=true. | RC484 registry-only SECURITY DEFINER, empty search_path, authenticated only. | Not deployed. |
| public.mnty_can_platform_admin() | STABLE SECURITY DEFINER; search_path=public, pg_temp; delegates to mnty_can('admin',NULL,NULL,NULL); anon EXEC=false, authenticated EXEC=true. | RC464/RC471 registry-only helper, empty search_path, authenticated only. | Not deployed. |
| private.platform_admins | Exists; owner postgres; RLS enabled; FORCE RLS disabled; anon/authenticated table privileges absent; service_role SELECT present. | RC464 FORCE RLS + trusted owner/helper parity; RC484 preserves registry boundary. | Preconditions align except FORCE RLS. |
| Policies using is_platform_admin() | 57 policies across 24 tables: 18 SELECT, 17 UPDATE, 15 DELETE, 7 ALL. This count includes storage.objects, not only public. | RC484 preflight requires at least 57 policies across 24 tables; fixture asserts exact command shape. | Exact blast-radius match. |
| Policies using mnty_can_platform_admin() | 5 RLS policies across digital_pages, mantigo_financial_config, mantigo_rate_limit_config. | RC464/RC471 registry-only guard. | Not deployed. |
| Shared SECURITY DEFINER helper callers | admin_create_global_ad, fulfill_digital_page_publish, review_mantigo_captain_application, set_mantigo_financial_config_backend remain helper callers; live paths are not consistently empty. | RC464/RC471 replace/retarget callers and empty their search_path. | Not deployed. |

The RC464/RC471/RC484/RC485/RC923 source chain and its disposable tests are the intended ordered correction. RC485 and RC923 must follow the registry-backed helper migration; RC495 must follow RC464/RC471 before it uses the platform-root helper. Do not apply any of these migrations individually to Production.

## 2. Anonymous Auth and public provider-profile read boundary (RC479)

Production query evidence:

- marketing_provider_profiles: RLS and FORCE RLS enabled.
- Effective table-level SELECT is still granted to both anon and authenticated.
- The current permissive policy Public can view active marketing providers applies to {anon,authenticated} and permits ACTIVE rows.
- The restrictive marketing_provider_profiles_confirmed_auth_select policy from RC479 is absent.
- The owner-management ALL policy contains a JWT non-anonymous predicate, but that does not replace the missing restrictive SELECT boundary.
- Public profile discovery can remain available through the approved read-only public catalog projections; unrestricted base-table SELECT is not equivalent to that allowlisted projection.

**Result:** RC479 is not deployed. Anonymous base-table SELECT remains exposed through the live grant + permissive policy combination. Keep the RC479 revoke and confirmed-user restrictive policy in the coordinated release; do not remove public catalog endpoints.

## 3. Storage write isolation and profile media scope (RC488/RC495)

Production buckets:

| Bucket | Public | Size limit | MIME allowlist |
|---|---:|---:|---|
| mantiqatix-media | false | 5 MiB | JPEG, PNG, WebP |
| mantiqatix-profile-media | true | 5 MiB | JPEG, PNG, WebP, SVG |

Current Storage state:

- storage.objects has no RC488 restrictive policies storage_objects_confirmed_auth_insert/update/delete.
- Existing mantiqatix-media policies rely in places on COALESCE(is_anonymous,false) <> true, which allows a missing claim, and on user/business path ownership.
- Existing mantiqatix-profile-media owner INSERT uses COALESCE(is_anonymous,false)=false, which also treats a missing claim as false; owner UPDATE/DELETE do not uniformly require an explicit false claim.
- The mantiqatix-profile-media public read policy is intentionally bucket-scoped. Do not convert this bucket to private or place legal evidence in it as part of this repair.
- Current platform branding INSERT/UPDATE/DELETE policies authorize an ACTIVE tenant SUPER_ADMIN membership and retain the older filename expression. They do not call the registry-backed platform-root helper. RC495 is absent.

**Result:** RC488/RC495 are not deployed. The correct source sequence is to add confirmed-Auth restrictive write guards globally to Storage, then apply the RC495 filename and root-registry policy repair only after RC464/RC471. Legal agreements and business registration documents require a separate private bucket and must never be put in the public profile-media bucket.

## 4. Financial/payment data read boundary (RC489)

The following 15 tables have RLS and FORCE RLS enabled in Production, but zero contain the RC489 restrictive policy mnty_confirmed_auth_financial_read:

commission_rules, commission_transactions, general_ledger, journal_entries, journal_entry_lines, payment_events, payment_financial_reconciliations, payment_intents, payment_provider_events, refund_transactions, settlement_attempts, settlement_transactions, subscription_payment_intents, wallet_accounts, wallet_transactions.

For 12 of the 15, effective SELECT is granted to authenticated and an existing permissive tenant/membership finance policy exists. Anonymous Auth sessions use the authenticated database role; without a restrictive confirmed-identity policy, a session with a qualifying active membership may satisfy those existing permissive predicates. The remaining three (payment_events, refund_transactions, settlement_attempts) do not currently have effective authenticated SELECT grants in the observed ACL snapshot.

**Important source verification:** the RC489 migration source correctly declares AS RESTRICTIVE, and its static validator explicitly asserts this. The problem observed here is deployment absence, not an error in RC489's policy type. Its integration test expects the guard to be RESTRICTIVE and verifies anonymous, missing-claim and confirmed-user behavior.

## 5. Medical appointment read boundary (RC490)

- medical_appointments has RLS and FORCE RLS enabled.
- The patient and provider SELECT policies exist.
- Effective SELECT is not currently granted to anon or authenticated in the live ACL snapshot, so direct client SELECT is currently closed at the table privilege boundary.
- mnty_confirmed_auth_medical_read is absent.
- The RC490 migration source correctly declares AS RESTRICTIVE; its integration test covers anonymous JWT, missing claim and confirmed provider behavior.

**Result:** RC490 is absent, but there is no effective direct authenticated SELECT grant in this snapshot. Preserve that closed grant boundary; do not grant SELECT as part of the migration repair.

## 6. Support and private CRM/notification boundaries (RC491/RC493)

| Table | RLS/FORCE RLS | Effective authenticated SELECT | Confirmed-auth restrictive guard |
|---|---|---:|---|
| support_tickets | true / true | true | RC491 absent |
| marketing_leads | true / true | true | RC493 absent |
| marketing_projects | true / true | true | RC493 absent |
| notifications | true / true | true | RC493 absent |

- Existing policies scope support rows to requester/assignee or tenant support roles; marketing leads to requester or manager; marketing projects to active business members; notifications to the addressed user.
- These are permissive row-level predicates and do not themselves exclude a Supabase Anonymous Auth identity that reaches the authenticated role.
- RC491's source policy is restrictive and only narrows SELECT; it does not remove the existing requester/staff scope.
- RC493's source installs restrictive SELECT guards on these three tables; its policies are absent live.

**Result:** RC491/RC493 are not deployed. Their restrictive guards should be included in the ordered DB release and verified with no-consent/anonymous, missing-claim and confirmed-user cases.

## 7. InDrive read/write boundaries (RC492)

- indrive_requests and indrive_bids both have RLS and FORCE RLS enabled.
- indrive_requests has an effective authenticated DELETE grant and owner-or-admin DELETE policy; authenticated INSERT/UPDATE grants are not present in the snapshot.
- indrive_bids has effective authenticated SELECT. Existing SELECT/UPDATE predicates use COALESCE(is_anonymous,'false') <> 'true': this blocks an explicit true claim but allows a missing claim.
- No RC492 restrictive policies exist: request INSERT/UPDATE/DELETE guards and the bid SELECT guard are all absent.
- The live request SELECT policy also uses the COALESCE pattern, so the explicit fail-closed policy is still needed wherever the role has the required table privilege.

**Result:** RC492 is not deployed. Preserve owner and provider relationship predicates; add only the restrictive explicit-false JWT boundaries in the coordinated release.

## 8. Settlement registry and Storage filename repair (RC494/RC495)

- create_settlement_and_post_journal(...) exists, SECURITY DEFINER, owned by postgres, search_path=pg_catalog, public; anon/authenticated EXECUTE are false and service_role EXECUTE is true.
- private.platform_admins FORCE RLS remains false and the live mnty_can_platform_admin() is still the old null-scope membership helper.
- RC494 preflight requires the hardened registry/helper ownership, FORCE RLS, settlement/journal schema, and business-scope dependencies. It is not safe to apply until the ordered RC449A/RC450 and RC464/RC471 release dependencies are reconciled and replayed.
- RC495 live target policies still use an ACTIVE tenant SUPER_ADMIN membership for platform branding and the old regex; current source requires the registry-backed helper and anchored safe filename expressions.
- RC495 must not be applied before the RC464/RC471 root-helper repair.

## 9. Correct source-to-production status

| Release slice | Source contract | Production evidence | Disposition |
|---|---|---|---|
| RC479 | Revoked raw anon base SELECT + restrictive confirmed-user SELECT | anon SELECT still granted; active anon/auth policy remains; guard absent | Not deployed; P0 |
| RC488 | Restrictive confirmed-Auth Storage INSERT/UPDATE/DELETE | all three guard policies absent | Not deployed; P0 |
| RC489 | 15 restrictive confirmed-Auth finance reads | 0/15 guard policies present | Not deployed; P0 |
| RC490 | Restrictive confirmed-Auth medical read | guard absent; authenticated SELECT grant absent | Not deployed; preserve no-grant |
| RC491 | Restrictive confirmed-Auth support read | guard absent | Not deployed; P0 |
| RC492 | Restrictive confirmed-Auth InDrive request/bid scope | all four guard policies absent | Not deployed; P0 |
| RC493 | Restrictive confirmed-Auth CRM/project/notification reads | 0/3 guard policies present | Not deployed; P0 |
| RC494 | Registry-authorized settlement backend + journal | live helper/FORCE-RLS dependencies remain old | Blocked on ordered schema/authorization slice |
| RC495 | Registry-backed platform branding + strict image paths | live policies still tenant-role based/old expression | Blocked until RC464/RC471 |

## 10. Test and release sequence

1. Keep Production read-only. Do not manually add policies, grant privileges, alter buckets or deploy Edge functions.
2. Run the exact-head PG17/static/forward-chain workflows for RC479, RC488–RC495. The current partner-branch full forward replay run 45407602805 and module validation run 45407602698 must complete against their exact tested head; a queued or in-progress run is not a pass.
3. Reconcile and apply only the complete ordered DB set with an encrypted recoverable backup, restore proof, rollback plan and operator approval.
4. Deploy matching Edge dependencies only as a coordinated release; verify deployed-origin anonymous Auth and confirmed-user negative/positive cases.
5. Verify the live table grants, restrictive policy commands, helper definitions, search_path, owners, FORCE RLS and Storage paths after release.
6. Keep directory publication fail-closed; RC472/RC473 lawful source-rights/contact-consent gates remain separate.
7. Full platform remains **BLOCKED / NOT CERTIFIED** until every mandatory security, data recovery, Edge parity and deployed-origin release gate is proven.

**Safety:** all Production queries in this review were read-only. No migrations, DDL/DML, grants, RLS, Auth, Storage, Edge, payment, settlement, directory publication or customer/business rows were mutated.


## 11. Disposable CI evidence (source only)

The following workflows completed successfully; they do not modify or certify Production:

| Run | Exact tested branch head | Result | Verified scope |
|---|---|---|---|
| 45407602805 | feat/business-partners-legal-compliance-20261124 @ e9fa4e0a354ca6428d6d7e95e7ea46306180921d | SUCCESS | Restored the captured Production schema checkpoint to an isolated local Supabase instance, validated the exact 80-version release contract, applied 117 later migrations in timestamp order, and passed the listed database integrations and tenant-isolation checks. |
| 45407602698 | feat/business-partners-legal-compliance-20261124 @ e9fa4e0a354ca6428d6d7e95e7ea46306180921d | SUCCESS | Dedicated jobs passed for RC479 provider-profile anonymous read, RC471 platform-root caller matrix, RC480 digital-page columns, RC482 registry root, RC481 legal Edge ACL, RC483 atomic Legal CMS audit, and companion module validations. |
| 45410089951 | audit/p0-anonymous-auth-storage-live-recheck-20261124 @ ecf8dd1242901a893a730dfd7aba8ae48df13815 | SUCCESS | RC493 static validator + isolated PostgreSQL fixture/migration/adversarial integration passed for marketing_leads, marketing_projects and notifications. It verifies anonymous JWT and missing is_anonymous claim are denied while confirmed owner reads remain available. |
| 45407602669 | feat/business-partners-legal-compliance-20261124 @ e9fa4e0a354ca6428d6d7e95e7ea46306180921d | SUCCESS | RC924 disposable PostgreSQL 17 agreement participant RLS regression test. |

Additional output markers from run 45407602805: RC485/RC923 anonymous-session denial for all seven catalog RPCs passed; RC486, RC487, RC488, RC489, RC490, RC491, RC492, RC494 and RC495 integrations passed; RC467/RC468/RC469 and two-tenant isolation checks passed. RC493's dedicated integration was run separately in 45410089951 because the full checkpoint replay applies the RC493 migration but does not invoke that standalone fixture/integration file.

**Interpretation:** the source migrations and their isolated behavior contracts have passed the listed suites. The read-only Production checks above still show these guards are not deployed, the live platform-root helpers remain weak, and no live database write was performed. A disposable migration replay is not a Production backup restore, approval, deployment or post-release readback.


## RC501 source-only follow-up — 2026-11-24
- Additional read-only Production function scan found seven SECURITY DEFINER callers of `public.is_platform_admin()` with `search_path=public`. All seven owners match the registry/helper owner at the observed checkpoint, and anon/authenticated/service_role direct EXECUTE is false. This is a search_path hardening gap, not proof of an exploitable caller or live compromise.
- RC501 adds a forward migration that requires RC484's registry-backed helper + FORCE RLS preconditions, then sets an empty path on the seven exact signatures. It snapshots and verifies body, owner, ACL, SECURITY DEFINER flag and identity metadata remain unchanged. Dedicated PG17 fixture/integration and static release-contract validator are included.
- Exact 81-version replay and exact-head CI are pending. Production remains read-only; RC501 is not applied.
