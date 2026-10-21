import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('supabase/functions/order-create/index.ts', 'utf8');

assert.ok(source.includes('const branchId = body.branchId ? String(body.branchId) : null;'),
  'requested branch must be resolved before checking membership');
assert.ok(source.includes('.select("id,role,status,branch_id,permissions")'),
  'membership authorization must load branch scope and explicit platform permissions');
assert.ok(source.includes('.eq("tenant_id", body.tenantId)') && source.includes('.eq("business_id", body.businessId)'),
  'membership lookup must be bound to the requested tenant and business');
assert.ok(source.includes('String(membership.branch_id ?? "") === branchId'),
  'branch-scoped memberships must match the requested branch exactly');
assert.ok(source.includes('(!membership.branch_id && businessWideRoles.has(role))'),
  'only business-wide roles may use an unscoped membership for a branch order');
assert.ok(source.includes('role === "SUPER_ADMIN"') &&
          source.includes('membership.permissions?.scope === "PLATFORM"') &&
          source.includes('membership.permissions?.full_control === true'),
  'SUPER_ADMIN must have explicit platform full-control claims');
assert.ok(source.includes('if ((targetMemberships ?? []).length > 500)'),
  'oversized membership results must fail closed');
assert.ok(source.includes('if (!hasScopedMembership)'),
  'nonmatching branch memberships must not authorize staff order creation');
assert.ok(source.includes('.eq("status", "ACTIVE")'),
  'only active memberships may authorize order creation');

console.log('Order-create branch-scope contract PASS');
