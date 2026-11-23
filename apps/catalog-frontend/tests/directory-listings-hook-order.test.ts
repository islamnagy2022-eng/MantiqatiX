import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/components/DirectoryListingsView.tsx', 'utf8');
const emptySearchGuard = source.indexOf(
  'if (!detailSlug && searchQuery.trim() && !functionalGroupId && !taxonomyCategoryId && inTaxonomyScope.length === 0) return null;',
);

assert.notEqual(emptySearchGuard, -1, 'The empty global-search guard must remain present.');

const hookCalls = [...source.matchAll(/\buse(?:Effect|Memo|State)\s*\(/g)].map((match) => match.index ?? -1);
assert.ok(hookCalls.length > 0, 'Expected component Hooks to be present.');
const lastHookCall = Math.max(...hookCalls);

assert.ok(
  lastHookCall < emptySearchGuard,
  'The empty-search return must remain after every Hook call to preserve React Hook order.',
);

console.log('DIRECTORY_LISTINGS_HOOK_ORDER=PASS');
