import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '');
if (!process.argv[2] || !fs.existsSync(root)) throw new Error('Usage: node test-v6-public-context-boundary.mjs <v6-worktree>');

const publicFiles = [
  'src/App.tsx',
  'src/components/DirectoryView.tsx',
  'src/components/Navbar.tsx',
  'src/components/medical/MedicalDirectoryView.tsx',
  'src/components/ContactUsView.tsx',
  'src/components/storefront/BusinessProfileHeader.tsx',
  'src/components/storefront/CatalogSection.tsx',
  'src/components/auth/LoginModal.tsx',
];

for (const relative of publicFiles) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  assert.doesNotMatch(source, /context\/AppContext/, relative + ' must not import the monolithic context');
  assert.doesNotMatch(source, /\buseApp\b/, relative + ' must use the public context contract');
}
const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
assert.match(app, /PublicAppProvider/);
assert.match(app, /usePublicApp/);

const context = fs.readFileSync(path.join(root, 'src/context/PublicAppContext.tsx'), 'utf8');
for (const forbidden of [
  '../context/AppContext',
  '../utils/rules',
  '../data/seedData',
  '../utils/accessPolicy',
  'localStorage',
  'WalletAccount',
  'WalletTransaction',
  'AdminDashboard',
  'MerchantDashboard',
]) {
  assert.equal(context.includes(forbidden), false, 'public context contains forbidden dependency: ' + forbidden);
}
assert.match(context, /fetchPublicCatalogDirectory/);
assert.match(context, /requestEmailOtp/);
assert.match(context, /fetchAuthenticatedMembershipChoices/);

for (const relative of ['src/components/ContactUsView.tsx', 'src/components/storefront/CatalogSection.tsx']) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  assert.doesNotMatch(source, /utils\/rules/, relative + ' must not pull the enterprise rules module');
}
console.log('V6_PUBLIC_CONTEXT_BOUNDARY=PASS');
