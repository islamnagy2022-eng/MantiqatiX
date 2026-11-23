import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const navbar = readFileSync('apps/catalog-frontend/src/components/Navbar.tsx', 'utf8');
const types = readFileSync('apps/catalog-frontend/src/types/index.ts', 'utf8');
const production = readFileSync('apps/catalog-frontend/src/lib/production.ts', 'utf8');
const context = readFileSync('apps/catalog-frontend/src/context/AppContext.tsx', 'utf8');

assert.match(types, /businessCode\\?: string/, 'Business must expose the canonical Supabase business code');
assert.match(production, /businessCode: String\\(raw\\.code \\|\\| ''\\)/, 'The production mapper must preserve the canonical database business code');
assert.match(navbar, /\\[\\.\\.\\.directoryBusinesses, \\.\\.\\.businesses\\]\\.find/, 'Marketing target must resolve from public and authorized business registries');
assert.match(navbar, /business\\.businessCode \\|\\| ''\\)\\.trim\\(\\)\\.toUpperCase\\(\\) === 'MNTY-MARKETING'/, 'Marketing target must use the canonical MNTY-MARKETING code');
assert.match(navbar, /disabled=\\{!marketingBusiness \\|\\| marketingOpening\\}/, 'Button must fail closed while unavailable or opening');
assert.match(navbar, /if \\(!marketingBusiness \\|\\| marketingOpening\\) return;[\\s\\S]*await openPublicBusiness\\(marketingBusiness\\.id\\)/, 'Click must load the exact resolved activity through the public catalog path');
assert.match(context, /const openPublicBusiness = async \\(businessId: string\\)[\\s\\S]*fetchPublicCatalog\\(businessId\\)[\\s\\S]*setCurrentView\\('public_storefront'\\)/, 'Public business opening must fetch and install the actual catalog before navigation');
assert.doesNotMatch(navbar, /biz_mantiqatix_marketing/, 'Synthetic non-database business IDs must never be used');
console.log('MARKETING_OFFICIAL_STOREFRONT_TARGET=PASS');
