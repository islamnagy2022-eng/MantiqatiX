# V6 r5 Preview source import — 2026-11-06

## Source provenance
- Canonical candidate ZIP SHA-256: `0e868efefbacd5cf3ec4c07a558230ce5cdfbbbdab64416182bc9a59f3acd429`.
- Public MVP tar.xz source pack SHA-256: `76e1187918a6a907133399cfe06afec63c41c76d90e60e4ef9bc936f5993eeed`.
- The source pack is stored in five base64 parts and reconstructed/digest-checked by CI.
- Source security audit and remediation verification: PASS; security audit tests: 2/2 PASS.

## Public MVP scope applied
- Replaced the large home directory with a focused activity-first public directory: activity, specialty, governorate, verification filters, verified-first results, and 20-item progressive pagination.
- Replaced the medical directory's simulated AI auto-registration with read-only server directory results; removed internal member messaging and ad columns.
- Replaced the business profile with a public-safe profile. Unverified activities expose name, location and contact only; catalog and extended details remain hidden until verification.
- Catalog is informational: products/services, published prices and availability only; no local cart or order claim.
- Contact page prepares a WhatsApp message only. It explicitly states that no message is sent or received until the visitor confirms inside WhatsApp.
- Removed admin/merchant dashboards, wallet, order, internal messaging, AI registration, site-map/ad entry points, sponsored columns and generated "most requested"/"picked for you" carousels from the public shell.

## First CI feedback and fixes
- First release run: 84/86 tests passed; two stale test expectations were corrected to match the no-fabricated-telemetry rule and sector-specific default images.
- Strict TypeScript check then exposed missing Lucide `Lock`, unreachable local-only messaging/privacy mutation blocks, and an optional diagnostic assertion; corrected.
- The first complete validation run passed source verification, release tests, full typecheck, Vite build, and subpath asset assertions.
- Public MVP changes above are a new source pack and require their own exact-head CI pass before adding Preview to Pages.

## Build contract
- Preview base: `/MantiqatiX/v6-preview/`.
- CI installs the exact Bun lockfile, runs `verify:release`, `lint`, and Vite production build.
- This workflow validates only; it does not deploy Pages or alter the root artifact.

## Next gates
1. Pass exact-head CI for the public MVP source pack.
2. Integrate validated V6 `dist/` under `v6-preview/` into the existing Pages artifact only.
3. Verify public directory, routing/reload, Android/Desktop, accessibility, and live OTP after approved CORS/SMTP configuration.
4. Cut over root only after explicit Preview acceptance, with `/legacy/` and rollback.

No Supabase production schema/data/Auth/RLS/GRANT/migration/Edge Function/payment/finance change or public deployment was performed.
