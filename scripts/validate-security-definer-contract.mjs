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

const currentWorkflow=fs.readFileSync('.github/workflows/pages.yml','utf8');
if(!currentWorkflow.includes('node scripts/validate-security-definer-contract.mjs')){
  throw new Error('SECURITY DEFINER validation is not wired into production CI.');
}
if(!currentWorkflow.includes('node scripts/validate-rbac-contract.mjs')){
  throw new Error('RBAC validation is not wired into production CI.');
}

console.log('RC340 SECURITY DEFINER/RBAC release contract: PASS');
