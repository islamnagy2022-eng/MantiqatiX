#!/usr/bin/env bash
set -euo pipefail

TEST_DATABASE="${PGDATABASE:-rc921_test}"
PSQL=(psql -h 127.0.0.1 -U postgres -d "$TEST_DATABASE" -v ON_ERROR_STOP=1)
PROVIDER_A='c0000000-0000-4000-8000-000000000001'

# The original production function has no explicit audit insert. A live,
# read-only catalog inspection also found no user trigger on medical_appointments.
# This test focuses on the actual concurrency invariant: a second transition
# must observe the first committed terminal state after waiting on FOR UPDATE.
"${PSQL[@]}" <<'SQL'
insert into public.medical_appointments
  (id, tenant_id, business_id, patient_id, doctor_id, status, updated_at)
values
  ('RC921-CONCURRENT', 'TENANT-A',
   'a0000000-0000-4000-8000-000000000001',
   'd0000000-0000-4000-8000-000000000099',
   'b0000000-0000-4000-8000-000000000001',
   'CONFIRMED', now());

create or replace function public.rc921_test_delay_completed()
returns trigger language plpgsql as $$
begin
  if new.status = 'COMPLETED' then
    perform pg_catalog.pg_sleep(1.5);
  end if;
  return new;
end;
$$;

create trigger rc921_test_delay_completed
before update on public.medical_appointments
for each row execute function public.rc921_test_delay_completed();
SQL

# Session A obtains the row lock, then pauses inside its update trigger.
"${PSQL[@]}" -c "set role authenticated; set request.jwt.claim.sub = '$PROVIDER_A'; select public.update_medical_appointment_status_backend('$PROVIDER_A', 'RC921-CONCURRENT', 'COMPLETED');" > /tmp/rc921-a.log 2>&1 &
pid_a=$!
sleep 0.25

# Session B attempts a competing terminal transition and must wait, then reject.
set +e
"${PSQL[@]}" -c "set role authenticated; set request.jwt.claim.sub = '$PROVIDER_A'; select public.update_medical_appointment_status_backend('$PROVIDER_A', 'RC921-CONCURRENT', 'CANCELLED');" > /tmp/rc921-b.log 2>&1
status_b=$?
set -e
wait "$pid_a"

if [ "$status_b" -eq 0 ]; then
  echo "RC921 concurrent competing transition unexpectedly succeeded"
  cat /tmp/rc921-b.log
  exit 1
fi
if ! grep -q "INVALID_MEDICAL_STATUS_TRANSITION" /tmp/rc921-b.log; then
  echo "RC921 concurrent transition failed for an unexpected reason"
  cat /tmp/rc921-b.log
  exit 1
fi

final_status=$("${PSQL[@]}" -Atc "select status from public.medical_appointments where id='RC921-CONCURRENT';")
if [ "$final_status" != "COMPLETED" ]; then
  echo "RC921 concurrent final state mismatch: $final_status"
  exit 1
fi

"${PSQL[@]}" -c "drop trigger rc921_test_delay_completed on public.medical_appointments; drop function public.rc921_test_delay_completed();"
echo "RC921 concurrent terminal transition serialization: PASS"
