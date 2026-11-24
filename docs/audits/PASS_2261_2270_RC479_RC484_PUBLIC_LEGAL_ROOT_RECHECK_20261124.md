# Pass 2261–2270 — RC479–RC484 public data, Legal CMS and global-admin root recheck

**Checkpoint:** 2026-11-24  
**Production:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Mode:** Source review and read-only PostgreSQL ACL, policy, function and column-privilege checks. No Production writes.

## Migration-by-migration result

| Migration | Source contract | Live Production evidence | Status |
|---|---|---|---|
| RC479 — provider profile anonymous boundary | Revoke direct anon SELECT on `marketing_provider_profiles`; public discovery continues only through curated server/Edge projections | Anon SELECT privilege remains true. The later restrictive `marketing_provider_profiles_confirmed_auth_select` policy is also absent. Existing owner and public ACTIVE read policies remain. | **BLOCKED — raw base-table access remains open to anon** |
| RC479 forward repair — anonymous Auth sessions | Deny anonymous Auth JWTs which use the authenticated PostgreSQL role, while keeping confirmed-user owner reads | `marketing_provider_profiles_confirmed_auth_select` policy is absent. Existing permissive public/active and CRM SELECT policies remain; the restrictive anonymous-session boundary is not installed. | **BLOCKED — anonymous Auth can still satisfy current provider-profile read policies** |
| RC480 — digital page column boundary | Remove table-level anon SELECT and grant only the 10 public renderer columns: id, page_type, slug, title, subtitle, description, seo_title, seo_description, status, version | All 19 current `digital_pages` columns return anon SELECT=true, including business/provider IDs, theme, created/updated actor and timestamps, and order linkage. This is not the 10-column allowlist. | **BLOCKED — 9 extra columns remain exposed to anon** |
| RC481 — Legal Edge service-role column grants | Grant only the required SELECT/INSERT columns to service_role for legal documents, versions, consents and audit | Read-only column-privilege checks found service_role SELECT=false for all 16 sampled legal document/version/audit columns. RC481's constrained Edge read surface is not present. | **BLOCKED — Legal Edge read privileges not installed** |
| RC482 — Legal platform-admin registry guard | `private.legal_is_admin(uuid)` must read `private.platform_admins`; zero-arg overload removed; `public.legal_assert_admin_backend(uuid)` service-role-only | UUID and zero-argument `private.legal_is_admin` overloads both exist. UUID helper has empty search_path but its body does not reference `private.platform_admins`; zero-arg overload remains. `public.legal_assert_admin_backend(uuid)` is absent. | **BLOCKED — old Legal admin helper remains** |
| RC483 — atomic Legal CMS create/audit | Two atomic, service-role-only RPCs create document/version and audit within one transaction; direct INSERT grants are revoked | `legal_create_document_backend(...)` and `legal_create_draft_version_backend(...)` exact signatures are absent. Service-role INSERT is false (consistent with RC483's revoke), but expected service-role SELECT column grants are also absent. | **BLOCKED — direct writes removed without atomic replacement RPCs present** |
| RC484 — generic platform-admin root | Force RLS on private registry and replace `public.is_platform_admin()` with SECURITY DEFINER, empty-path registry lookup | `private.platform_admins` has RLS enabled but FORCE RLS=false. Live `public.is_platform_admin()` remains SECURITY INVOKER with `search_path=public` and queries `public.user_memberships` for ADMIN/SUPER_ADMIN roles, not the registry. | **P0 BLOCKER — tenant role still acts as global root** |

## Detailed findings

### Provider profiles and public digital pages

The two RC479 controls protect distinct paths:
1. Direct PostgREST anon table access through the PostgreSQL `anon` role.
2. Anonymous Auth sessions represented by the `authenticated` role.

Both are currently unclosed: anon still has SELECT, and the restrictive confirmed-user policy is absent. The existing ACTIVE public policy is not a substitute for the curated Edge projection.

RC480 has a similarly precise boundary. Source permits ten fields used by the public renderer. The live catalog reports anon SELECT for all 19 columns, so the intended column-level grant boundary is not installed. No provider or digital-page rows were selected in this audit.

### Legal Center / Legal CMS

RC482's protected registry is not yet the root authority for Legal CMS. Both the UUID and zero-argument helper overloads remain, and the UUID implementation does not reference `private.platform_admins`. The public backend assertion RPC is absent.

RC483 expects service-role-only atomic document/version creation with audit. Both RPCs are absent. Its direct INSERT revocations are visible in the effective privilege state, but the service-role read-column grants from RC481 are also absent. Treating the direct INSERT revocation alone as a successful migration would therefore be unsafe: the replacement transaction boundary has not appeared in the live catalog.

### Platform root

RC484's generic `is_platform_admin()` is still the earlier invoker function that checks tenant membership roles. The registry exists, but FORCE RLS is false and the helper body is not registry-backed. RLS policies that call this helper must not be considered protected by a registry-based root until the exact implementation, ownership, ACL and RLS/FORCE RLS contract is verified.

## Release disposition

- Block provider-profile raw anonymous access and digital-page public column grants pending ordered forward fixes and tests.
- Keep Legal CMS create/version workflows blocked until registry-backed admin assertion, both atomic RPCs and the precise service-role column grants are verified together.
- Keep every Platform Admin / global RLS bypass blocked until RC484's owner, SECURITY DEFINER, empty search_path, registry body, ACL and FORCE RLS postconditions pass.
- Live migration ledger remains 310 rows through `20261110150618`; current source release contract is 82 versions with 0 exact source version matches.
- No policy, table grant, column grant, RPC, migration, Auth, Storage, Edge or business-data mutation occurred.

**Production mutation:** NONE.
