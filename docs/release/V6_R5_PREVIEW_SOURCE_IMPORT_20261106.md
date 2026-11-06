# V6 r5 Preview source import — 2026-11-06

## Source provenance
- Canonical candidate ZIP SHA-256: `0e868efefbacd5cf3ec4c07a558230ce5cdfbbbdab64416182bc9a59f3acd429`.
- Public MVP tar.xz source pack SHA-256: `afab4504ba86960f7ac2a64e6ad969d901be80f6022f3393e14cf3ecc81f453f`.
- The source pack is stored as a single binary archive at `apps/aistudio-v6/source-r5-preview.tar.xz` and digest-checked directly by CI.
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

## Latest CI feedback
- Public MVP tests passed, but strict TypeScript found stale cart-indicator JSX references after checkout removal. Those remaining references were removed; the next exact-head run is pending.

## Pages Preview composition
- The existing `.github/workflows/pages.yml` now builds V6 from the verified archive and composes its `dist/` under `v6-preview/` alongside the existing catalog root.
- Post-deployment smoke checks verify the Preview HTML and JS/CSS asset URLs. No second Pages deployment workflow is created and the root catalog is not replaced.
- The combined Pages workflow is not yet validated on this PR; no Preview deployment has occurred.

## Shared runtime configuration
- V6 loads the existing root `config.js` before its module entry and reads `window.MNTY_CONFIG` at runtime.
- The shared adapter validates HTTPS Supabase project URLs and accepts only `sb_publishable_*` keys or JWTs whose role is `anon`; service-role JWTs are rejected.
- This avoids baking the key into the V6 build step and keeps both public directory and OTP membership configuration consistent with the existing catalog's public client config.
