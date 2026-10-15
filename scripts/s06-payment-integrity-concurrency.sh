#!/usr/bin/env bash
set -euo pipefail

# S06 concurrent duplicate-delivery regression.
# Argument: ID of the disposable PostgreSQL service container.
pg_container="${1:?usage: s06-payment-integrity-concurrency.sh <postgres-container-id>}"
db="mantiqatix_s06_payment_test"

docker exec "$pg_container" psql -U postgres -d "$db" -v ON_ERROR_STOP=1 -c "
  INSERT INTO public.digital_page_orders
    (id,provider,amount,currency,provider_order_id,payment_status,fulfillment_status)
  VALUES
    ('10000000-0000-4000-8000-000000006099','PAYMOB',249.50,'EGP',
     's06-concurrent-order','PENDING','REQUESTED');
"

call_rpc() {
  docker exec "$pg_container" psql -U postgres -d "$db" -X -A -t -v ON_ERROR_STOP=1 -c "
    SELECT public.process_verified_digital_page_payment_backend(
      '10000000-0000-4000-8000-000000006099',
      'paymob:s06-concurrent-duplicate',
      'TRANSACTION','SUCCEEDED',true,249.50,'EGP',
      's06-concurrent-duplicate','s06-concurrent-order',
      '{\"suite\":\"S06\",\"case\":\"concurrent-duplicate\"}'::jsonb
    );
  "
}

call_rpc > /tmp/s06-concurrent-1.json &
pid1=$!
call_rpc > /tmp/s06-concurrent-2.json &
pid2=$!
wait "$pid1"
wait "$pid2"

cat /tmp/s06-concurrent-1.json
cat /tmp/s06-concurrent-2.json
grep -q '"payment_status": "PAID"' /tmp/s06-concurrent-1.json
grep -q '"payment_status": "PAID"' /tmp/s06-concurrent-2.json
true_count="$(grep -h -o '"idempotent": true' /tmp/s06-concurrent-1.json /tmp/s06-concurrent-2.json | wc -l)"
false_count="$(grep -h -o '"idempotent": false' /tmp/s06-concurrent-1.json /tmp/s06-concurrent-2.json | wc -l)"
test "$true_count" -eq 1
test "$false_count" -eq 1

docker exec "$pg_container" psql -U postgres -d "$db" -v ON_ERROR_STOP=1 -c "
DO \$verify\$
DECLARE
  event_count integer;
  order_status text;
BEGIN
  SELECT count(*) INTO event_count
  FROM public.digital_page_payment_events
  WHERE external_event_id='paymob:s06-concurrent-duplicate';
  SELECT payment_status INTO order_status
  FROM public.digital_page_orders
  WHERE id='10000000-0000-4000-8000-000000006099';
  IF event_count <> 1 THEN
    RAISE EXCEPTION 'S06 concurrent duplicate expected one event, got %', event_count;
  END IF;
  IF order_status <> 'PAID' THEN
    RAISE EXCEPTION 'S06 concurrent duplicate expected PAID, got %', order_status;
  END IF;
END
\$verify\$;
"
