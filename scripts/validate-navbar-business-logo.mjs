import assert from 'node:assert/strict';
import fs from 'node:fs';

const navbar = fs.readFileSync('apps/catalog-frontend/src/components/Navbar.tsx', 'utf8');
const index = fs.readFileSync('apps/catalog-frontend/index.html', 'utf8');
const manifest = JSON.parse(fs.readFileSync('apps/catalog-frontend/public/manifest.webmanifest', 'utf8'));

assert.match(navbar, /currentBusiness\?\.logoUrl\?\.trim\(\)/,
  'the shared navbar must use the active business logo when a business context exists');
assert.match(navbar, /const contextLogoUrl = currentBusiness\?\.logoUrl\?\.trim\(\)\s*\|\|\s*`\$\{import\.meta\.env\.BASE_URL\}brand\/mantiqatix-approved-logo\.jpg`/,
  'the navbar must fall back to the official platform logo when no business logo is available');
assert.match(navbar, /src=\{contextLogoUrl\}/,
  'the brand image beside the MantiqatiX name must use the resolved context logo');
assert.match(navbar, /alt=\{currentBusiness\?\.name \? `شعار \$\{currentBusiness\.name\}` : 'شعار منطقتي X'\}/,
  'the logo accessible name must describe the active business or the platform fallback');

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

console.log('NAVBAR_BUSINESS_LOGO_PLATFORM_INSTALL_ICON_SEPARATION=PASS');
