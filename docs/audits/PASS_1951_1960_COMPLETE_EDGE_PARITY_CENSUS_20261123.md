# Pass 1951–1960 — Complete 42-function Edge entrypoint parity census — 2026-11-23

## Coverage and result
- [x] 1951 — Compared all 42 currently deployed ACTIVE Supabase Edge Function entrypoint files with the corresponding current-main source files.
- [x] 1952 — 24/42 entrypoints are byte-identical to current main.
- [x] 1953 — 18/42 entrypoints differ from current main; this is a source/deployed parity census, not proof every differing function is exploitable or should be deployed immediately.
- [x] 1954 — Exact matches: `public-catalog`, `public-catalog-directory`, `payment-webhook`, `mantigo-payment-intent`, `api`, `order-status-update`, `post-financial-journal`, `settlement-create`, `subscription-start-trial`, `legal-center`, `erp-product-create`, `marketing-lead-create`, `digital-page-order-create`, `approval-list`, `facebook-page-import`, `business-approval`, `mnty-registration-review`, `business-onboarding-status`, `business-deactivate`, `mnty-provider-onboarding-submit`, `mnty-provider-onboarding-review`, `legal-consent`, `legal-gate`, `smm-gateway`.
- [x] 1955 — Material/source-only or intentional differences: `paymob-webhook`, `payment-intent`, `subscription-payment-intent`, `digital-page-payment-intent`, `settlement-financial-atomic`, `financial-journal`, `order-create`, `catalog-admin`, `mnty-push-dispatch`, `health`, `directory-listings`, `business-register`, `mnty-customer-registration`, `legal-cms`, `business-branch-admin`, `ai-gemini-proxy`, `catalog-platform-admin`, `erp-purchase-receive`.
- [x] 1956 — `smm-gateway` v13 is byte-identical to current main and remains `SMM_INITIAL_LAUNCH_DEFERRED=true`; no SMM action is enabled.
- [x] 1957 — `directory-listings` v18 intentionally differs by a one-file fail-closed implementation; keep it deployed until consent registry, source-rights and RC472/RC473 gates pass.
- [x] 1958 — `health` v3 is a public static health response; current main requires a monitor token and probes the database read-only. This is an observability/configuration gap, not a data exposure finding.
- [x] 1959 — Business branch scope: deployed v5 omits `branch_id IS NULL` from its business-manager authorization predicate; current main requires business-wide membership. Two active branch-scoped admin-role memberships exist across two businesses, so sibling-branch management is a concrete P1 test/fix requirement.
- [x] 1960 — No Edge function deployed, no RPC invoked, no user/tenant/branch rows selected, and no Production schema/data/Auth/Storage/payment changes occurred.

## Consolidated deployment blockers
- Paymob/payment/subscription/digital-page/financial/order Edge drift requires matching schema, RPC signatures, grants and payment idempotency tests.
- Platform-root Edge drift (`catalog-admin`, `catalog-platform-admin`, `business-register`, `business-branch-admin`, `ai-gemini-proxy`) must be coordinated with RC464/RC471/RC484/RC485 registry-backed database authority. Live helper remains weak.
- Legal CMS requires RC482/RC483 and its three missing atomic RPCs before deploying the main source.
- Customer registration requires the explicit RPC behavior decision and staging acceptance matrix.
- Branch-admin must prove branch-scoped users cannot manage sibling branches.
- Push-dispatch requires bounded JSON parsing and constant-time secret comparison before deployment.
- Keep directory fail-closed and SMM deferred.

**Disposition:** source/deployed census complete for all 42 active functions. Only 24 match current main. No deployment in this pass; full Production remains **BLOCKED / NOT CERTIFIED**.
