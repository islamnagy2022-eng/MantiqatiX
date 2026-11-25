# PASS 2451–2460 — Free-Plan Backup and Restore Capability Recheck

**Date:** 2026-11-25  
**Production:** `MANTIQATIX FINAL / moyhiluyhjsujhwlyeuu`  
**Organization:** `manteqti`  
**Method:** Connected Supabase organization/project/branch inspection, connector capability inventory, current official Supabase documentation and runbook source review.  
**Production impact:** Read-only. No database export, Storage download, Auth export, restore, project creation, plan change or Production mutation was performed.

## 1. Organization and backup tier

| Control | Read-back |
|---|---|
| Supabase organization | `manteqti` |
| Plan | **Free / tier_free** |
| Production project | `ACTIVE_HEALTHY` |
| PostgreSQL | `17.6.1.155` |
| Region | `us-east-2` |
| Automatic daily database backup entitlement | **Not included on Free** |
| Connected backup inventory action | **Not exposed by the connected Supabase tools** |
| Owner-created backup artifacts | **UNKNOWN / NOT EVIDENCED** |
| Successful independent restore drill | **NOT EVIDENCED** |
| Measured RPO / RTO | **NOT MEASURED** |

Supabase's current Backup documentation states that automatic daily DB backups are available on Pro/Team/Enterprise, recommends manual CLI logical exports and off-site copies for Free, and explicitly says DB backups do not include Storage object bytes. The connected tools in this workspace expose project/migration/branch/Edge metadata but no database-backup inventory action. Therefore this audit cannot claim that a manual export exists or does not exist. The owner must provide a timestamp, artifact path, size, SHA-256 and independent retrieval evidence.

## 2. Logical database dump scope

The current Supabase CLI reference documents `supabase db dump` as excluding Supabase-managed schemas by default, including:

- `auth`
- `storage`
- extension-managed schemas

It also states the default dump is schema-only; role and data dumps require separate options. A regular `roles.sql` + `schema.sql` + `data.sql` set is therefore **not a complete Supabase project backup**.

The supported CLI guide separately documents `supabase db diff --linked --schema auth,storage` for capturing custom schema changes in managed Auth/Storage schemas. That command is a schema-diff path, not an export of Auth user/identity records or Storage object bytes.

## 3. Auth, Storage, Edge and Vault recovery

| Component | Current evidence / required action |
|---|---|
| Auth user/identity records | Not included in the standard CLI logical dump. A separate supported recovery mechanism must be selected and proved in an isolated restore before release. |
| Auth configuration/API keys | Requires separate configuration/secret recovery; not supplied by the three logical SQL dumps. |
| Storage schema customizations | Capture separately through the documented Auth/Storage schema-diff path, inspect and test. |
| Storage object bytes | Must be exported independently with an object manifest, hashes, byte counts and retrieval test. |
| Edge Functions | Preserve canonical source, function names, versions, `verify_jwt`, import maps/`deno.json`, environment secret names and deployment config; never include secret values in GitHub. |
| Vault / encryption root key | Requires separate owner-controlled recovery evidence. Do not infer recovery from a database SQL dump alone. |

Supabase's current **Restore to a new project** documentation describes copying Auth user data and the encryption root key, but this feature is paid-plan-only and requires physical backups. It does not copy Storage objects/settings, Edge Functions, Auth settings/API keys, Realtime settings or extensions; these require manual reconfiguration. It is not an available Free-plan restoration path, and no paid project/branch was created for this audit.

## 4. Runbook correction

Updated `docs/release/PRODUCTION_BACKUP_RESTORE_DRILL_20261124.md` to:

- State the verified Free-plan entitlement and explicitly mark manual backup inventory unknown until artifact evidence is provided.
- Make clear that the standard CLI logical dump excludes `auth`, `storage` and extension-managed schemas.
- Separate Auth user/identity recovery from Auth schema-diff capture.
- Treat Storage object bytes and Storage schema/policy customizations as separate backup tasks.
- Clarify that the paid restore-to-new-project feature is not assumed available.
- Require an owner-controlled isolated restore, checksums, explicit exclusions, measured RPO/RTO and rollback proof.
- Preserve the official Supabase command pattern; no backup was created and no secret was supplied to this repository.

## 5. Required next evidence and release block

1. Owner creates database logical exports from a controlled workstation, records exact CLI version/commands/output/exclusions, encrypts them and verifies an off-site copy can be retrieved.
2. Owner supplies a separately exported Storage object set with bucket/key manifest, byte counts and SHA-256 checksums.
3. Owner selects and proves a supported Auth user/identity and Vault/encryption-key recovery path; ordinary CLI logical dump is insufficient.
4. Restore database, Auth, Storage and relevant configuration in a non-Production PostgreSQL 17/Supabase-compatible environment; resolve every warning.
5. Measure actual RPO/RTO and demonstrate rollback of the candidate DB + Edge release.
6. Only after the 83-source physical-effect and DB→RPC/ACL/RLS→Edge release matrices pass may an exact Production release be considered with explicit owner approval.

**Production mutations:** NONE.  
**Backup artifacts:** not created/verified by this audit.  
**Restore drill:** not performed.  
**Release status:** **BLOCKED / NOT CERTIFIED**.
