import fs from 'node:fs';

const migration='supabase/migrations/20261007000102_rc340_live_security_boundary_assertions.sql';
const sql=fs.readFileSync(migration,'utf8');

const required=[
  'RC340_RLS_DISABLED',
  'RC340_RLS_NO_POLICY',
  'has_function_privilege',
  'search_path=public, pg_temp',
  'get_mnty_targeted_advertisements',
  'digital_page_payment_events',
  'RC340_PAYMENT_EVENTS_POLICY_DRIFT'
];

for(const marker of required){
  if(!sql.includes(marker)) throw new Error(`RC340 security-boundary marker missing: ${marker}`);
}

const criticalTables=[
  'orders','payment_intents','user_memberships','support_tickets',
  'ticket_messages','notifications','financial_obligations',
  'settlement_transactions','general_ledger'
];
for(const table of criticalTables){
  if(!sql.includes(`('${table}')`)) throw new Error(`RC340 critical table missing: ${table}`);
}

const functions=[
  'admin_create_global_ad',
  'create_job_backend',
  'create_medical_appointment_backend',
  'create_payment_intent_backend',
  'get_mnty_targeted_advertisements',
  'mnty_active_membership',
  'mnty_can',
  'mnty_can_platform_admin',
  'update_medical_appointment_status_backend'
];
for(const fn of functions){
  if(!sql.includes(fn)) throw new Error(`RC340 SECURITY DEFINER boundary missing: ${fn}`);
}

console.log('RC340 fail-closed security-boundary contract: PASS');
