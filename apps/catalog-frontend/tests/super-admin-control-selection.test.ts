import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findVisiblePerson, resolveVisiblePersonId } from '../src/components/admin/superAdminControlSelection';

const people = [
  { id: 'person-a', email: 'a@example.test' },
  { id: 'person-b', email: 'b@example.test' },
];

assert.equal(resolveVisiblePersonId('person-b', people), 'person-b', 'A still-visible selection should be preserved.');
assert.equal(resolveVisiblePersonId('person-old', people), 'person-a', 'A filtered-out selection must move to the first current result.');
assert.equal(resolveVisiblePersonId('person-old', []), '', 'An empty search result must clear the previous selection.');
assert.equal(findVisiblePerson('person-old', people), null, 'Assignment lookup must reject an ID outside the current result list.');
assert.equal(findVisiblePerson('person-b', people)?.email, 'b@example.test', 'Assignment lookup must return only a currently visible person.');

const source = readFileSync('src/components/admin/SuperAdminControlCenter.tsx', 'utf8');
const loadStart = source.indexOf('const loadAll=useCallback(async()=>{');
const loadEnd = source.indexOf('\n\n  const loadAudit=', loadStart);
assert.ok(loadStart >= 0 && loadEnd > loadStart, 'The control center loader must remain discoverable.');
const loader = source.slice(loadStart, loadEnd);
assert.match(loader, /const requestId=\+\+loadSequence\.current/, 'Each refresh must receive a request sequence.');
assert.match(loader, /if\(requestId!==loadSequence\.current\)return false/, 'An older response must not overwrite a newer response.');
assert.match(loader, /setRoles\(\[\]\);setPeople\(\[\]\);setAssignments\(\[\]\);setRoleId\(''\);setSelectedPersonId\(''\)/, 'A failed refresh must clear stale privileged lists and selections.');
assert.match(loader, /resolveVisiblePersonId\(current,nextPeople\)/, 'Selected person must be reconciled against latest results.');
assert.match(loader, /if\(requestId===loadSequence\.current\)setLoading\(false\)/, 'An older request must not release the latest request loading state.');

const assignStart = source.indexOf('const assignRole=async');
const assignEnd = source.indexOf('\n  const revokeAssignment=', assignStart);
assert.ok(assignStart >= 0 && assignEnd > assignStart, 'Role assignment handler must remain discoverable.');
const assignHandler = source.slice(assignStart, assignEnd);
assert.match(assignHandler, /findVisiblePerson\(selectedPersonId,people\)/, 'Assignment must resolve the target from current visible results.');
assert.ok(assignHandler.indexOf('findVisiblePerson(selectedPersonId,people)') < assignHandler.indexOf("supabase.rpc('mnty_platform_admin_assign_custom_role'"), 'Target validation must occur before the role-assignment RPC.');
assert.match(source, /event\.key==='Enter'.*loadAll\(\)/, 'The people search must also run when the user presses Enter.');

console.log('SUPER_ADMIN_PERSON_SEARCH_SELECTION=PASS');


// Business subscriber role editor must stay aligned with the backend allowlist and retain branch scope.
const businessSubscriberSource = readFileSync('src/components/admin/BusinessSubscriberAdmin.tsx', 'utf8');
const platformAdminEndpointSource = readFileSync('../../supabase/functions/catalog-platform-admin/index.ts', 'utf8');
assert.ok(!businessSubscriberSource.includes('window.prompt('), 'Role changes must use the controlled role editor, not free-form text.');
assert.ok(businessSubscriberSource.includes("branchId:m.branch_id||''"), 'Role changes must preserve the selected membership branch.');
assert.ok(platformAdminEndpointSource.includes('select("id,user_id,tenant_id,business_id,branch_id,role,status,permissions")'), 'The protected admin list must expose the current branch scope to the UI.');
const uiRoleBlock = businessSubscriberSource.split('const membershipRoleOptions = [')[1]?.split('] as const;')[0] || '';
const apiRoleStart = platformAdminEndpointSource.indexOf('const allowedRoles = new Set([', platformAdminEndpointSource.indexOf('if (action === "SAVE_MEMBERSHIP")'));
const apiRoleEnd = platformAdminEndpointSource.indexOf(']);', apiRoleStart);
assert.ok(uiRoleBlock && apiRoleStart >= 0 && apiRoleEnd > apiRoleStart, 'Both the UI role options and backend allowlist must remain discoverable.');
const uiRoles = [...uiRoleBlock.matchAll(/value: '([A-Z_]+)'/g)].map(match => match[1]).sort();
const apiRoles = [...platformAdminEndpointSource.slice(apiRoleStart, apiRoleEnd).matchAll(/"([A-Z_]+)"/g)].map(match => match[1]).sort();
assert.deepEqual(uiRoles, apiRoles, 'The UI role options must exactly match the server allowlist.');
console.log('BUSINESS_SUBSCRIBER_ROLE_EDITOR_SCOPE_AND_ALLOWLIST=PASS');


