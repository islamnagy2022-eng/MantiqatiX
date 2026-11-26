import assert from "node:assert/strict";
import test from "node:test";
import {
  hasPromotionalGalleryCapability,
  hasPromotionalGalleryChanges,
} from "../src/utils/promotionalGalleryCapability";

test("recognizes the RC928 read contract when the gallery field is explicitly returned", () => {
  assert.equal(hasPromotionalGalleryCapability({
    business: { profile: { promotionalImages: [] } },
  }), true);
  assert.equal(hasPromotionalGalleryCapability({
    business: { profile: { promotionalImages: ["https://cdn.example.test/a.webp"] } },
  }), true);
});

test("fails closed for older catalog-admin responses without the gallery property", () => {
  assert.equal(hasPromotionalGalleryCapability({ business: { profile: {} } }), false);
  assert.equal(hasPromotionalGalleryCapability({ business: { profile: { promotional_images: [] } } }), false);
  assert.equal(hasPromotionalGalleryCapability({ business: {} }), false);
  assert.equal(hasPromotionalGalleryCapability(null), false);
  assert.equal(hasPromotionalGalleryCapability([]), false);
});

test("does not force a capability probe when a caller omits the optional gallery field", () => {
  assert.equal(hasPromotionalGalleryChanges(["https://cdn.example.test/kept.webp"], undefined), false);
});

test("does not force a capability probe for unchanged normalized galleries", () => {
  assert.equal(hasPromotionalGalleryChanges([], []), false);
  assert.equal(hasPromotionalGalleryChanges(
    [" https://cdn.example.test/a.webp ", "", "https://cdn.example.test/a.webp"],
    ["https://cdn.example.test/a.webp"],
  ), false);
});

test("detects additions, removals and ordering changes", () => {
  assert.equal(hasPromotionalGalleryChanges([], ["https://cdn.example.test/a.webp"]), true);
  assert.equal(hasPromotionalGalleryChanges(
    ["https://cdn.example.test/a.webp"],
    [],
  ), true);
  assert.equal(hasPromotionalGalleryChanges(
    ["https://cdn.example.test/a.webp", "https://cdn.example.test/b.webp"],
    ["https://cdn.example.test/b.webp", "https://cdn.example.test/a.webp"],
  ), true);
});

test("ignores malformed non-string entries consistently", () => {
  assert.equal(hasPromotionalGalleryChanges([42], []), false);
  assert.equal(hasPromotionalGalleryChanges(["https://cdn.example.test/a.webp", null], [
    "https://cdn.example.test/a.webp",
  ]), false);
});
