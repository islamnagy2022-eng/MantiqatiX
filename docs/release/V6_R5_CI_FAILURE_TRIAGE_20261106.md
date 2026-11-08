# V6 r5 validation follow-up — 2026-11-06

The first exact-head CI run passed source provenance/security checks and frozen Bun dependency installation, then stopped in `verify:release` on two stale test expectations:

1. `src/utils/enterprise.test.ts` asserted fabricated load-test RPS and fabricated live telemetry. The current client-safe implementation intentionally reports zero/unknown until an external load-test runner and live telemetry source are connected. Tests now assert the safe unavailable state.
2. `src/utils/rules.test.ts` asserted generic legacy image URLs. The current image resolver returns sector-specific default images. Tests now assert the canonical services-sector defaults.

A first unified-diff patch did not match the exact packed source and was rejected; no source code was changed by that attempt. It has been replaced by `scripts/patch-v6-release-test-contract.py`, an idempotent, anchor-checked patch applied by the preparation script. Runtime application code is unchanged. The next exact-head CI run remains the acceptance gate; no deploy or production cutover is authorized by this correction.
