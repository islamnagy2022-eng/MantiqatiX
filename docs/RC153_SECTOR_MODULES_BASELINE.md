# RC153 — Sector Modules Baseline

Implemented web runtime modules:
- Fashion / Retail
- Education
- Jobs
- Used Items

The runtime reads only existing Supabase records and uses the existing RLS policies. Owner-scoped create flows were added for fashion products, jobs and used-item ads. Education is currently read/request oriented because its existing schema separates profiles and requests without a tenant/business scope.

Source:
- web/sector-modules.js
- web/index.html loads sector-modules.js

Commit: c96a5c99d9b476e19afca0e6e440557afe3b2337
Loader commit: da4886ab11fda73da5b3f09561e4508dd9c90198

Not verified: browser E2E, cross-user isolation, production CI for these commits.
