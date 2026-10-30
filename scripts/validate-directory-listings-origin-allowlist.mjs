import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('supabase/functions/directory-listings/index.ts', 'utf8');
const start = source.indexOf('const allowedOrigins = new Set([');
const end = source.indexOf(']);', start);
assert.ok(start >= 0 && end > start, 'directory-listings must define an explicit CORS allowlist');
const allowlist = source.slice(start, end);
assert.ok(allowlist.includes('"https://islamnagy2022-eng.github.io"'), 'the canonical GitHub Pages catalog origin must remain allowed');
assert.ok(!allowlist.includes('catalog.tagerflow.com'), 'the retired catalog domain must not remain in the directory CORS allowlist');
assert.ok(allowlist.includes('"http://localhost:8080"'), 'local development origin must remain available');
console.log('DIRECTORY_LISTINGS_ORIGIN_ALLOWLIST=PASS');
