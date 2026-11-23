import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const navbar = readFileSync('apps/catalog-frontend/src/components/Navbar.tsx', 'utf8');
const types = readFileSync('apps/catalog-frontend/src/types/index.ts', 'utf8');
const production = readFileSync('apps/catalog-frontend/src/lib/production.ts', 'utf8');
const context = readFileSync('apps/catalog-frontend/src/context/AppContext.tsx', 'utf8');

assert.ok(types.includes('businessCode?: string'), 'Business must expose the canonical Supabase business code');
assert.ok(production.includes("businessCode: String(raw.code || '')"), 'The production mapper must preserve the canonical database business code');
assert.ok(navbar.includes('[...directoryBusinesses, ...businesses].find'), 'Marketing target must resolve from public and authorized business registries');
assert.ok(navbar.includes("String(business.businessCode || '').trim().toUpperCase() === 'MNTY-MARKETING'"), 'Marketing target must use the canonical MNTY-MARKETING code');
assert.ok(navbar.includes('disabled={!marketingBusiness || marketingOpening}'), 'Button must fail closed while unavailable or opening');
assert.ok(navbar.includes('if (!marketingBusiness || marketingOpening) return;') && navbar.includes('await openPublicBusiness(marketingBusiness.id)'), 'Click must load the exact resolved activity through the public catalog path');
assert.ok(context.includes('const openPublicBusiness = async (businessId: string): Promise<boolean> => {') && context.includes('const catalog = await fetchPublicCatalog(businessId).catch(() => null);') && context.includes("setCurrentView('public_storefront');"), 'Public business opening must fetch and install the actual catalog before navigation');
assert.ok(!navbar.includes('biz_mantiqatix_marketing'), 'Synthetic non-database business IDs must never be used');
console.log('MARKETING_OFFICIAL_STOREFRONT_TARGET=PASS');
