import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath='supabase/migrations/20261019190000_rc457_medical_appointment_state_machine.sql';
const fixturePath='supabase/tests/rc457_medical_appointment_state_machine_fixture.sql';
const integrationPath='supabase/tests/rc457_medical_appointment_state_machine_integration.sql';
const workflowPath='.github/workflows/module-professionalization.yml';
const docsPath='docs/release/RC457_MEDICAL_APPOINTMENT_STATE_MACHINE.md';
const releaseMigration=fs.readFileSync('supabase/migrations/20261020200000_rc467_medical_booking_release_contract.sql','utf8');
const bookingFixture=fs.readFileSync('supabase/tests/rc462_medical_booking_fixture.sql','utf8');
const bookingIntegration=fs.readFileSync('supabase/tests/rc462_medical_booking_integration.sql','utf8');
const app=fs.readFileSync('web/app.js','utf8');
const index=fs.readFileSync('web/index.html','utf8');
const sw=fs.readFileSync('web/sw.js','utf8');
const releaseWorkflow=fs.readFileSync('.github/workflows/medical-module-release.yml','utf8');
const productionVerifier=fs.readFileSync('scripts/production/verify-production.mjs','utf8');
const migrationReplay=fs.readFileSync('.github/workflows/disposable-forward-migration-replay.yml','utf8');
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

assert.match(releaseMigration,/ACTIVE_VERIFIED_MEDICAL_PROVIDER_NOT_FOUND/);
assert.match(releaseMigration,/APPOINTMENT_TIME_MUST_BE_FUTURE/);
assert.match(releaseMigration,/APPOINTMENT_SLOT_ALIGNMENT_REQUIRED/);
assert.match(releaseMigration,/pg_advisory_xact_lock/);
assert.match(releaseMigration,/DOCTOR_SLOT_UNAVAILABLE/);
assert.match(releaseMigration,/DOCTOR_PROFILE_OWNERSHIP_REQUIRED/);
assert.match(releaseMigration,/medical_appointments_provider_select/);
assert.doesNotMatch(releaseMigration,/grant execute|revoke execute/i,'RC467 must preserve existing function grants');
assert.match(bookingFixture,/PHARMACY/);
assert.match(bookingIntegration,/RC467_MEDICAL_BOOKING_RELEASE_CONTRACT_PASS/);
assert.match(bookingIntegration,/RC467_OTHER_DOCTOR_MUTATION_WAS_ALLOWED/);
assert.match(app,/key:'MEDICAL',name:'الأطباء والعيادات'/);
assert.match(app,/if\(m\.key==='MEDICAL'\)[\s\S]{0,300}loadMedicalWorkspace\(\)/);
assert.match(app,/async function loadMedicalWorkspace\(\)/);
assert.match(app,/create_medical_appointment_backend/);
assert.match(app,/update_medical_appointment_status_backend/);
const operations=fs.readFileSync('web/operations-modules.js','utf8');
assert.match(operations,/function medicalStatusActions\(a\)/,"doctor workspace must render role-appropriate appointment actions");
assert.match(operations,/data-medical-target="CONFIRMED"/,"doctor workspace must expose appointment confirmation");
assert.match(operations,/data-medical-target="CANCELLED"/,"patient/provider cancellation must be wired");
assert.match(operations,/data-medical-target="COMPLETED"/,"doctor workspace must support completing a due visit");
assert.match(operations,/data-medical-target="NO_SHOW"/,"doctor workspace must support no-show status for due visits");
assert.match(operations,/updateMedicalAppointmentStatus\(b\.dataset\.medicalStatus,b\.dataset\.medicalTarget\)/,"appointment status actions must call the authenticated backend RPC");
assert.match(operations,/p_user_id:user\.id,p_appointment_id:String\(id\),p_target_status:String\(target\)/,"status mutations must bind the authenticated actor");
assert.match(operations,/p\.is_verified===true/,"booking discovery must hide unverified medical providers");
assert.match(operations,/900000!==0/,"booking UI must enforce the backend's 15-minute slot alignment");
assert.match(operations,/medical-appointments-live/,"doctor appointments must refresh from realtime events");
assert.match(operations,/current==='المنظومة الطبية'&&!loading/,"realtime refresh must be limited to the active medical module");
assert.match(index,/operations-modules\.js\?v=mnty132/,"medical workflow asset cache must be refreshed");
assert.match(index,/app\.js\?v=mnty-doctors-v1-20261020/);
assert.match(index,/sw\.js\?v=mnty-doctors-v1-20261020/);
assert.match(sw,/const CACHE='mnty-web-v162'/);
assert.match(sw,/app\.js\?v=mnty-doctors-v1-20261020/);
assert.match(releaseWorkflow,/20261020200000_rc467_medical_booking_release_contract\.sql/);
assert.match(releaseWorkflow,/rc462_medical_booking_integration\.sql/);
assert.match(migrationReplay,/20261020200000_rc467_medical_booking_release_contract\.sql/);

console.log('RC457 state machine + RC467 doctor module release source contract: PASS');
