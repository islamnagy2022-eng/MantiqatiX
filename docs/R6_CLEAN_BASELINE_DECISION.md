# MantiqatiX — R6 Clean Baseline Decision

Date: 2026-11-09
Status: APPROVED DEVELOPMENT DIRECTION — SOURCE IMPORT AND DEPLOYMENT STILL BLOCKED

## 1. Authoritative application

The owner-selected `bizcatalog-manager (6).zip` is the sole application baseline for the next build. It is not a patch target for RC40, V6, or the previous catalog application. The new application owns the UI, routes, components, workflows, and product behavior.

Do not merge old application screens, layouts, state stores, or duplicated modules into R6 merely to preserve history. Do not replace the R6 interface with old interfaces.

## 2. What may be reused from older sources

Older sources are reference material only. Reuse an item only after documenting:
- the exact capability missing from R6;
- the source file, migration, or contract that implements it;
- compatibility with the R6 architecture;
- security and data impact;
- tests proving the integrated capability.

Potentially reusable capabilities are limited to:
- Google OAuth / Supabase Auth configuration and callback handling;
- Supabase client initialization and typed API contracts;
- backend authorization and RLS policies;
- database schema migrations that match R6 entities;
- server-side integrations and operational health checks;
- Android/mobile source tree, retained separately and not merged into the web UI.

Do not copy legacy application shells, duplicate dashboards, obsolete demo users, passwords, customer lists, transactions, sales, wallet balances, messages, backups, or production database dumps.

## 3. Data reset policy

All historical/demo operational data must be absent from the R6 application baseline:
- customers, leads, subscribers, and user fixtures;
- orders, sales, invoices, payments, refunds, wallets, and balances;
- chat/messages, support tickets, and notification history;
- old analytics counters and fabricated KPI totals;
- backup manifests and local production database files.

Only reviewed directory/catalog seed content explicitly selected for public directory presentation may remain. It must be labeled unverified until verified by the owner or trusted source. New operational data starts empty.

Never import `.data/`, database dumps, backups, service-role keys, production tokens, or user password hashes into the source repository.

## 4. Supabase and authentication boundary

The application should use Supabase as the authoritative shared backend after schema reconciliation. Use:
- a publishable/anon key in the browser only;
- service-role/secret keys only in server-side secret storage;
- Google OAuth client secrets only in provider/server secret settings;
- RLS and server-side authorization for every sensitive table and mutation.

Do not point a public Preview at the existing production database. Build a clean isolated Preview database from reviewed R6-compatible migrations. Do not reset, truncate, or delete the existing production Supabase project as part of this development task.

Before production cutover, reconcile migrations and schema against the actual production project, run read-only checks, verify backup/restore, and prepare a reversible migration plan. Any destructive production-data deletion requires a separate explicit approval naming the exact project and scope.

## 5. Repository cleanup policy

The R6 app must be the only active web application under the new application root. Remove obsolete web application copies only after confirming they are not used by production Pages, rollback, Android, CI, migrations, or security compatibility. Keep mobile/Android source untouched.

Historical specs, security evidence, and migration provenance may remain under `docs/archive/` if they are still needed for traceability; they must not be runtime dependencies.

## 6. Release gates

The source ZIP must be imported and hash-verified before CI can build it. Required gates:
1. clean install from a committed lockfile;
2. typecheck and tests;
3. production build;
4. Docker build and container health;
5. Auth: Google sign-in, callback, session refresh, logout;
6. RLS/RBAC tests and tenant isolation;
7. schema/migration parity on isolated Preview Supabase;
8. empty operational data verification;
9. deployed-origin smoke tests;
10. production cutover only after explicit owner approval.

Current state: source ZIP not imported to this Git branch; build not verified; Preview URL not deployed. Production `main` remains unchanged.
