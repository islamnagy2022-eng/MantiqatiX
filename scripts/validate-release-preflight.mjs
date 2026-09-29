import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
const config = fs.readFileSync('web/config.js', 'utf8');
const index = fs.readFileSync('web/index.html', 'utf8');
const onboarding = fs.readFileSync('web/provider-onboarding-module.js', 'utf8');

const requiredWorkflowMarkers = [
  'node scripts/validate-production-security.mjs',
  'node scripts/validate-auth-flow.mjs',
  'node scripts/validate-booking-payment-flow.mjs',
  'name: github-pages-${{ github.run_id }}-${{ github.run_attempt }}',
  'artifact_name: github-pages-${{ github.run_id }}-${{ github.run_attempt }}',
  'curl --fail --silent --show-error --location --retry 5 --retry-delay 3 "$PAGE_URL" -o "$TMP_PAGE"'
];
for (const marker of requiredWorkflowMarkers) {
  if (!workflow.includes(marker)) throw new Error('Release workflow missing required guard: ' + marker);
}

if (!/supabaseUrl:\s*['"]https:\/\/moyhiluyhjsujhwlyeuu\.supabase\.co['"]/.test(config)) {
  throw new Error('Release config is not pinned to the approved production Supabase project.');
}
if (!/MNTY_DATA_SOURCE\s*=\s*['"]WEBSITE_SUPABASE['"]/.test(config)) {
  throw new Error('Release config is not connected to the production Supabase data source.');
}
if (/DISCONNECTED|blockedQuery|demo|mock/i.test(config)) {
  throw new Error('Release config contains a disconnected/demo/mock marker.');
}
if (!/provider-onboarding-module\.js\?v=mnty37/.test(index)) {
  throw new Error('Provider onboarding module is not loaded by the production landing shell.');
}
if (!/business-register/.test(onboarding) || !/business-onboarding-status/.test(onboarding) || !/catalog-admin/.test(onboarding) || !/business-branch-admin/.test(onboarding)) {
  throw new Error('Provider onboarding module is missing required production workflow integrations.');
}
if (!/Mantiqati X|MNTY/i.test(index)) {
  throw new Error('Production landing page does not contain the MNTY identity marker.');
}

console.log('Production release preflight: PASS (CI guards, production Supabase pin, connected data source, MNTY identity)');
