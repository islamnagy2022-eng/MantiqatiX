#!/usr/bin/env bash
set -euo pipefail

pg_container="$(docker ps --filter 'ancestor=postgres:16' --format '{{.ID}}' | head -n 1)"
test -n "$pg_container"

first_sql="BEGIN; SET test.pause_directory_claim='on'; SELECT public.review_directory_listing_claim_atomic('40000000-0000-4000-8000-000000000006','APPROVED','10000000-0000-4000-8000-000000000003','concurrent winner','20000000-0000-4000-8000-000000000005',true,true); COMMIT;"
second_sql="BEGIN; SELECT public.review_directory_listing_claim_atomic('40000000-0000-4000-8000-000000000007','APPROVED','10000000-0000-4000-8000-000000000003','concurrent loser','20000000-0000-4000-8000-000000000005',true,true); COMMIT;"

docker exec "$pg_container" psql -U postgres -d mantiqatix_directory_claim_test -v ON_ERROR_STOP=1 -c "$first_sql" > /tmp/claim-first.log 2>&1 &
first_pid=$!
sleep 0.25

if docker exec "$pg_container" psql -U postgres -d mantiqatix_directory_claim_test -v ON_ERROR_STOP=1 -c "$second_sql" > /tmp/claim-second.log 2>&1; then
  echo "FAIL: second concurrent approval unexpectedly succeeded"
  cat /tmp/claim-second.log
  exit 1
fi

wait "$first_pid"
grep -q 'APPROVED' /tmp/claim-first.log || {
  cat /tmp/claim-first.log
  echo "FAIL: first concurrent approval did not commit"
  exit 1
}
grep -q 'BUSINESS_ALREADY_HAS_OWNER' /tmp/claim-second.log || {
  cat /tmp/claim-second.log
  echo "FAIL: second approval did not fail on the serialized owner conflict"
  exit 1
}

cat <<'SQL' | docker exec -i "$pg_container" psql -U postgres -d mantiqatix_directory_claim_test -v ON_ERROR_STOP=1
DO $verify$
DECLARE
  v_owner_count integer;
  v_first_status text;
  v_second_status text;
BEGIN
  SELECT count(*) INTO v_owner_count
  FROM public.user_memberships
  WHERE business_id='20000000-0000-4000-8000-000000000005'
    AND status='ACTIVE' AND role='BUSINESS_OWNER';
  SELECT status INTO v_first_status FROM public.directory_listing_claim_requests
  WHERE id='40000000-0000-4000-8000-000000000006';
  SELECT status INTO v_second_status FROM public.directory_listing_claim_requests
  WHERE id='40000000-0000-4000-8000-000000000007';
  IF v_owner_count <> 1 OR v_first_status <> 'APPROVED' OR v_second_status <> 'PENDING' THEN
    RAISE EXCEPTION 'concurrent claim invariant failed: owners %, first %, second %',
      v_owner_count, v_first_status, v_second_status;
  END IF;
END;
$verify$;
SQL

echo "DIRECTORY_CLAIM_CONCURRENCY=PASS"
