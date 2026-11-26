import test from "node:test";
import assert from "node:assert/strict";
import { getExplicitPublicContact } from "./public-contact-visibility.mjs";
import {
  getNextDirectoryCursorPosition,
  hashDirectoryScope,
  issueDirectoryCursor,
  matchesDirectoryAreaFilter,
  matchesDirectoryVerificationPhase,
  mergePublicDirectoryCatalogItems,
  matchesDirectoryBusinessFilters,
  normalizeDirectoryFilters,
  parseDirectorySlugs,
  verifyDirectoryCursor,
} from "./public-directory-pagination.mjs";

const secret = "test-only-cursor-secret-that-is-at-least-32-bytes-long";
const id = "123e4567-e89b-42d3-a456-426614174000";

test("global and branch catalogue rows share one sorted page cap", () => {
  const globalItems = Array.from({ length: 150 }, (_, index) => ({
    id: `global-${String(index).padStart(3, "0")}`,
    name_ar: `ز منتج عام ${index}`,
  }));
  const branchItems = [
    { id: "branch-first", name_ar: "أ منتج خاص بالفرع" },
    { id: "global-000", name_ar: "أ نسخة مكررة من المنتج العام" },
  ];

  const merged = mergePublicDirectoryCatalogItems(globalItems, branchItems, 150);

  assert.equal(merged.length, 150);
  assert.equal(merged[0].id, "branch-first",
    "An earlier-sorting branch row must not be discarded merely because global rows were concatenated first.");
  assert.equal(merged.filter((item) => item.id === "global-000").length, 1,
    "Unexpected duplicate IDs must be emitted once, preferring the branch projection.");
  assert.equal(merged.find((item) => item.id === "global-000").name_ar, "أ نسخة مكررة من المنتج العام");
});

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

test("Specialty filter uses only public business/profile fields and ignores unapproved provider fields", () => {
  const business = {
    settings: {
      activity_specialty: "طب الأطفال",
      catalog_profile: { specialty: "جلدية", governorate: "المنوفية" },
    },
  };
  const provider = { provider_kind: "HEALTH", specialties: ["باطنة خاصة لا يجوز طلبها"] };
  assert.equal(matchesDirectoryBusinessFilters(business, provider, { specialty: "طب الأطفال" }), true);
  assert.equal(matchesDirectoryBusinessFilters(business, provider, { specialty: "جلدية" }), true);
  assert.equal(matchesDirectoryBusinessFilters(business, provider, { specialty: "باطنة خاصة لا يجوز طلبها" }), false);
});

test("area filter matches only the consent-projected branch-aware address", () => {
  const privateProfile = {
    address: "عنوان خاص على مستوى النشاط",
    public_contact_enabled: false,
    public_contact_consent_audit_verified: false,
  };
  const consentedProfile = {
    address: "",
    public_contact_enabled: true,
    public_contact_consent_audit_verified: true,
  };
  const missingAuditProfile = {
    address: "",
    public_contact_enabled: true,
    public_contact_consent_audit_verified: false,
  };
  const branch = { address: "فرع طنطا شارع الجمهورية", phone: "01012345678" };
  const privateProjection = getExplicitPublicContact(privateProfile, branch);
  const consentedProjection = getExplicitPublicContact(consentedProfile, branch);
  const missingAuditProjection = getExplicitPublicContact(missingAuditProfile, branch);

  assert.equal(privateProjection.address, "");
  assert.equal(matchesDirectoryAreaFilter(privateProjection.address, "الجمهورية"), false);
  assert.equal(consentedProjection.address, "فرع طنطا شارع الجمهورية");
  assert.equal(matchesDirectoryAreaFilter(consentedProjection.address, "الجمهورية"), true);
  assert.equal(missingAuditProjection.address, "");
  assert.equal(matchesDirectoryAreaFilter(missingAuditProjection.address, "الجمهورية"), false);
  assert.equal(matchesDirectoryAreaFilter("", "الجمهورية"), false);
  assert.equal(matchesDirectoryAreaFilter("فرع طنطا شارع الجمهورية", ""), true);
  assert.equal(matchesDirectoryAreaFilter(privateProjection.address, ""), true);

  assert.equal(matchesDirectoryBusinessFilters({
    settings: { catalog_profile: privateProfile },
  }, {}, { query: "عنوان خاص" }), false);
  assert.equal(matchesDirectoryBusinessFilters({
    settings: { catalog_profile: consentedProfile },
  }, {}, { query: "فرع طنطا شارع الجمهورية" }), false,
  "Consent-gated address must remain excluded from general free-text search.");
});
test("free-text search matches public profile data but never private contact fields", () => {
  const business = {
    name: "مركز الروضة الطبي",
    phone: "01012345678",
    address: "شارع سري لا يظهر بدون موافقة",
    settings: {
      catalog_profile: { description: "خدمات طبية متخصصة", category: "مخابز", governorate: "المنوفية" },
    },
  };
  const provider = { name_ar: "مركز الروضة", description: "رعاية صحية", specialties: ["أطفال"] };
  assert.equal(matchesDirectoryBusinessFilters(business, provider, { query: "الروضة طبي" }), true);
  assert.equal(matchesDirectoryBusinessFilters(business, provider, { query: "مخابز" }), true);
  assert.equal(matchesDirectoryBusinessFilters(business, provider, { query: "المنوفية" }), true);
  assert.equal(matchesDirectoryBusinessFilters(business, provider, { query: "01012345678" }), false);
  assert.equal(matchesDirectoryBusinessFilters(business, provider, { query: "شارع سري" }), false);
});

