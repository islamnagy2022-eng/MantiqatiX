#!/usr/bin/env bash
set -uo pipefail

mkdir -p artifacts
report="artifacts/migration-source-chain-report.json"
log="artifacts/migration-clean-replay.log"
: > "$log"

if ! node scripts/verify-migration-source-chain.mjs --report "$report" > artifacts/migration-source-chain-validator.stdout 2> artifacts/migration-source-chain-validator.stderr; then
  {
    echo "STATUS=BLOCKED"
    echo "STAGE=SOURCE_PREFLIGHT"
    echo "DETAIL=Source chain contains missing/invalid/ambiguous migration inputs; SQL replay was not started."
    cat artifacts/migration-source-chain-validator.stderr
  } | tee "$log"
  exit 1
fi

mapfile -t migration_paths < <(
  find supabase/migrations supabase/recovered-migrations -type f -name '*.sql' -printf '%f\t%p\n' \
    | sort -t $'\t' -k1,1 -u \
    | cut -f2-
)

if (("${#migration_paths[@]}" == 0)); then
  echo "STATUS=BLOCKED: no migration SQL files found" | tee "$log"
  exit 1
fi

{
  echo "STATUS=STARTED"
  echo "DATABASE=disposable PostgreSQL only"
  echo "MIGRATION_COUNT=${#migration_paths[@]}"
  echo "ORDER=ascending full filename; no migrations are skipped"
} | tee -a "$log"

# Standard Supabase database roles are environment prerequisites, not application-schema stubs.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c 'CREATE ROLE anon NOLOGIN' >> "$log" 2>&1
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c 'CREATE ROLE authenticated NOLOGIN' >> "$log" 2>&1 || true
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c 'CREATE ROLE service_role NOLOGIN' >> "$log" 2>&1 || true

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
      echo "No later migration was attempted."
    } | tee -a "$log"
    exit 1
  fi
done

{
  echo "STATUS=PASS"
  echo "APPLIED_MIGRATIONS=$count"
  echo "FIRST_FAILED_MIGRATION=NONE"
} | tee -a "$log"
