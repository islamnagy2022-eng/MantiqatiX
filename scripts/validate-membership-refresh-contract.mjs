import fs from 'node:fs';

const app = fs.readFileSync('web/app.js', 'utf8');
const workflow = fs.readFileSync('.github/workflows/module-professionalization.yml', 'utf8');

const requiredAppContracts = [
  "async function loadLiveData()",
  "if(m.error)throw m.error;",
  "live.error=e?.message||'تعذر تحميل بيانات المنصة';",
  "}finally{live.loading=false;}",
  "const savedId=window.MNTYActiveMembershipId||localStorage.getItem('MNTYActiveMembershipId')",
  "live.activeMembershipId=active?.id||null;"
];
for (const marker of requiredAppContracts) {
  if (!app.includes(marker)) {
    throw new Error('Membership refresh contract missing: ' + marker);
  }
}

const loadStart = app.indexOf('async function loadLiveData()');
const loadEnd = app.indexOf('\n\nfunction roleLabel', loadStart);
if (loadStart < 0 || loadEnd < 0) {
  throw new Error('Could not isolate loadLiveData implementation');
}
const load = app.slice(loadStart, loadEnd);
if (!/try\s*\{[\s\S]*if\(m\.error\)throw m\.error;[\s\S]*catch\(e\)\{live\.error=e\?\.message\|\|'تعذر تحميل بيانات المنصة';\}finally\{live\.loading=false;\}/.test(load)) {
  throw new Error('Membership load failures must set a visible error state and always clear loading');
}
if (!workflow.includes('node scripts/validate-membership-refresh-contract.mjs')) {
  throw new Error('Membership refresh validator is not wired into CI');
}

console.log('Membership refresh/failure-state contract: PASS');
