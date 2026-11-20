// Collect every active, field-specific consent row for a bounded set of listing IDs.
// PostgREST may cap returned rows below the requested page size, so advance by
// the actual row count and continue until an empty page is observed.
const ALLOWED_CONTACT_SCOPES = new Set([
  "PHONE",
  "SECONDARY_PHONE",
  "ADDRESS",
  "PRECISE_LOCATION",
]);

export async function collectActiveContactConsentScopes(
  listingIds,
  fetchPage,
  pageSize = 1000,
) {
  const ids = [...new Set((listingIds || []).map((id) => String(id || "")).filter(Boolean))];
  const scopes = new Map();
  if (!ids.length) return { scopes, ready: true };

  if (!Number.isSafeInteger(pageSize) || pageSize < 1) {
    return { scopes, ready: false };
  }

  let offset = 0;
  while (true) {
    let result;
    try {
      result = await fetchPage(offset, pageSize, ids);
    } catch {
      return { scopes: new Map(), ready: false };
    }
    const { data, error } = result || {};
    if (error || !Array.isArray(data)) {
      // Discard partial results: callers must never use an incomplete consent set.
      return { scopes: new Map(), ready: false };
    }
    if (data.length === 0) break;

    for (const row of data) {
      const id = String(row?.listing_id || "");
      const scope = String(row?.scope || "").toUpperCase();
      if (!id || !ids.includes(id) || !ALLOWED_CONTACT_SCOPES.has(scope)) continue;
      if (!scopes.has(id)) scopes.set(id, new Set());
      scopes.get(id).add(scope);
    }
    offset += data.length;
  }

  return { scopes, ready: true };
}
