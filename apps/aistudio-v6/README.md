# AI Studio V6 — canonical r5 source

Source archive is stored as base64 text parts under `source-pack-parts/`. The preparation script reconstructs and verifies the tar.xz, then expands it into an ignored worktree.

- Original ZIP SHA-256: `0e868efefbacd5cf3ec4c07a558230ce5cdfbbbdab64416182bc9a59f3acd429`
- Derived tar.xz SHA-256: `34a7665f313c9488f1959c72a2ef13ef594a54ce228e26061095c96f9bb7bd77`
- Preview base: `/MantiqatiX/v6-preview/`

This import does not deploy Pages or mutate production.

The preparation script applies two narrow test-expectation corrections before running the suite: it asserts zero/unavailable load telemetry until a real load runner exists, and verifies sector-specific fallback images rather than legacy generic URLs.
