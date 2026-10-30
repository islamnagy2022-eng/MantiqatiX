import assert from 'node:assert/strict';
import fs from 'node:fs';

const view = fs.readFileSync('apps/catalog-frontend/src/components/DirectoryView.tsx', 'utf8');
const production = fs.readFileSync('apps/catalog-frontend/src/lib/production.ts', 'utf8');
const types = fs.readFileSync('apps/catalog-frontend/src/types/index.ts', 'utf8');

assert.match(view, /navigator\.geolocation\.getCurrentPosition/, 'GPS must use the browser geolocation API');
assert.match(view, /onClick=\{requestUserLocation\}/, 'GPS must only be requested after the visitor activates the button');
assert.match(view, /enableHighAccuracy:\s*true/, 'GPS should request high accuracy where supported');
assert.match(view, /PERMISSION_DENIED/, 'permission denial must have a handled fallback');
assert.match(view, /const canWidenGeographicSearch = selectedAreaFilter !== 'all'[\s\S]*selectedVillageFilter !== 'all'[\s\S]*selectedMarkazFilter !== 'all'[\s\S]*selectedGovFilter !== 'all'/,
  'the interface must offer progressive geographic widening from area to governorate');
assert.match(view, /onClick=\{widenGeographicSearch\}/, 'geographic widening must require an explicit visitor action');
assert.doesNotMatch(view, /If a selected area has no results, widen geography[\s\S]*?useEffect\(/,
  'the selected geographic scope must not change automatically when results are empty');
assert.match(view, /window\.isSecureContext/, 'GPS must explain when a secure context is required');
assert.match(view, /POSITION_UNAVAILABLE/, 'unavailable device location must have a clear fallback');
assert.match(view, /coords\.accuracy/, 'GPS accuracy must be checked and communicated');
assert.match(view, /if \(a\.isVerified !== b\.isVerified\) return a\.isVerified \? -1 : 1/, 'verified businesses must rank ahead of unverified businesses');
assert.match(view, /biz\.isVerified \? 'order-1' : 'order-3'/, 'the unified grid must visually prioritize verified businesses');
assert.match(view, /bg-red-600/, 'unverified registered activities must use the warning badge color');
assert.match(view, /غير مؤكد/, 'unverified registered activities must be visibly labeled');
assert.match(view, /className="order-2 min-w-0 overflow-hidden rounded-xl/, 'unconfirmed directory records must appear after verified results');
assert.match(view, /distanceKm\(userCoordinates, getCoordinates\(a\)\)/, 'distance ranking must use explicit coordinates');
assert.match(view, /Math\.abs\(latitude\) > 90 \|\| Math\.abs\(longitude\) > 180/, 'invalid coordinates must be rejected');
assert.match(view, /على بُعد/, 'distance should be visible when available');
assert.doesNotMatch(view, /localStorage\.(?:setItem|getItem)\([^\n]*(?:userCoordinates|latitude|longitude)/,
  'visitor GPS coordinates must not be persisted in local storage');
assert.match(types, /latitude\?: number/, 'catalog business type must support optional latitude');
assert.match(types, /longitude\?: number/, 'catalog business type must support optional longitude');
assert.match(production, /function parseFirstOptionalCoordinate\([\s\S]*?for \(const value of values\)[\s\S]*?if \(parsed !== undefined\) return parsed/, 'coordinate mapping must fall through empty or invalid fields to the next valid candidate');
assert.match(production, /branchMetadata\.latitude[\s\S]*?branchLocation\.latitude/, 'branch metadata and nested location coordinates must be mapped');
assert.match(production, /profileMetadata\.latitude[\s\S]*?profileLocation\.latitude/, 'profile metadata and nested location coordinates must be mapped');
assert.match(production, /rawMetadata\.latitude[\s\S]*?rawLocation\.latitude/, 'raw activity metadata and nested location coordinates must be mapped');
assert.match(production, /latitude_deg/, 'alternate explicit latitude fields must be supported');
assert.match(production, /longitude_deg/, 'alternate explicit longitude fields must be supported');
assert.match(production, /parseOptionalCoordinate\(/, 'stored coordinates must be range-validated before use');

console.log('Catalog geographic search contract: PASS');
