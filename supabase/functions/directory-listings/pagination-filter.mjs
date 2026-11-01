const SEARCH_COLUMNS = Object.freeze(["display_name", "specialty", "taxonomy_specialty", "phone", "secondary_phone", "address", "governorate", "district", "village"]);

export function sanitizeDirectoryPaginationSearch(value) {
  return String(value ?? "").slice(0, 100).replace(/[^\p{L}\p{N}\s+-]/gu, " ").replace(/\s+/g, " ").trim();
}

export function buildDirectoryPaginationOrFilter(searchValue, cursor) {
  const search = sanitizeDirectoryPaginationSearch(searchValue);
  const cursorExpression = cursor
    ? "or(created_at.lt." + cursor.created_at + ",and(created_at.eq." + cursor.created_at + ",id.lt." + cursor.id + "))"
    : "";
  if (search && cursorExpression) {
    const pattern = "%" + search + "%";
    return SEARCH_COLUMNS.map((column) => "and(" + column + ".ilike." + pattern + "," + cursorExpression + ")").join(",");
  }
  if (search) {
    const pattern = "%" + search + "%";
    return SEARCH_COLUMNS.map((column) => column + ".ilike." + pattern).join(",");
  }
  return cursorExpression ? cursorExpression.slice(3, -1) : null;
}
