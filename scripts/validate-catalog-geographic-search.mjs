import assert from 'node:assert/strict';
import fs from 'node:fs';

const view = fs.readFileSync('apps/catalog-frontend/src/components/DirectoryView.tsx', 'utf8');
const production = fs.readFileSync('apps/catalog-frontend/src/lib/production.ts', 'utf8');
const types = fs.readFileSync('apps/catalog-frontend/src/types/index.ts', 'utf8');

assert.match(view, /navigator\.geolocation\.getCurrentPosition/, 'GPS must use the browser geolocation API');
assert.match(view, /onClick=\{requestUserLocation\}/, 'GPS must only be requested after the visitor activates the button');
assert.match(view, /enableHighAccuracy:\s*true/, 'GPS should request high accuracy where supported');
assert.match(view, /PERMISSION_DENIED/, 'permission denial must have a handled fallback');
assert.match(view, /selectedAreaFilter !== 'all'[\s\S]*selectedVillageFilter !== 'all'[\s\S]*selectedMarkazFilter !== 'all'[\s\S]*selectedGovFilter !== 'all'/,
  'empty geographic searches must progressively widen from area to governorate');
assert.match(view, /const aVerified = a\.isVerified \? 0 : 1/, 'verified businesses must rank ahead of unverified businesses');
assert.match(view, /biz\.isVerified \? 'order-1' : 'order-3'/, 'the unified grid must visually prioritize verified businesses');
assert.match(view, /bg-red-600[^\\n]*<span>غير مؤكد<\\/span>/, 'unverified registered activities must be visibly labeled');
assert.match(view, /className="order-2 min-w-0 overflow-hidden rounded-xl/, 'unconfirmed directory records must appear after verified results');
assert.match(view, /distanceKm\(userCoordinates, getCoordinates\(a\)\)/, 'distance ranking must use explicit coordinates');
assert.match(view, /Math\.abs\(latitude\) > 90 \|\| Math\.abs\(longitude\) > 180/, 'invalid coordinates must be rejected');
assert.match(view, /على بُعد/, 'distance should be visible when available');
assert.doesNotMatch(view, /localStorage\.(?:setItem|getItem)\([^\n]*(?:userCoordinates|latitude|longitude)/,
  'visitor GPS coordinates must not be persisted in local storage');
assert.match(types, /latitude\?: number/, 'catalog business type must support optional latitude');
assert.match(types, /longitude\?: number/, 'catalog business type must support optional longitude');
assert.match(production, /branch\.latitude \?\? branch\.lat/, 'branch latitude must be mapped from stored records');
assert.match(production, /branch\.longitude \?\? branch\.lng \?\? branch\.lon/, 'branch longitude must be mapped from stored records');
assert.match(production, /parseOptionalCoordinate\(/, 'stored coordinates must be range-validated before use');

console.log('Catalog geographic search contract: PASS');
