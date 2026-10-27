# MantiqatiX

**MantiqatiX** is the sole official public brand name of the platform. There is no customer-facing abbreviation or shortened brand identity.

Product model: **Customer ↔ Service Provider** with an **Operational Service Map** only when location is operationally necessary.

Internal technical identifiers that use legacy `MNTY` naming may remain where required for database contracts, migrations, APIs, validation scripts, compatibility, or security boundaries. They are implementation identifiers, not public branding.

SMM storefront: **deferred from initial launch**. `web/smm.html` is a `noindex` informational placeholder; the retired interactive browser client has been removed. The `smm-gateway` source, authorization tests, and historical database migrations remain intentionally in place for security and compatibility, with execution default-denied until a separately reviewed post-launch release.

Production web deployment: `.github/workflows/pages.yml` builds `apps/catalog-frontend/` and publishes the validated `apps/catalog-frontend/dist` artifact only when the full production verifier succeeds. The legacy `web/` tree is still used by source-contract/compatibility checks; it is not the deployed artifact directory in this workflow.


## Project continuity (required for contributors and AI sessions)
- Start every work session with [Project Continuity & Production Handoff](docs/PROJECT_CONTINUITY.md).
- Read the chronological [Session Log](docs/SESSION_LOG.md) and [Master Production TODO](docs/MASTER_PRODUCTION_TODO.md) before continuing.
- Record every material decision, code change, test, blocker, and next action in the session log. Do not mark a gate verified without evidence.
