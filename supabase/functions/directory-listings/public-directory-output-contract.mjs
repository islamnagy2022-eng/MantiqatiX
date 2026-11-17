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

// Keep this row-level contract in sync with the explicit publicFields SELECT in index.ts.
// A newly selected database column must not become public automatically.
const PUBLIC_LISTING_KEYS = new Set([
  "id",
  "slug",
  "display_name",
  "listing_type",
  "functional_group_id",
  "taxonomy_category_id",
  "taxonomy_specialty",
  "specialty",
  "phone",
  "secondary_phone",
  "address",
  "governorate",
  "district",
  "village",
  "source_name",
  "source_url",
  "source_checked_at",
  "listing_status",
  "claim_status",
  "completeness",
  "metadata",
  "created_at",
  "updated_at",
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
  const publicRow = {};
  for (const key of PUBLIC_LISTING_KEYS) {
    if (key === "metadata") continue;
    if (Object.prototype.hasOwnProperty.call(value, key)) publicRow[key] = value[key];
  }
  publicRow.metadata = sanitizePublicDirectoryMetadata(value.metadata);
  return publicRow;
}
