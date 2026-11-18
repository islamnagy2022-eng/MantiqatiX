# MantiqatiX

**MantiqatiX** is the sole official public brand name of the platform. There is no customer-facing abbreviation or shortened brand identity.

Product model: **Customer ↔ Service Provider** with an **Operational Service Map** only when location is operationally necessary.

Internal technical identifiers that use legacy `MNTY` naming may remain where required for database contracts, migrations, APIs, validation scripts, compatibility, or security boundaries. They are implementation identifiers, not public branding.

SMM storefront: **deferred from initial launch**. `web/smm.html` is a `noindex` informational placeholder; the retired interactive browser client has been removed. The `smm-gateway` source, authorization tests, and historical database migrations remain intentionally in place for security and compatibility, with execution default-denied until a separately reviewed post-launch release.

Primary customer entry: the verified GitHub Pages production root (`/MantiqatiX/`) currently serves the legacy catalog application. The single Pages workflow preserves a rollback copy under `/legacy/` and publishes the V6 preview alias under `/v6-preview/`; V6 is not the production root yet. The workflow intentionally retains the catalog root while the full platform production gate is blocked. The V6 preview application is prepared from the repository's tracked V6 source by `scripts/prepare-aistudio-v6-preview-source.sh`. The V6 preview interface exposes the general activities directory, business profiles, public catalog and contact page; the dedicated medical directory page, route, navigation item and homepage CTA are excluded from the public build. The latest R7 AI Studio archive is preserved as a reference candidate only; see `docs/audits/R7_ARCHIVE_11_INTAKE_20261118.md`.


## Project continuity (required for contributors and AI sessions)
- Start every work session with [Project Continuity & Production Handoff](docs/PROJECT_CONTINUITY.md).
- Read the [Owner Operating Specifications 00–19](docs/specifications/OPERATING_SPECIFICATIONS_00_19.md) and the [RC40 → Web Reuse Matrix](docs/RC40_MODULE_REUSE_EXECUTION_MATRIX.md) before making architecture or module decisions.
- Read the chronological [Session Log](docs/SESSION_LOG.md) and [Master Production TODO](docs/MASTER_PRODUCTION_TODO.md) before continuing.
- Use the root [Website/Catalog Production TODO](TODO_PRODUCTION.md) as the detailed catalog execution supplement; reconcile overlapping tasks with the Master TODO rather than creating duplicate trackers.
- Record every material decision, code change, test, blocker, and next action in the session log. Do not mark a gate verified without evidence.


## Session continuation references

- Owner operating specifications 00–19: [`docs/specifications/OPERATING_SPECIFICATIONS_00_19.md`](docs/specifications/OPERATING_SPECIFICATIONS_00_19.md)
- Specification-to-TODO cross-reference (SPEC-00–SPEC-19): [`docs/specifications/SPECIFICATION_TODO_TRACEABILITY.md`](docs/specifications/SPECIFICATION_TODO_TRACEABILITY.md)
- Resume from [`docs/PROJECT_CONTINUITY.md`](docs/PROJECT_CONTINUITY.md), then read the latest entries in [`docs/SESSION_LOG.md`](docs/SESSION_LOG.md) and the global/catalog TODO registers.
