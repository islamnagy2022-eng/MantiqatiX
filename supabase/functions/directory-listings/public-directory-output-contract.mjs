const PUBLIC_METADATA_KEYS = new Set([
  "logoUrl",
  "logo_url",
  "coverUrl",
  "cover_url",
  "bio",
  "workingHours",
  "working_hours",
  "google_maps_url",
  "websiteUrl",
  "bookingUrl",
  "profileImageUrl",
  "services",
]);

const clean = (value, max = 500) => String(value ?? "").trim().slice(0, max);

export function sanitizePublicDirectoryMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value;
  const result = {};
  for (const key of PUBLIC_METADATA_KEYS) {
    const item = source[key];
    if (typeof item === "string") result[key] = clean(item, key === "bio" ? 2000 : 1500);
    else if (typeof item === "boolean" || (typeof item === "number" && Number.isFinite(item))) result[key] = item;
    else if (key === "services" && Array.isArray(item)) {
      result[key] = item
        .filter((entry) => typeof entry === "string")
        .slice(0, 20)
        .map((entry) => clean(entry, 160));
    }
  }
  return result;
}

export function sanitizePublicDirectoryListing(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const {
    verified_by: _verifiedBy,
    is_verified: _isVerified,
    claimed_user_id: _claimedUserId,
    claimed_business_id: _claimedBusinessId,
    ...publicRow
  } = value;
  return {
    ...publicRow,
    metadata: sanitizePublicDirectoryMetadata(publicRow.metadata),
  };
}
