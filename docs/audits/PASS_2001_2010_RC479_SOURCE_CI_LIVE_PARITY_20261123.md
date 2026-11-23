# Pass 2001–2010 — RC479 forward anonymous-Auth guard source/CI/live parity — 2026-11-23

## Source and CI evidence
- [x] 2001 — Confirmed RC479 has two separate source migrations: raw anon SELECT revoke (`20261118190000`) and anonymous Auth-session restrictive SELECT guard (`20261120193000`).
- [x] 2002 — Confirmed PR #938 merged the forward anonymous Auth-session guard to main at `436b7a5a4aa12aa979f5ea4b52b9ce9d3971a046`.
- [x] 2003 — Exact PR-head workflow evidence recorded in `docs/audits/PASS_1490_1499_RC479_ANONYMOUS_AUTH_FORWARD_GUARD_20261120.md`: RC479 dedicated test run 44803731818 PASS; RC464 combined run 44803731787 PASS; forward migration replay 44803731771 PASS; migration uniqueness, collision guard and immutability checks PASS.
- [x] 2004 — Disposable integration covers anonymous Auth SELECT denial, confirmed-user compatibility, owner UPDATE success and wrong-owner UPDATE denial.
- [x] 2005 — Source test explicitly confirms the owner ALL policy remains intact and the new SELECT policy is RESTRICTIVE for `authenticated` with `is_anonymous=false`.
- [x] 2006 — The exact-head CI results are source/fixture evidence only; Pages deploy jobs were skipped and no Production deployment is implied.

## Live parity recheck
- [x] 2007 — Live table still has raw anon SELECT and lacks `marketing_provider_profiles_confirmed_auth_select`; both RC479 migrations remain unapplied in Production.
- [x] 2008 — Live public-active SELECT still targets `anon,authenticated`; live CRM manager SELECT remains unscoped.
- [x] 2009 — Confirmed-user residual exposure is explicitly acknowledged by the merged source audit: confirmed users retain base-table SELECT, including `owner_user_id` and `settings`. RC479 does not solve this; a separate compatibility-reviewed projection change is required.
- [x] 2010 — No live SQL, migration, grant, policy, Auth, Storage, Edge, profile or customer-data mutation occurred.

## Decision
RC479 source and exact-head disposable tests are complete and merged, but Production remains unchanged. Do not apply RC479 alone or claim provider-profile privacy is closed. The next source change must remove broad confirmed-user base-table exposure without breaking owner/provider workflows, then be tested in PostgreSQL 17 and included in the reconciled release chain.

**Production remains BLOCKED / NOT CERTIFIED.**
