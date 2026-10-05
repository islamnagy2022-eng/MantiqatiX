import fs from 'node:fs';

const forbiddenPublicBrand = /MNTY(?:\s+(?:JOBS|FASHION|EDUCATION))?/g;

const checks = [
  ['web/index.html', true],
  ['web/smm.html', true],
  ['web/assets/mnty-cover-ad-1.svg', true],
  ['web/assets/mnty-cover-ad-2.svg', true],
  ['web/assets/mnty-cover-ad-3.svg', true],
  ['web/assets/mnty-berket-sabea-sponsored.svg', true],
  ['web/assets/module-defaults/jobs.svg', true],
  ['web/assets/module-defaults/fashion.svg', true],
  ['web/assets/module-defaults/education.svg', true],
];

for (const [file, enabled] of checks) {
  if (!enabled) continue;
  const raw = fs.readFileSync(file, 'utf8');
  // Customer-facing HTML may contain legacy MNTY technical identifiers inside scripts; audit only rendered/metadata content.
  const text = file.endsWith('.html') ? raw.replace(/<script\\b[\\s\\S]*?<\\/script>/gi, '') : raw;
  if (forbiddenPublicBrand.test(text)) {
    throw new Error(`Public brand violation in ${file}: MNTY appears in a customer-facing artifact.`);
  }
  forbiddenPublicBrand.lastIndex = 0;
}

const brand = fs.readFileSync('web/assets/mantiqatix-logo.svg', 'utf8');
if (!brand.includes('<title>MantiqatiX</title>')) {
  throw new Error('Canonical MantiqatiX master logo title is missing.');
}

console.log('Public brand validation passed: MantiqatiX is the only public brand label in the audited artifacts.');
