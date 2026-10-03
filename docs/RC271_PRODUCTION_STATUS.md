# MNTY Production Status — RC271
Date: 2026-10-03
Repository: islamnagy2022-eng/MantiqatiX
Branch: main
Commit audited: aef43cefa95ff977f9570f112a9a1ecb1d5f2953
Supabase: moyhiluyhjsujhwlyeuu
Final Production Gate: OPEN

## Evidence snapshot
- Latest main commit: aef43cefa95ff977f9570f112a9a1ecb1d5f2953 (RC270 update project continuity).
- GitHub Actions run 37113121948 for that exact commit: completed/success.
- Supabase project: ACTIVE_HEALTHY, PostgreSQL 17.6.1.155.
- Live public tables: 123.
- Live public tables with RLS: 123/123.
- Live public policies: 472.
- Live public SECURITY DEFINER functions: 94.
- Auth users: 6.
- ACTIVE memberships: 23.
- Orders: 0.
- Payment intents: 0.
- Payment provider events: 0.
- Notifications: 0.
- ACTIVE Edge Functions: 35.

## Production Status Matrix

| Gate | Status | Evidence | Required to close | Can execute now? |
|---|---|---|---|---|
| Multi-user / Multi-tenant E2E | NOT VERIFIED | 6 auth users / 23 active memberships exist, but no controlled two-user/two-tenant adversarial fixture has been executed | Independent identities/tenants; own-access and cross-tenant denial tests | WAITING FOR controlled test identities/fixture |
| Customer → Provider → Order → Status → Notification | NOT VERIFIED | Orders=0 and notifications=0; static/server boundaries exist | Real authorized provider/business/catalog/price chain and runtime E2E | WAITING FOR authorized active test data + browser |
| Paymob Production E2E | WAITING FOR USER/CREDENTIAL | Payment tables are empty; production credentials/real transaction permission not available to this execution | Approved merchant credentials and authorized real transaction | No — financial action requires approval |
| Finance / Settlement / Refund | NOT VERIFIED | Financial backend exists; no real payment/settlement/refund evidence | Real payment lifecycle + reconciliation + refund contract/test | No — real money action requires approval |
| Push / Device E2E | NOT VERIFIED | Push Edge Function is ACTIVE; notifications=0 | Device subscription, dispatch, actual device delivery evidence | WAITING FOR PHYSICAL DEVICE |
| Leaked Password Protection | BLOCKED | Project baseline and current pricing show feature is unavailable on Free; managed Auth setting is not writable through SQL here | Enable through eligible Supabase Auth configuration/plan, then rerun Advisor | No dashboard/plan action available here |
| Backup / Restore | NOT VERIFIED | No destructive production restore rehearsal performed | Controlled backup → restore → integrity → application verification | WAITING FOR controlled environment/approval |
| Rollback Rehearsal | NOT VERIFIED | Release workflow exists; no controlled rollback rehearsal evidence | Rehearsal with reversible release/migration path | WAITING FOR controlled staging/rehearsal |
| Android Build | NOT VERIFIED | Android source exists in supplied RC40 archive but is absent from current main release tree | Current-source Android build | WAITING FOR Android source integration/build environment |
| Android Signing | NOT VERIFIED | No verified release keystore/signature artifact | Protected signing configuration and signed artifact | WAITING FOR signing credentials |
| Real Device Verification | NOT VERIFIED | No device evidence | Install/login/core workflow/push/error handling | WAITING FOR PHYSICAL DEVICE |
| External Browser Smoke | PARTIALLY VERIFIED | Latest Pages CI performs deployed-site verification; interactive authenticated browser E2E is not established here | Interactive browser auth/core-flow smoke | WAITING FOR interactive browser execution |
| Security Advisor | OPEN | Security review still contains managed leaked-password finding and intentional/conditional SECURITY DEFINER/RLS findings | Resolve managed setting and complete contextual per-function/runtime review | Partially; no blanket revocation |
| Performance Advisor | PARTIALLY VERIFIED | Advisor currently reports unused indexes and multiple permissive policies; these are optimization findings, not proof of functional failure | Workload-backed EXPLAIN evidence before index/policy consolidation | Yes, but not P0 without measured workload |
| RLS / RBAC | PARTIALLY VERIFIED | 123/123 public tables have RLS; live exposed SECURITY DEFINER inventory reviewed | Adversarial runtime authorization E2E | WAITING FOR independent identities |
| Edge Function Security | PARTIALLY VERIFIED | 35 ACTIVE functions; sensitive workflow functions use JWT verification; payment/webhook boundaries exist | Runtime adversarial tests and per-function authorization evidence | Partially |
| Tenant Isolation | NOT VERIFIED | Static tenant predicates/RLS exist; no independent two-tenant runtime test | Cross-tenant denial E2E | WAITING FOR test fixture |
| Monitoring / Alerts | NOT VERIFIED | Log streams exist; formal alert/incident delivery evidence is incomplete | Alert threshold + routing + incident drill | Partially |
| Release Artifact | PARTIALLY VERIFIED | Web CI artifact/deployment succeeds for current commit | Signed Android artifact + final evidence bundle | WAITING FOR Android/signing/external gates |

