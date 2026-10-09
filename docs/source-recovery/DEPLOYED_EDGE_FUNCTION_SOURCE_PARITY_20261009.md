# Deployed Edge Function Source Parity Audit — 2026-10-09

**Scope:** Read-only comparison of the active Supabase Edge Function `index.ts` source against the repository branch `fix/mantigo-atomic-paymob-webhook`. No function was deployed, no database rows were changed, and no production settings were modified.

**Result:** 16/16 entrypoint source files matched byte-for-byte at the time of inspection. All 16 functions reported `ACTIVE` with JWT verification enabled.

| Edge Function | Deployed version | JWT verification | Source parity |
|---|---:|---|---|
| `business-deactivate` | 1 | enabled | EXACT MATCH |
| `approval-list` | 1 | enabled | EXACT MATCH |
| `business-onboarding-status` | 1 | enabled | EXACT MATCH |
| `financial-journal` | 1 | enabled | EXACT MATCH |
| `settlement-financial-atomic` | 2 | enabled | EXACT MATCH |
| `legal-consent` | 1 | enabled | EXACT MATCH |
| `legal-cms` | 4 | enabled | EXACT MATCH |
| `legal-gate` | 2 | enabled | EXACT MATCH |
| `legal-center` | 2 | enabled | EXACT MATCH |
| `subscription-start-trial` | 1 | enabled | EXACT MATCH |
| `subscription-payment-intent` | 2 | enabled | EXACT MATCH |
| `ai-gemini-proxy` | 2 | enabled | EXACT MATCH |
| `erp-product-create` | 2 | enabled | EXACT MATCH |
| `erp-purchase-receive` | 1 | enabled | EXACT MATCH |
| `marketing-lead-create` | 6 | enabled | EXACT MATCH |
| `mnty-provider-onboarding-review` | 1 | enabled | EXACT MATCH |

## Interpretation

- This closes the **source drift** question for these 16 entrypoints on this branch.
- Exact source parity does not prove that business behavior is correct, tenant isolation is complete, or the functions have passed integration/E2E tests.
- Function versions and source can change after this inspection; rerun the parity check before any release.
- The repository source should remain the reviewed source of truth for subsequent changes.
- Financial, subscription, legal, ERP, and onboarding paths still require behavior-level tests, permission-negative tests, and post-deployment smoke checks where applicable.
