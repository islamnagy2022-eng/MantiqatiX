const SEARCH_COLUMNS = [
  "display_name",
  "specialty",
  "taxonomy_specialty",
  "phone",
  "secondary_phone",
  "address",
  "governorate",
  "district",
  "village",
] as const;

export type DirectoryPaginationCursor = {
  created_at: string;
  id: string;
};

/**
 * Normalize free-text before embedding it in a PostgREST logic-tree expression.
 * Reserved delimiters and SQL LIKE wildcards are replaced rather than interpreted.
 */
export function sanitizeDirectoryPaginationSearch(value: unknown): string {
  return String(value ?? "")
    .slice(0, 100)
    .replace(/[%,()."\\_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Return a single PostgREST OR expression. When search and cursor are both
 * present, every searchable column is ANDed with the same keyset predicate,
 * which is equivalent to: (any searchable column matches) AND (cursor).
 */
export function buildDirectoryPaginationOrFilter(
  searchValue: string,
  cursor: DirectoryPaginationCursor | null,
): string {
  const search = sanitizeDirectoryPaginationSearch(searchValue);
  const cursorExpression = cursor
    ? "or(created_at.lt." + cursor.created_at +
      ",and(created_at.eq." + cursor.created_at + ",id.lt." + cursor.id + "))"
    : "";

  if (search && cursorExpression) {
    const pattern = "%" + search + "%";
    return SEARCH_COLUMNS.map((column) =>
      "and(" + column + ".ilike." + pattern + "," + cursorExpression + ")"
    ).join(",");
  }

  if (search) {
    const pattern = "%" + search + "%";
    return SEARCH_COLUMNS.map((column) => column + ".ilike." + pattern).join(",");
  }

  return cursorExpression ? cursorExpression.slice(3, -1) : "";
}
