# V6 r5 Preview source import — 2026-11-06

## Source provenance
- Canonical candidate ZIP SHA-256: `0e868efefbacd5cf3ec4c07a558230ce5cdfbbbdab64416182bc9a59f3acd429` (exact match).
- Derived tar.xz source pack SHA-256: `34a7665f313c9488f1959c72a2ef13ef594a54ce228e26061095c96f9bb7bd77`.
- Candidate ZIP integrity: PASS; 103 extracted files.
- The clean source pack is retained in `apps/aistudio-v6/source-r5-preview.tar.xz`; CI expands it into an ignored worktree.
- Source security audit and remediation verification: PASS; security audit tests: 2/2 PASS.

## Build contract
- Preview base: `/MantiqatiX/v6-preview/`.
- CI installs the exact Bun lockfile, runs `verify:release`, `lint`, and Vite production build.
- This workflow validates only. It does not deploy Pages or alter the root artifact.
- Full project install/typecheck/build/browser E2E are not claimed until the new CI run passes.

## Next gates
1. Pass exact-head GitHub Actions validation.
2. Integrate the validated `dist/` under `v6-preview/` into the existing Pages artifact only; no parallel Pages deploy workflow.
3. Verify public directory, routing/reload, Android/Desktop, accessibility, and live OTP after approved CORS/SMTP configuration.
4. Cut over root only after explicit Preview acceptance, with `/legacy/` and rollback.

No Supabase production schema/data/Auth/RLS/GRANT/migration/Edge Function/payment/finance change or public deployment was performed.


## First CI feedback and correction
- First run installed the lockfile and passed source security/remediation, then ran 86 tests: 84 passed and 2 failed due stale assertions.
- The two assertions expected fabricated 1k/500k load-test measurements despite the implementation deliberately returning zero/unavailable values, and expected legacy generic cover imagery despite the sector-specific image library.
- The source preparation script now applies exact, anchor-checked corrections to those test assertions before running the test suite. No production logic was weakened or changed by this correction. A fresh CI run is required to verify.
