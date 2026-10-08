import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('web/app.js', 'utf8');

// Restaurant source failures must survive loading and render as an explicit
// unavailable state instead of being indistinguishable from a valid empty list.
assert.match(app, /cache\.rows\.__errors\s*=\s*cache\.errors/, 'restaurant source errors must be carried to the renderer');
assert.match(app, /const errors\s*=\s*rows\.__errors\s*\|\|\s*\{\}/, 'restaurant renderer must read source errors');
assert.match(app, /NOT AVAILABLE/, 'restaurant source errors must be shown as unavailable');
assert.match(app, /esc\(errors\[key\]\)/, 'source error messages must be HTML escaped');

// CRM/support controls and mutation entry points must use the canonical RBAC
// contract; a hard-coded role list is not an authorization source.
assert.match(app, /MNTY_RBAC\?\.can\(role,\s*'CRM',\s*'create',\s*live\.permissions\)\s*===\s*true/, 'CRM create action must be RBAC-gated');
assert.match(app, /MNTY_RBAC\?\.can\(role,\s*'SUPPORT',\s*'create',\s*live\.permissions\)\s*===\s*true/, 'support create action must be RBAC-gated');
assert.match(app, /function canManageSupport\(\)\s*\{\s*return window\.MNTY_RBAC\?\.can\(String\(live\.role\|\|''\),\s*'SUPPORT',\s*'update',\s*live\.permissions\)\s*===\s*true\s*\}/, 'support update must use canonical RBAC');

console.log('RC450 restaurant source-state and CRM/support RBAC contract PASS');