## SECURITY DEFINER review
The currently executable authenticated SECURITY DEFINER surface was inspected rather than blanket-revoked:
- admin_create_global_ad: checks platform-admin permission.
- create_job_backend: binds p_user_id to auth.uid() and requires active business membership.
- create_medical_appointment_backend: binds user identity, provider/business, tenant membership and slot uniqueness.
- create_payment_intent_backend: rejects anonymous sessions, checks tenant/order ownership, server pricing snapshot, amount/currency and idempotency.
- get_mnty_targeted_advertisements: public discovery RPC; bounded limit and sanitized operational advertisement output.
- mnty_active_membership / mnty_can / mnty_can_platform_admin: identity/membership/RBAC helpers.
- update_medical_appointment_status_backend: binds user identity and tenant membership and restricts provider status transitions.

No privilege was changed in RC271 because static review cannot substitute for adversarial multi-account runtime evidence.

## Cost / Subscription Matrix

| Requirement | Current capability | Paid service required? | Exact service/tier | One-time | Recurring | Can postpone? |
|---|---|---|---|---:|---:|---|
| Current Supabase project | Active Free-plan baseline documented | No for current baseline | Supabase Free | $0 | $0 | No, but production resilience features are limited |
| Supabase production backups | Free plan lacks automatic backups | Yes if using managed daily backups | Supabase Pro | $0 | From $25/month | Not for final recovery certification |
| Supabase PITR | Not available on Free | Yes | Supabase paid plan + PITR add-on | Variable | Variable | Yes only if controlled backup/restore alternative is accepted |
| Paymob production | Code boundary exists | Merchant account/contract required | Paymob production account | Provider-specific | Transaction/provider-specific | No for Paymob gate |
| Android Play publishing | Build/signing not verified | Account required | Google Play Console | $25 registration | No recurring developer-account fee stated here | Yes if web-only launch is explicitly accepted |
| Physical Android device | No device evidence | Device purchase/access required | Any supported Android test device | Variable | Variable | No for Android device gate |
| Browser E2E | CI deployed-site smoke exists | No inherently | Interactive browser/test environment | $0 if available | $0 if available | No for final external verification |
| Push delivery | Backend dispatcher exists | Provider/device capability may be required depending on channel | Web/Android push infrastructure | Variable | Variable | No for device-delivery gate |

## Decision
RC271 does not close a release gate. No production data, money, credentials, or destructive recovery action was executed.

Next safe blocker:
1. User/dashboard action: address leaked-password protection/eligible Supabase security configuration.
2. Controlled test fixture: provide/approve disposable independent identities for two tenants.
3. Then execute adversarial authorization E2E before any further privilege changes.

