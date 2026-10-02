import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
const config = fs.readFileSync('web/config.js', 'utf8');
const index = fs.readFileSync('web/index.html', 'utf8');
const app = fs.readFileSync('web/app.js', 'utf8');
const onboarding = fs.readFileSync('web/provider-onboarding-module.js', 'utf8');
const home = fs.readFileSync('web/home.js', 'utf8');
const homeCss = fs.readFileSync('web/home.css', 'utf8');

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
if (!/provider-onboarding-module\.js\?v=mnty\d+/.test(index)) {
  throw new Error('Provider onboarding module is not loaded by the production landing shell.');
}
if (!/business-register/.test(onboarding) || !/business-onboarding-status/.test(onboarding) || !/catalog-admin/.test(onboarding) || !/business-branch-admin/.test(onboarding)) {
  throw new Error('Provider onboarding module is missing required production workflow integrations.');
}
if (!/signInWithOAuth\(\{provider:\s*['"]google['"]/.test(app) ||
    !/redirectTo\s*:\s*oauthRedirectUrl\(\)/.test(app) ||
    !/detectSessionInUrl\s*:\s*true/.test(app)) {
  throw new Error('Production auth flow is missing the secure Google OAuth redirect/session detection guard.');
}
const smm = fs.readFileSync('web/smm.js', 'utf8');
if (app.includes('signInWithOtp(') || app.includes('verifyOtp(') || smm.includes('signInWithOtp(') || smm.includes('verifyOtp(')) {
  throw new Error('Production auth flow still exposes an Email OTP path.');
}
if (!smm.includes("signInWithOAuth({provider:'google',options:") || !smm.includes('id="google-auth"')) {
  throw new Error('SMM production auth flow is not Google-only.');
}
if (!/MantiqatiX/i.test(index)) {
  throw new Error('Production landing page does not contain the MantiqatiX identity marker.');
}

const launchUiGuards = [
  ['header search input', /id="mx-home-search"/],
  ['search action', /id="mx-search-btn"/],
  ['search suggestions', /id="mx-search-suggestions"/],
  ['mobile menu', /id="mx-mobile-menu"/],
  ['mobile drawer', /id="mx-mobile-drawer"/],
  ['mobile drawer close', /id="mx-mobile-menu-close"/],
  ['mobile add activity', /id="mx-mobile-add"/],
  ['footer', /class="mx-footer"/],
  ['bottom search action', /id="mx-bottom-search"/]
];
for (const [label, pattern] of launchUiGuards) {
  if (!pattern.test(home)) throw new Error('Homepage launch UI guard missing: ' + label);
}
for (const [label, pattern] of [
  ['mobile drawer open state', /\.mx-mobile-drawer\.is-open/],
  ['responsive mobile breakpoint', /@media\(max-width:800px\)/],
  ['reduced motion support', /prefers-reduced-motion:reduce/]
]) {
  if (!pattern.test(homeCss)) throw new Error('Homepage responsive guard missing: ' + label);
}
if (!/loadData\(term\)/.test(home) || !/marketing_services/.test(home) || !/marketing_provider_profiles/.test(home)) {
  throw new Error('Homepage search is not connected to the live service/provider catalog.');
}

console.log('Production release preflight: PASS (CI guards, production Supabase pin, connected data source, MantiqatiX identity, secure Google-only auth)');
