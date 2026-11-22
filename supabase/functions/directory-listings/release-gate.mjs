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
    message: "This directory is temporarily unavailable while owner contact permissions are being verified.",
  }),
});

const methodNotAllowedResponse = Object.freeze({
  status: 405,
  body: Object.freeze({ error: "METHOD_NOT_ALLOWED" }),
});

/**
 * Directory listing access is deny-by-default.
 *
 * The server-side feature switch must be the exact string "true" and the
 * contact-consent registry must be reachable before any listing or mutation
 * route can execute. OPTIONS is handled by the caller before this helper.
 */
export const resolveDirectoryListingsReleaseGate = (
  method,
  enabledFlag,
  consentRegistryAvailable,
) => {
  const normalizedMethod = String(method || "").toUpperCase();
  if (normalizedMethod === "OPTIONS") return null;

  const explicitlyEnabled = enabledFlag === "true";
  if (!explicitlyEnabled || consentRegistryAvailable !== true) {
    if (normalizedMethod === "GET") return disabledGetResponse;
    if (normalizedMethod === "POST") return disabledPostResponse;
    return methodNotAllowedResponse;
  }

  if (normalizedMethod !== "GET" && normalizedMethod !== "POST") {
    return methodNotAllowedResponse;
  }
  return null;
};
