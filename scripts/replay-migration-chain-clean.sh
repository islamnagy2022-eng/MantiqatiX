#!/usr/bin/env bash
set -euo pipefail

mkdir -p artifacts
report="artifacts/migration-source-chain-report.json"
log="artifacts/migration-clean-replay.log"
: > "$log"

# Diagnostic replay is deliberately separate from strict release certification.
# Version collisions are retained and ordered by the explicit source-control tie-break
# manifest in the validator; no SQL migration is skipped or renamed.
if ! node scripts/verify-migration-source-chain.mjs --diagnostic-replay --report "$report" > artifacts/migration-source-chain-validator.stdout 2> artifacts/migration-source-chain-validator.stderr; then
  {
    echo "STATUS=BLOCKED"
    echo "STAGE=SOURCE_PREFLIGHT"
    echo "DETAIL=Missing/invalid sources or an unreviewed collision prevented even diagnostic replay."
    cat artifacts/migration-source-chain-validator.stderr
  } | tee "$log"
  exit 1
fi

mapfile -t migration_paths < <(node -e '
  const r = require("./artifacts/migration-source-chain-report.json");
  if (!r.diagnosticReplay || !r.replayMayStart || !Array.isArray(r.replayOrder)) process.exit(2);
  for (const p of r.replayOrder) console.log(p);
')

if (("${#migration_paths[@]}" == 0)); then
  echo "STATUS=BLOCKED: no migration SQL files found" | tee "$log"
  exit 1
fi

{
  echo "STATUS=STARTED_DIAGNOSTIC_ONLY"
  echo "DATABASE=disposable PostgreSQL only"
  echo "MIGRATION_COUNT=${#migration_paths[@]}"
  echo "ORDER=ascending filename version; reviewed source-control chronology breaks legacy timestamp ties"
  echo "CERTIFICATION=PROHIBITED while version collisions or production-source reconciliation remain open"
} | tee -a "$log"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c 'CREATE ROLE anon NOLOGIN' >> "$log" 2>&1
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c 'CREATE ROLE authenticated NOLOGIN' >> "$log" 2>&1
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c 'CREATE ROLE service_role NOLOGIN' >> "$log" 2>&1

count=0
for file in "${migration_paths[@]}"; do
  count=$((count + 1))
  echo "APPLYING[$count/${#migration_paths[@]}]=$file" | tee -a "$log"
  if ! psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file" >> "$log" 2>&1; then
    {
      echo "STATUS=FAIL"
      echo "FIRST_FAILED_MIGRATION=$file"
      echo "FAILURE_INDEX=$count"
      echo "APPLIED_BEFORE_FAILURE=$((count - 1))"
      echo "NO_LATER_MIGRATION_ATTEMPTED=true"
      echo "CERTIFICATION=BLOCKED"
    } | tee -a "$log"
    exit 1
  fi
done

{
  echo "STATUS=DIAGNOSTIC_SQL_PASS"
  echo "APPLIED_MIGRATIONS=$count"
  echo "FIRST_FAILED_MIGRATION=NONE"
  echo "CERTIFICATION=BLOCKED: diagnostic tie-breaks are not authoritative production chronology"
} | tee -a "$log"
