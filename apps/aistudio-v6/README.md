# AI Studio V6 — canonical r5 source

The immutable r5 source archive is stored as five base64 text parts under `source-pack-parts/`. The preparation script reconstructs the tar.xz, verifies its SHA-256, and extracts the app into an ignored `worktree/`.

- Original candidate ZIP SHA-256: `0e868efefbacd5cf3ec4c07a558230ce5cdfbbbdab64416182bc9a59f3acd429`
- Corrected source pack SHA-256: `15ee3718b476aa867813f941327a83da9eace9e35d7be25a795ff4e686ad8388`
- Preview base: `/MantiqatiX/v6-preview/`
- Corrected two stale test expectations: load-test placeholders must not invent capacity/telemetry; fallback images must use sector-specific assets.
- Corrected strict TypeScript issues: missing Lucide `Lock` import, unreachable local-only messaging/privacy mutation blocks, and optional diagnostic text assertion.

This import does not deploy Pages or mutate production.
