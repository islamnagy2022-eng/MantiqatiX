import { isCurrentDoctorRepublicationEvidence } from "./doctor-import-contract.mjs";

/**
 * Contact consent and owner claiming are separate from permission to republish
 * a doctor's public profile commercially. Every doctor row needs its own
 * current source evidence; an owner claim alone never waives that requirement.
 */
export function isDoctorPublicListingAllowed(listing, evidenceRows, now = new Date()) {
  if (!listing || typeof listing !== "object" || Array.isArray(listing)) return false;
  const listingType = String(listing.listing_type ?? "").trim().toLowerCase();
  if (listingType !== "doctor") return true;
  if (!Array.isArray(evidenceRows) || evidenceRows.length === 0) return false;
  return evidenceRows.some((evidence) =>
    isCurrentDoctorRepublicationEvidence(
      evidence,
      listing.source_url,
      listing.source_name,
      now,
    )
  );
}

/** Preserve source order while excluding doctor rows without current permission. */
export function filterPublicDirectoryListingsBySourceRights(rows, evidenceRows, now = new Date()) {
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => isDoctorPublicListingAllowed(row, evidenceRows, now));
}

/**
 * Scan ordered raw pages until limit + 1 eligible rows are found or the source
 * is exhausted. The returned cursor is the last delivered row, not the last
 * scanned row, so rows skipped by the rights filter cannot be lost on the next
 * request. A bounded scan fails closed instead of returning a silently
 * incomplete page.
 *
 * fetchBatch(after, pageSize) must return rows ordered by created_at DESC, id
 * DESC and apply all normal search/geographic/taxonomy filters before limiting.
 */
/**
 * @typedef {{ created_at: string, id: string }} DirectorySourceRightsCursor
 * @param {{
 *   fetchBatch: (after: DirectorySourceRightsCursor | null, pageSize: number) => Promise<unknown[]>,
 *   initialCursor?: DirectorySourceRightsCursor | null,
 *   limit: number,
 *   evidenceRows: unknown[],
 *   now?: Date,
 *   batchSize?: number,
 *   maxScanned?: number
 * }} options
 */
export async function scanPublicDirectoryPageWithSourceRights({
  fetchBatch,
  initialCursor = null,
  limit,
  evidenceRows,
  now = new Date(),
  batchSize = 200,
  maxScanned = 2000,
}) {
  if (typeof fetchBatch !== "function" ||
      !Number.isInteger(limit) || limit < 1 || limit > 100 ||
      !Number.isInteger(batchSize) || batchSize < 1 ||
      !Number.isInteger(maxScanned) || maxScanned < batchSize) {
    return { ready: false, reason: "INVALID_SCAN_ARGUMENTS", listings: [], hasMore: false, nextCursor: null };
  }

  const eligible = [];
  let after = initialCursor;
  let scanned = 0;
  let exhausted = false;

  while (eligible.length <= limit && scanned < maxScanned) {
    const requested = Math.min(batchSize, maxScanned - scanned);
    let rows;
    try {
      rows = await fetchBatch(after, requested);
    } catch {
      return { ready: false, reason: "READ_FAILED", listings: [], hasMore: false, nextCursor: null };
    }
    if (!Array.isArray(rows)) {
      return { ready: false, reason: "READ_FAILED", listings: [], hasMore: false, nextCursor: null };
    }
    if (rows.length === 0) {
      exhausted = true;
      break;
    }

    for (const row of rows) {
      scanned += 1;
      if (isDoctorPublicListingAllowed(row, evidenceRows, now)) eligible.push(row);
      if (eligible.length > limit) break;
    }

    if (eligible.length > limit) break;
    if (rows.length < requested) {
      exhausted = true;
      break;
    }
    const lastScanned = rows[rows.length - 1];
    if (!lastScanned?.created_at || !lastScanned?.id) {
      return { ready: false, reason: "INVALID_SCAN_ROW", listings: [], hasMore: false, nextCursor: null };
    }
    after = { created_at: lastScanned.created_at, id: lastScanned.id };
  }

  const hasMore = eligible.length > limit;
  if (!hasMore && !exhausted && scanned >= maxScanned) {
    return { ready: false, reason: "SCAN_LIMIT_REACHED", listings: [], hasMore: false, nextCursor: null };
  }

  const listings = eligible.slice(0, limit);
  const lastDelivered = listings[listings.length - 1];
  const nextCursor = hasMore && lastDelivered?.created_at && lastDelivered?.id
    ? { created_at: lastDelivered.created_at, id: lastDelivered.id }
    : null;
  if (hasMore && !nextCursor) {
    return { ready: false, reason: "INVALID_DELIVERED_ROW", listings: [], hasMore: false, nextCursor: null };
  }
  return { ready: true, reason: null, listings, hasMore, nextCursor, scanned };
}
