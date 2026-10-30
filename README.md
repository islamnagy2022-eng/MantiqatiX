# MantiqatiX

**MantiqatiX** is the sole official public brand name of the platform. There is no customer-facing abbreviation or shortened brand identity.

Product model: **Customer ↔ Service Provider** with an **Operational Service Map** only when location is operationally necessary.

Internal technical identifiers that use legacy `MNTY` naming may remain where required for database contracts, migrations, APIs, validation scripts, compatibility, or security boundaries. They are implementation identifiers, not public branding.

SMM storefront: **deferred from initial launch**. `web/smm.html` is a `noindex` informational placeholder; the retired interactive browser client has been removed. The `smm-gateway` source, authorization tests, and historical database migrations remain intentionally in place for security and compatibility, with execution default-denied until a separately reviewed post-launch release.

Primary customer entry: the electronic catalog build is published directly at `/MantiqatiX/` as the only production UI. The Pages workflow publishes `apps/catalog-frontend/dist` alone; it does not copy the legacy `web/` application, preview tree, or SMM placeholder into the production artifact. The legacy source remains in the repository solely for reusable code, compatibility reference, and continued development. Vite assets, PWA manifest, and service-worker scope are configured for the public root. The production artifact excludes `web/preview/` demo pages and the deferred `web/smm.html` placeholder. `.github/workflows/preview-pages.yml` validates demo source for regression tests but does not publish it. The scoped catalog pilot may deploy after its dedicated prerequisites and smoke checks pass; the full platform gate remains BLOCKED until migration/schema, payment/finance, backup/restore, Edge Function and Auth/SMM runtime evidence is complete.


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
