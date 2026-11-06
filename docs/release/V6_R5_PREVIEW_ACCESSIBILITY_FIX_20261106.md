# V6 Preview browser accessibility correction — 2026-11-06

The first composed Pages browser run built the catalog and V6 preview successfully and passed all earlier source, release, typecheck, build, live catalog, Qadam, OAuth, and public-directory checks. Desktop/mobile browser validation then failed axe-core with critical violation `select-name`.

The identified control is the public directory governorate filter in `src/components/DirectoryView.tsx`. It displayed the visible text "المحافظة:" adjacent to the select but did not programmatically associate a label. The deterministic V6 source overlay now adds `aria-label="تصفية الأنشطة حسب المحافظة"` to that select. No test was weakened and no production database/backend change was made.

Required next gate: rerun the composed Pages validation and require the V6 browser E2E and axe critical-violation check to pass. The overall production verifier still reports the full-platform gate BLOCKED for unapplied required migrations and unverified finance, restore, Auth settings, and Edge Function parity. Catalog-only scope remains separate; no production deployment or V6 root cutover is authorized here.
