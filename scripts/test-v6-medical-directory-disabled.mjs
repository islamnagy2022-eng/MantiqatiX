import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const forbidden = [
  ['src/App.tsx', /MedicalDirectoryView|medical_directory/],
  ['src/context/PublicAppContext.tsx', /medical_directory/],
  ['src/components/Navbar.tsx', /medical_directory|الدليل الطبي|HeartPulse/],
  ['src/components/DirectoryView.tsx', /setCurrentView\(['"]medical_directory['"]\)|الدليل الطبي/],
];
for (const [file, pattern] of forbidden) {
  assert.doesNotMatch(read(file), pattern, 'Medical directory reference remains in ' + file);
}
for (const rel of ['src/components/medical/MedicalDirectoryView.tsx', 'src/data/medicalSpecialties.ts']) {
  assert.equal(fs.existsSync(path.join(root, rel)), false, 'Medical-only file remains: ' + rel);
}
assert.match(read('src/App.tsx'), /currentView === 'contact_us'/, 'Contact route was damaged');
assert.match(read('src/App.tsx'), /<DirectoryView \/>/, 'General directory route was damaged');
console.log('V6_MEDICAL_DIRECTORY_DISABLED=PASS');
