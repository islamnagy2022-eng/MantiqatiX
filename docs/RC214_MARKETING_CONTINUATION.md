# RC214 — MantiqaTix Web Continuation / Marketing Integration

Date: 2026-10-02

## Baseline
The production website remains:
https://islamnagy2022-eng.github.io/MantiqatiX/

The current Web source is:
https://github.com/islamnagy2022-eng/MantiqatiX/tree/main/web

This change does not replace the existing Web application. It adds a focused marketing workspace on top of the existing shell.

## Study result

### Already present in the published Web
- Public MantiqaTix homepage and discovery experience.
- Supabase-backed runtime.
- Customer/provider authentication and workspace.
- Provider onboarding through protected Edge Functions.
- Branch creation and catalog/pricing through protected backend paths.
- Customer/provider order flow and branch-aware ordering.
- Marketing domain tables and an existing operational marketing workspace.
- Separate SMM runtime for digital-service wholesale workflows.
- On-demand location adapter; no continuous location tracking.
- GitHub Pages CI/deployment path.

### Alignment with the approved MantiqaTix operating model
The marketing domain is treated as a service-provider sector while also supporting MantiqaTix's own marketing operation.

The model is:
1. MantiqaTix internal marketing operation.
2. External marketing companies/specialists as service providers.
3. Customer marketing leads as demand.
4. Marketing services as the catalog.
5. Projects as the execution/financial record.
6. SMM remains a distinct digital-service execution product and is not merged into ordinary agency projects.

### New RC214 Web layer
- web/marketing-platform-module.js
  - Adds a dedicated التسويق والإعلان workspace to the authenticated Web shell.
  - Presents the internal MantiqaTix marketing role separately from external marketing providers.
  - Reads provider/service/lead/project data through the existing Supabase client and existing RLS boundaries.
  - Does not expose secrets or provider credentials.
  - Does not create synthetic KPIs or production fixtures.
  - Keeps the funnel measurement contract explicit: Spend → Reach → Click → Lead → Qualified → Registration → Activation → Conversion → Revenue.
  - Labels account-scoped counts as account-scoped; it does not present them as platform-wide KPIs.

- web/index.html
  - Loads the new module after the existing provider onboarding module.

## Not changed
- RLS / FORCE RLS policy model.
- Payment/order authority.
- Provider onboarding Edge Functions.
- Financial ledger or settlement logic.
- SMM provider credentials or backend execution.
- Location collection semantics.
- Existing homepage and public discovery flow.

## Verification gates still required before merging to main
- GitHub Pages validation and published-site smoke.
- Browser authenticated test for customer and provider accounts.
- RLS/authorization negative tests for marketing provider, lead and project data.
- Confirm production table grants/policies for the selected marketing read paths.
- Verify no SMM credential data is reachable from the new workspace.
- Verify responsive/accessibility behavior.
- Merge only after the above evidence is available.

## Release status
RC214 is a continuation branch, not a Production Certified release.

Branch: web-continuation-rc214-marketing
Latest branch commit: dedbd1e729db173e401c39fc1638054dbed64851