// A role-only update must not reset independent catalog permissions or change a suspended membership's state.
assert.ok(businessSubscriberSource.includes("status:['ACTIVE','INACTIVE','SUSPENDED'].includes(String(m.status||'').toUpperCase())?String(m.status).toUpperCase():'INACTIVE'"), 'Role changes must preserve the exact supported membership state.');
assert.ok(!businessSubscriberSource.includes('catalogEnabled:true,catalogWrite:true,accountRestricted:false'), 'Role changes must not silently grant catalog read/write permissions.');
assert.ok(platformAdminEndpointSource.includes('typeof body.catalogEnabled === "boolean" ? body.catalogEnabled : previousPermissions.catalog !== false'), 'Omitted catalog settings must retain the existing membership permissions.');
assert.ok(platformAdminEndpointSource.includes('typeof body.catalogWrite === "boolean" ? body.catalogWrite : previousPermissions.catalog_write !== false'), 'Omitted catalog write settings must retain the existing write permissions.');
assert.ok(platformAdminEndpointSource.includes('typeof body.accountRestricted === "boolean"'), 'Omitted account restriction settings must retain the current restriction state.');
console.log('BUSINESS_SUBSCRIBER_ROLE_UPDATE_PRESERVES_MEMBERSHIP_PERMISSIONS=PASS');


// Legacy platform-owner memberships must be marked protected in the management view.
assert.ok(platformAdminEndpointSource.includes('branch_id,role,status,permissions'), 'Business memberships must include permission metadata for protected-account detection.');
assert.ok(platformAdminEndpointSource.includes('is_platform_account: String(m.role || "").toUpperCase() === "SUPER_ADMIN" || isProtectedPlatformMembership(m)'), 'Protected platform memberships must be explicitly marked in the read model.');
assert.ok(businessSubscriberSource.includes('حساب منصة محمي · غير قابل للتعديل هنا'), 'The UI must not present ordinary membership controls for protected platform accounts.');
console.log('BUSINESS_SUBSCRIBER_PROTECTED_PLATFORM_MEMBERSHIPS=PASS');


// Unknown legacy roles must never silently default to CUSTOMER in the role editor.
assert.ok(businessSubscriberSource.includes('const openRoleEditor=(membership:Membership)=>{'), 'Role editor must validate the current role before opening.');
assert.ok(businessSubscriberSource.includes('if(!membershipRoleOptions.some((option)=>option.value===currentRole))'), 'Unsupported legacy roles must be rejected from the editor.');
assert.ok(businessSubscriberSource.includes('الدور الحالي غير موجود في قائمة الأدوار الآمنة'), 'The UI must explain why an unsupported role cannot be edited.');
assert.ok(businessSubscriberSource.includes('onClick={()=>openRoleEditor(m)}'), 'Membership role controls must use the guarded editor opener.');
assert.ok(!businessSubscriberSource.includes("?String(m.role).toUpperCase():'CUSTOMER'"), 'No unknown membership role may be silently downgraded to CUSTOMER.');
console.log('BUSINESS_SUBSCRIBER_UNKNOWN_ROLE_FAILS_CLOSED=PASS');
