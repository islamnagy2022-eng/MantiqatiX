# PASS 1841–1850 — Publish-first Production release-gate recheck

**Date:** 2026-11-23
**Project:** `moyhiluyhjsujhwlyeuu` — MANTIQATIX FINAL
**Scope:** live release prerequisites for restoring the public activity-directory publication path.
**Inspection:** read-only Production SQL, deployed Edge source retrieval, current-main audit/runbook review.
**Production impact:** none. No DDL/DML, migration, Auth, RLS, GRANT, Storage, Edge deployment, payment, wallet, settlement, or public-data mutation.

## User priority

The user explicitly reprioritized work as: **publish first**. New activity discovery is paused until the public directory release gate advances.

## Fresh live evidence

| Check | Result |
|---|---:|
| Production migration ledger | 310 rows |
| Latest applied migration | `20261110150618` |
| Required exact release migration set | 0/76 applied (per current reconciliation manifest) |
| RC472 / RC473 | Both absent |
| `public.directory_listing_contact_consents` | Absent |
| Approved commercial source-permission evidence | 0 rows |
| Barakat El-Sabaa district PUBLISHED | 358 |
| Barakat El-Sabaa district DRAFT | 87 |
| Barakat El-Sabaa district HIDDEN | 9 |

These district counts describe database status only. They do not mean the records are currently served through the public activity-directory endpoint.

## Live directory Edge boundary

The deployed `directory-listings` function is ACTIVE v18 with `verify_jwt=false`. The deployed source is the deliberate one-file fail-closed mitigation:
- GET returns an empty listings array with `directoryDisabled=true`.
- POST rejects mutations with HTTP 503 and `DIRECTORY_LISTINGS_DISABLED_FOR_V1`.
- This is a temporary mitigation, not the final consent-aware feature and not restored public directory functionality.

Do not deploy the current-main consent-aware Edge entrypoint or RC472/RC473 independently. The database consent registry, exact migration chain, compatible complete Edge bundle, and post-deployment anonymous/owner tests must be coordinated.

## Backup and recovery gate

The Production organization is on the Free plan and the database is PostgreSQL 17.6.1.155. The canonical runbook requires:
1. Encrypted off-site database exports for roles, schema, and data.
2. Separate Storage object export, checksum/decryption verification, and off-site retrieval.
3. Vault key recovery or approved secret recreation; do not copy secrets into GitHub or chat.
4. Independent restore into a disposable PostgreSQL 17 environment.
5. Critical schema/row-count/RLS/ACL/Auth/Storage/Edge and financial-invariant checks.
6. Measured restore duration, RPO/RTO, rollback evidence, and independent reviewer sign-off.

No such complete operator-owned backup/restore evidence was available to verify in this session. The repository runbook explicitly notes the environment lacks the required Supabase CLI, PostgreSQL tools, Docker, protected database credentials, S3 credentials, encryption key custody, and off-site destination. Status remains **NOT VERIFIED / WAIT — operator-controlled recovery evidence required**.

## Source and rights boundary

- Current source contains the consent migrations and matching sanitizer/authorization implementation, but these are not proof of Production deployment.
- The live permission-evidence table currently contains zero approved commercial-republication records.
- Publicly visible directory records and third-party phone listings are not automatically licensed for commercial republication.
- Do not insert or publish scraped contact details until an allowed source basis or owner-submitted record with the required consent is recorded and verified.

## Release order

1. Operator produces encrypted off-site DB + Storage backup evidence and completes the isolated PostgreSQL 17 restore/rollback rehearsal.
2. Reconcile the exact 76-version chronological migration chain and physical schema/object/ACL dependencies against the live 310-row ledger.
3. Run exact-head disposable PostgreSQL 17 adversarial tests for platform-admin registry, tenant/business/branch scope, anonymous Auth boundaries, and directory consent.
4. Apply the coordinated ordered DB release, including RC472/RC473 and all prerequisite authorization migrations, in an approved Production window.
5. Deploy the complete matching Edge bundle only after DB compatibility is verified.
6. Verify anonymous no-consent negative cases, each field-specific consent grant/revoke/expiry path, owner scope, pagination, registry outage fail-closed behavior, and live source hash/version.
7. Re-enable public listing publication only after source-rights evidence and post-deployment checks pass.

## Actions performed in this continuation

- Re-read the canonical `MASTER_SOURCE_OF_TRUTH.md`, current live security audit, backup/restore runbook, production reconciliation manifest, and issues #876, #104, and #599.
- Rechecked the live migration ledger, consent table presence, approved source-permission count, and Barakat El-Sabaa aggregate listing statuses.
- Rechecked the deployed directory Edge source and confirmed the v18 disabled-mitigation code is still present.
- Added fresh read-only evidence comments to issues #876, #104, and #599 (comment IDs 7092698297, 7092698945, 7092699586).

## Decision

**PUBLIC DIRECTORY PUBLICATION: BLOCKED / WAIT. FULL PLATFORM: BLOCKED / NOT CERTIFIED.**

No records were added, changed, or published. Do not use an Edge deploy or direct SQL write as a shortcut. Resume the operator recovery gate first; keep additional local activity discovery paused until the publication path has a lawful, consent-aware release.