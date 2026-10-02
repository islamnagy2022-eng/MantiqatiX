import fs from 'node:fs';
const sql=fs.readFileSync('scripts/verify-rc258-rbac-contract.sql','utf8');
const migration=fs.readFileSync('supabase/migrations/20261002123000_rc258_centralized_server_rbac.sql','utf8');
for(const marker of ['mnty_active_membership','mnty_can(','mnty_can_platform_admin','SUPER_ADMIN','OWNER','SERVICE_PROVIDER','CUSTOMER','scope','full_control']){
  if(!sql.includes(marker) && !migration.includes(marker)) throw new Error('RBAC contract marker missing: '+marker);
}
if(!/revoke all on function public\.mnty_can\(/.test(migration)) throw new Error('mnty_can public revoke missing');
if(!/grant execute on function public\.mnty_can\([^;]+ to authenticated/.test(migration)) throw new Error('mnty_can authenticated grant missing');
if(!/SUPER_ADMIN.*PLATFORM.*full_control/s.test(migration)) throw new Error('Strict SUPER_ADMIN platform capability contract missing');
console.log('RC259 RBAC contract validation: PASS');
