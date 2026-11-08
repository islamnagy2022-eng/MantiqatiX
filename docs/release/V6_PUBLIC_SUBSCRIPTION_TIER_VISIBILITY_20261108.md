# V6 public subscription-tier visibility boundary — 2026-11-08

## Read-only production evidence

Project: `moyhiluyhjsujhwlyeuu`. No SQL writes or schema mutations were executed.

The production database contains four active price rows in `public.subscription_tier_prices`:

| Tier code | Monthly price | Annual price | Currency |
|---|---:|---:|---|
| STARTER_GROWTH | 199.00 | 1,788.00 | EGP |
| PRO_EXPANSION | 499.00 | 4,788.00 | EGP |
| ENTERPRISE_CHAIN | 999.00 | 9,588.00 | EGP |
| VIP_DOMINATOR | 1,999.00 | 19,188.00 | EGP |

The production table has both RLS and FORCE RLS enabled. The `anon` role does **not** have SELECT privilege. `authenticated` has SELECT privilege under non-anonymous authenticated policies. There are currently zero rows in `business_subscriptions`.

## UI integration decision

The uploaded `sectorBlueprints.ts` and `SectorDevelopmentModal.tsx` contain per-sector tier narratives, fee values, usage caps and tool claims. Those static values are not treated as production subscription truth.

- Do not copy those values or the browser-side upgrade handler into the public Preview.
- Do not grant anonymous SELECT on `subscription_tier_prices`.
- Do not add a database migration while the production migration-ledger reconciliation gate is blocked.
- A future public plans section must use a narrow server-side read contract that returns only active public pricing fields, after confirming the platform owner intends these prices to be public.
- Authenticated business-management and upgrade actions must continue to use the existing payment-intent/subscription backend contracts. No client-side subscription activation.

This keeps a visual tier comparison separate from a live subscription transaction and avoids publishing unapproved or non-authoritative package details.
