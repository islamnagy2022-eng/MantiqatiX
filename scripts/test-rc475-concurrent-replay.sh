#!/usr/bin/env bash
set -euo pipefail

pg_container="${1:?Usage: run-rc475-concurrent-replay.sh <postgres-container-id> [database]}"
database="${2:-mantiqatix_rc428_430_test}"
psql_exec() {
  docker exec "$pg_container" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$database" "$@"
}

# Use the same disposable tenant/business and commission rule as the sequential
# integration fixture, but isolate this order and payment intent.
psql_exec -c "
  INSERT INTO public.orders
    (id,tenant_id,business_id,payment_method,status,total,currency,pricing_version,pricing_hash,pricing_authority)
  VALUES
    ('30000000-0000-4000-8000-000000004299','tenant-a',
     '20000000-0000-4000-8000-000000004281','PAYMOB','PENDING',100,'EGP',7,'pricing-hash-a','catalog_v1');
  INSERT INTO public.payment_intents
    (id,tenant_id,order_id,amount,currency,status,provider,provider_order_id,payment_method,pricing_version,pricing_hash)
  VALUES
    ('pi-concurrent','tenant-a','30000000-0000-4000-8000-000000004299',
     100,'EGP','PENDING','PAYMOB','paymob-order-concurrent','PAYMOB',7,'pricing-hash-a');
  CREATE OR REPLACE FUNCTION public.rc475_test_delay_concurrent_success()
  RETURNS trigger LANGUAGE plpgsql AS \$function\$
  BEGIN
    IF NEW.id = 'pi-concurrent'
       AND NEW.status = 'SUCCEEDED'
       AND current_setting('mantiqatix_test.rc475_delay', true) = 'true' THEN
      PERFORM pg_catalog.pg_sleep(1);
    END IF;
    RETURN NEW;
  END;
  \$function\$;
  CREATE TRIGGER rc475_test_delay_concurrent_success
    BEFORE UPDATE ON public.payment_intents
    FOR EACH ROW EXECUTE FUNCTION public.rc475_test_delay_concurrent_success();
"

# Session A deliberately pauses inside the successful intent update while it
# owns the provider-event advisory lock. Session B then submits the same signed
# provider event from a separate PostgreSQL connection.
docker exec "$pg_container" psql -X -Atq -v ON_ERROR_STOP=1 -U postgres -d "$database" -c "
  BEGIN;
  SET LOCAL mantiqatix_test.rc475_delay = 'true';
  SELECT public.process_verified_provider_payment(
    'evt-concurrent','tenant-a','PAYMOB','paymob:txn-concurrent','pi-concurrent',
    'TRANSACTION',true,100,'EGP',100
  );
  COMMIT;
" > /tmp/rc475-concurrent-session-a.log &
pid_a=$!

sleep 0.2

docker exec "$pg_container" psql -X -Atq -v ON_ERROR_STOP=1 -U postgres -d "$database" -c "
  SELECT public.process_verified_provider_payment(
    'evt-concurrent','tenant-a','PAYMOB','paymob:txn-concurrent','pi-concurrent',
    'TRANSACTION',true,100,'EGP',100
  );
" > /tmp/rc475-concurrent-session-b.log &
pid_b=$!

wait "$pid_a"
wait "$pid_b"

grep -Eq '"idempotent"[[:space:]]*:[[:space:]]*false' /tmp/rc475-concurrent-session-a.log
grep -Eq '"idempotent"[[:space:]]*:[[:space:]]*true' /tmp/rc475-concurrent-session-b.log

event_count="$(psql_exec -Atq -c "SELECT count(*) FROM public.payment_provider_events WHERE external_event_id='paymob:txn-concurrent';")"
reconciliation_count="$(psql_exec -Atq -c "SELECT count(*) FROM public.payment_financial_reconciliations WHERE payment_intent_id='pi-concurrent' AND provider_event_id='paymob:txn-concurrent' AND reconciliation_status='RECONCILED';")"
commission_count="$(psql_exec -Atq -c "SELECT count(*) FROM public.commission_transactions WHERE order_id='30000000-0000-4000-8000-000000004299';")"
intent_status="$(psql_exec -Atq -c "SELECT status FROM public.payment_intents WHERE id='pi-concurrent';")"

test "$event_count" = "1"
test "$reconciliation_count" = "1"
test "$commission_count" = "1"
test "$intent_status" = "SUCCEEDED"

echo "RC475 concurrent Paymob replay: PASS (first=false, replay=true, event=1, reconciliation=1, commission=1)"
