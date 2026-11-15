import assert from 'node:assert/strict';
import fs from 'node:fs';

const migrationPath = 'supabase/migrations/20261115010000_rc467_commission_scope_hardening.sql';
const testPath = 'supabase/tests/rc467_commission_scope_integration.sql';
const migration = fs.readFileSync(migrationPath, 'utf8');
const test = fs.readFileSync(testPath, 'utf8');

function functionBody(name) {
  const start = migration.indexOf('CREATE OR REPLACE FUNCTION public.' + name + '(');
  assert.notEqual(start, -1, 'Missing replacement for ' + name);
  const end = migration.indexOf('$function$;', start);
  assert.notEqual(end, -1, 'Missing function terminator for ' + name);
  return migration.slice(start, end + '$function$;'.length);
}

const drafts = functionBody('mnty_commission_rule_drafts');
const draftPreview = functionBody('preview_commission_rule_draft');
const resolution = functionBody('preview_commission_rule_resolution');
const financePreview = functionBody('preview_commission_backend');

for (const [name, body] of [
  ['commission draft manager', drafts],
  ['commission draft preview', draftPreview],
  ['commission resolution preview', resolution],
]) {
  assert.ok(body.includes('public.mnty_can_platform_admin()'), name + ' must use the canonical platform-root helper');
  assert.ok(body.includes('PLATFORM_ADMIN_REQUIRED'), name + ' must deny non-platform actors explicitly');
  assert.ok(!body.includes('v_can_manage_tenant') && !body.includes('v_tenant_manager'),
    name + ' must not fall back to tenant OWNER/ADMIN membership');
}

assert.ok(financePreview.includes("SET search_path TO ''"), 'Financial preview must use an empty search_path');
assert.ok(financePreview.includes('public.mnty_can_platform_admin()'), 'Platform Super Admin must retain the global finance preview path');
assert.ok(financePreview.includes('m.business_id = p_business_id'), 'Business finance access must match the requested business');
assert.ok(financePreview.includes('m.branch_id is null'), 'Branch-scoped finance actors must not use a branch-less preview API');
assert.ok(financePreview.includes('FINANCE_SCOPE_REQUIRED'), 'Financial preview must deny out-of-scope business actors');
assert.ok(financePreview.includes("coalesce(auth.jwt()->>'is_anonymous','false') = 'true'"), 'Financial preview must reject anonymous sessions');
assert.ok(!financePreview.includes('assert_financial_membership'), 'Preview must not delegate to the tenant-only helper');

for (const signature of [
  'mnty_commission_rule_drafts(text, character varying, character varying, jsonb)',
  'preview_commission_rule_draft(character varying, character varying, numeric)',
  'preview_commission_rule_resolution(character varying, uuid, character varying, text, text, text, text, numeric)',
  'preview_commission_backend(character varying, uuid, character varying, numeric)',
]) {
  assert.ok(migration.includes('REVOKE ALL ON FUNCTION public.' + signature + ' FROM PUBLIC, anon;'),
    'Missing PUBLIC/anon revoke for ' + signature);
  assert.ok(migration.includes('GRANT EXECUTE ON FUNCTION public.' + signature + ' TO authenticated;'),
    'Missing authenticated grant for ' + signature);
}

for (const token of [
  'RC467_BUSINESS_OWNER_SAVE_WAS_ALLOWED',
  'RC467_BRANCH_OWNER_LIST_WAS_ALLOWED',
  'RC467_TENANT_OWNER_AUDIT_WAS_ALLOWED',
  'RC467_CROSS_BUSINESS_FINANCE_PREVIEW_WAS_ALLOWED',
  'RC467_BRANCH_FINANCE_PREVIEW_WAS_ALLOWED',
  'RC467_ANONYMOUS_FINANCE_PREVIEW_WAS_ALLOWED',
  'RC467_PLATFORM_RESOLUTION_PREVIEW_FAILED',
  'ROLLBACK;',
]) assert.ok(test.includes(token), 'Missing RC467 regression case: ' + token);

console.log('RC467 commission authorization static contract: PASS');
