# Pass 1911–1920 — Live Storage ACL, anonymous-auth guard and bucket exposure review — 2026-11-23

## Live Production evidence
- [x] 1911 — `storage.objects` has RLS enabled; direct table ACL grants SELECT/INSERT/UPDATE/DELETE to both `anon` and `authenticated`. Therefore actual row access depends on RLS policy composition; ACL alone is not the full decision.
- [x] 1912 — Inspected all current `storage.objects` policies. Existing upload/update/delete policies target `authenticated`; there is no direct `anon` write policy. Several existing authenticated write policies use permissive handling of missing `is_anonymous` claim, and platform-brand write policies do not explicitly reject anonymous Auth identities.
- [x] 1913 — RC488 restrictive policies `storage_objects_confirmed_auth_insert/update/delete` are absent from live Production.
- [x] 1914 — Current-main RC488 requires `(auth.jwt()->>'is_anonymous')::boolean IS FALSE` as a RESTRICTIVE predicate on all authenticated Storage INSERT/UPDATE/DELETE, denying anonymous Auth sessions and missing claims.
- [x] 1915 — Live `mnty_platform_brand_insert/update/delete` policies still authorize from any active SUPER_ADMIN membership; current-main RC495 changes these policies to the shared platform-admin helper and repairs filename suffix constraints.
- [x] 1916 — Aggregate-only check: one active SUPER_ADMIN user exists and is present in `private.platform_admins`; no current non-registry SUPER_ADMIN matched. No user identifiers selected.
- [x] 1917 — Bucket inventory: `mantiqatix-media` is private, 5 MiB limit, JPEG/PNG/WebP only; `mantiqatix-profile-media` is public, 5 MiB limit, JPEG/PNG/WebP/SVG. Public read policy covers the profile-media bucket.
- [x] 1918 — Current object count in both buckets is zero; no existing object contents or customer files were read. Public bucket exposure is therefore a future upload-policy concern, not a confirmed current file leak.
- [x] 1919 — RC488 and RC495 are not in the live migration ledger. Do not add permissive policies or alter bucket visibility to silence Advisor findings.
- [x] 1920 — No Storage object, bucket, ACL, RLS policy, migration, Auth setting, file, or Edge Function was changed.

## Required release actions
- [ ] Reconcile and apply RC488–RC495 only through the exact 76-version release chain after independent PG17 replay and backup/restore gates.
- [ ] Verify anonymous Auth session denial for upload/update/delete, confirmed-user owner upload/update/delete, and platform-brand write denial for tenant SUPER_ADMIN not in the registry.
- [ ] Verify public profile-media read contract and file path/extension/MIME restrictions; keep the profile-media bucket public only for explicitly public provider images.
- [ ] Re-read live storage policies and bucket settings after deployment.

**Disposition:** no Storage mutation occurred. Full Production remains **BLOCKED / NOT CERTIFIED**.
