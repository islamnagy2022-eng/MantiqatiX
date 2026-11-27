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
assert.match(loader, /const requestId=\+\+loadSequence\.current/, 'Each people/role refresh must receive a request sequence.');
assert.match(loader, /if\(requestId!==loadSequence\.current\)return/, 'An older search response must not overwrite a newer response.');
assert.match(loader, /setRoles\(\[\]\);setPeople\(\[\]\);setAssignments\(\[\]\)/, 'A failed control-center refresh must clear stale privileged lists.');
assert.match(loader, /resolveVisiblePersonId\(current,nextPeople\)/, 'Selected person must be reconciled against the latest result list.');

const assignStart = source.indexOf('const assignRole=async');
const assignEnd = source.indexOf('\n  const revokeAssignment=', assignStart);
assert.ok(assignStart >= 0 && assignEnd > assignStart, 'Role assignment handler must remain discoverable.');
const assignHandler = source.slice(assignStart, assignEnd);
assert.match(assignHandler, /findVisiblePerson\(selectedPersonId,people\)/, 'Role assignment must resolve the target from current visible search results.');
assert.ok(assignHandler.indexOf('findVisiblePerson(selectedPersonId,people)') < assignHandler.indexOf("supabase.rpc('mnty_platform_admin_assign_custom_role'"), 'Target validation must occur before the role-assignment RPC.');
assert.match(source, /event\.key==='Enter'.*loadAll\(\)/, 'The people search must also run when the user presses Enter.');

console.log('SUPER_ADMIN_PERSON_SEARCH_SELECTION=PASS');
