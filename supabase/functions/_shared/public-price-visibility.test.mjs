import assert from "node:assert/strict";
import test from "node:test";
import {
  filterRowsToPubliclyPricedItems,
  getExplicitlyPublicComparePrice,
  hasExplicitPublicPricePermission,
  requiresPublicQuote,
} from "./public-price-visibility.mjs";

const item = (id, showPrice, extra = {}) => ({
  id,
  item_type: "PRODUCT",
  metadata: { catalog_public: { show_price: showPrice, ...extra } },
});

test("missing or false show_price never grants public price disclosure", () => {
  for (const candidate of [
    { id: "missing", item_type: "PRODUCT", metadata: { catalog_public: {} } },
    item("false", false, { compare_price: 180 }),
    { id: "missing-metadata", item_type: "PRODUCT", metadata: {} },
    { id: "malformed", item_type: "PRODUCT", metadata: { catalog_public: "true" } },
  ]) {
    assert.equal(hasExplicitPublicPricePermission(candidate), false);
    assert.equal(getExplicitlyPublicComparePrice(candidate), null);
  }
});

test("only an explicit boolean true permits a finite non-negative compare price", () => {
  assert.equal(getExplicitlyPublicComparePrice(item("valid", true, { compare_price: "120.5" })), 120.5);
  assert.equal(getExplicitlyPublicComparePrice(item("zero", true, { compare_price: 0 })), 0);
  assert.equal(getExplicitlyPublicComparePrice(item("negative", true, { compare_price: -1 })), null);
  assert.equal(getExplicitlyPublicComparePrice(item("nan", true, { compare_price: "not-a-price" })), null);
  assert.equal(getExplicitlyPublicComparePrice(item("absent", true)), null);
});

test("service without explicit public price permission is quote-only", () => {
  assert.equal(requiresPublicQuote({ item_type: "SERVICE", metadata: { catalog_public: {} } }), true);
  assert.equal(requiresPublicQuote({ item_type: "SERVICE", metadata: { catalog_public: { show_price: false } } }), true);
  assert.equal(requiresPublicQuote({ item_type: "SERVICE", metadata: { catalog_public: { show_price: true } } }), false);
  assert.equal(requiresPublicQuote({ item_type: "PRODUCT", metadata: { catalog_public: {} } }), false);
});

test("price and option rows are returned only for items with explicit public permission", () => {
  const items = [
    item("public-item", true),
    item("private-item", false),
    { id: "missing-flag", item_type: "PRODUCT", metadata: { catalog_public: {} } },
  ];
  const rows = [
    { catalog_item_id: "public-item", unit_price: 50 },
    { catalog_item_id: "private-item", unit_price: 20 },
    { catalog_item_id: "missing-flag", unit_price: 10 },
    { catalog_item_id: "unknown-item", unit_price: 5 },
  ];

  assert.deepEqual(
    filterRowsToPubliclyPricedItems(items, rows),
    [{ catalog_item_id: "public-item", unit_price: 50 }],
  );
});

test("malformed collections fail closed without throwing", () => {
  assert.deepEqual(filterRowsToPubliclyPricedItems(null, [{ catalog_item_id: "x" }]), []);
  assert.deepEqual(filterRowsToPubliclyPricedItems([item("x", true)], null), []);
});
