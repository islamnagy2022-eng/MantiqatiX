const DIRECTORY_SEARCH_COLUMNS = Object.freeze([
  "display_name",
  "specialty",
  "taxonomy_specialty",
  "phone",
  "secondary_phone",
  "address",
  "governorate",
  "district",
  "village",
]);

/**
 * Keep free-text values out of the PostgREST logic grammar while preserving
 * Arabic/Latin letters, digits, spaces and phone number separators.
 */
export function sanitizeDirectoryPaginationSearch(value) {
  return String(value ?? "")
    .slice(0, 100)
    .replace(/[^\\p{L}\\p{N}\\s+-]/gu, " ")
    .replace(/\\s+/g, " ")
    .trim();
}

/**
 * Build the single PostgREST OR expression for free-text search and a
 * deterministic created_at/id keyset cursor.
 *
 * Search + cursor is expressed as:
 *   OR(AND(search-column-1, cursor), AND(search-column-2, cursor), ...)
 * This is equivalent to search AND cursor, without appending multiple
 * 'or' query parameters to one PostgREST request.
 */
export function buildDirectoryPaginationOrFilter(searchValue, cursor) {
  const search = sanitizeDirectoryPaginationSearch(searchValue);
  const cursorExpression = cursor
    ? "or(created_at.lt." + cursor.created_at +
      ",and(created_at.eq." + cursor.created_at + ",id.lt." + cursor.id + "))"
    : "";

  if (search && cursorExpression) {
    const pattern = "%" + search + "%";
    return DIRECTORY_SEARCH_COLUMNS.map((column) =>
      "and(" + column + ".ilike." + pattern + "," + cursorExpression + ")"
    ).join(",");
  }

  if (search) {
    const pattern = "%" + search + "%";
    return DIRECTORY_SEARCH_COLUMNS.map((column) =>
      column + ".ilike." + pattern
    ).join(",");
  }

  return cursorExpression ? cursorExpression.slice(3, -1) : null;
}
