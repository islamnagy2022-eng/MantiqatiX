import assert from "node:assert/strict";
import test from "node:test";
import {
  sanitizePublicDirectoryListing,
  sanitizePublicDirectoryMetadata,
} from "../../supabase/functions/directory-listings/public-directory-output-contract.mjs";

test("public metadata keeps only display-safe allowlisted keys", () => {
  const result = sanitizePublicDirectoryMetadata({
    bio: "  Clinic bio  ",
    websiteUrl: " https://example.org ",
    logoUrl: "https://example.org/logo.png",
    workingHours: "Mon-Fri 9-5",
    services: [" Dental ", 7, " Cardiology ", null],
    source_permission_evidence_id: "private-evidence-id",
    owner_confirmation_required: true,
    professional_registration_verified: true,
    source_phone_verified: true,
    internal_notes: "do not expose",
    socialLinks: { private: "https://private.example" },
    coordinates: { lat: 1, lng: 2 },
  });

  assert.deepEqual(result, {
    bio: "Clinic bio",
    websiteUrl: "https://example.org",
    logoUrl: "https://example.org/logo.png",
    workingHours: "Mon-Fri 9-5",
    services: ["Dental", "Cardiology"],
  });
});

test("public metadata truncates strings and caps services", () => {
  const result = sanitizePublicDirectoryMetadata({
    bio: "x".repeat(2100),
    websiteUrl: "y".repeat(1600),
    services: Array.from({ length: 25 }, (_, index) => " service " + index + " "),
  });

  assert.equal(result.bio.length, 2000);
  assert.equal(result.websiteUrl.length, 1500);
  assert.equal(result.services.length, 20);
  assert.equal(result.services[0], "service 0");
  assert.equal(result.services[19], "service 19");
});

test("invalid metadata values become an empty object", () => {
  assert.deepEqual(sanitizePublicDirectoryMetadata(null), {});
  assert.deepEqual(sanitizePublicDirectoryMetadata([]), {});
  assert.deepEqual(sanitizePublicDirectoryMetadata("private"), {});
});

test("public Google Maps metadata accepts only HTTPS Google Maps destinations", () => {
  assert.equal(
    sanitizePublicDirectoryMetadata({ google_maps_url: "https://www.google.com/maps/place/Cairo" }).google_maps_url,
    "https://www.google.com/maps/place/Cairo",
  );
  assert.equal(
    sanitizePublicDirectoryMetadata({ google_maps_url: "https://maps.app.goo.gl/abc123" }).google_maps_url,
    "https://maps.app.goo.gl/abc123",
  );
  for (const value of [
    "javascript:alert(1)",
    "http://www.google.com/maps/place/Cairo",
    "https://evil.example/maps",
    "https://google.com.evil.example/maps",
    "https://user:pass@google.com/maps",
    "https://google.com:8443/maps",
    "https://google.com/search?q=clinic",
  ]) {
    assert.equal(
      sanitizePublicDirectoryMetadata({ google_maps_url: value }).google_maps_url,
      undefined,
      "Unsafe or non-Maps URL must not be exposed: " + value,
    );
  }
});

test("public listing removes internal identities and sanitizes metadata without implying professional verification", () => {
  const result = sanitizePublicDirectoryListing({
    id: "listing-1",
    display_name: "Example Clinic",
    claim_status: "CLAIMED",
    verified_by: "internal-user-uuid",
    is_verified: true,
    claimed_user_id: "claim-user-uuid",
    claimed_business_id: "claim-business-uuid",
    metadata: {
      bio: "Public profile",
      source_permission_evidence_id: "private-evidence-id",
      owner_confirmation_required: true,
    },
  });

  assert.deepEqual(result, {
    id: "listing-1",
    display_name: "Example Clinic",
    claim_status: "CLAIMED",
    metadata: { bio: "Public profile" },
  });
  assert.equal("verified_by" in result, false);
  assert.equal("is_verified" in result, false);
  assert.equal("claimed_user_id" in result, false);
  assert.equal("claimed_business_id" in result, false);
});

test("public listing does not infer professional verification from owner-claim identity", () => {
  const result = sanitizePublicDirectoryListing({ id: "listing-2", metadata: {} });
  assert.equal("is_verified" in result, false);
});

test("public listing drops unknown top-level database fields even if a query selects them", () => {
  const result = sanitizePublicDirectoryListing({
    id: "listing-3",
    display_name: "Example Clinic",
    source_name: "Official directory",
    source_url: "https://example.org/clinic",
    source_checked_at: "2026-11-14T12:00:00Z",
    source_permission_evidence_id: "private-evidence-id",
    owner_confirmation_required: true,
    professional_registration_verified: true,
    source_phone_verified: true,
    created_by: "internal-creator-id",
    updated_by: "internal-updater-id",
    internal_notes: "not public",
    deleted_at: "2026-11-14T12:00:00Z",
    verified_by: "internal-verifier-id",
    claimed_user_id: "claim-user-id",
    claimed_business_id: "claim-business-id",
    metadata: {
      bio: "Public profile",
      internal_notes: "not public",
    },
  });

  assert.deepEqual(result, {
    id: "listing-3",
    display_name: "Example Clinic",
    source_name: "Official directory",
    source_url: "https://example.org/clinic",
    source_checked_at: "2026-11-14T12:00:00Z",
    metadata: { bio: "Public profile" },
  });
});
