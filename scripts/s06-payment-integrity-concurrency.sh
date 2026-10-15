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


# Two distinct orders racing to claim one provider event must not both process it.
docker exec "$pg_container" psql -U postgres -d "$db" -v ON_ERROR_STOP=1 -c "
  INSERT INTO public.digital_page_orders
    (id,provider,amount,currency,provider_order_id,payment_status,fulfillment_status)
  VALUES
    ('10000000-0000-4000-8000-000000006097','PAYMOB',249.50,'EGP','s06-cross-order-a','PENDING','REQUESTED'),
    ('10000000-0000-4000-8000-000000006098','PAYMOB',249.50,'EGP','s06-cross-order-b','PENDING','REQUESTED');
"

call_cross_order_rpc() {
  local order_id="$1"
  local provider_order_id="$2"
  docker exec "$pg_container" psql -U postgres -d "$db" -X -A -t -v ON_ERROR_STOP=1 -c "
    SELECT public.process_verified_digital_page_payment_backend(
      '$order_id',
      'paymob:s06-cross-order-race',
      'TRANSACTION','SUCCEEDED',true,249.50,'EGP',
      's06-cross-order-race','$provider_order_id',
      '{\"suite\":\"S06\",\"case\":\"concurrent-cross-order\"}'::jsonb
    );
  "
}

call_cross_order_rpc '10000000-0000-4000-8000-000000006097' 's06-cross-order-a' > /tmp/s06-cross-order-a.json 2>&1 &
cross_a=$!
call_cross_order_rpc '10000000-0000-4000-8000-000000006098' 's06-cross-order-b' > /tmp/s06-cross-order-b.json 2>&1 &
cross_b=$!
if wait "$cross_a"; then cross_a_status=0; else cross_a_status=$?; fi
if wait "$cross_b"; then cross_b_status=0; else cross_b_status=$?; fi
cat /tmp/s06-cross-order-a.json
cat /tmp/s06-cross-order-b.json
if [[ "$cross_a_status" -eq "$cross_b_status" ]]; then
  echo "S06 cross-order replay expected exactly one accepted callback and one rejected callback" >&2
  exit 1
fi
grep -q 'DIGITAL_PAGE_EVENT_ORDER_MISMATCH' /tmp/s06-cross-order-a.json /tmp/s06-cross-order-b.json
error_count="$(grep -h -o 'DIGITAL_PAGE_EVENT_ORDER_MISMATCH' /tmp/s06-cross-order-a.json /tmp/s06-cross-order-b.json | wc -l)"
test "$error_count" -eq 1

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
  IF (SELECT count(*) FROM public.digital_page_payment_events WHERE external_event_id='paymob:s06-cross-order-race') <> 1 THEN
    RAISE EXCEPTION 'S06 concurrent cross-order race expected exactly one provider event';
  END IF;
  IF (SELECT count(*) FROM public.digital_page_orders WHERE id IN (
      '10000000-0000-4000-8000-000000006097',
      '10000000-0000-4000-8000-000000006098') AND payment_status='PAID') <> 1 THEN
    RAISE EXCEPTION 'S06 concurrent cross-order race must pay exactly one order';
  END IF;
  IF (SELECT count(*) FROM public.digital_page_orders WHERE id IN (
      '10000000-0000-4000-8000-000000006097',
      '10000000-0000-4000-8000-000000006098') AND payment_status='PENDING') <> 1 THEN
    RAISE EXCEPTION 'S06 concurrent cross-order race must leave the other order pending';
  END IF;
END
\$verify\$;
"
