# MantiqatiX

**MantiqatiX** is the sole official public brand name of the platform. There is no customer-facing abbreviation or shortened brand identity.

Product model: **Customer ↔ Service Provider** with an **Operational Service Map** only when location is operationally necessary.

Internal technical identifiers that use legacy `MNTY` naming may remain where required for database contracts, migrations, APIs, validation scripts, compatibility, or security boundaries. They are implementation identifiers, not public branding.

SMM storefront: **deferred from initial launch**. `web/smm.html` is a `noindex` informational placeholder; the retired interactive browser client has been removed. The `smm-gateway` source, authorization tests, and historical database migrations remain intentionally in place for security and compatibility, with execution default-denied until a separately reviewed post-launch release.

Primary customer entry: the current GitHub Pages production root (`/MantiqaTix/`) is the V6 public application. The single Pages workflow builds the retained catalog application under `/legacy/` for compatibility and rollback, and also publishes the V6 preview alias under `/v6-preview/`; it composes these paths into one Pages artifact and runs deployed-origin smoke checks. The V6 application is prepared from the repository's tracked V6 source by `scripts/prepare-aistudio-v6-preview-source.sh`. The public V6 interface exposes the general activities directory, business profiles, public catalog and contact page; the dedicated medical directory page, route, navigation item and homepage CTA are excluded from the public build. Existing business records are not deleted by this UI change. Do not confuse that deployed V6 source with the newer R6 archive `bizcatalog-manager (6).zip`: R6 remains a separate, local-only integration candidate and has not been imported into this repository or published. Preserve the legacy catalog and rollback path; do not replace the root with R6 until the exact R6 source is imported, security-hardened, built, tested in an isolated Preview, and explicitly accepted. The full platform gate remains `BLOCKED / NOT CERTIFIED` while Auth/RBAC, shared persistence, migration/schema parity, payment/finance, backup/restore, Edge Function and remaining module runtime evidence are unresolved.


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
