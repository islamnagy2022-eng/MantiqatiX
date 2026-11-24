# Pass 2231–2240 — RC442–RC451 approval, CRM, matrimony, journal and ads live recheck

**Checkpoint:** 2026-11-24  
**Production:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Mode:** Migration source review and read-only PostgreSQL policy/ACL/function/trigger/index queries. No Production writes.

## Migration-by-migration findings

| Migration | Expected contract | Live Production evidence | Disposition |
|---|---|---|---|
| RC442 approval audit atomicity | Revoke direct INSERT/UPDATE/DELETE on `approval_actions`; drop member INSERT policy; use `private.review_business_approval_atomic(uuid,varchar,varchar)` with `search_path=pg_catalog`, service-role boundary | RPC exists as SECURITY DEFINER, owner postgres, but search_path is `public, pg_temp`; anon EXECUTE=false, authenticated=false, service_role=true. Authenticated still has direct SELECT/INSERT/UPDATE/DELETE table privileges and `approval_actions_member_insert` still exists. | **PRESENT, CONTRACT-BLOCKED — direct audit writes remain granted** |
| RC444 CRM business scope | CRM lead/provider readers require own row, matching business scope, or explicit MNTY-PLATFORM full-control | Live “CRM managers view marketing leads” and “CRM managers view marketing providers” policies authorize active broad role names without the source's full platform scope/business-row checks. | **POLICY DRIFT — cross-business scope predicate differs from source** |
| RC447 matrimony profile privacy | Owner-only base-table SELECT, curated discovery projection RPC, unlocked-contact RPC, server-only verification trigger | Discovery RPC, unlocked-contact RPC, private verification guard and verification trigger are absent. Existing `matrimony_profiles_select` predicate is non-anonymous session logic, not `owner_user_id = auth.uid()`; authenticated can SELECT the base table. | **BLOCKED — private profile base-row boundary is not the source contract** |
| RC448 matrimony request lifecycle | Unique active request pair; one contact unlock per request; create/respond/unlock/contact RPC lifecycle; direct state changes moved behind trusted RPCs | Unlock unique index is present. Active-pair unique index absent. Four exact request/contact RPCs absent. Authenticated retains INSERT/UPDATE on `matrimony_requests` and INSERT/UPDATE/DELETE on `matrimony_contact_unlocks`. | **PARTIAL / BLOCKED — lifecycle RPCs and active-pair invariant absent; direct mutations remain** |
| RC449 MantiGO platform admin scope | Require explicit active MNTY-PLATFORM SUPER_ADMIN with PLATFORM/full_control; empty search_path in helper and four global RPCs | The five routine identities exist, but current main/live recheck records the old unscoped `mnty_can('admin',NULL,NULL,NULL)` helper behavior. All five remain on non-empty search_path. | **PRESENT, CONTRACT-BLOCKED** |
| RC449A journal schema prerequisites | Seven journal columns (entry_number, debit/credit totals, posted_at, updated_at, reversed_by_entry_id, line_number) plus running-balance lookup index | The seven source columns are absent in the current direct column check; `general_ledger_running_balance_lookup_idx` is absent. | **BLOCKED — prerequisites absent** |
| RC450 financial journal service-role boundary | `post_financial_journal_backend(uuid,jsonb,jsonb)` service_role-only; journal trigger writes running ledger rows | Function exists as SECURITY DEFINER, but live `search_path=public` rather than `public, pg_temp`, and service_role EXECUTE is false. Trigger function and `trg_post_journal_to_gl` trigger exist; trigger function's live path is `public` rather than source `public, pg_temp`. | **PARTIAL / CONTRACT-BLOCKED** |
| RC451 targeted ads search_path | Set `get_mnty_targeted_advertisements(...)` to empty search_path; preserve intentional public ad discovery | Exact seven-argument function exists, SECURITY DEFINER, empty search_path, anon EXECUTE=true, authenticated EXECUTE=true. | **PASS — preserve the intentional public read boundary** |

## Security interpretation

### Approval audit
The source explicitly removes direct client DML because audit rows must be committed atomically with the approval state transition. The live table still has authenticated INSERT/UPDATE/DELETE grants and the old member-insert policy. The private atomic function exists, but its search path also differs from the source. This is not a proven data-forgery incident; it is an unclosed source-to-live authorization gap requiring a coordinated forward fix.

### CRM
Both live CRM manager read policies match active role names but are broader than the exact RC444 policy source. The source requires a row's requester/business scope or explicit MNTY-PLATFORM full-control authority. Separately, `marketing_provider_profiles` still has anon SELECT and an ACTIVE public-read policy; prior P0 reports already track that base-table projection exposure under RC479/#928. Do not treat the CRM read-policy rework as permission to blanket-revoke the separate intentional public discovery path without its curated projection boundary.

### Matrimony privacy and lifecycle
- `matrimony_profiles` has authenticated SELECT, and the live SELECT policy currently does not limit rows to `owner_user_id=auth.uid()`. Its broad non-anonymous predicates allow the authenticated role to satisfy the policy. No application rows were read, so this report does not claim that private contact values were retrieved.
- The source discovery/contact RPCs and verification guard are absent, as is the verification trigger.
- The request lifecycle RPCs are absent; direct DML grants remain on requests and contact unlocks. The unique unlock-per-request index exists, but the active request-pair uniqueness index is absent.

### Financial journal
The backend posting routine and trigger mechanism exist physically, but the service-role RPC boundary and exact search path differ from source. Journal schema prerequisites and the running-balance index are absent. Presence of a trigger does not prove the full ledger schema, atomicity, balance calculations or service-role execution contract is ready.

### Intentional ad discovery
The targeted advertisement function is a reviewed public read surface. It has empty search_path and narrow output behavior already documented in earlier reports. Preserve its anon execution; no blanket privilege revocation was performed.

## Release disposition

- Keep approval audit, CRM management reads, matrimony private-profile access, request lifecycle and journal posting **BLOCKED / NOT CERTIFIED** pending ordered source-to-live repairs and adversarial tests.
- Preserve the RC451 public ad read contract.
- Do not manually patch individual policies/grants/functions in Production or replay individual historical migrations.
- Production ledger remains 310 rows through `20261110150618`; this is still a subset of the 82-version physical-effect/alias map.

**Production mutation:** NONE.
