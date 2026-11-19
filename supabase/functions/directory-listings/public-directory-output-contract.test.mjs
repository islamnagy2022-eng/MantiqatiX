import test from "node:test";
import assert from "node:assert/strict";
import { sanitizePublicDirectoryListing } from "./public-directory-output-contract.mjs";

const sample = {
  id: "listing-1",
  slug: "clinic-1",
  display_name: "Clinic One",
  listing_type: "clinic",
  specialty: "Cardiology",
  phone: "+20 100 111 2222",
  secondary_phone: "+20 100 333 4444",
  address: "Private street 10",
  governorate: "Menoufia",
  district: "Tala",
  village: "Village A",
  claim_status: "CLAIMED",
  claimed_user_id: "private-user-id",
  claimed_business_id: "private-business-id",
  verified_by: "private-reviewer-id",
  outreach_notes: "internal note",
  metadata: {
    bio: "Public profile biography",
    logoUrl: "https://cdn.example.test/logo.png",
    google_maps_url: "https://www.google.com/maps/place/Tala",
    private_contact_note: "must never leak",
    socialLinks: ["https://social.example.test/profile"],
  },
};

test("public listing hides phone, secondary phone, address and precise map without consent", () => {
  const result = sanitizePublicDirectoryListing(sample);
  assert.equal("phone" in result, false);
  assert.equal("secondary_phone" in result, false);
  assert.equal("address" in result, false);
  assert.equal("google_maps_url" in result.metadata, false);
  assert.equal(result.display_name, "Clinic One");
  assert.equal(result.metadata.bio, "Public profile biography");
  assert.equal(result.metadata.logoUrl, "https://cdn.example.test/logo.png");
  assert.equal("private_contact_note" in result.metadata, false);
});

test("each contact scope reveals only its matching field", () => {
  const result = sanitizePublicDirectoryListing(sample, new Set(["PHONE"]));
  assert.equal(result.phone, sample.phone);
  assert.equal("secondary_phone" in result, false);
  assert.equal("address" in result, false);
  assert.equal("google_maps_url" in result.metadata, false);

  const addressOnly = sanitizePublicDirectoryListing(sample, new Set(["ADDRESS"]));
  assert.equal(addressOnly.address, sample.address);
  assert.equal("phone" in addressOnly, false);
  assert.equal("secondary_phone" in addressOnly, false);
});

test("secondary phone and precise location require their own explicit scopes", () => {
  const result = sanitizePublicDirectoryListing(sample, new Set(["SECONDARY_PHONE", "PRECISE_LOCATION"]));
  assert.equal(result.secondary_phone, sample.secondary_phone);
  assert.equal("phone" in result, false);
  assert.equal("address" in result, false);
  assert.equal(result.metadata.google_maps_url, "https://www.google.com/maps/place/Tala");
});

test("all approved scopes reveal only the public allowlist", () => {
  const result = sanitizePublicDirectoryListing(
    sample,
    new Set(["PHONE", "SECONDARY_PHONE", "ADDRESS", "PRECISE_LOCATION"]),
  );
  assert.equal(result.phone, sample.phone);
  assert.equal(result.secondary_phone, sample.secondary_phone);
  assert.equal(result.address, sample.address);
  assert.equal(result.metadata.google_maps_url, "https://www.google.com/maps/place/Tala");
  assert.equal("claimed_user_id" in result, false);
  assert.equal("claimed_business_id" in result, false);
  assert.equal("verified_by" in result, false);
  assert.equal("outreach_notes" in result, false);
});

test("unsafe precise-location URLs are removed even when consent exists", () => {
  const unsafe = sanitizePublicDirectoryListing({
    ...sample,
    metadata: { google_maps_url: "https://user:pass@evil.example/maps/place/private" },
  }, new Set(["PRECISE_LOCATION"]));
  assert.equal("google_maps_url" in unsafe.metadata, false);
});

test("non-HTTPS public metadata URLs are removed", () => {
  const result = sanitizePublicDirectoryListing({
    ...sample,
    metadata: {
      logoUrl: "http://cdn.example.test/logo.png",
      websiteUrl: "javascript:alert(1)",
      bookingUrl: "https://user:pass@booking.example.test/path",
    },
  }, new Set());
  assert.equal("logoUrl" in result.metadata, false);
  assert.equal("websiteUrl" in result.metadata, false);
  assert.equal("bookingUrl" in result.metadata, false);
});


test("owner controls fail closed when the consent registry is unavailable without hiding the owner's own data", async () => {
  const { resolveDirectoryOwnerAccess } = await import("./public-directory-output-contract.mjs");
  const owner = resolveDirectoryOwnerAccess(true, false, new Set());
  assert.equal(owner.canEdit, false);
  assert.deepEqual([...owner.contactScopes].sort(), ["ADDRESS", "PHONE", "PRECISE_LOCATION", "SECONDARY_PHONE"]);

  const healthyOwner = resolveDirectoryOwnerAccess(true, true, new Set(["PHONE"]));
  assert.equal(healthyOwner.canEdit, true);
  const visitor = resolveDirectoryOwnerAccess(false, false, new Set(["PHONE"]));
  assert.equal(visitor.canEdit, false);
  assert.deepEqual([...visitor.contactScopes], ["PHONE"]);
});
