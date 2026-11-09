# BizCatalog Manager (6) — Isolated Preview

Status: **STAGED — SOURCE ARCHIVE NOT YET COMMITTED; NOT DEPLOYED**

This branch is an isolated staging branch created from `main`:
`preview/bizcatalog-manager-6-isolated`

## Source of truth
The requested preview source is the user-provided archive `bizcatalog-manager (6).zip`.
It must be imported as its own application source. Existing repository application files and
historical production data must not be substituted for that archive.

## Data isolation requirements
- Do not import `.data/production-live-db.json`.
- Do not import any files under `.data/backups/`.
- Do not seed the preview from historical production/customer/business data.
- Review `src/data/seedData.ts` and retain only explicitly approved generic demo/reference
  content; otherwise initialize the preview empty.
- Use a separate preview database/project and separate credentials if a backend is connected.
- Never reuse production secrets, payment credentials, OAuth secrets, or webhook secrets.

## Deployment gate
The archive contains a React/Vite frontend and an Express server (`server.ts`).
GitHub Pages alone cannot run the Express backend. A Pages-only deployment must not be
presented as a fully functional application. The source must first be committed to this
branch, secrets/default credentials reviewed, and the deployment target chosen to support
the backend (or the frontend must be explicitly labeled as a static-only preview).

## Required next steps
1. Commit the sanitized archive source to this branch, excluding production DB/backups and
   local secrets.
2. Review seed data and server-side default secrets.
3. Configure isolated preview environment variables and database.
4. Run install, typecheck, build, and smoke tests.
5. Deploy to a separate preview URL and verify authentication, data isolation, and core flows.

The production/default branch is not changed by this staging operation.
