const PUBLIC_METADATA_KEYS = new Set([
  "logoUrl", "logo_url", "coverUrl", "cover_url", "bio",
  "workingHours", "working_hours", "google_maps_url",
  "websiteUrl", "bookingUrl", "profileImageUrl", "services",
]);

// Keep this row-level contract in sync with the explicit publicFields SELECT in index.ts.
// A newly selected database column must not become public automatically.
const PUBLIC_LISTING_KEYS = new Set([
  "id", "slug", "display_name", "listing_type", "functional_group_id",
  "taxonomy_category_id", "taxonomy_specialty", "specialty", "phone",
  "secondary_phone", "address", "governorate", "district", "village",
  "source_name", "source_url", "source_checked_at", "listing_status",
  "claim_status", "completeness", "metadata", "created_at", "updated_at",
]);

const clean = (value, max = 500) => String(value ?? "").trim().slice(0, max);
const PUBLIC_HTTPS_URL_KEYS = new Set(["logoUrl", "logo_url", "coverUrl", "cover_url", "websiteUrl", "bookingUrl", "profileImageUrl"]);

function sanitizePublicHttpsUrl(value) {
  const raw = clean(value, 1500);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.port) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function sanitizePublicGoogleMapsUrl(value) {
  const raw = clean(value, 1000);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    const allowedHosts = new Set(["google.com", "www.google.com", "maps.google.com", "maps.app.goo.gl", "goo.gl"]);
    if (url.protocol !== "https:" || url.username || url.password || url.port || !allowedHosts.has(host)) return "";
    if ((host === "google.com" || host === "www.google.com") && !url.pathname.startsWith("/maps")) return "";
    if (host === "goo.gl" && !url.pathname.startsWith("/maps")) return "";
    return url.toString();
  } catch {
    return "";
  }
}

export function sanitizePublicDirectoryMetadata(value, contactScopes = new Set()) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value;
  const result = {};
  for (const key of PUBLIC_METADATA_KEYS) {
    const item = source[key];
    if (PUBLIC_HTTPS_URL_KEYS.has(key)) {
      const safeUrl = sanitizePublicHttpsUrl(item);
      if (safeUrl) result[key] = safeUrl;
    } else if (key === "google_maps_url") {
      if (!contactScopes.has("PRECISE_LOCATION")) continue;
      const safeUrl = sanitizePublicGoogleMapsUrl(item);
      if (safeUrl) result[key] = safeUrl;
    } else if (typeof item === "string") result[key] = clean(item, key === "bio" ? 2000 : 1500);
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

export function sanitizePublicDirectoryListing(value, contactScopes = new Set()) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const publicRow = {};
  for (const key of PUBLIC_LISTING_KEYS) {
    if (key === "metadata") continue;
    if (key === "phone" && !contactScopes.has("PHONE")) continue;
    if (key === "secondary_phone" && !contactScopes.has("SECONDARY_PHONE")) continue;
    if (key === "address" && !contactScopes.has("ADDRESS")) continue;
    if (Object.prototype.hasOwnProperty.call(value, key)) publicRow[key] = value[key];
  }
  publicRow.metadata = sanitizePublicDirectoryMetadata(value.metadata, contactScopes);
  return publicRow;
}
