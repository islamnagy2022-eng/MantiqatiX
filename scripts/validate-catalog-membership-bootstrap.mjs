import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('apps/catalog-frontend/src/lib/production.ts', 'utf8');
const guardPattern = /const hasBusinessScopedMembership = roleMemberships\.some\(\(m: any\) => Boolean\(m\.business_id\)\);\s*if\s*\(!platform\s*&&\s*hasBusinessScopedMembership\s*&&\s*businesses\.length\s*===\s*0\)\s*\{\s*throw new Error\(/;
const guardIndex = source.search(guardPattern);
const roleIndex = source.indexOf("const role = platform ? 'admin' : roleMemberships.length ? 'subscriber' : 'guest';");

assert.ok(guardIndex >= 0, 'Active business-linked membership must not silently become an empty workspace when catalog reads fail.');
assert.ok(roleIndex > guardIndex, 'Membership bootstrap guard must execute before role/workspace selection.');
const guardBlock = source.slice(guardIndex, roleIndex);
for (const phrase of ['عضوية نشطة', 'لم يتم تغيير الاشتراك', 'منح صلاحيات بديلة', 'أعد المحاولة']) {
  assert.ok(guardBlock.includes(phrase), 'Bootstrap failure must disclose the issue without mutating subscription or granting fallback access.');
}
assert.ok(source.includes(".eq('user_id', user.id).eq('status', 'ACTIVE')"), 'Only active memberships are considered by this guard.');
assert.ok(source.includes("const platform = platformMemberships.length > 0;"), 'Platform-admin workspaces must remain separate from business-owner failure handling.');

console.log('CATALOG_MEMBERSHIP_BOOTSTRAP_FAIL_CLOSED=PASS');
