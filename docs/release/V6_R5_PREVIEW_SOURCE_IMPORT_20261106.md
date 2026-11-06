# V6 r5 Preview source import — 2026-11-06

## Source provenance
- Canonical candidate ZIP SHA-256: `0e868efefbacd5cf3ec4c07a558230ce5cdfbbbdab64416182bc9a59f3acd429`.
- Corrected tar.xz source pack SHA-256: `15ee3718b476aa867813f941327a83da9eace9e35d7be25a795ff4e686ad8388`.
- The source pack is stored in five base64 parts and reconstructed/digest-checked by CI.
- Source security audit and remediation verification: PASS; security audit tests: 2/2 PASS.

## CI feedback and corrections
- First CI run installed the locked dependencies and passed source security/remediation checks. Of 86 tests, 84 passed and 2 failed due stale assertions.
- Corrected the load-test assertion to require unavailable/zero telemetry until a real external load runner exists.
- Corrected the default-image assertion to compare with sector-specific fallback assets, not retired generic URLs.
- The next typecheck exposed a missing Lucide `Lock` import, unreachable local-only messaging/privacy mutation blocks after explicit safe returns, and an optional diagnostic string assertion. These were corrected in the source pack.
- New CI run must pass all gates before any Preview artifact integration.

## Build contract
- Preview base: `/MantiqatiX/v6-preview/`.
- CI installs the exact Bun lockfile, runs `verify:release`, `lint`, and Vite production build.
- This workflow validates only; it does not deploy Pages or alter the root artifact.

## Next gates
1. Pass exact-head GitHub Actions validation.
2. Integrate validated V6 `dist/` under `v6-preview/` into the existing Pages artifact only.
3. Verify public directory, routing/reload, Android/Desktop, accessibility, and live OTP after approved CORS/SMTP configuration.
4. Cut over root only after explicit Preview acceptance, with `/legacy/` and rollback.

No Supabase production schema/data/Auth/RLS/GRANT/migration/Edge Function/payment/finance change or public deployment was performed.
