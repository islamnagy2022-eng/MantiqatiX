import assert from 'node:assert/strict';
import fs from 'node:fs';

const navbar = fs.readFileSync('apps/catalog-frontend/src/components/Navbar.tsx', 'utf8');
const index = fs.readFileSync('apps/catalog-frontend/index.html', 'utf8');
const manifest = JSON.parse(fs.readFileSync('apps/catalog-frontend/public/manifest.webmanifest', 'utf8'));

assert.ok(navbar.includes("const contextLogoUrl = `${import.meta.env.BASE_URL}brand/mantiqatix-approved-logo.jpg`;"),
  'the navbar must always display the official MantiqatiX platform logo, regardless of active business context');
assert.ok(navbar.includes('src={contextLogoUrl}') && navbar.includes('alt="شعار منطقتي X"'),
  'the brand image beside the MantiqatiX name must use the official platform logo and accessible name');

assert.match(index, /rel="icon"[^>]*mantiqatix-approved\.svg/,
  'browser favicon must remain the official MantiqatiX brand');
assert.match(index, /rel="apple-touch-icon"[^>]*sizes="256x256"[^>]*type="image\/jpeg"[^>]*mantiqatix-red-gold-app-icon\.jpg/,
  'the iOS home-screen icon must use the approved red-and-gold MantiqatiX app artwork');
assert.ok(fs.existsSync('apps/catalog-frontend/public/icons/mantiqatix-red-gold-app-icon.jpg'),
  'the approved iOS home-screen icon asset must exist');
assert.equal(manifest.display, 'standalone', 'the installable app must remain a standalone platform app');
assert.ok(manifest.icons.some((icon) => icon.src === '/MantiqatiX/icons/mantiqatix-approved.svg'
  && icon.sizes === 'any' && icon.type === 'image/svg+xml' && icon.purpose === 'any'),
  'the install manifest must retain the scalable official MantiqatiX logo');
assert.ok(manifest.icons.some((icon) => icon.src === '/MantiqatiX/icons/mantiqatix-red-gold-app-icon.jpg'
  && icon.sizes === '256x256' && icon.type === 'image/jpeg' && icon.purpose === 'any'),
  'the install manifest must include the approved red-and-gold app artwork');
assert.ok(manifest.icons.every((icon) => !/business|merchant|currentBusiness/i.test(icon.src)),
  'business context must never replace the installed application icon');

const serviceWorker = fs.readFileSync('apps/catalog-frontend/public/sw.js', 'utf8');
assert.match(serviceWorker, /const CACHE_NAME = 'mantiqatix-primary-catalog-shell-v\d+';/,
  'offline cache must be versioned in the catalog-only namespace');
for (const asset of [
  '/MantiqatiX/icons/mantiqatix-approved.svg',
  '/MantiqatiX/brand/mantiqatix-approved-logo.jpg',
  '/MantiqatiX/icons/mantiqatix-192.png',
  '/MantiqatiX/icons/mantiqatix-512.png',
  '/MantiqatiX/icons/mantiqatix-red-gold-app-icon.jpg',
]) {
  assert.ok(serviceWorker.includes(asset), `offline install shell must cache approved brand asset: ${asset}`);
}
assert.ok(!serviceWorker.includes('/MantiqatiX/icons/mantiqatix.svg'),
  'offline shell must not retain the retired generic app icon');


const requiredBrandAssets = [
  'apps/catalog-frontend/public/brand/mantiqatix-approved-logo.jpg',
  'apps/catalog-frontend/public/icons/mantiqatix-approved.svg',
  'apps/catalog-frontend/public/icons/mantiqatix-192.png',
  'apps/catalog-frontend/public/icons/mantiqatix-512.png',
  'apps/catalog-frontend/public/icons/mantiqatix-red-gold-app-icon.jpg',
];
for (const asset of requiredBrandAssets) {
  assert.ok(fs.existsSync(asset), `required platform brand asset is missing: ${asset}`);
  assert.ok(fs.statSync(asset).size > 0, `required platform brand asset is empty: ${asset}`);
}

console.log('NAVBAR_BUSINESS_LOGO_PLATFORM_INSTALL_ICON_SEPARATION=PASS');
