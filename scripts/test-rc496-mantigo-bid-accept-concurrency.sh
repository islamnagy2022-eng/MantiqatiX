#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must point to the disposable RC496 PostgreSQL test database}"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

run_attempt() {
  local bid_id="$1"
  local output_file="$2"
  local sql
  sql="DO \$\$
  DECLARE v_result jsonb;
  BEGIN
    PERFORM pg_catalog.set_config('request.jwt.claim.sub','49600000-0000-4000-8000-000000000001',false);
    BEGIN
      v_result := public.accept_mantigo_bid_backend(
        '49600000-0000-4000-8000-000000000001',
        'RC496-CONCURRENT',
        '$bid_id'
      );
      RAISE NOTICE 'RC496_CONCURRENT_RESULT=SUCCESS:%',v_result->>'accepted_bid_id';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'RC496_CONCURRENT_RESULT=DENIED:%',SQLERRM;
    END;
  END
  \$\$;"
  psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 -c "$sql" >"$output_file" 2>&1
}

run_attempt "RC496-CONCURRENT-A" "$tmp_dir/a.log" &
pid_a=$!
sleep 0.2
run_attempt "RC496-CONCURRENT-B" "$tmp_dir/b.log" &
pid_b=$!

wait "$pid_a"
wait "$pid_b"

cat "$tmp_dir/a.log" "$tmp_dir/b.log"
success_count="$(awk '/RC496_CONCURRENT_RESULT=SUCCESS:/{n++} END {print n+0}' "$tmp_dir"/*.log)"
denied_count="$(awk '/RC496_CONCURRENT_RESULT=DENIED:/{n++} END {print n+0}' "$tmp_dir"/*.log)"
expected_denial_count="$(awk '/RC496_CONCURRENT_RESULT=DENIED:RIDE_NOT_OPEN/{n++} END {print n+0}' "$tmp_dir"/*.log)"
test "$success_count" -eq 1
test "$denied_count" -eq 1
test "$expected_denial_count" -eq 1

state="$(psql "$DATABASE_URL" -X -At -v ON_ERROR_STOP=1 -c "
  SELECT
    (SELECT count(*) FROM public.mantigo_bids WHERE ride_id='RC496-CONCURRENT' AND status='ACCEPTED')::text || ':' ||
    (SELECT count(*) FROM public.mantigo_bids WHERE ride_id='RC496-CONCURRENT' AND status='REJECTED')::text || ':' ||
    (SELECT count(*) FROM public.mantigo_bids WHERE ride_id='RC496-CONCURRENT' AND status='OFFERED')::text || ':' ||
    coalesce((SELECT accepted_bid_id FROM public.mantigo_rides WHERE id='RC496-CONCURRENT'),'') || ':' ||
    (SELECT count(*) FROM public.rc496_financial_lock_calls WHERE ride_id='RC496-CONCURRENT')::text || ':' ||
    (SELECT count(*) FROM public.audit_logs WHERE action='MANTIGO_BID_ACCEPTED' AND entity_id='RC496-CONCURRENT')::text || ':' ||
    (SELECT count(*) FROM public.notifications WHERE type='MANTIGO_ACCEPTED' AND entity_id='RC496-CONCURRENT')::text
")"

case "$state" in
  "1:1:0:RC496-CONCURRENT-A:1:1:1"|"1:1:0:RC496-CONCURRENT-B:1:1:1") ;;
  *) echo "RC496 concurrent single-winner invariant failed: $state" >&2; exit 1 ;;
esac

echo "RC496 concurrent acceptance race: PASS (one winner, one denial, one fare lock, one audit, one notification)."
