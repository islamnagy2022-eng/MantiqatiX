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
| Plan tier | **FREE** — confirmed by organization-level \`get_organization\` read-back on 2026-11-25 | Supabase subscription is organization-based; automatic daily database backups are not included on Free. Manual owner-run CLI backups are required. |
| Backup inventory/latest backup | NOT EXPOSED by connected Supabase tools | Backup existence, age, retention, encryption and downloadability are **UNVERIFIED**. |
| Supabase branches | Listing returned only the primary \`main\` entry for this project; no separate preview/restore branch appeared | No independent restore target has been demonstrated. The row's \`with_data=false\` is not proof of a populated restore. |
| GitHub Actions PostgreSQL 17 replay | Passed on exact PR heads #1086/#1087/#1088/#1089/#1090 | This proves source-chain testability against disposable CI schemas; it is **not** a restore from Production backup. |
| Database export | Not executed; no owner-held connection URL/credential was supplied to the runtime | No database dump/checksum exists in this session. |
| Storage object bytes | Not exported | Database metadata alone does not preserve object contents. |
| Auth configuration / external secrets | Not exported or restore-tested | Auth data in a database dump does not prove recovery of provider credentials, SMTP/OAuth configuration, JWT signing configuration, Vault keys or external secrets. |
| Restore drill / rollback | NOT PERFORMED | No measured RPO/RTO. |

## 2. Important backup distinction

Supabase's official Free-plan backup guidance states that Free projects do not receive automatic daily database backups and must be backed up manually through the Supabase CLI. The connected organization read-back confirms this project is under the **Free** plan. Paid Pro/Team/Enterprise plans receive daily database backups according to the current Supabase backup guide. A database backup does **not** contain actual Storage object bytes; those must be exported and verified separately. No manual dump or Storage export was created during this review.

Official references:
- [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase CLI database dump](https://supabase.com/docs/reference/cli/supabase-db-dump)
- [Supabase Storage management](https://supabase.com/docs/guides/storage/management)

## 3. Release gate

**BACKUP_RESTORE_GATE = BLOCKED / NOT VERIFIED.**

Do not execute Production migrations, DDL/DML, RLS/GRANT, Auth, Storage, Vault, Edge or payments until an owner-controlled encrypted backup is retrievable and a restore/rollback drill has passed. A green CI replay or healthy project status cannot replace this gate.

The exact owner-side procedure and evidence requirements are in [PRODUCTION_BACKUP_RESTORE_DRILL_20261124.md](../release/PRODUCTION_BACKUP_RESTORE_DRILL_20261124.md).


## 4. Plan verification addendum — 2026-11-25

- Supabase organization \`manteqti\` (\`uahatcrnwfexfdmkrdkr\`) returned \`plan=free\` and \`tier=tier_free\` via \`get_organization\`. Organization plan applies to its projects.
- Official Free-plan FAQ, updated 2026-10-30: Free projects do not receive automatic backups; manual CLI backups are available.
- Official Database Backups guide, updated 2026-11-12: Pro/Team/Enterprise receive daily database backups (7/14/30-day retention respectively); Storage object bytes are not included in database backups.
- The backup inventory and last successful artifact timestamp remain unavailable through the connected tools. Do not convert that limitation into a claim that an owner-created manual backup does not exist; request retrievable artifact/checksum evidence during the owner-controlled drill.
- No plan upgrade, billing change, backup, restore or Production mutation was performed.

Official references: [Free-plan backups](https://supabase.com/kb/faqs/platform/free-plan-backups), [Database Backups](https://supabase.com/docs/guides/platform/backups).
