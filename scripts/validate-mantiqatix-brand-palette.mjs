import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const checks = [];
const expect = (label, condition) => checks.push({ label, pass: Boolean(condition) });

const css = read('apps/catalog-frontend/src/index.css');
const expectedTokens = {
  '--mx-blue-950': '#3a0000',
  '--mx-blue-900': '#5a0000',
  '--mx-blue-800': '#7a0000',
  '--mx-blue-700': '#a00000',
  '--mx-blue-500': '#d90000',
  '--mx-cyan-500': '#f6c04d',
  '--mx-cyan-200': '#ffe1a3',
  '--mx-blue-50': '#fff3e0',
  '--mx-background': '#fff8f0',
  '--mx-text': '#2b1714',
  '--mx-border': '#ead5c5',
  '--mx-success': '#16a878',
  '--mx-danger': '#d90000',
};
for (const [token, value] of Object.entries(expectedTokens)) {
  expect(`token ${token} uses ${value}`, css.includes(`  ${token}: ${value};`));
}

const requiredFiles = [
  ['apps/catalog-frontend/src/App.tsx', ['bg-[#fff8f0]', 'text-[#2b1714]']],
  ['apps/catalog-frontend/src/components/Navbar.tsx', ['#7a0000', '#f6c04d']],
  ['apps/catalog-frontend/src/components/DirectoryView.tsx', ['#3a0000', '#7a0000', '#f6c04d']],
  ['apps/catalog-frontend/src/components/MarketplaceHome.tsx', ['from-[#3a0000]', '#f6c04d']],
  ['apps/catalog-frontend/src/components/merchant/MerchantDashboard.tsx', ['from-[#3a0000]', 'bg-[#f6c04d]']],
  ['apps/catalog-frontend/src/modules/dashboard/ProfessionalDashboard.tsx', ['from-[#3a0000]', 'bg-[#a00000]', '#f6c04d']],
  ['apps/catalog-frontend/src/components/admin/AdminDashboard.tsx', ['from-[#3a0000]', 'bg-[#7a0000]', 'bg-[#f6c04d]']],
  ['apps/catalog-frontend/src/components/storefront/BusinessProfileHeader.tsx', ['mx-v4-storefront-shell', 'mx-v4-storefront-primary']],
  ['apps/catalog-frontend/src/components/storefront/CatalogSection.tsx', ['mx-v4-catalog-section', 'mx-v4-catalog-primary-action']],
];
for (const [path, markers] of requiredFiles) {
  const source = read(path);
  for (const marker of markers) expect(`${path} contains ${marker}`, source.includes(marker));
}

expect('success semantic color remains green', css.includes('--mx-success: #16a878;'));
expect('danger semantic color remains red', css.includes('--mx-danger: #d90000;'));
expect('storefront hover uses warm token, not legacy blue', css.includes('.mx-v4-storefront-secondary:hover { background: var(--mx-blue-50); }') && !css.includes('#d5edff'));
const admin = read('apps/catalog-frontend/src/components/admin/AdminDashboard.tsx');
expect('payment confirmation remains a success action', admin.includes('تأكيد سداد المستحقات') && admin.includes('bg-emerald-600'));
expect('publication approval remains a success action', admin.includes("handlePublicationReview(business, 'APPROVE')") && admin.includes('bg-emerald-600'));
const directory = read('apps/catalog-frontend/src/components/DirectoryView.tsx');
expect('verified and unverified listing states remain distinct', directory.includes('bg-emerald-500') && directory.includes('bg-red-600'));

const failures = checks.filter((check) => !check.pass);
for (const check of checks) console.log(`[${check.pass ? 'PASS' : 'FAIL'}] ${check.label}`);
console.log(`MANTIQATIX_BRAND_PALETTE_CHECKS=${checks.length - failures.length}/${checks.length}`);
if (failures.length) process.exit(1);
