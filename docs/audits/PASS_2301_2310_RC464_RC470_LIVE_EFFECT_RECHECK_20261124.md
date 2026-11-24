# PASS 2301–2310 — RC464–RC470 platform root, order, branch, commission and payment live effect recheck

**Date:** 2026-11-24
**Method:** current live Production read-only policy/function/ACL/search_path read-back plus existing RC464B preflight evidence. No Production writes.

| Migration | Current live evidence | Disposition |
|---|---|---|
| RC464 | Registry exists, RLS ON/FORCE RLS OFF; is_platform_admin remains SECURITY INVOKER/search_path=public and membership-derived. | **BLOCKED — registry root not active.** |
| RC464B | Orders/history RLS, authenticated SELECT grants and exact expected policy sets exist; predicates remain tenant-wide. | **PREFLIGHT PASS / RC465 still blocked.** |
| RC465 | orders_member_select/history_member_read remain tenant-only; provider SELECT checks business but not exact branch. | **BLOCKED — business/branch read-scope repair absent.** |
| RC466 | Businesses/branches/department/warehouse/stock/inventory policies remain primarily tenant-wide; branch read is not exact hierarchy. | **BLOCKED — RC466 scope repair absent.** |
| RC467 | Three commission RPCs have empty search_path and business/branch scope; preview_commission_backend remains search_path=public and lacks branch scope; platform helper legacy. | **PARTIAL — not registry-hardened.** |
| RC468 | Claim/release functions remain search_path=public, pg_temp; only legacy 4-arg finalizer exists; 5-arg provider-bound finalizer absent; service_role EXECUTE false. | **BLOCKED — claim/finalize contract absent.** |
| RC469 | Four shared admin callers still use legacy helper; caller search_paths public or public,pg_temp. | **BLOCKED — shared helper path repair absent.** |
| RC470 | Digital-page processor exists and checks provider_order_id, but search_path=public, pg_temp and atomic reconciliation mismatch guard absent. | **BLOCKED — forward processor repair incomplete.** |

**Production mutation:** NONE. Keep orders, commission, platform admin and payment paths gated until the ordered DB + Edge release is proven.