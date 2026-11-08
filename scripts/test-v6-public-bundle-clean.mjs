import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(process.argv[2] || '');
const assets = path.join(dist, 'assets');
if (!process.argv[2] || !fs.existsSync(assets)) throw new Error('Usage: node test-v6-public-bundle-clean.mjs <dist-directory>');
const jsFiles = fs.readdirSync(assets).filter((name) => name.endsWith('.js'));
assert.ok(jsFiles.length > 0, 'public V6 build must contain JavaScript assets');

const forbiddenMarkers = [
  'wallet_admin_main',
  'wallet_biz_',
  'wallet_sub_',
  'prod_demo_',
  'admin_root',
  'محفظة الإدارة العامة',
];
const findings = [];
for (const name of jsFiles) {
  const source = fs.readFileSync(path.join(assets, name), 'utf8');
  for (const marker of forbiddenMarkers) {
    if (source.includes(marker)) findings.push({ asset: name, marker });
  }
}
assert.deepEqual(findings, [], 'private admin/wallet/demo markers must not ship in public V6 JS: ' + JSON.stringify(findings));
console.log('V6_PUBLIC_BUNDLE_CLEAN=PASS assets=' + jsFiles.length);
