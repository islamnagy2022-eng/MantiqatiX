# PASS 2391–2400 — Backup and restore capability read-back

**Source checkpoint:** \`main @ 46714e919d959e49afe5efa64e2fcd2f94a982d7\`  
**Production Supabase:** \`MANTIQATIX FINAL / moyhiluyhjsujhwlyeuu\`  
**Region:** \`us-east-2\`  
**Database:** PostgreSQL \`17.6.1.155\`, \`ACTIVE_HEALTHY\`  
**Method:** read-only Supabase project/branch metadata and connected-tool capability review. No backup/restore, project setting, branch creation, Production SQL, Storage, Auth, Vault or Edge mutation was performed.

## 1. Verified facts

| Item | Result | Interpretation |
|---|---|---|
| Production project | Active/healthy; PostgreSQL 17.6.1.155 | Project availability is not evidence of a restorable backup. |
| Plan tier | NOT EXPOSED by the connected \`get_project\` response | Cannot infer Pro/Team/Enterprise or Free. |
| Backup inventory/latest backup | NOT EXPOSED by connected Supabase tools | Backup existence, age, retention, encryption and downloadability are **UNVERIFIED**. |
| Supabase branches | Listing returned only the primary \`main\` entry for this project; no separate preview/restore branch appeared | No independent restore target has been demonstrated. The row's \`with_data=false\` is not proof of a populated restore. |
| GitHub Actions PostgreSQL 17 replay | Passed on exact PR heads #1086/#1087/#1088/#1089/#1090 | This proves source-chain testability against disposable CI schemas; it is **not** a restore from Production backup. |
| Database export | Not executed; no owner-held connection URL/credential was supplied to the runtime | No database dump/checksum exists in this session. |
| Storage object bytes | Not exported | Database metadata alone does not preserve object contents. |
| Auth configuration / external secrets | Not exported or restore-tested | Auth data in a database dump does not prove recovery of provider credentials, SMTP/OAuth configuration, JWT signing configuration, Vault keys or external secrets. |
| Restore drill / rollback | NOT PERFORMED | No measured RPO/RTO. |

## 2. Important backup distinction

Supabase's official backup documentation states that automated daily database backups are available on paid plans, while Free projects rely on owner-run logical exports. A database backup does **not** contain the actual Storage object bytes; those must be backed up separately. The plan tier for this project is not exposed in our connected read-back, so the existence of an automatic daily backup cannot be assumed.

Official references:
- [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase CLI database dump](https://supabase.com/docs/reference/cli/supabase-db-dump)
- [Supabase Storage management](https://supabase.com/docs/guides/storage/management)

## 3. Release gate

**BACKUP_RESTORE_GATE = BLOCKED / NOT VERIFIED.**

Do not execute Production migrations, DDL/DML, RLS/GRANT, Auth, Storage, Vault, Edge or payments until an owner-controlled encrypted backup is retrievable and a restore/rollback drill has passed. A green CI replay or healthy project status cannot replace this gate.

The exact owner-side procedure and evidence requirements are in [PRODUCTION_BACKUP_RESTORE_DRILL_20261124.md](../release/PRODUCTION_BACKUP_RESTORE_DRILL_20261124.md).