test("geographic filters ignore administrative prefixes and Arabic spelling variants", () => {
  const business = { settings: { catalog_profile: {
    governorate: "المنوفيه",
    markaz: "بركه السبع",
    village: "قرية الروضة",
  } } };
  assert.equal(matchesDirectoryBusinessFilters(business, {}, {
    governorate: "محافظة المنوفية",
    markaz: "مركز بركة السبع",
    village: "الروضة",
  }), true);
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
  assert.deepEqual(decoded, { ok: true, phase: "verified", lastId: id, snapshotAt: "2026-11-14T00:00:00.000Z" });
  assert.deepEqual(await verifyDirectoryCursor(token, {
    scopeHash: await hashDirectoryScope({ governorate: "الغربية" }, []), secret, now: Date.parse("2026-11-14T00:02:00.000Z"),
  }), { ok: false, code: "INVALID_CURSOR" });
});

test("verified-first cursor phases safely cross from verified results to unverified results", async () => {
  assert.equal(matchesDirectoryVerificationPhase({ is_verified: true }, "verified"), true);
  assert.equal(matchesDirectoryVerificationPhase({ is_verified: false }, "verified"), false);
  assert.equal(matchesDirectoryVerificationPhase({ is_verified: null }, "unverified"), true);
  assert.equal(matchesDirectoryVerificationPhase({ is_verified: true }, "unverified"), false);

  assert.deepEqual(getNextDirectoryCursorPosition({
    lastId: id, lastPhase: "verified", lookaheadPhase: "unverified",
  }), { phase: "unverified", lastId: null });
  assert.deepEqual(getNextDirectoryCursorPosition({
    lastId: id, lastPhase: "unverified", lookaheadPhase: "unverified",
  }), { phase: "unverified", lastId: id });
  assert.deepEqual(getNextDirectoryCursorPosition({
    lastId: id, lastPhase: "verified", lookaheadPhase: "verified",
  }), { phase: "verified", lastId: id });

  const scopeHash = await hashDirectoryScope({}, []);
  const token = await issueDirectoryCursor({
    lastId: null, phase: "unverified", snapshotAt: "2026-11-14T12:00:00.000Z",
    scopeHash, secret, now: Date.parse("2026-11-14T12:01:00.000Z"),
  });
  assert.deepEqual(await verifyDirectoryCursor(token, {
    scopeHash, secret, now: Date.parse("2026-11-14T12:02:00.000Z"),
  }), {
    ok: true, phase: "unverified", lastId: null, snapshotAt: "2026-11-14T12:00:00.000Z",
  });
  await assert.rejects(() => issueDirectoryCursor({
    lastId: null, phase: "verified", snapshotAt: "2026-11-14T12:00:00.000Z",
    scopeHash, secret,
  }), /INVALID_CURSOR_PAYLOAD/);
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
