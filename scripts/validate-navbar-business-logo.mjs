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
assert.match(index, /rel="apple-touch-icon"[^>]*mantiqatix-192\.png/,
  'the mobile home-screen icon link must remain the official MantiqatiX brand');
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
assert.match(serviceWorker, /mantiqatix-primary-catalog-shell-v4/,
  'the app-shell cache must be versioned when the official icon set changes');
for (const asset of [
  '/MantiqatiX/icons/mantiqatix-approved.svg',
  '/MantiqatiX/brand/mantiqatix-approved-logo.jpg',
  '/MantiqatiX/icons/mantiqatix-192.png',
  '/MantiqatiX/icons/mantiqatix-512.png',
  '/MantiqatiX/icons/mantiqatix-red-gold-app-icon.jpg',
]) {
  assert.ok(serviceWorker.includes(asset), `offline app shell must cache official brand asset: ${asset}`);
}
assert.ok(!serviceWorker.includes('/MantiqatiX/icons/mantiqatix.svg'),
  'the retired generic icon must not replace the approved platform icon in the offline app shell');

console.log('NAVBAR_BUSINESS_LOGO_PLATFORM_INSTALL_ICON_SEPARATION=PASS');
