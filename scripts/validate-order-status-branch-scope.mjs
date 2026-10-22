import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync('supabase/migrations/20261022130000_rc529_order_status_branch_scope.sql', 'utf8');
const edge = fs.readFileSync('supabase/functions/order-status-update/index.ts', 'utf8');
const test = fs.readFileSync('supabase/tests/rc529_order_status_branch_scope_integration.sql', 'utf8');

assert.ok(migration.includes('create policy orders_member_update_branch_guard'), 'order UPDATE needs a restrictive branch-scope policy');
assert.ok(migration.includes('as restrictive') && migration.includes('for update'), 'branch scope must constrain existing permissive UPDATE policies');
assert.ok(migration.includes('m.business_id=orders.business_id'), 'RLS must bind order mutations to the exact business');
assert.ok(migration.includes('m.branch_id=orders.branch_id'), 'RLS must bind branch-scoped roles to the exact branch');
assert.ok(migration.includes('m.branch_id is null and upper(m.role) in (\'OWNER\',\'ADMIN\',\'BUSINESS_OWNER\')'), 'only explicit business-wide roles may use a branchless membership');
assert.ok(migration.includes('m.business_id=v_order.business_id'), 'canonical RPC must reject cross-business membership');
assert.ok(migration.includes('m.branch_id=v_order.branch_id'), 'canonical RPC must enforce exact branch membership');
assert.ok(migration.includes('p_user_id is distinct from auth.uid()'), 'RPC must bind the claimed user to the authenticated subject');
assert.ok(migration.includes('ORDER_PAID_REQUIRES_REFUND_BEFORE_CANCELLATION'), 'paid-order cancellation must still require refund handling');
assert.ok(edge.includes('admin.rpc("update_order_status_backend"'), 'the verified Edge Function must call the backend-only RPC');
assert.ok(!edge.includes('userScoped.rpc("update_order_status_backend"'), 'status RPC must not be exposed to direct authenticated clients');
assert.ok(migration.includes('from public, anon, authenticated, service_role;'), 'status RPC execution must be revoked from client roles');
assert.ok(migration.includes('to service_role;'), 'only the trusted server role may execute the status RPC');
assert.ok(migration.includes("coalesce(auth.role(),'') <> 'service_role'"), 'RPC must distinguish trusted server invocation from user-context calls');
assert.ok(test.includes('RC529_FAIL: authenticated role can execute backend-only status RPC'), 'integration must assert the authenticated role lacks EXECUTE');
assert.ok(edge.includes('if(rpcError)return out({error:"ORDER_STATUS_UPDATE_FAILED"},400)'), 'database errors must not leak raw provider details');
for (const marker of [
  'RC529_FAIL: cross-branch status mutation succeeded',
  'RC529_FAIL: valid same-branch transition did not persist',
  'RC529_FAIL: customer cancellation did not persist',
  'RC529_FAIL: paid order was cancelled without refund',
  'RC529_FAIL: cross-business owner changed order state',
  'RC529_FAIL: customer cancelled another customer order'
]) assert.ok(test.includes(marker), 'integration must cover ' + marker);

console.log('RC529 order branch-scope and authenticated RPC contract PASS');
