# PASS 2111–2120 — RC924 live Production agreement-boundary recheck

**Date:** 2026-11-24, approximately 19:15 UTC  
**Production:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Repository main at start:** `e5cb0c7644d63d3a1f12bd73a1f3258457ef4b53`  
**Method:** read-only SQL against `supabase_migrations.schema_migrations`, `pg_catalog`, `pg_policies`, `has_table_privilege`, and `pg_get_functiondef`. No agreement rows, participant identities, customer data, or legal document content were read. No Production mutation was performed.

## 1. Live migration identity

| Check | Live result |
|---|---|
| Migration ledger rows | 310 |
| Latest recorded migration | `20261110150618` |
| RC923 `20261124121348` | Not recorded |
| RC924 `20261124140000` | Not recorded |
| `public.directory_listing_contact_consents` | Absent |
| `private.platform_admins` | Exists; FORCE RLS remains disabled |

The 81-version source release contract and the isolated PostgreSQL 17 replay do not alter this Production state. Exact-version absence remains a ledger-identity fact; it is not by itself proof that every physical effect of every required migration is absent.

## 2. Agreements table access boundary

| Property | Live state |
|---|---|
| `public.agreements` RLS | Enabled |
| `public.agreements` FORCE RLS | Enabled |
| Effective `anon` SELECT | Denied |
| Effective `authenticated` SELECT | Granted |
| `agreements_confirmed_auth_select` restrictive policy | **Absent** |
| `agreements_participant_read` policy | Present, but its participant correlation is incorrect |

The live `agreements_participant_read` policy currently contains this predicate:

```sql
EXISTS (
  SELECT 1
  FROM agreement_participants ap
  WHERE ap.agreement_id = ap.id
    AND ap.user_id = (SELECT auth.uid())
)
```

The `ap.agreement_id = ap.id` comparison is self-referential. It does not correlate the participant row to the current parent row in `public.agreements`. The intended relationship is `ap.agreement_id = agreements.id`.

The current policy also uses `COALESCE(auth.jwt() ->> 'is_anonymous', false) = false`. That treats a missing claim as false, rather than requiring a positively confirmed non-anonymous identity.

Two restrictive policies currently exist on this table:
- `mnt_non_anonymous_boundary` uses `COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false`.
- `non_anonymous_authenticated_guard` uses `COALESCE(auth.jwt() ->> 'is_anonymous', 'false') <> 'true'`.

Both allow a missing `is_anonymous` claim to pass their expression. Neither substitutes for the RC924 confirmed-identity guard, which requires the claim to be explicitly false.

## 3. Live Legal helper overloads and dependency

Read-only function inspection found:

| Function | SECURITY DEFINER | search_path | anon EXECUTE | authenticated EXECUTE |
|---|---:|---|---:|---:|
| `private.legal_is_admin()` | Yes | empty | No | Yes |
| `private.legal_is_admin(uuid)` | Yes | empty | No | Yes |
| `public.legal_is_admin(uuid)` | Yes | `public` | No | No |

Both live private overloads still derive Legal authority from ACTIVE `public.user_memberships` rows with role `SUPER_ADMIN`, `ADMIN`, or `LEGAL_ADMIN`. The UUID overload defaults its argument to NULL and falls back to `auth.uid()`. This is not the registry-backed global-authority rule required by RC482.

The zero-argument private overload is also still present. RC924 deliberately fails closed unless:
1. RC482 has replaced the UUID helper with a registry-backed function that reads `private.platform_admins`;
2. that helper remains SECURITY DEFINER with an empty `search_path`;
3. authenticated EXECUTE is present and anon EXECUTE is denied; and
4. the legacy zero-argument overload has been removed.

The current `agreements_admin_write` policy invokes `private.legal_is_admin(auth.uid())`, so the RC482 prerequisite is security-critical and must precede RC924. Do not deploy RC924 alone.

## 4. Source repair and test evidence

Merged source:
- PR #1064 — RC924 migration and ordered RC482 prerequisite.
- Merge commit: `82cdebcdefc4a9c12d4e875548f1cf5f5dd3f896`.
- RC924 migration: `supabase/migrations/20261124140000_rc924_agreement_participant_read_scope.sql`.

The source migration:
- checks the registry-backed RC482 helper contract before changing policies;
- rejects the legacy zero-argument Legal helper;
- replaces the faulty participant-read policy with `ap.agreement_id = agreements.id`;
- adds a restrictive SELECT policy requiring `auth.jwt() ->> 'is_anonymous'` to be explicitly `false`;
- preserves the intended administrator/participant scope; and
- makes no table, application-row, grant, or helper change.

Exact-head test evidence:
- RC924 ordered RC482 → RC924 PostgreSQL 17 adversarial test: run `45466369028`, SUCCESS.
- Exact 81-version strict release gate and full chronological replay: run `45466369023`, SUCCESS. The isolated replay restored the captured schema checkpoint and applied 117 later migrations in timestamp order, including RC923 and RC924.
- These are disposable CI results, not Production deployment evidence.

## 5. Disposition and next actions

**Classification:** RC482 and RC924 are source-merged and isolated-test-passing, but their corresponding Production authorization/policy effects are not applied. The live Legal helper still uses membership-derived role authority, the zero-argument overload remains, the agreement participant policy has the wrong correlation, and the explicit confirmed-auth restrictive policy is absent.

1. Keep Production read-only.
2. Keep RC482 → RC924 in the coordinated 81-version DB release; do not apply either separately.
3. Reconcile all 81 migration IDs against exact ledger statements and physical function, policy, ACL, table, index, trigger and constraint state.
4. Require owner-controlled encrypted DB + Storage backup, Auth/Vault recovery coverage, independent PostgreSQL 17 restore/rollback and measured RPO/RTO before the coordinated DB + Edge release.
5. After an approved release, re-read the helper definitions, function overloads, ownership, ACLs, FORCE RLS and agreement policies, then test participant A/B isolation, unrelated-user denial, tenant-role non-escalation, anonymous Auth denial and missing-claim denial against the deployed origin.

**Production impact:** read-only inspection only. No DDL, DML, migration, RLS, GRANT, Auth, Storage, Edge Function, payment, wallet, settlement or publication change was made. Full platform remains **BLOCKED / NOT CERTIFIED**.
