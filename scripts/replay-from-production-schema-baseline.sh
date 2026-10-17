#!/usr/bin/env bash
set -euo pipefail

ROOT="${GITHUB_WORKSPACE:-$(git rev-parse --show-toplevel)}"
cd "$ROOT"
: "${LOCAL_DB_URL:?LOCAL_DB_URL must point only to the disposable local Supabase database}"
node -e 'const u = new URL(process.env.LOCAL_DB_URL); if (!["127.0.0.1", "localhost", "::1"].includes(u.hostname) || u.port !== "54322") { console.error("BASELINE_BLOCKED: refusing to run against a non-local/non-disposable database URL"); process.exit(1); }'

export REQUIRE_BASELINE_REVIEW=1
node scripts/validate-production-schema-baseline.mjs --verify

MANIFEST="supabase/tests/baselines/production_schema_snapshot.manifest.json"
SNAPSHOT="supabase/tests/baselines/production_schema_snapshot.sql"
RECONCILIATION="docs/release/production-migration-reconciliation.json"
CHECKPOINT="$(node -e 'const m=require("./supabase/tests/baselines/production_schema_snapshot.manifest.json"); process.stdout.write(m.last_applied_migration_version)')"
ALIAS_VERSION="$(node -e 'const m=require("./docs/release/production-migration-reconciliation.json"); process.stdout.write(m.rc424_reconciliation?.source_filename_version || "")')"
ALIAS_LEDGER_VERSION="$(node -e 'const m=require("./docs/release/production-migration-reconciliation.json"); process.stdout.write(m.rc424_reconciliation?.ledger_version || "")')"
ALIAS_MATCH="$(node -e 'const m=require("./docs/release/production-migration-reconciliation.json"); process.stdout.write(String(m.rc424_reconciliation?.exact_statement_match === true))')"

[[ "$CHECKPOINT" =~ ^[0-9]{14}$ ]] || { echo "BASELINE_BLOCKED: invalid ledger checkpoint"; exit 1; }
[[ -f "$SNAPSHOT" && -f "$RECONCILIATION" ]] || { echo "BASELINE_BLOCKED: required baseline/reconciliation artifact missing"; exit 1; }
if [[ "$ALIAS_MATCH" != "true" || ! "$ALIAS_LEDGER_VERSION" =~ ^[0-9]{14}$ || ! "$ALIAS_VERSION" =~ ^[0-9]{14}$ ]]; then
  echo "BASELINE_BLOCKED: RC424 source/ledger identity mapping is not verified."
  exit 1
fi

# Restore the schema snapshot into the disposable local Supabase database only.
# The local public schema is cleared first; the production database URL is never used here.
psql "$LOCAL_DB_URL" -X -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE;"
if grep -Eiq '^CREATE SCHEMA public\s*;' "$SNAPSHOT"; then
  psql "$LOCAL_DB_URL" -X -v ON_ERROR_STOP=1 -f "$SNAPSHOT"
else
  psql "$LOCAL_DB_URL" -X -v ON_ERROR_STOP=1 -c "CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT USAGE ON SCHEMA public TO PUBLIC;"
  psql "$LOCAL_DB_URL" -X -v ON_ERROR_STOP=1 -f "$SNAPSHOT"
fi

mkdir -p artifacts/baseline-forward-replay
REPORT="artifacts/baseline-forward-replay/migrations-applied.txt"
: > "$REPORT"
declare -A seen_versions=()
pending_count=0
while IFS= read -r file; do
  name="$(basename "$file")"
  version="${name%%_*}"
  [[ "$version" =~ ^[0-9]{14}$ ]] || { echo "BASELINE_BLOCKED: invalid migration version in $name"; exit 1; }
  [[ "$version" > "$CHECKPOINT" ]] || continue

  # RC424's deployed ledger version differs from its source filename version.
  # The verified exact-statement mapping prevents replaying that already-applied source.
  if [[ "$version" == "$ALIAS_VERSION" && ( "$ALIAS_LEDGER_VERSION" < "$CHECKPOINT" || "$ALIAS_LEDGER_VERSION" == "$CHECKPOINT" ) ]]; then
    echo "SKIP_APPLIED_LEDGER_ALIAS $name ledger_version=$ALIAS_LEDGER_VERSION exact_statement_match=true" | tee -a "$REPORT"
    continue
  fi

  if [[ -n "${seen_versions[$version]:-}" ]]; then
    echo "BASELINE_BLOCKED: duplicate forward migration version $version: ${seen_versions[$version]} and $name"
    exit 1
  fi
  seen_versions[$version]="$name"
  pending_count=$((pending_count + 1))
  echo "APPLY $name sha256=$(sha256sum "$file" | awk '{print $1}')" | tee -a "$REPORT"
  psql "$LOCAL_DB_URL" -X -v ON_ERROR_STOP=1 -f "$file"
done < <(find supabase/migrations -maxdepth 1 -type f -name '*.sql' -print | sort)

if [[ "$pending_count" -eq 0 ]]; then
  echo "BASELINE_BLOCKED: no forward migrations were replayed; evidence would be vacuous."
  exit 1
fi

echo "POST_REPLAY_CHECK counter_offer_rpc_privilege_contract.sql" | tee -a "$REPORT"
psql "$LOCAL_DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/baselines/counter_offer_rpc_privilege_contract.sql 2>&1 | tee -a "$REPORT"

{
  echo
  echo "status=PASS"
  echo "strategy=reviewed production schema snapshot + forward migrations"
  echo "checkpoint=$CHECKPOINT"
  echo "forward_migration_count=$pending_count"
  echo "snapshot_sha256=$(sha256sum "$SNAPSHOT" | awk '{print $1}')"
} >> "$REPORT"

echo "BASELINE_FORWARD_REPLAY=PASS"
echo "BASELINE_CHECKPOINT=$CHECKPOINT"
echo "FORWARD_MIGRATIONS_APPLIED=$pending_count"
echo "REPLAY_REPORT=$REPORT"
