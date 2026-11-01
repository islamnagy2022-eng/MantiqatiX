const PROTECTED_METADATA_KEYS = Object.freeze([
  "source_status", "source_phone_verified", "sourcePhoneVerified", "phone_verified", "phoneVerified", "phone_verification_status",
  "owner_confirmation_required", "ownerConfirmationRequired", "owner_confirmed", "ownerConfirmed", "owner_verified", "ownerVerified",
  "professional_registration_verified", "professionalRegistrationVerified", "registration_verified", "registrationVerified",
  "verified", "is_verified", "isVerified", "coordinates_status", "coordinatesStatus", "coordinates_method", "coordinatesMethod",
]);

/** Normalize a hostname, rejecting URL fragments, credentials, paths and ports. */
export function normalizeDirectorySourceHost(value) {
  const raw = String(value ?? "").trim().slice(0, 300).toLowerCase();
  if (!raw || raw.includes("/") || raw.includes("@") || raw.includes("?") || raw.includes("#")) return "";
  try {
    const parsed = new URL(raw.includes("://") ? raw : "https://" + raw);
    if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.port ||
        parsed.pathname !== "/" || parsed.search || parsed.hash) return "";
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Check every required republication scope against one approved evidence record.
 * The time argument is injectable so expiry and not-yet-valid evidence can be tested deterministically.
 */
export function isCurrentDoctorRepublicationEvidence(evidence, sourceUrl, sourceName, now = new Date()) {
  if (!evidence || typeof evidence !== "object") return false;
  let parsedSourceUrl;
  try {
    parsedSourceUrl = new URL(String(sourceUrl ?? ""));
  } catch {
    return false;
  }
  if (!["https:", "http:"].includes(parsedSourceUrl.protocol)) return false;
  const sourceHost = normalizeDirectorySourceHost(parsedSourceUrl.hostname);
  const currentTime = now instanceof Date ? now.getTime() : Number(now);
  const validFrom = new Date(evidence.valid_from).getTime();
  const expiresAt = evidence.expires_at ? new Date(evidence.expires_at).getTime() : null;
  return evidence.status === "APPROVED" &&
    !evidence.revoked_at &&
    Number.isFinite(currentTime) &&
    Number.isFinite(validFrom) &&
    validFrom <= currentTime &&
    (expiresAt === null || (Number.isFinite(expiresAt) && expiresAt > currentTime)) &&
    evidence.allows_doctor_profile_republication === true &&
    evidence.allows_commercial_republication === true &&
    Boolean(sourceHost) &&
    sourceHost === evidence.source_host &&
    String(sourceName ?? "").trim().toLocaleLowerCase() ===
      String(evidence.source_name ?? "").trim().toLocaleLowerCase();
}

/** Remove untrusted metadata fields that could falsely claim verification. */
export function sanitizeDoctorImportMetadata(value) {
  const metadata = value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
  for (const key of PROTECTED_METADATA_KEYS) delete metadata[key];
  return metadata;
}

/**
 * Validate the requested listing state. An omitted status defaults to PUBLISHED
 * when a valid phone exists and DRAFT otherwise; an explicit publication request
 * without a valid phone is rejected. Explicit HIDDEN/DRAFT always remain explicit.
 */
export function resolveDoctorImportStatus(row, hasPhone) {
  const source = row && typeof row === "object" && !Array.isArray(row) ? row : {};
  const hasRequestedStatus = Object.prototype.hasOwnProperty.call(source, "listingStatus") ||
    Object.prototype.hasOwnProperty.call(source, "listing_status");
  const rawStatus = source.listingStatus || source.listing_status || "PUBLISHED";
  const requestedStatus = String(rawStatus).trim().slice(0, 20).toUpperCase();
  const allowed = new Set(["PUBLISHED", "DRAFT", "HIDDEN"]);
  if (hasRequestedStatus && !allowed.has(requestedStatus)) {
    return { valid: false, reason: "INVALID_LISTING_STATUS", hasRequestedStatus, requestedStatus, listingStatus: null };
  }
  if (hasRequestedStatus && requestedStatus === "PUBLISHED" && !hasPhone) {
    return { valid: false, reason: "PHONE_REQUIRED_FOR_PUBLICATION", hasRequestedStatus, requestedStatus, listingStatus: null };
  }
  const listingStatus = requestedStatus === "PUBLISHED" && !hasPhone ? "DRAFT" : requestedStatus;
  return { valid: true, reason: null, hasRequestedStatus, requestedStatus, listingStatus };
}
