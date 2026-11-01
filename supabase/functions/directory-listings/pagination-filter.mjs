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

/** @param {unknown} value @returns {number | null} */
export function parseDirectoryPaginationLimit(value) {
  const limit = Number(value || "100");
  return Number.isInteger(limit) && limit >= 1 && limit <= 100 ? limit : null;
}

/** @param {unknown} value @returns {{ created_at: string, id: string } | null} */
export function decodeDirectoryPaginationCursor(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw.length > 1200) throw new Error("invalid cursor");
  try {
    const normalized = raw.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - raw.length % 4) % 4);
    const decoded = JSON.parse(atob(normalized));
    if (!decoded || typeof decoded.created_at !== "string" ||
      Number.isNaN(Date.parse(decoded.created_at)) ||
      typeof decoded.id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(decoded.id)) {
      throw new Error("invalid cursor");
    }
    return { created_at: new Date(decoded.created_at).toISOString(), id: decoded.id };
  } catch {
    throw new Error("invalid cursor");
  }
}

/** @param {{ created_at: string, id: string }} cursor @returns {string} */
export function encodeDirectoryPaginationCursor(cursor) {
  return btoa(JSON.stringify({ created_at: cursor.created_at, id: cursor.id }))
    .replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/g, "");
}
