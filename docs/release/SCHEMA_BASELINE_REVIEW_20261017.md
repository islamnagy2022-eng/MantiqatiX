# Production Schema Baseline — Static Review Notes (2026-10-17)

## Artifact provenance

- Review PR: [#284](https://github.com/islamnagy2022-eng/MantiqatiX/pull/284)
- Capture workflow: [run 38993809648](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38993809648)
- PostgreSQL major: 17
- Applied migration count: 283
- Ledger checkpoint: `20261008222845`
- Snapshot SHA-256: `ee16d095177110de67dac57f1b9a1e67610b40a3712981e850eff17d637a67a2`
- Ordered migration ledger SHA-256: `0b60096967ef51a912a08b437a10377e2f12d357dd6b25d5dc80677b1f8832b2`

## Automated static audit

Run [Production Schema Baseline Static Audit](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38995239972) passed on head `36971cd89e5d69ec00050dfe74c6261ec395060f`.

- 128 public tables; all 128 have RLS enabled in the dump.
- 485 policy declarations.
- 145 SECURITY DEFINER functions parsed; all have an explicit `search_path` setting and `REVOKE ALL ... FROM PUBLIC` in the snapshot.
- No recognized high-signal connection string/JWT/Supabase secret patterns were found by the capture validation scan. This is not a complete secret audit.
- No `COPY ... FROM stdin` row-data payload was found.
- `public.counter_offer_indrive_bid(uuid,uuid,numeric)` is present in the snapshot and checks authenticated ownership of the request before updating a bid.

## Manual-review observations

1. Policy `Public can view active platform brand assets` on `public.platform_brand_assets` uses `USING (true)` for `anon` and `authenticated`. This may be intentional for public active brand assets, but reviewer must verify the policy is constrained to active/public rows by the table design or view. The policy itself does not show an active-row predicate.
2. `public.get_mnty_targeted_advertisements(...)` is SECURITY DEFINER and executable by `anon` and `authenticated`. The body filters advertisements to `ACTIVE` and `APPROVED`, checks active targeting locations, and supports public ad retrieval. Review output columns and row filtering before approving the baseline.
3. A static scan found no other SECURITY DEFINER functions granted to `anon`/`authenticated` that lacked an obvious auth/role helper. This is only a heuristic and is not a substitute for reviewing all 50 callable functions.
4. Many SECURITY DEFINER functions use `search_path = public` or `public, pg_temp`. All have an explicit setting and PUBLIC execute revoke in the dump, but object-qualification and temporary-object risks must be evaluated function by function.
5. All public tables have RLS enabled in the snapshot; policy semantics, table grants, views, triggers, and runtime tenant isolation have not been comprehensively verified.
6. Snapshot contains the live definition of `counter_offer_indrive_bid`, but this does not reconstruct its authoritative historical migration source or remove the need to test migration replay from the captured checkpoint.

## Gate status

**`PENDING_REVIEW` — do not change.**

This is a schema-only bootstrap candidate for a disposable test database, not a migration and not an approved production artifact. No production writes, DDL, grants, migration application, or deployment were performed.

Before approving the baseline or enabling forward replay:
- Complete manual review of all SECURITY DEFINER bodies, grants, RLS policies, views, triggers, and exposed functions.
- Resolve the historical migration-source gaps separately; do not convert the snapshot into historical migrations.
- Use an isolated disposable database, apply only migrations newer than the checkpoint in chronological order, and record complete replay output.
- Pass tenant-isolation, payment/finance E2E, and backup/restore rehearsal.
- Keep PRs #248, #273, #282, and this PR unmerged until the applicable gates pass.


## Supplemental independent scan — 2026-10-17

- An independent source-text scan of snapshot blob `8d096904c777b4c7eae096014b45c59859c96cee` found 145 occurrences of `SECURITY DEFINER`; this parser extracted 144 complete function bodies because one body uses a delimiter/layout not covered by the ad-hoc parser. This is a parser coverage gap, not evidence that a function is absent. The baseline must remain pending until all 145 functions are accounted for by the authoritative audit.
- Of the 144 parsed bodies, 49 had an `anon` or `authenticated` grant in the snapshot. Only `public.get_mnty_targeted_advertisements(...)` lacked an obvious auth/role signal in its body. Manual inspection shows it returns approved active advertisement creative/target fields, filters active targeting locations, and supports public global ads; it does not query account, order, payment, or membership data. It remains a SECURITY DEFINER function with `search_path = public, pg_temp`, so review must verify schema CREATE privileges, fully-qualified object references, and that target/creative fields are intentionally public before approval.
- The `public.platform_brand_assets` table has a CHECK constraint restricting `asset_key` to `PRIMARY_LOGO` and `PRIMARY_MARK`; its public SELECT policy exposes `asset_path`, `original_asset_path`, MIME type, version, updater ID, and timestamp. The policy is plausibly intentional for public brand assets, but verify that both paths point only to public assets and do not expose private storage keys before marking it approved.
- These observations narrow the review but do **not** complete the full function/grant/policy review or tenant-isolation test. Manifest status remains `PENDING_REVIEW`.


## Supplemental manual review — public targeted-ad function and brand-asset policy (2026-10-17)

### `public.get_mnty_targeted_advertisements(...)`

- **Reviewed snapshot definition:** function returns only advertisement ID/title, creative URL, target URL, ad-space ID, match level, and approximate distance. It reads `public.advertisements`, `public.advertisement_target_locations`, `public.platform_geo_areas`, and `public.platform_global_advertisements`; each table reference is schema-qualified.
- Tenant/account/order/payment/membership data is not queried by this function. Local ads are filtered to `ACTIVE` + `APPROVED`, within start/end time, active geographic targets, and the selected country. Global ads are likewise filtered to `ACTIVE` + `APPROVED` and start/end time. `p_limit` is clamped to 1–50.
- Function is `SECURITY DEFINER`, has `search_path = public, pg_temp`, and is callable by `anon` and `authenticated`. The snapshot scan found no CREATE grant to those roles on schema `public`; however, this is a schema-only snapshot and runtime privilege assertions have not been run. Keep this function in the manual review set until a disposable role-level test proves effective grants, schema CREATE denial, and intended public creative/target exposure.
- **Disposition:** scoped read-only behavior appears consistent with public ad delivery; not independently certified for production.

### `public.platform_brand_assets`

- Table CHECK constraint limits `asset_key` to `PRIMARY_LOGO` and `PRIMARY_MARK`. Public SELECT policy is `USING (true)` for `anon` and `authenticated`, and exposed columns include `asset_path` and `original_asset_path`.
- The snapshot is schema-only and contains no row values, so it cannot prove these paths refer exclusively to public assets or that `original_asset_path` does not expose private storage keys.
- **Required follow-up:** use an authorized read-only query or asset inventory to verify the two path values and storage bucket/access policy. Do not export user data or secret values. If the original path is private, replace broad direct read with a safe public view/RPC or remove the original path from the public contract after an independently reviewed forward-only migration.
- **Disposition:** unresolved; baseline remains `PENDING_REVIEW`.

No production changes, grants, schema changes, data reads from user tables, or deployments were performed during this source review.


## Correction — effective direct table privilege for brand assets (2026-10-17)

- Follow-up ACL scan of the same schema-only snapshot found **no** `GRANT SELECT` or `GRANT ALL` on `public.platform_brand_assets` to `anon` or `authenticated`. The table's explicit role grants shown in the dump are limited to `REFERENCES, TRIGGER, TRUNCATE, MAINTAIN`; default table privileges for these roles also grant only those non-read privileges. Therefore the broad SELECT policy does **not by itself** establish that client roles can read the table; direct SELECT appears ungranted in the captured ACL state.
- This corrects the preceding note's implication that the policy alone exposes the paths. Runtime `has_table_privilege('anon', ... , 'SELECT')` and authenticated-role checks should still be run in a disposable replay, and any public RPC/view that reads this table must be audited separately. Because the baseline contains no row values, public storage-path validation remains unavailable from this artifact.
- Baseline remains `PENDING_REVIEW`; no production query or mutation was performed for this correction.


## Supplemental live ACL and brand-asset verification — 2026-10-17 (read-only)

### `public.platform_brand_assets`

Read-only production queries returned:
- Exactly two rows, with keys `PRIMARY_LOGO` and `PRIMARY_MARK`.
- Each `asset_path` equals its `original_asset_path`.
- The paths match the repository's public static files: `assets/mantiqatix-logo.svg` and `assets/mantiqatix-mark.svg`; the corresponding files exist at `web/assets/mantiqatix-logo.svg` (blob `8a175d1c8912637b7f29383fc0836ac4f577e057`) and `web/assets/mantiqatix-mark.svg` (blob `01f7c5878b585d94a8f7509e9732488079c80e50`) on `main`.
- Effective privilege checks returned `has_table_privilege('anon', ..., 'SELECT') = false` and the same for `authenticated`. Thus the broad `USING (true)` policy alone does not currently grant these client roles table access. No private storage URL/key was observed in the two current values.

**Disposition:** the original concern about the *current two path values* pointing to private storage keys is resolved by the read-only evidence. Keep a narrower caveat: a future table-level SELECT grant could make the permissive policy effective, so the release baseline must preserve/check the no-client-SELECT grant unless a separately reviewed public-view contract is introduced. This does not certify all policies or other access paths.

### `public.get_mnty_targeted_advertisements(...)`

Additional read-only production ACL check returned:
- SECURITY DEFINER = true; settings include `search_path=public, pg_temp`.
- `anon` and `authenticated` can EXECUTE the function.
- Neither `anon` nor `authenticated` has CREATE on schema `public`.

Combined with the earlier reviewed snapshot body (schema-qualified table references; output limited to ad creative/target metadata; active/approved and active-target filters), this supports the intended public ad-discovery use case. It is **not** a disposable behavioral test and does not eliminate the need to validate the effective function contract in an isolated test database or review all other callable SECURITY DEFINER functions.

**Evidence type:** read-only production catalog/metadata query plus repository asset existence check. No user-table rows, payment records, or secrets were read. No production write, DDL, grant, migration, or deployment occurred.

**Gate:** keep manifest `PENDING_REVIEW`. These observations close two narrow review questions only; they do not complete the overall baseline review, tenant-isolation E2E, full function/grant/policy review, or release gate.


## Parser correction and exact-head verification — 2026-10-18

- Replaced the previous function-body delimiter assumption in `scripts/tests/production-schema-baseline-static-audit.mjs` with a header-based scan that stops at the dollar-quote opener. The audit now checks the `SECURITY DEFINER` and `SET search_path` attributes in the function declaration header, independent of the body's closing dollar tag.
- Added an explicit coverage equality check between `SECURITY DEFINER` occurrences in the snapshot and parsed function headers. This is intended to fail closed if parser coverage regresses.
- Added a branch-push trigger for the static audit so subsequent edits to the snapshot, manifest, ledger, validator, or workflow are audited on the branch as well as in pull requests.
- Exact-head run [39089593717](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/39089593717) passed on `d70000e185c2e6d2c5f86d82a4c5b7a089564b02`: 283 ledger versions through `20261008222845`, 128/128 public tables with RLS enabled in the snapshot, 485 policy declarations, and 145/145 parsed SECURITY DEFINER headers with explicit `search_path` and PUBLIC execute revokes.
- The baseline remains `PENDING_REVIEW`. These are static snapshot checks, not a full manual function/policy review, a disposable forward-migration replay, or production tenant/payment E2E. No production changes or deployment were performed.


## Disposable tenant-isolation E2E — 2026-10-18

- Added `.github/workflows/disposable-schema-tenant-isolation-e2e.yml`. It creates a temporary Supabase project in CI, restores only the schema-only snapshot, injects synthetic rows guarded by `mantiqati_disposable=on`, then runs the fail-closed verifier.
- Exact-head workflow [39089734987](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/39089734987) passed on commit `0d92966a36da09333bc5d39294515dfc08101b81`.
- SQL output confirms both directions: Tenant A saw its own rows and could not see private Tenant B rows; Tenant B saw its own rows and could not see private Tenant A rows. Assertions covered businesses, orders, payment intents, and provider-onboarding rows.
- This verifies the captured schema/policies in an isolated local Supabase environment only. It does not establish that production currently has identical policies, nor does it prove full migration replay, live application tenant isolation, payment/finance E2E, or backup/restore. Manifest stays `PENDING_REVIEW`; production remains untouched.
