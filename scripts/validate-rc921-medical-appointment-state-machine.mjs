import fs from 'node:fs';

const migration = fs.readFileSync('supabase/migrations/20261123010000_rc921_medical_appointment_provider_state_machine.sql', 'utf8');
const integration = fs.readFileSync('supabase/tests/rc921_medical_status_integration.sql', 'utf8');
const requiredMigration = [
  'p_user_id <> v_uid',
  'for update',
  'um.business_id = v_appointment.business_id',
  'um.tenant_id = v_appointment.tenant_id',
  'mp.owner_user_id = v_uid',
  'mp.id::text = v_appointment.doctor_id',
  "v_appointment.status = 'BOOKED'",
  "v_appointment.status = 'CONFIRMED'",
  "raise exception 'INVALID_MEDICAL_STATUS_TRANSITION'",
  'revoke all on function public.update_medical_appointment_status_backend',
  'grant execute on function public.update_medical_appointment_status_backend'
];
for (const token of requiredMigration) {
  if (!migration.toLowerCase().includes(token.toLowerCase())) {
    throw new Error('RC921 migration contract missing: ' + token);
  }
}
const requiredTests = [
  'provider B changed provider A appointment',
  'cross-business manager changed appointment',
  'cross-tenant admin changed appointment',
  'patient own cancellation failed',
  'patient cancelled another patient appointment',
  'terminal appointment was reopened/changed'
];
for (const token of requiredTests) {
  if (!integration.includes(token)) throw new Error('RC921 integration coverage missing: ' + token);
}
if (/drop\s+function|alter\s+table\s+public\.medical_appointments\s+drop/i.test(migration)) {
  throw new Error('RC921 migration contains destructive DDL');
}
console.log('RC921 medical appointment state-machine source contract: PASS');
