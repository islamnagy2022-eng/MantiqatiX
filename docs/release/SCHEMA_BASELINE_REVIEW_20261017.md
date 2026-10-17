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
