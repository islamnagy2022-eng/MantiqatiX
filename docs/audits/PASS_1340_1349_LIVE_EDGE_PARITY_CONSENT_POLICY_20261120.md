# Pass 1340–1349 — Live Edge parity and contact-consent policy checkpoint

**Date:** 2026-11-20  
**Production project:** `moyhiluyhjsujhwlyeuu`  
**GitHub main checkpoint:** `87eb92be74aeb3040b04e29e18708dd8cdadba19`  
**Production mutations:** none. Read-only metadata and deployed function source inspection only.

## Verified live inventory

- Supabase project remains `ACTIVE_HEALTHY`, PostgreSQL 17.6.1.155.
- Production migration ledger contains **310** entries; latest is `20261110150618` (`revoke_public_execute_from_trigger_functions`).
- Production has **42 active Edge Functions**.
- The seven critical Edge Functions checked were `directory-listings`, `order-create`, `payment-intent`, `paymob-webhook`, `digital-page-payment-intent`, `subscription-payment-intent`, and `financial-journal`.
- For all seven, deployed `index.ts` content differs from the corresponding current `main` source file. This is a direct byte-for-byte comparison of retrieved source text, not an inference from timestamps.
- `directory-listings` is deployed as v16 with `verify_jwt=false` and only three files: `index.ts`, `pagination-filter.mjs`, and `doctor-import-contract.mjs`.
- Current GitHub `main` `directory-listings/index.ts` imports additional `public-directory-output-contract.mjs`, `consent-pagination.mjs`, and `contact-consent-pagination.mjs` modules. Those modules are not in the deployed v16 bundle. The deployed index also differs from current source.
- Production table inventory still does not contain `public.directory_listing_contact_consents`; RC473 has not been applied. Direct browser-role SELECT on `public.public_directory_listings` was separately confirmed denied in Pass 1330–1339, but the public Edge Function uses `service_role`, so its response sanitizer and consent enforcement remain the critical disclosure boundary.

## Contact-consent product decision

The project owner explicitly confirmed on 2026-11-20:

> Contact consent remains active until the activity owner explicitly withdraws it.

Implementation consequence:
- Do not add automatic expiry or an `expires_at` rule.
- A consent remains active while explicitly granted and `revoked_at IS NULL`.
- Revocation must remain attributed to the authenticated owner/authorized actor and fail closed if the consent registry cannot be read or validated.
- This decision does not authorize a Production migration or Edge deployment.

Decision recorded in P0 Issue #876 comment **7043793414**.

## Financial/order Edge parity

The fresh seven-function comparison was recorded in P0 Issue #857 comment **7043920765**. All seven deployed entrypoints differ from current `main`; no claim is made that every difference is a vulnerability or that all function behavior is broken. The exact differences must be reviewed against the corresponding migration/RPC contracts and tested as one coordinated release.

## Release disposition

**BLOCKED / NOT CERTIFIED.** Do not independently deploy any mismatched function, especially payment/order/finance or `directory-listings`. Continue source-side tests and exact migration reconciliation. Production rollout remains gated on:
1. Encrypted off-site database and Storage exports, checksum/decryption verification, Vault recovery plan.
2. Independent PostgreSQL 17 restore rehearsal and rollback rehearsal with measured RPO/RTO and independent reviewer.
3. Chronological migration/schema/grant/RLS/RPC reconciliation against the live ledger.
4. Complete Edge bundle parity and contract tests against the exact target schema.
5. Payment sandbox and negative authorization/privacy end-to-end tests.
6. Separate approved Production release window and post-release verification.

No Production rows or personal/contact data were selected. No Production database, migration, grant, RLS, Auth, Storage, Edge Function, payment, wallet, settlement, or deployment mutation occurred.


## Additional exact migration and physical-object recheck — 2026-11-20

After the initial audit was drafted, the canonical `REQUIRED_RELEASE_MIGRATION_VERSIONS` array in `scripts/production/live-reconciliation-contract.mjs` was parsed and compared against a fresh Production migration inventory:

- Required exact release migration identifiers: **64**.
- Exact required identifiers found in the live ledger: **0/64**.
- Live ledger remains **310** entries through `20261110150618`.
- Interpretation remains a migration-identity gap, not proof that all 64 physical effects are absent. Do not fabricate ledger rows or blindly replay the migration files.

A fresh read-only catalog query rechecked the 74 object names in the canonical release object contract:
- Physically present: **31/74**.
- Physically absent: **43/74**.
- The query inspected PostgreSQL catalogs and information_schema only; it did not select application rows.
- Presence checks are not a substitute for checking function grants/owners/search_path, RLS policies, exact RPC overloads, or behavior. Those remain separate release checks.

No Production mutation or deployment occurred.
