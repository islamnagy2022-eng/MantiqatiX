# Edge ↔ RPC ↔ Production migration dependency matrix

**Source checkpoint:** main @ c802c01c639c9d64919c2cb90c64815843cac089  
**Production project:** MANTIQATIX FINAL / moyhiluyhjsujhwlyeuu  
**State:** **READ-ONLY / BLOCKED / NOT CERTIFIED**

See [PASS 2381–2390](../audits/PASS_2381_2390_EDGE_RPC_PRODUCTION_DEPENDENCY_RECHECK_20261124.md) for the exact function/ACL/signature/column evidence.

## Deployment slice gates

| Slice | Current-main Edge | Required live DB contract | Current blocker |
|---|---|---|---|
| Standard Paymob | payment-intent, paymob-webhook | RC426–RC430, RC475; exact-cent/provider-order preflight and atomic failure/reconciliation RPCs | Current webhook has no stored provider-order comparison; failure RPC absent; RC426–430/475 unrecorded. |
| Digital-page Paymob | digital-page-payment-intent, paymob-webhook | RC426/RC431/RC468/RC470, five-argument finalizer, stored provider-order guard | Four-argument finalizer only; old processor writes provider order ID without asserting equality; required versions absent. |
| Subscription billing | subscription-payment-intent, paymob-webhook | RC429/RC430/RC435/RC439/RC475; claimable creation, atomic provider claim, encrypted secret columns and atomic success/failure processors | Both new claim RPCs and five columns absent; new webhook RPCs absent. |
| Financial journal | financial-journal | RC449A → RC450; journal columns and service-role-only posting RPC grant | Five journal columns absent; service-role EXECUTE is false on both present journal RPCs. |
| ERP receiving | erp-purchase-receive | RC434 → RC437 → RC438; line-aware receipt RPC and purchase-order lines | Base and line-aware RPCs absent; purchase-order-line table absent. |
| Settlement | settlement-financial-atomic | RC494 business identity column/FK/index and registry-scoped authorization | Service-role RPC exists, but business_id column absent and legacy platform helper remains. |
| Order creation | order-create | Existing create_order_backend service-role RPC and its preconditions | RPC ACL compatible; older deployed handler lacks current request-size and finite-total guards. |

## Rules

- Never deploy an Edge function solely because its bundle builds or an isolated test passes.
- Do not add a grant manually to make an Edge endpoint work; the source migration and authorization boundary must be reviewed and tested as a unit.
- Do not replay or edit old migrations. Use the canonical migration list and reconcile physical effects before applying forward fixes.
- A successful CI replay from an isolated PostgreSQL 17 baseline proves source-chain testability, not that Production has the same objects or ACL.
- Keep Paymob webhook endpoints fail-closed for mismatched, missing or unsigned provider order identifiers.
- Treat missing provider_order_id matches, event replay collisions, unprocessed failures, old checkout secrets and non-idempotent retries as explicit negative-test cases.
- Keep financial journal and ERP endpoints blocked until their RPC permissions, schema objects, indexes/constraints and actor/tenant/business scope are verified.
- Full compiled Edge bundle/import-map/secret dependency parity remains NOT VERIFIED. Exact entrypoint match alone is not a release certificate.

**No Production change is authorized by this runbook.**
