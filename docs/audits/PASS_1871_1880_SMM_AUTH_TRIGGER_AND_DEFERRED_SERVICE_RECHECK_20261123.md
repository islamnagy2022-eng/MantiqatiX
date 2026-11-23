# Pass 1871–1880 — SMM Auth trigger and deferred-service parity — 2026-11-23

## Live Production evidence
- [x] 1871 — Inspected non-internal triggers on `auth.users`. Active trigger `trg_smm_bootstrap_admin` remains enabled and calls `public.smm_bootstrap_first_admin()`, a SECURITY DEFINER function with `search_path=public`.
- [x] 1872 — Function body grants the first Auth user SMM admin status when `public.smm_admins` is empty. This is a latent first-user-wins privilege bootstrap; it is not proof of current unauthorized admin assignment.
- [x] 1873 — Aggregate-only live counts: 8 Auth users, 1 SMM admin allowlist row, 1 platform-admin registry row. No user identifiers were selected.
- [x] 1874 — `public.smm_admins` has RLS enabled; direct anon/authenticated SELECT is false. Service-role SELECT/INSERT/UPDATE/DELETE are also currently false.
- [x] 1875 — Retrieved live `smm-gateway` v13 (ACTIVE, verify_jwt=true). It contains `SMM_INITIAL_LAUNCH_DEFERRED=true` and hard-denies all actions with 503 before user lookup, so SMM remains deliberately disabled for initial launch.
- [x] 1876 — Current-main RC487 migration `20261120220000_rc487_remove_smm_first_user_admin_bootstrap.sql` removes the trigger and function, preserves existing allowlist rows, revokes all SMM admin table privileges from API roles, and grants service_role SELECT only.
- [x] 1877 — RC487 integration test asserts trigger/function removal, no client table access, service_role SELECT, and no service_role mutation.
- [x] 1878 — Current-main source has explicit SMM admin allowlist / platform SUPER_ADMIN full-control checks. Current live service remains launch-deferred, so no SMM order/credit/provider operation was invoked.
- [x] 1879 — The RC487 migration is not yet in the live migration ledger; do not enable SMM or remove its launch gate until the coordinated migration chain is reconciled and the migration is applied under release controls.
- [x] 1880 — No Auth user, SMM allowlist row, trigger, function, table grant, Edge Function, provider credential, order, wallet or payment was changed.

## Remaining actions
- [ ] Apply RC487 only through the full reconciled migration release chain; verify trigger/function absence and allowlist ACL.
- [ ] Keep SMM disabled until RC456 service-role table ACLs, RC487 first-user bootstrap removal, secret RPCs, provider-host allowlist, financial idempotency, pricing review and adversarial tests are live and verified.
- [ ] Verify SMM gateway reads after RC456/RC487 and only then consider an explicit post-launch enablement approval.

**Release status:** SMM intentionally deferred. Full Production remains **BLOCKED / NOT CERTIFIED**.
