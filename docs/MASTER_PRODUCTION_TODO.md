

## 2026-10-21 — live production security drift confirmed (read-only)
- [x] Re-read live Supabase migration ledger: 283 entries; latest applied version is still RC424 `20261008222845`. RC449/RC451 and the required post-RC424 release batch are not recorded as applied.
- [x] Read-only function-definition checks confirmed four global MantiGO RPCs are still SECURITY DEFINER with `search_path=public` and lack `mnty_can_platform_admin()` checks in live definitions, while source RC449 requires an explicit platform-super-admin scope guard. This is a confirmed source/live parity blocker.
- [x] Read-only check confirmed live `get_mnty_targeted_advertisements` remains `search_path=public, pg_temp`; source RC451 changes this to an empty search path. Preserve intended anonymous ad discovery unless reviewed access changes justify otherwise.
- [x] Supabase security advisor findings captured: one RLS-enabled table without policies (`digital_page_payment_events`), one anon-executable SECURITY DEFINER, 40 authenticated-executable SECURITY DEFINER. No bulk revocations.
- [x] Reconfirmed deployed `business-branch-admin` is ACTIVE v5 and is behind hardened repository source.
- [ ] Reconcile/rehearse the complete ordered post-RC424 migration chain on disposable PostgreSQL, test tenant isolation/payment-finance E2E, rehearse backup/restore, verify Auth settings and Edge Function parity, then seek explicit rollout approval.
- No production migrations, grants, RLS/Auth settings, function deployments, or financial operations were changed. Release remains **BLOCKED / NOT CERTIFIED**.
