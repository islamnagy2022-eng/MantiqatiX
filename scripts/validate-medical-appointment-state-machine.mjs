import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath='supabase/migrations/20261019190000_rc457_medical_appointment_state_machine.sql';
const fixturePath='supabase/tests/rc457_medical_appointment_state_machine_fixture.sql';
const integrationPath='supabase/tests/rc457_medical_appointment_state_machine_integration.sql';
const workflowPath='.github/workflows/module-professionalization.yml';
const docsPath='docs/release/RC457_MEDICAL_APPOINTMENT_STATE_MACHINE.md';
const migration=fs.readFileSync(migrationPath,'utf8');
const fixture=fs.readFileSync(fixturePath,'utf8');
const integration=fs.readFileSync(integrationPath,'utf8');
const workflow=fs.readFileSync(workflowPath,'utf8');
const docs=fs.readFileSync(docsPath,'utf8');

assert.match(migration,/create or replace function public\.update_medical_appointment_status_backend/);
assert.match(migration,/set search_path\s*=\s*''/i,'SECURITY DEFINER function must use an empty search_path');
assert.match(migration,/for update/,'appointment row must be locked during transition');
assert.match(migration,/AUTH_USER_MISMATCH/);
assert.match(migration,/ACTIVE_MEMBERSHIP_REQUIRED/);
assert.match(migration,/MEDICAL_APPOINTMENT_NOT_CANCELLABLE/);
assert.match(migration,/INVALID_MEDICAL_STATUS_TRANSITION/);
assert.match(migration,/MEDICAL_APPOINTMENT_NOT_DUE/);
assert.match(migration,/PROVIDER_STATUS_CHANGE_REQUIRED/);
assert.match(migration,/upper\(v_old\) = 'BOOKED' and v_target = 'CONFIRMED'/);
assert.match(migration,/upper\(v_old\) = 'CONFIRMED' and v_target in \('COMPLETED','NO_SHOW'\)/);
assert.doesNotMatch(migration,/grant execute|revoke execute/i,'this migration must not alter function grants');
assert.match(fixture,/create function public\.update_medical_appointment_status_backend/);
assert.ok(fixture.includes('appt-cross-business'),'fixture must include same-tenant cross-business appointment');
assert.ok(integration.includes('appt-cross-business'),'integration must assert same-tenant cross-business denial');
assert.match(integration,/RC457_EXPECTED_REJECTION_MISSING/);
for(const marker of [
  'MEDICAL_APPOINTMENT_NOT_CANCELLABLE',
  'INVALID_MEDICAL_STATUS_TRANSITION',
  'MEDICAL_APPOINTMENT_NOT_DUE',
  'PROVIDER_STATUS_CHANGE_REQUIRED',
  'ACTIVE_MEMBERSHIP_REQUIRED',
  'AUTH_USER_MISMATCH',
  'RC457_ANON_EXECUTE_MUST_BE_DENIED',
  'RC457_AUTHENTICATED_EXECUTE_REQUIRED'
]) assert.ok(integration.includes(marker),'integration test missing '+marker);
assert.match(workflow,/rc457-medical-appointment-state-machine-integration/);
assert.match(workflow,/node scripts\/validate-medical-appointment-state-machine\.mjs/);
assert.match(docs,/latest applied version `20261008222845`/);
assert.match(docs,/must not be applied alone or out of order/);
assert.match(docs,/NO_SHOW.*semantics/);
assert.match(docs,/No production mutation was performed/);
console.log('RC457 medical appointment state-machine source contract: PASS');
