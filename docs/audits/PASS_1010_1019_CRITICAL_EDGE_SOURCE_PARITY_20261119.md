# Critical Supabase Edge Function Source Parity — Pass 1010–1019 (2026-11-19)

**Canonical Supabase project:** `moyhiluyhjsujhwlyeuu`  
**Git main checkpoint:** `6793c4720b2fe94846ac5c953e3950927c8e71e1`  
**Evidence mode:** live Edge Function metadata/source retrieval compared byte-for-byte with `main` entrypoint files  
**Deployments or Production mutations:** NONE

## 1. Exact entrypoint comparison

Eleven critical entrypoints were fetched from the live project and compared with the corresponding `supabase/functions/<slug>/index.ts` file on main.

| Function | Live version | Status | verify_jwt | Exact entrypoint match |
|---|---:|---|---:|---|
| `api` | 17 | ACTIVE | false | PASS |
| `order-create` | 8 | ACTIVE | true | **MISMATCH** |
| `order-status-update` | 4 | ACTIVE | true | PASS |
| `payment-intent` | 8 | ACTIVE | true | **MISMATCH** |
| `payment-webhook` | 3 | ACTIVE | false | PASS |
| `paymob-webhook` | 10 | ACTIVE | false | **MISMATCH** |
| `digital-page-payment-intent` | 5 | ACTIVE | true | **MISMATCH** |
| `subscription-payment-intent` | 4 | ACTIVE | true | **MISMATCH** |
| `financial-journal` | 3 | ACTIVE | true | **MISMATCH** |
| `smm-gateway` | 13 | ACTIVE | true | PASS |
| `directory-listings` | 16 | ACTIVE | false | **MISMATCH** |

**Result: 4/11 exact matches; 7/11 mismatches.** Comparison was performed on the retrieved `index.ts` content, not only version numbers or timestamps.

## 2. Risk classification

The mismatches are in payment/order/finance and public-directory paths:
- `order-create`
- `payment-intent`
- `paymob-webhook`
- `digital-page-payment-intent`
- `subscription-payment-intent`
- `financial-journal`
- `directory-listings`

This is a source-parity finding, not by itself proof of a live exploit. However, deploying a source replacement individually is unsafe because the 62-version schema release contract remains 0/62 applied, multiple required RPC/table dependencies are absent, and payment/finance end-to-end and backup/restore gates remain incomplete.

## 3. What matched

The live entrypoints for `api`, `order-status-update`, `payment-webhook`, and `smm-gateway` match main exactly. Their live metadata is recorded above. A matching entrypoint does not independently prove runtime authorization, RLS correctness, or negative-path behavior.

## 4. Release decision

- Do not deploy any of the seven mismatched functions individually.
- Reconcile each function's full source bundle, imports, configuration, secrets and verify_jwt contract against the same ordered database release.
- Require disposable integration tests, live negative authorization tests, Paymob sandbox payment/callback correlation, idempotent fulfillment and rollback evidence before any Edge deployment.
- Preserve the catalog-only Pages deployment; it is separate from this Edge parity gate.

**Disposition:** critical Edge Function parity remains **PARTIAL / BLOCKED**. No Edge Function was deployed or changed; no Production SQL/DDL/DML/Auth/RLS/GRANT/payment/wallet/settlement change occurred.
