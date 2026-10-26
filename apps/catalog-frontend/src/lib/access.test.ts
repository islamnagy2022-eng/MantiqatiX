import assert from 'node:assert/strict';
import { canAccessView, defaultViewForRole } from './access';

const views = ['directory', 'public_storefront', 'merchant_admin', 'super_admin', 'login'] as const;
const expected: Record<string, Record<(typeof views)[number], boolean>> = {
  guest: {
    directory: true,
    public_storefront: true,
    merchant_admin: false,
    super_admin: false,
    login: false,
  },
  subscriber: {
    directory: true,
    public_storefront: true,
    merchant_admin: true,
    super_admin: false,
    login: false,
  },
  admin: {
    directory: true,
    public_storefront: true,
    merchant_admin: true,
    super_admin: true,
    login: false,
  },
};

for (const [role, matrix] of Object.entries(expected)) {
  for (const view of views) {
    assert.equal(canAccessView(role, view), matrix[view], `${role} -> ${view}`);
  }
}

assert.equal(defaultViewForRole('guest'), 'directory');
assert.equal(defaultViewForRole('subscriber'), 'merchant_admin');
assert.equal(defaultViewForRole('admin'), 'super_admin');
assert.equal(defaultViewForRole('unrecognized-role'), 'directory');

console.log('Frontend role-screen access matrix: PASS (15 role/view cases + 4 default routes).');
