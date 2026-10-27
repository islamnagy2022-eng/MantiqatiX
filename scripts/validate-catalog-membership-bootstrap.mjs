import fs from 'node:fs';

const source = fs.readFileSync('apps/catalog-frontend/src/lib/production.ts', 'utf8');
const guardPattern = /const hasBusinessScopedMembership = roleMemberships\.some\(\(m: any\) => Boolean\(m\.business_id\)\);\s*if\s*\(!platform\s*&&\s*hasBusinessScopedMembership\s*&&\s*businesses\.length\s*===\s*0\)\s*\{\s*throw new Error\(/;
const guardIndex = source.search(guardPattern);
const roleIndex = source.indexOf("const role = platform ? 'admin' : roleMemberships.length ? 'subscriber' : 'guest';");

if (guardIndex < 0) {
  throw new Error('Missing guard: business-linked membership must not silently appear unsubscribed when every catalog read fails.');
}
if (roleIndex < 0 || guardIndex > roleIndex) {
  throw new Error('Membership bootstrap guard must run before role and workspace selection.');
}
const guardBlock = source.slice(guardIndex, roleIndex);
for (const phrase of ['عضوية نشطة', 'لم يتم تغيير الاشتراك', 'أعد المحاولة']) {
  if (!guardBlock.includes(phrase)) {
    throw new Error('Membership bootstrap error must explain the active membership, preserve subscription state, and offer a retry path.');
  }
}

console.log('Catalog membership bootstrap guard: PASS');
