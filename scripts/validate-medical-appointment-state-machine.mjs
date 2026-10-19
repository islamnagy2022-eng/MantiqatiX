import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath='supabase/migrations/20261010210000_rc452_medical_appointment_state_machine.sql';
const fixturePath='supabase/tests/rc452_medical_appointment_state_machine_fixture.sql';
const integrationPath='supabase/tests/rc452_medical_appointment_state_machine_integration.sql';
const workflowPath='.github/workflows/module-professionalization.yml';
const docsPath='docs/release/RC452_MEDICAL_APPOINTMENT_STATE_MACHINE.md';
const migration=fs.readFileSync(migrationPath,'utf8');
const fixture=fs.readFileSync(fixturePath,'utf8');
const integration=fs.readFileSync(integrationPath,'utf8');
const workflow=fs.readFileSync(workflowPath,'utf8');
const docs=fs.readFileSync(docsPath,'utf8');

assert.match(migration,/create or replace function public\.update_medical_appointment_status_backend/);
assert.match(migration,/for update/,'appointment row must be locked during transition');
assert.match(migration,/AUTH_USER_MISMATCH/);
assert.match(migration,/ACTIVE_MEMBERSHIP_REQUIRED/);
assert.match(migration,/MEDICAL_APPOINTMENT_NOT_CANCELLABLE/);
assert.match(migration,/INVALID_MEDICAL_STATUS_TRANSITION/);
assert.match(migration,/PROVIDER_STATUS_CHANGE_REQUIRED/);
assert.match(migration,/upper\(v_old\) = 'BOOKED' and v_target = 'CONFIRMED'/);
assert.match(migration,/upper\(v_old\) = 'CONFIRMED' and v_target in \('COMPLETED','NO_SHOW'\)/);
assert.doesNotMatch(migration,/grant execute|revoke execute/i,'this migration must not alter function grants');
assert.match(fixture,/create function public\.update_medical_appointment_status_backend/);
assert.match(integration,/RC452_EXPECTED_REJECTION_MISSING/);
for(const marker of [
  'MEDICAL_APPOINTMENT_NOT_CANCELLABLE',
  'INVALID_MEDICAL_STATUS_TRANSITION',
  'PROVIDER_STATUS_CHANGE_REQUIRED',
  'ACTIVE_MEMBERSHIP_REQUIRED',
  'AUTH_USER_MISMATCH',
  'RC452_ANON_EXECUTE_MUST_BE_DENIED',
  'RC452_AUTHENTICATED_EXECUTE_REQUIRED'
]) assert.ok(integration.includes(marker),'integration test missing '+marker);
assert.match(workflow,/rc452-medical-appointment-state-machine-integration/);
assert.match(workflow,/node scripts\/validate-medical-appointment-state-machine\.mjs/);
console.log('RC452 medical appointment state-machine source contract: PASS');
