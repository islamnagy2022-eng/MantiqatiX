import fs from 'node:fs';

const migrationDir='supabase/migrations';
const migrationFiles=fs.readdirSync(migrationDir).filter(f=>f.endsWith('.sql')).sort();
const expected=[
  'admin_create_global_ad(varchar,text,text,timestamptz,timestamptz)',
  'create_job_backend(uuid,text,varchar,uuid,text,text,text,text,text,text,text,text)',
  'create_medical_appointment_backend(uuid,text,uuid,text,bigint,text)',
  'create_payment_intent_backend(varchar,uuid,numeric,varchar,varchar,varchar,varchar)',
  'mnty_active_membership(varchar,uuid,varchar)',
  'mnty_can(text,varchar,uuid,varchar)',
  'mnty_can_platform_admin()',
  'update_medical_appointment_status_backend(uuid,text,text)'
];

const hardening=migrationFiles
  .filter(f=>/^20261004003842_rc336_harden_authenticated_security_definer_search_paths\.sql$/.test(f))
  .map(f=>fs.readFileSync(migrationDir+'/'+f,'utf8'))
  .join('\n');

if(!hardening) throw new Error('RC336 SECURITY DEFINER hardening migration is missing.');
for(const signature of expected){
  const marker='alter function public.'+signature+' set search_path=public,pg_temp;';
  if(!hardening.includes(marker)){
    throw new Error('SECURITY DEFINER search_path hardening missing: '+signature);
  }
}

const verify=fs.readFileSync('scripts/verify-rc337-security-definer-hardening.sql','utf8');
for(const marker of [
  'expected_anon',
  'expected_authenticated',
  'has_function_privilege',
  'security_definer',
  'search_path=public, pg_temp',
  'get_mnty_targeted_advertisements'
]){
  if(!verify.includes(marker)) throw new Error('RC337 verification contract marker missing: '+marker);
}

const rc340='supabase/migrations/20261007000102_rc340_live_security_boundary_assertions.sql';
if(!fs.existsSync(rc340)) throw new Error('RC340 live security-boundary assertion migration is missing.');
const rc340Sql=fs.readFileSync(rc340,'utf8');
for(const marker of [
  'RC340_RLS_DISABLED',
  'RC340_RLS_NO_POLICY',
  'has_function_privilege',
  'search_path=public, pg_temp',
  'get_mnty_targeted_advertisements',
  'digital_page_payment_events',
  'RC340_PAYMENT_EVENTS_POLICY_DRIFT'
]){
  if(!rc340Sql.includes(marker)) throw new Error('RC340 security-boundary marker missing: '+marker);
}



const rc340Tables=[
  'orders','payment_intents','user_memberships','support_tickets',
  'ticket_messages','notifications','financial_obligations',
  'settlement_transactions','general_ledger'
];
for(const table of rc340Tables){
  if(!rc340Sql.includes("('"+table+"')"))
    throw new Error('RC340 live RLS assertion missing critical table: '+table);
}
for(const marker of [
  "('public.mnty_active_membership(character varying,uuid,character varying)',false,true)",
  "('public.mnty_can(text,character varying,uuid,character varying)',false,true)",
  "('public.get_mnty_targeted_advertisements(character varying,character varying,character varying,double precision,double precision,character varying,integer)',true,true)",
  "if v_auth is distinct from v.expected_auth",
  "if v_anon is distinct from v.expected_anon"
]){
  if(!rc340Sql.includes(marker)) throw new Error('RC340 expected privilege contract missing: '+marker);
}

const rc424='supabase/migrations/20261009010000_rc424_atomic_digital_page_payment_webhook.sql';
if(!fs.existsSync(rc424)) throw new Error('RC424 digital-page payment processor migration is missing.');
const rc424Sql=fs.readFileSync(rc424,'utf8');
const paymentProcessor='process_verified_digital_page_payment_backend(uuid,text,text,text,boolean,numeric,text,text,text,jsonb)';
for(const marker of [
  'revoke all on function public.'+paymentProcessor+' from public;',
  'revoke all on function public.'+paymentProcessor+' from anon;',
  'revoke all on function public.'+paymentProcessor+' from authenticated;',
  'grant execute on function public.'+paymentProcessor+' to service_role;',
  'DIGITAL_PAGE_SIGNATURE_REQUIRED',
  'DIGITAL_PAGE_AMOUNT_CURRENCY_MISMATCH',
  'DIGITAL_PAGE_EVENT_ORDER_MISMATCH'
]){
  if(!rc424Sql.includes(marker)) throw new Error('RC424 payment processor security/idempotency contract missing: '+marker);
}

const currentWorkflow=fs.readFileSync('.github/workflows/pages.yml','utf8');
if(!currentWorkflow.includes('node scripts/validate-security-definer-contract.mjs')){
  throw new Error('SECURITY DEFINER validation is not wired into production CI.');
}
if(!currentWorkflow.includes('node scripts/validate-rbac-contract.mjs')){
  throw new Error('RBAC validation is not wired into production CI.');
}

const rc440=fs.readFileSync('supabase/migrations/20261010020000_rc440_exposed_security_definer_search_path.sql','utf8');
if(!rc440.includes("pg_catalog.format('%I.%I(%s)'")) throw new Error('RC440 must schema-qualify dynamic ALTER FUNCTION targets.');
if(!rc440.includes("cfg='search_path=public'")||!rc440.includes("has_function_privilege('anon'")||!rc440.includes("has_function_privilege('authenticated'")) throw new Error('RC440 must remain limited to exposed SECURITY DEFINER functions.');
const rc436=fs.readFileSync('supabase/migrations/20261009220000_rc436_atomic_financial_journal.sql','utf8');
const rc437=fs.readFileSync('supabase/migrations/20261009230000_rc437_purchase_order_lines_receiving_limits.sql','utf8');
const rc438=fs.readFileSync('supabase/migrations/20261009240000_rc438_purchase_order_creation_with_lines.sql','utf8');
for(const [name,source,markers] of [
  ['RC436 atomic financial journal',rc436,['set search_path = \'\'','revoke all on function public.post_financial_journal_atomic_backend(uuid,jsonb,jsonb) from public,anon,authenticated','to service_role']],
  ['RC437 line-aware purchase receipt',rc437,['set search_path = \'\'','PRODUCT_NOT_IN_PURCHASE_ORDER','PURCHASE_ORDER_QUANTITY_EXCEEDED','from public,anon,authenticated,service_role']],
  ['RC438 actor-bound order creation',rc438,['set search_path = \'\'','p_actor_user_id uuid','revoke all on function public.create_purchase_order_with_lines_backend(varchar,varchar,uuid,varchar,varchar,varchar,numeric,numeric,text,jsonb,uuid) from public,anon,authenticated','to service_role']]
]){
  for(const marker of markers){
    if(!source.includes(marker)) throw new Error(name+' security marker missing: '+marker);
  }
}
const auditRunbook='docs/runbooks/SECURITY_DEFINER_RLS_AUDIT.sql';
if(!fs.existsSync(auditRunbook)) throw new Error('Read-only SECURITY DEFINER/RLS audit runbook is missing.');
for(const marker of ['has_function_privilege','relrowsecurity','pg_policies','role_table_grants']){
  if(!fs.readFileSync(auditRunbook,'utf8').includes(marker)) throw new Error('Security audit runbook marker missing: '+marker);
}

console.log('RC340 SECURITY DEFINER/RBAC release contract: PASS');
