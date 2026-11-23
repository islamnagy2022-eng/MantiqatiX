import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canAddProduct, getRemainingProductsCount, MAX_PRODUCTS_PER_BUSINESS, resolveCatalogQuota } from '../src/utils/rules';
import { readFileSync } from 'node:fs';

const defaultsSource = readFileSync(new URL('../src/data/productionDefaults.ts', import.meta.url), 'utf8');

test('platform and business defaults do not impose a fixed item ceiling', () => {
  assert.equal(MAX_PRODUCTS_PER_BUSINESS, 0);
  assert.match(defaultsSource, /maxAllowedProductsPerBusiness:\s*0/);
});

test('default catalogue quota is unlimited at every item count', () => {
  for (const count of [0, 150, 151, 10000, 1000000]) {
    const quota = resolveCatalogQuota(count);
    assert.equal(quota.isUnlimited, true);
    assert.equal(quota.canAdd, true);
    assert.equal(quota.limit, null);
    assert.equal(quota.remaining, null);
    assert.equal(canAddProduct(count), true);
    assert.equal(getRemainingProductsCount(count), Number.POSITIVE_INFINITY);
  }
});

test('positive server-configured entitlement remains representable', () => {
  const quota = resolveCatalogQuota(8, 10);
  assert.deepEqual(quota, {
    isUnlimited: false,
    limit: 10,
    remaining: 2,
    usagePercent: 80,
    canAdd: true,
  });
  assert.equal(resolveCatalogQuota(10, 10).canAdd, false);
  assert.equal(resolveCatalogQuota(12, 10).remaining, 0);
});

test('invalid and non-positive limits fail open to unlimited rather than imposing a hidden cap', () => {
  for (const limit of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5]) {
    assert.equal(resolveCatalogQuota(999, limit).isUnlimited, true);
    assert.equal(resolveCatalogQuota(999, limit).canAdd, true);
  }
});
