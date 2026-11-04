# Production recheck — 2026-11-04

## Release result

**Catalog pilot: DEPLOYED / VERIFIED.**  
**Full MantiqatiX platform: BLOCKED / NOT CERTIFIED.**

- Main commit: `fe9e9f57b780b01c49940349dccf3bbac67efaae`
- Pages workflow: [41916804007](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41916804007) — success
- Primary frontend validation: [41916803905](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41916803905) — build, PostgreSQL employee RBAC, and Playwright succeeded
- Deployed-origin browser tests: success
- Production health monitor: [41916803979](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41916803979) — success
- Public site: https://islamnagy2022-eng.github.io/MantiqatiX/

The deployed Playwright run covered the public directory/home, 20-item progressive pagination, medical directory filters, guest route denial, owner and employee membership scopes, branch-owner and unsupported-manager denial, responsive owner dashboards, QR permanent links, GPS consent and denial behavior, verified storefronts, real product catalogs, activity-specialty routes, and guest account-portal denial. Accessibility checks reported no critical or serious WCAG 2.1 violations.

## Catalog runtime changes

PR #663 was merged as part of the release. It corrected the public product mapper to accept both legacy snake_case and normalized camelCase API contracts; restricted prices to the selected branch or the business-wide default; preserved owner/AI images; and kept quote-only service prices and option deltas out of public responses.

Live Supabase read-only functions after deployment:

| Function | Live version | JWT verification | Source parity |
|---|---:|---|---|
| `public-catalog-directory` | 17 | false (public GET contract) | Exact match to main |
| `public-catalog` | 7 | false (public GET contract) | Exact match to main |
| `catalog-admin` | 20 | false (route-level bearer/session/role checks) | Exact match to main |
| `catalog-platform-admin` | 23 | true | Drift found |

The two public read-only functions were deployed from current main source. The directory function also received the shared activity-module sanitizer file. Quote-only item prices and option deltas are filtered by the Edge Function before serialization.

The live `catalog-platform-admin` v23 does not contain the current main activity-module override write handling and audit-result contract. Its live source must not be overwritten blindly. Activity-module admin writes remain disabled in the UI until the operation and its audit record are committed atomically in one backend transaction.

## Current Production database evidence

A fresh read-only Supabase migration inventory on 2026-11-04 returned **309 migration records**, latest:

`20261101140105 directory_source_permission_evidence`

The release verifier still finds **0 of 42** exact source-version identifiers in the live ledger. Exact identifier absence does not prove all effects are absent: the release record includes exact source aliases and effects deployed through forward bundles. Two duplicate aliases remain pending controlled migration-history reconciliation:

- RC424 source `20261009010000` is an exact SQL-statement alias of live ledger version `20261008222845`.
- Marketing-contact source `20261027100000` is an exact source-blob alias of live ledger version `20261027041411`.

Do not run either alias as a new migration or fabricate migration-history rows.

## Isolated migration replay

[GitHub Actions run 41914489055](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41914489055) succeeded on 2026-11-04:

- Restored checkpoint `20261008222845` in a disposable isolated Supabase instance.
- Applied 76 later source migrations in timestamp order.
- Passed the RC117 default-image/activity-admin contract.
- Passed owner-profile persistence checks, including metadata/publication preservation and branch-manager denial.
- Passed RC455/RC456 commission preview integration tests.
- Passed synthetic Tenant A/B read and mutation isolation for orders and payment intents.

**Production effect: NONE.** This replay does not prove the current live production schema is restorable and does not authorize applying the missing migrations.

## Targeted security recheck

Supabase Security Advisor returned 94 findings on 2026-11-04: 90 anonymous-policy findings, 9 RLS-enabled/no-policy findings, one anon-executable SECURITY DEFINER warning, one authenticated-executable SECURITY DEFINER warning, and one leaked-password-protection warning. Advisor findings are not vulnerability counts.

The nine no-policy relations have no direct `anon` or `authenticated` SELECT privilege in the inspected grant inventory. The two SECURITY DEFINER warnings correspond to trigger-only functions:

- `assign_default_owner_to_unowned_business()` — attached trigger enabled; live `search_path=public, auth`; direct EXECUTE is too broad.
- `capture_commission_rule_audit()` — attached trigger enabled; empty search_path; direct EXECUTE is too broad.

RC463 exists in source but is not recorded in the live migration ledger and remains unapplied.

A read-only synthetic anonymous JWT probe returned zero visible rows for wallet accounts, wallet transactions, general ledger, payment intents, provider payment events, orders, business subscriptions, and user memberships. `payment_events` rejected SELECT at the table privilege layer. All probe transactions were rolled back. These targeted checks do not replace adversarial RLS tests or managed Auth configuration evidence.

## Full-platform blockers still open

1. The 42 required release source-version identifiers and associated physical object contracts are not fully reconciled. The current selected physical-object report remains 32/60 non-PASS.
2. Six critical payment/order/finance Edge Functions remain source-drifted: `order-create`, `payment-intent`, `paymob-webhook`, `digital-page-payment-intent`, `subscription-payment-intent`, and `financial-journal`. They must not be deployed one by one.
3. RC449A/RC450 financial-journal schema columns, RPC contract and service-role EXECUTE boundary are not present in production. A fresh November 4 read-only PostgreSQL query confirmed all five journal columns absent and no service_role EXECUTE on either journal RPC; it also confirmed that the old four-argument digital-page claim function and postgres-only purchase-order status function remain contract-incompatible.
4. RC435/RC439 subscription checkout contracts remain unresolved.
5. Payment/finance E2E with signed Paymob sandbox callbacks, reconciliation, refunds, settlements and journal posting is NOT VERIFIED.
6. Backup retention, a real restore rehearsal, measured RPO/RTO, rollback drill, and storage/media recovery remain NOT VERIFIED.
7. Managed Auth hardening, including leaked-password protection, needs owner-dashboard evidence.
8. SMM gateway negative runtime evidence remains open; keep the gateway deferred.

No production migration, data mutation, Auth/RLS/GRANT change, payment, wallet, or journal write was performed in this recheck.

## Gate

`CATALOG_PILOT_GATE=PASS`  
`FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`

The catalog is live. The full enterprise platform is not yet certified for financial/ERP/SMM/MantiGO production operations.
