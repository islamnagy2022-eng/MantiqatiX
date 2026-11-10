import assert from 'node:assert/strict';
import test from 'node:test';
import { resolvePublicCatalogAvailability } from '../src/lib/catalogPricing';

test('quote-only products stay available without a numeric price', () => {
  assert.deepEqual(
    resolvePublicCatalogAvailability({ show_price: false, is_available: true }, { available: true }, undefined),
    { requiresQuote: true, available: true },
  );
});

test('quote-only services stay available without a numeric price', () => {
  assert.deepEqual(
    resolvePublicCatalogAvailability({ show_price: false, is_available: true }, { available: true }, null),
    { requiresQuote: true, available: true },
  );
});

test('an explicit quote-only flag also keeps an item available', () => {
  assert.deepEqual(
    resolvePublicCatalogAvailability({ is_available: true }, { requiresQuote: true }, undefined),
    { requiresQuote: true, available: true },
  );
});

test('ordinary items without a current price are not orderable', () => {
  assert.deepEqual(
    resolvePublicCatalogAvailability({ show_price: true, is_available: true }, { available: true }, undefined),
    { requiresQuote: false, available: false },
  );
});

test('priced public items remain available at their normal price', () => {
  assert.deepEqual(
    resolvePublicCatalogAvailability({ show_price: true, is_available: true }, { available: true }, { unit_price: 120 }),
    { requiresQuote: false, available: true },
  );
});

test('an explicitly unavailable item remains unavailable even when quote-only', () => {
  assert.deepEqual(
    resolvePublicCatalogAvailability({ show_price: false, is_available: false }, { available: true }, undefined),
    { requiresQuote: true, available: false },
  );
});

test('item-level availability still overrides a quote-only flag', () => {
  assert.deepEqual(
    resolvePublicCatalogAvailability({ show_price: false, is_available: true }, { available: false }, undefined),
    { requiresQuote: true, available: false },
  );
});
