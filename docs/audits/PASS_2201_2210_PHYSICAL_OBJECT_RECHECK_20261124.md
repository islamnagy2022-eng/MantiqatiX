# Pass 2201–2210 — Read-only Production physical-contract refresh (76 objects)

**Checkpoint:** 2026-11-24  
**Environment:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Mode:** Read-only PostgreSQL catalog inspection. No application rows, customer data, secrets, or payment payloads were selected.

## Scope

Rechecked the 76 physical-object contracts already recorded in `docs/release/production-migration-reconciliation.json` under `required_release_object_presence_check.observed`. This is a refreshed sample of the existing 76-object register, not a complete migration-to-object map for all 82 required source migrations.

Presence checks used `pg_class`/`to_regclass`, `pg_attribute`, `pg_proc`/`to_regprocedure`, and `pg_trigger`. Exact function signatures were checked where the register contained them; function-family entries without signatures were checked by schema and function name only.

## Physical presence result

| Object type | Checked | Physically present | Absent |
|---|---:|---:|---:|
| Tables | 7 | 5 | 2 |
| Indexes | 13 | 6 | 7 |
| Columns | 12 | 2 | 10 |
| Function entries | 41 | 22 | 19 |
| Triggers | 3 | 0 | 3 |
| **Total** | **76** | **35** | **41** |

The 35 physically present objects are not 35 certified contracts. Existence alone does not prove the expected signature, body, tenant/business/branch scope, owner, RLS/FORCE RLS, effective ACL, idempotency, or runtime behavior.

### Absent object groups

- **RC117 default-image support:** five columns, three triggers, and `public.mnty_default_image_url()` are absent.
- **RC425–RC430 payment processing:** the MantiGO provider-event table and atomic processor, the claim-token digital-page finalizer overload, provider-failure and subscription success/failure processors are absent.
- **RC435/RC439 subscription checkout:** claimable intent creation/claim RPCs and provider-creation/encrypted-secret columns are absent.
- **RC434/RC438 ERP purchasing:** atomic stock receipt, purchase-order lines, line-scoped receipt and purchase-order creation contracts are absent. The old order-status function exists by signature but remains contract-blocked.
- **RC427/RC432 and journal/index prerequisites:** the active-payment-intent unique index, SMM wallet idempotency index, null-safe membership index, and required journal indexes are absent.
- **Current follow-up contracts:** atomic journal posting, purchase-line setters/receivers, and other tracked functions remain absent.

The exact absent object names are preserved in the machine-readable release manifest under `physical_presence_refresh_20261124_current.absent_objects`.

## Function security and ACL read-back

Of the 41 function entries, 22 matched a live routine/overload:

| Property | Count |
|---|---:|
| SECURITY DEFINER | 21 |
| SECURITY INVOKER | 1 |
| Empty `search_path` | 13 |
| Non-empty `search_path` | 9 |
| Direct `anon EXECUTE` | 0 |
| `authenticated EXECUTE` | 19 |
| `service_role EXECUTE` | 2 |

The 41 function entries include both family-name checks and exact-signature entries; they are not 41 distinct routine names. A name-only match is not treated as signature or behavior parity.

### Present, but still contract-blocked or requiring separate review

- `private.platform_admins` exists and RLS is enabled, but `FORCE ROW LEVEL SECURITY` remains false.
- `public.is_platform_admin()` exists but remains SECURITY INVOKER with `search_path=public` and the legacy membership-derived implementation.
- `public.mnty_can_platform_admin()` remains SECURITY DEFINER with `search_path=public, pg_temp`; its legacy unscoped helper behavior remains a P0 authorization concern.
- `public.process_verified_digital_page_payment_backend(...)` is SECURITY DEFINER with `search_path=public, pg_temp`; the live function still requires exact body/ACL parity review.
- `public.process_verified_provider_payment(...)` is SECURITY DEFINER with `search_path=public`; its current body, webhook correlation and atomic finance contract are not certified.
- `public.update_purchase_order_status_backend(varchar,varchar)` exists with `search_path=public`, but neither `authenticated` nor `service_role` has the expected EXECUTE grant.

Nine of the 22 matched function definitions have a non-empty search path. The other functions still require per-function body, owner, grant, actor derivation and tenant-scope review; an empty search path alone is not a PASS.

## Live release ledger and RC925 boundary

A separate read-only aggregate check confirmed **310 Production migration rows** through `20261110150618`. The current source manifest contains 82 required release migration identifiers and records 0 exact identifier matches in the live ledger. This is an identity gap, not proof that every physical effect is absent.

RC925 is merged in source and its negative and positive Auth-claim tests pass in isolated PostgreSQL 17. The Production catalog query after those source merges still showed the seven catalog RPCs on the old live definitions. RC925 remains unapplied to Production.

## Disposition

- Keep the full Production release **BLOCKED / NOT CERTIFIED**.
- Do not replay the 82-migration chain directly against Production.
- Continue exact per-migration effect/alias classification, function-body/ACL/RLS parity, and the coordinated DB + Edge dependency map.
- Keep Paymob, settlement, subscription checkout, directory publication and other affected writes/read surfaces fail-closed until their complete contracts and recovery gates pass.
- Complete owner-controlled encrypted database and Storage exports, Auth/Vault recovery, independent PostgreSQL 17 restore/rollback, and measured RPO/RTO before any coordinated Production release.

**Production mutation:** NONE.
