#!/usr/bin/env bash
set -euo pipefail

: "${DB_URL:?DB_URL must point to the disposable PostgreSQL 17 test database}"
tmp_dir="$(mktemp -d)"
pid_one=""
pid_two=""
cleanup() {
  if [[ -n "$pid_one" ]]; then wait "$pid_one" 2>/dev/null || true; fi
  if [[ -n "$pid_two" ]]; then wait "$pid_two" 2>/dev/null || true; fi
  psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 <<'SQL' >/dev/null 2>&1 || true
DROP TRIGGER IF EXISTS trg_rc498_delay_order_idempotency_test ON public.orders;
DROP FUNCTION IF EXISTS public.rc498_test_delay_order_idempotency_insert();
DELETE FROM public.orders WHERE tenant_id='tenant-a' AND client_idempotency_key='concurrent-order-key-rc498';
SQL
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 <<'SQL'
CREATE OR REPLACE FUNCTION public.rc498_test_delay_order_idempotency_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.client_idempotency_key = 'concurrent-order-key-rc498' THEN
    PERFORM pg_sleep(1.5);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_rc498_delay_order_idempotency_test ON public.orders;
CREATE TRIGGER trg_rc498_delay_order_idempotency_test
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.rc498_test_delay_order_idempotency_insert();
SQL

run_order() {
  local order_id="$1"
  local output="$2"
  psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 >"$output" <<SQL
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false) AS _sub \\gset
SELECT set_config('request.jwt.claim.role','authenticated',false) AS _role \\gset
SELECT public.create_order_backend(
  '$order_id',
  'tenant-a',
  '20000000-0000-4000-8000-000000000001',
  'branch-a',
  '10000000-0000-4000-8000-000000000001',
  'concurrent-order-key-rc498',
  0,0,0,0,0,'EGP','Customer One','01000000000','Concurrent idempotency test',
  '[{"catalogItemId":"40000000-0000-4000-8000-000000000001","quantity":1,"selectedOptionIds":[]}]'::jsonb,
  null,'{}'::jsonb
);
SQL
}

run_order "30000000-0000-4000-8000-000000000096" "$tmp_dir/one.json" &
pid_one=$!
sleep 0.2
run_order "30000000-0000-4000-8000-000000000097" "$tmp_dir/two.json" &
pid_two=$!
wait "$pid_one"
pid_one=""
wait "$pid_two"
pid_two=""

node --input-type=commonjs - "$tmp_dir/one.json" "$tmp_dir/two.json" <<'NODE'
const fs = require("node:fs");
const [onePath, twoPath] = process.argv.slice(2);
const one = JSON.parse(fs.readFileSync(onePath, "utf8").trim());
const two = JSON.parse(fs.readFileSync(twoPath, "utf8").trim());
if (!one.id || one.id !== two.id) throw new Error("Concurrent retries did not converge on one canonical order ID");
if (Number(one.idempotent) + Number(two.idempotent) !== 1) {
  throw new Error("Exactly one concurrent order call must create; the other must replay idempotently");
}
console.log("RC498_CONCURRENT_ORDER_IDEMPOTENCY=PASS");
NODE

count="$(psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM public.orders WHERE tenant_id='tenant-a' AND client_idempotency_key='concurrent-order-key-rc498'")"
if [[ "$count" != "1" ]]; then
  echo "Expected one order for concurrent idempotency key; found $count" >&2
  exit 1
fi
