# Pass 1901–1910 — Registration and business-creation Edge parity — 2026-11-23

## Live/source comparison
- [x] 1901 — Compared 10 deployed registration/onboarding/legal Edge entrypoints with current main.
- [x] 1902 — Exact matches: `business-approval` v6, `mnty-registration-review` v5, `business-onboarding-status` v3, `business-deactivate` v3, `mnty-provider-onboarding-submit` v6, `mnty-provider-onboarding-review` v3, `legal-consent` v3, `legal-gate` v4.
- [x] 1903 — `mnty-customer-registration` v4 differs from current main. Live calls `private.ensure_customer_membership_for_user`; main calls `private.activate_customer_registration_atomic`.
- [x] 1904 — Read-only catalog confirms both customer activation RPCs exist, SECURITY DEFINER, empty search_path, service_role EXECUTE true and anon/authenticated EXECUTE false. They have materially different semantics; do not deploy the current-main Edge source just to match hashes.
- [x] 1905 — Existing source validator and audit require an explicit behavior decision and isolated staging acceptance matrix covering pending-request cleanup, lock key, membership insert scope, and audit-failure behavior before customer-registration convergence.
- [x] 1906 — `business-register` v9 differs from current main. Live source derives platform-superadmin from membership metadata; main calls `mnty_can_platform_admin()` and removes membership metadata as root authority.
- [x] 1907 — Aggregate-only query for the deployed business-register/catalog-admin legacy platform predicate found one active matching membership, and it is present in the private platform registry; no non-registry matching user was found. No identifiers selected.
- [x] 1908 — Live `mnty_can_platform_admin()` is still weak/null-scope; deploying the new business-register Edge source alone is not safe until RC464/RC471 registry helper migrations are live.
- [x] 1909 — Provider onboarding submit/review and legal consent/gate entrypoints are byte-identical to main in this comparison; this is entrypoint parity only, not a full runtime/secret/dependency audit.
- [x] 1910 — No registration request was submitted, no membership/approval record was read or written, and no Edge function or database object was changed.

## Remaining release work
- [ ] Resolve customer activation behavior differences and pass the disposable PostgreSQL acceptance matrix before changing the registration Edge function.
- [ ] Apply/reconcile registry-backed platform authority before deploying business-register source.
- [ ] Re-run exact source/deployed comparison after the coordinated Edge/database release.

**Disposition:** no deployment in this pass. Full Production remains **BLOCKED / NOT CERTIFIED**.
