const disabledGetResponse = Object.freeze({
  status: 200,
  body: Object.freeze({
    listings: [],
    pageSize: 0,
    hasMore: false,
    nextCursor: null,
    directoryDisabled: true,
  }),
});

const disabledPostResponse = Object.freeze({
  status: 503,
  body: Object.freeze({
    error: "DIRECTORY_LISTINGS_DISABLED_FOR_V1",
    message: "Directory claims and contact-consent changes are unavailable until the consent registry is ready.",
  }),
});

const methodNotAllowedResponse = Object.freeze({
  status: 405,
  body: Object.freeze({ error: "METHOD_NOT_ALLOWED" }),
});

/**
 * Public discovery and private contact disclosure are separate capabilities.
 *
 * GET may expose only the public projection. The caller must still sanitize
 * phone/address/precise-location fields against active owner consent; if the
 * consent registry is unavailable, those scopes resolve to an empty set.
 *
 * POST contains owner claims and consent mutations, so it remains blocked
 * until both the exact server-side switch and consent registry are available.
 */
export const resolveDirectoryListingsReleaseGate = (
  method,
  enabledFlag,
  consentRegistryAvailable,
) => {
  const normalizedMethod = String(method || "").toUpperCase();
  if (normalizedMethod === "OPTIONS") return null;

  const explicitlyEnabled = enabledFlag === "true";
  if (normalizedMethod === "GET") {
    return explicitlyEnabled ? null : disabledGetResponse;
  }

  if (normalizedMethod === "POST") {
    return explicitlyEnabled && consentRegistryAvailable === true
      ? null
      : disabledPostResponse;
  }

  return methodNotAllowedResponse;
};
