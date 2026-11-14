import test from "node:test";
import assert from "node:assert/strict";
import {
  hashDirectoryScope,
  issueDirectoryCursor,
  matchesDirectoryBusinessFilters,
  normalizeDirectoryFilters,
  parseDirectorySlugs,
  verifyDirectoryCursor,
} from "./public-directory-pagination.mjs";

const secret = "test-only-cursor-secret-that-is-at-least-32-bytes-long";
const id = "123e4567-e89b-42d3-a456-426614174000";

test("normalizes only approved filters and bounds values", () => {
  assert.deepEqual(normalizeDirectoryFilters(new URLSearchParams(
    "activity=%20%20مطاعم%20%20%20ومقاهي%20&specialty=حلويات&governorate=المنوفية&markaz=بركة%20السبع&village=الروضة&other=no"
  )), {
    activity: "مطاعم ومقاهي", specialty: "حلويات", governorate: "المنوفية",
    markaz: "بركة السبع", village: "الروضة",
  });
  assert.equal(normalizeDirectoryFilters({ specialty: "x".repeat(130) }).specialty.length, 100);
});

test("rejects oversized slug filters and de-duplicates valid slugs", () => {
  assert.deepEqual(parseDirectorySlugs("one,two,one"), { ok: true, slugs: ["one", "two"] });
  assert.equal(parseDirectorySlugs(Array.from({ length: 21 }, (_, i) => "s" + i).join(",")).ok, false);
  assert.equal(parseDirectorySlugs("x".repeat(4001)).ok, false);
});

test("Activity/Specialty/geographic filters match public business projection fields", () => {
  const business = {
    name: "مخبز الروضة",
    settings: {
      category_code: "food",
      activity_category_code: "cat_food_bakery",
      activity_specialty: "مخبوزات",
      catalog_profile: { governorate: "المنوفية", markaz: "بركة السبع", village: "الروضة" },
    },
  };
  const provider = { provider_kind: "food", name_ar: "مخبز الروضة" };
  assert.equal(matchesDirectoryBusinessFilters(business, provider, {
    activity: "FOOD", specialty: "مخبوزات", governorate: "المنوفية", markaz: "بركة السبع", village: "الروضة",
  }), true);
  assert.equal(matchesDirectoryBusinessFilters(business, provider, { activity: "cat_food_bakery" }), true);
  assert.equal(matchesDirectoryBusinessFilters(business, provider, { village: "طنطا" }), false);
  assert.equal(matchesDirectoryBusinessFilters(business, provider, { specialty: "حلويات" }), false);
});

test("scope hash is stable and changes when a filter changes", async () => {
  const a = await hashDirectoryScope({ activity: "مطاعم", governorate: "المنوفية" }, ["b", "a"]);
  const b = await hashDirectoryScope({ governorate: "المنوفية", activity: "مطاعم" }, ["a", "b"]);
  const c = await hashDirectoryScope({ activity: "صيدليات", governorate: "المنوفية" }, ["a", "b"]);
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("signed cursor round-trips and is bound to filter scope", async () => {
  const scopeHash = await hashDirectoryScope({ governorate: "المنوفية" }, []);
  const token = await issueDirectoryCursor({
    lastId: id, snapshotAt: "2026-11-14T00:00:00.000Z", scopeHash, secret, now: Date.parse("2026-11-14T00:01:00.000Z"),
  });
  const decoded = await verifyDirectoryCursor(token, { scopeHash, secret, now: Date.parse("2026-11-14T00:02:00.000Z") });
  assert.deepEqual(decoded, { ok: true, lastId: id, snapshotAt: "2026-11-14T00:00:00.000Z" });
  assert.deepEqual(await verifyDirectoryCursor(token, {
    scopeHash: await hashDirectoryScope({ governorate: "الغربية" }, []), secret, now: Date.parse("2026-11-14T00:02:00.000Z"),
  }), { ok: false, code: "INVALID_CURSOR" });
});

test("tampered, expired and malformed cursors are rejected", async () => {
  const scopeHash = await hashDirectoryScope({}, []);
  const now = Date.parse("2026-11-14T12:00:00.000Z");
  const token = await issueDirectoryCursor({
    lastId: id, snapshotAt: "2026-11-14T12:00:00.000Z", scopeHash, secret, now,
  });
  assert.deepEqual(await verifyDirectoryCursor(token.slice(0, -2) + "aa", { scopeHash, secret, now }), { ok: false, code: "INVALID_CURSOR" });
  assert.deepEqual(await verifyDirectoryCursor(token, { scopeHash, secret, now: now + 7 * 60 * 60 * 1000 }), { ok: false, code: "INVALID_CURSOR" });
  assert.deepEqual(await verifyDirectoryCursor("bad.cursor", { scopeHash, secret, now }), { ok: false, code: "INVALID_CURSOR" });
});
