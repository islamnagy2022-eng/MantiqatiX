import assert from "node:assert/strict";
import test from "node:test";
import { sanitizePublicPromotionalImages, validatePromotionalImages } from "./promotional-images.mjs";

test("accepts up to ten public HTTPS image URLs", () => {
  const input = Array.from({ length: 10 }, (_, index) => `https://cdn.example.test/image-${index}.webp`);
  const result = validatePromotionalImages(input);
  assert.equal(result.valid, true);
  assert.deepEqual(result.images, input);
});

test("rejects more than ten promotional image URLs", () => {
  const input = Array.from({ length: 11 }, (_, index) => `https://cdn.example.test/image-${index}.webp`);
  assert.equal(validatePromotionalImages(input).error, "PROMOTIONAL_IMAGES_LIMIT_EXCEEDED");
});

test("rejects non-array collections", () => {
  assert.equal(validatePromotionalImages("https://cdn.example.test/a.webp").error, "PROMOTIONAL_IMAGES_MUST_BE_ARRAY");
  assert.equal(validatePromotionalImages({ image: "https://cdn.example.test/a.webp" }).valid, false);
});

test("rejects HTTP, malformed and credential-bearing URLs", () => {
  for (const url of [
    "http://cdn.example.test/a.webp",
    "https://user:pass@cdn.example.test/a.webp",
    "https://[invalid-host/a.webp",
    "not-a-url",
  ]) {
    assert.equal(validatePromotionalImages([url]).valid, false, url);
  }
});

test("rejects local hosts, IP literals and custom ports", () => {
  for (const url of [
    "https://localhost/a.webp",
    "https://assets.local/a.webp",
    "https://127.0.0.1/a.webp",
    "https://[::1]/a.webp",
    "https://cdn.example.test:8443/a.webp",
  ]) {
    assert.equal(validatePromotionalImages([url]).valid, false, url);
  }
});

test("trims empty lines and removes duplicate URLs", () => {
  const result = validatePromotionalImages([
    "  https://cdn.example.test/a.webp  ",
    "",
    "https://cdn.example.test/a.webp",
    "https://cdn.example.test/b.webp",
  ]);
  assert.equal(result.valid, true);
  assert.deepEqual(result.images, [
    "https://cdn.example.test/a.webp",
    "https://cdn.example.test/b.webp",
  ]);
});

test("rejects non-string entries and overlong URLs", () => {
  assert.equal(validatePromotionalImages([42]).valid, false);
  assert.equal(validatePromotionalImages(["https://cdn.example.test/" + "a".repeat(1500)]).valid, false);
});

test("public sanitizer fails closed for malformed persisted data", () => {
  assert.deepEqual(sanitizePublicPromotionalImages("https://cdn.example.test/a.webp"), []);
  assert.deepEqual(sanitizePublicPromotionalImages([
    "https://cdn.example.test/a.webp",
    "javascript:alert(1)",
  ]), []);
});
