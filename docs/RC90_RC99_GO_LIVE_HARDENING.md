# MantiqatiX — RC90..RC99 / Go-Live Hardening Program

Date: 2026-09-27

This is a controlled continuation after RC89. A gate is PASS only when its required evidence exists.

| Gate | Objective | Current status |
|---|---|---|
| RC90 | Release configuration freeze | READY TO EXECUTE |
| RC91 | Auth production configuration verification | BLOCKED / external |
| RC92 | Multi-user / multi-tenant authorization E2E | BLOCKED / external |
| RC93 | Storage isolation E2E | BLOCKED / external |
| RC94 | Payment provider production E2E | BLOCKED / external |
| RC95 | Android release build/signing/device | BLOCKED / external |
| RC96 | Backup restore drill | BLOCKED / external |
| RC97 | Production observability verification | REVIEW |
| RC98 | Final regression + security evidence pack | BLOCKED until RC91-RC96 evidence |
| RC99 | Go-Live authorization | BLOCKED until all mandatory gates PASS |

## RC90 — Release configuration freeze

Before final certification:
- freeze production schema changes except emergency security fixes;
- freeze public API contract changes;
- freeze branding/identity changes;
- record exact Git commit, Edge Function versions, database migration head, and production configuration snapshot;
- create a rollback decision record.

No release is certified from an unrecorded moving target.

## RC91 — Auth

Verify in the production Auth configuration:
- leaked-password protection enabled;
- email confirmation behavior;
- anonymous session rejection on protected functions;
- session expiry/logout behavior;
- recovery flow;
- production redirect URLs.

No source-only assertion substitutes for dashboard/runtime evidence.

## RC92 — Authorization E2E

Use authorized non-production or explicitly approved test identities only. Verify:
- customer cannot read another customer's order/payment;
- provider cannot cross tenant boundaries;
- operational roles can perform only assigned actions;
- registration approval creates the intended active membership;
- role switching cannot escalate beyond allowed roles.

No production test account is to be created without explicit authorization.

## RC93 — Storage E2E

Verify with two isolated identities/tenants:
- owner access;
- cross-user denial;
- cross-tenant denial;
- authorized business access;
- deletion/update boundaries;
- signed URL/media consumer behavior.

## RC94 — Payment E2E

Verify using the configured provider and approved test/production procedure:
- authoritative amount;
- pricing hash/version binding;
- idempotency;
- success/failure/cancel/replay;
- webhook authenticity;
- payment-to-order correlation;
- financial persistence.

Never use fabricated payment success to close this gate.

## RC95 — Android release

Verify:
- release compilation;
- AAB/APK signing;
- package/version metadata;
- production endpoint configuration;
- physical-device login/session;
- customer/provider flows;
- payment/order UI;
- offline/retry behavior;
- crash-free critical paths.

## RC96 — Backup/restore

Perform an isolated restore and verify:
- schema;
- RLS/policies;
- critical RPCs;
- auth dependencies;
- storage references;
- representative non-sensitive test data;
- application connectivity.

Record measured RPO/RTO. Do not claim restore success without executing it.

## RC97 — Observability

Verify:
- Edge Function logs;
- database error visibility;
- request IDs where implemented;
- payment failure tracing;
- operational alerts;
- crash reporting path.

## RC98 — Final evidence pack

Bundle:
- exact release commit;
- CI result;
- production function versions;
- migration state;
- Auth configuration evidence;
- authorization E2E results;
- Storage E2E results;
- payment E2E results;
- Android build/signing/device results;
- restore evidence;
- regression/security results;
- rollback procedure.

## RC99 — Go-Live authorization

PASS only when every mandatory external gate has evidence. Otherwise status remains BLOCKED/UNVERIFIED.

### Non-negotiable release rule

Do not create fake accounts, fake transactions, speculative migrations, fabricated CI results, fabricated device tests, or fabricated provider responses merely to close a gate.


## RC90 live freeze checkpoint — 2026-09-27

Repository:
- default branch: main
- latest commit: 12e48883cfc44e562949e190ee9c0ce5ff169e64
- repository is public and not archived

Production Edge Functions previously verified:
- api v8 ACTIVE / JWT required
- order-create v1 ACTIVE / JWT required
- order-status-update v1 ACTIVE / JWT required
- mnty-registration-review v3 ACTIVE / JWT required
- payment-intent v3 ACTIVE / JWT required
- settlement-create v3 ACTIVE / JWT required

Freeze rule:
- No production schema or Edge Function mutation is performed merely to close RC90.
- Emergency security changes remain allowed if required.
- Final certification must reference an exact repository commit and exact production function versions.
- Production migration drift remains a release evidence item and is not silently reconciled.

RC90 status: **CHECKPOINT RECORDED**.
