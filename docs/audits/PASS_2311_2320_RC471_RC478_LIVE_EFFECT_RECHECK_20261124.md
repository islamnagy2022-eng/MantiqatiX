# PASS 2311–2320 — RC471–RC478 MantiGO, directory and payment live effect recheck

**Date:** 2026-11-24
**Method:** read-only PostgreSQL function metadata/body checks, directory schema/policy inventory, and payment RPC contract read-back. No ride, captain, payment or customer rows were read.

| Migration | Current live evidence | Disposition |
|---|---|---|
| RC471 | Four MantiGO/global admin callers still use legacy mnty_can_platform_admin; caller search_paths non-empty; platform registry FORCE RLS off. | **BLOCKED — registry-only platform root not active.** |
| RC472 | review_directory_listing_claim_atomic absent; NULL-safe membership index absent. | **BLOCKED — claim/listing atomicity absent.** |
| RC473 | Contact-consent registry/table and required PHONE/SECONDARY_PHONE/ADDRESS/PRECISE_LOCATION service-role scopes absent; directory Edge remains fail-closed. | **BLOCKED — consent foundation absent.** |
| RC474 | Exact payment-intent RPC exists but search_path=public, pg_temp and no exact branch scope; service_role EXECUTE true. | **BLOCKED — business/branch authorization incomplete.** |
| RC475 | Provider success processor exists but lacks reconciliation mismatch guard; provider failure and both subscription atomic processors absent. | **BLOCKED — atomic webhook flow incomplete.** |
| RC476 | Captain earnings RPC remains search_path=public and references legacy amount/captain_amount, not gross_amount/captain_net_amount. | **BLOCKED — earnings RPC does not match live ledger schema.** |
| RC477 | Customer ride RPC remains search_path=public and serializes full bid rows with to_jsonb(b), with no contact masking before ACCEPTED. | **BLOCKED — captain contact privacy repair absent.** |
| RC478 | Open-ride RPC remains search_path=public and has no ACTIVE/VERIFIED/AVAILABLE captain gate. | **BLOCKED — open-ride privacy repair absent.** |

**Production mutation:** NONE. Keep directory closed, MantiGO location/contact surfaces gated, and Paymob processing fail-closed.