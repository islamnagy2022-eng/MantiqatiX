#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
job_id="a0000000-0000-4000-8000-000000000001"
actor_id="c0000000-0000-4000-8000-000000000002"
tmp_dir="$(mktemp -d)"
lock_log="$tmp_dir/deactivation.log"
application_log="$tmp_dir/application.log"
lock_pid=""
application_pid=""

cleanup() {
  if [[ -n "$application_pid" ]]; then kill "$application_pid" 2>/dev/null || true; fi
  if [[ -n "$lock_pid" ]]; then kill "$lock_pid" 2>/dev/null || true; fi
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

# Session A owns the job row first, then deactivates it before committing.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
  begin;
  select id from public.jobs where id = '$job_id' for update;
  select pg_sleep(5);
  update public.jobs set is_active = false where id = '$job_id';
  commit;
" >"$lock_log" 2>&1 &
lock_pid=$!

# Wait until Session A is demonstrably holding the row lock.
ready=0
for _ in $(seq 1 100); do
  count="$(psql "$DATABASE_URL" -Atq -c "select count(*) from pg_stat_activity where state='active' and query like 'select pg_sleep(5)%';")"
  if [[ "$count" -ge 1 ]]; then ready=1; break; fi
  sleep 0.05
done
if [[ "$ready" -ne 1 ]]; then
  echo "RC930_CONCURRENCY_FAIL: deactivation transaction did not acquire its lock" >&2
  exit 1
fi

# Session B calls the application RPC and must wait for Session A's lock.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL >"$application_log" 2>&1 &
set role authenticated;
select set_config('request.jwt.claim.sub', '$actor_id', false);
select public.submit_job_application_backend(
  '$actor_id', '$job_id', 'Race Applicant', '+201000000001', 'Experience', 'CV'
);
SQL
application_pid=$!

# Prove the RPC is blocked on a PostgreSQL lock rather than merely starting later.
waiting=0
for _ in $(seq 1 100); do
  count="$(psql "$DATABASE_URL" -Atq -c "select count(*) from pg_stat_activity where state='active' and wait_event_type='Lock' and query like '%submit_job_application_backend%';")"
  if [[ "$count" -ge 1 ]]; then waiting=1; break; fi
  if ! kill -0 "$application_pid" 2>/dev/null; then break; fi
  sleep 0.05
done
if [[ "$waiting" -ne 1 ]]; then
  wait "$lock_pid" || true
  if wait "$application_pid"; then
    echo "RC930_CONCURRENCY_FAIL: submission did not wait for deactivation" >&2
    exit 1
  fi
  if ! grep -q "JOB_NOT_ACTIVE" "$application_log"; then
    cat "$application_log" >&2
    echo "RC930_CONCURRENCY_FAIL: expected JOB_NOT_ACTIVE after deactivation" >&2
    exit 1
  fi
  echo "RC930_CONCURRENCY_PASS"
  exit 0
fi

wait "$lock_pid"
lock_pid=""
set +e
wait "$application_pid"
application_status=$?
set -e
application_pid=""
if [[ "$application_status" -eq 0 ]] || ! grep -q "JOB_NOT_ACTIVE" "$application_log"; then
  cat "$application_log" >&2
  echo "RC930_CONCURRENCY_FAIL: application was not rejected after serialized deactivation" >&2
  exit 1
fi

persisted="$(psql "$DATABASE_URL" -Atq -c "select count(*) from public.job_applications where job_id='$job_id' and applicant_user_id='$actor_id';")"
if [[ "$persisted" != "0" ]]; then
  echo "RC930_CONCURRENCY_FAIL: rejected application was persisted" >&2
  exit 1
fi

echo "RC930_CONCURRENCY_PASS"
