const PAGE_SIZE = 20;
const MAX_CURSOR_LENGTH = 2048;
const MAX_FILTER_LENGTH = 100;
const MAX_SLUGS = 20;
const MAX_CURSOR_AGE_MS = 6 * 60 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const FILTER_KEYS = ["activity", "specialty", "governorate", "markaz", "village", "area", "query"];
const encoder = new TextEncoder();

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const safeText = (value, max = MAX_FILTER_LENGTH) =>
  typeof value === "string" ? value.normalize("NFKC").trim().replace(/\s+/g, " ").slice(0, max) : "";
const base64UrlEncode = (bytes) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
};
const base64UrlDecode = (value) => {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("INVALID_BASE64URL");
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};
const isUuid = (value) => typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const normalizedMatchValue = (value) => safeText(value, 200).toLocaleLowerCase("ar-EG")
  .replace(/[أإآ]/g, "ا").replace(/[ىي]/g, "ي").replace(/ة/g, "ه")
  .replace(/[\u064B-\u065F\u0670]/g, "").replace(/\s+/g, " ").trim();
const normalizedAdministrativeValue = (value) =>
  normalizedMatchValue(value).replace(/^(?:محافظ(?:ة|ه)|مركز|مدين(?:ة|ه)|قسم|قري(?:ة|ه)|شياخ(?:ة|ه)|حي|نجع)\s*/, "");

export const PUBLIC_DIRECTORY_PAGE_SIZE = PAGE_SIZE;

/**
 * Merge globally scoped and branch-scoped public catalogue rows using one
 * deterministic name order before applying the public response cap. Keeping
 * the two queries separate avoids interpolating branch IDs into PostgREST,
 * while sorting the union prevents global rows from starving branch rows.
 * When an item ID is unexpectedly present in both scopes, the branch row wins.
 */
export function mergePublicDirectoryCatalogItems(globalItems, branchItems, limit = 150) {
  const safeLimit = Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, 150) : 150;
  const unique = new Map();
  for (const item of [
    ...(Array.isArray(branchItems) ? branchItems : []),
    ...(Array.isArray(globalItems) ? globalItems : []),
  ]) {
    if (!isRecord(item) || item.id == null) continue;
    const id = String(item.id);
    if (!unique.has(id)) unique.set(id, item);
  }
  const compareText = (left, right) => left < right ? -1 : left > right ? 1 : 0;
  return [...unique.values()]
    .sort((left, right) =>
      compareText(String(left.name_ar || ""), String(right.name_ar || "")) ||
      compareText(String(left.id), String(right.id))
    )
    .slice(0, safeLimit);
}

export function normalizeDirectoryFilters(input) {
  const get = (key) => input && typeof input.get === "function"
    ? input.get(key)
    : isRecord(input) ? input[key] : undefined;
  const filters = {};
  for (const key of FILTER_KEYS) {
    const value = safeText(get(key));
    if (value) filters[key] = value;
  }
  return filters;
}

export function parseDirectorySlugs(value) {
  if (value === null || value === undefined || value === "") return { ok: true, slugs: [] };
  if (typeof value !== "string" || value.length > 4000) return { ok: false, code: "INVALID_SLUG_FILTER" };
  const slugs = value.split(",").map((item) => item.trim()).filter(Boolean);
  if (slugs.length > MAX_SLUGS || slugs.some((slug) => slug.length > 140)) {
    return { ok: false, code: "INVALID_SLUG_FILTER" };
  }
  return { ok: true, slugs: [...new Set(slugs)] };
}

export function matchesDirectoryBusinessFilters(business, provider, filters) {
  const settings = isRecord(business?.settings) ? business.settings : {};
  const profile = isRecord(settings.catalog_profile) ? settings.catalog_profile : {};
  const values = {
    activity: [
      profile.category, profile.activity_category_code, profile.taxonomy_category_id,
      settings.category_code, settings.activity_code, settings.activity_category_code,
      settings.taxonomy_category_id, settings.activity_group_code, settings.taxonomy_group_code,
      provider?.provider_kind,
    ],
    specialty: [settings.activity_specialty, profile.activity_specialty, profile.specialty],
    governorate: [profile.governorate],
    markaz: [profile.markaz],
    village: [profile.village],
    // Area matching is deferred until the server builds the exact branch-aware
    // public-contact projection. Do not inspect raw branch or profile addresses here.
    area: [],
    // Search is intentionally restricted to public profile/category text. Never probe
    // phone, WhatsApp, precise address, or other consent-gated contact values.
    // Every search field below is part of the actual public Business projection.
    // Hidden operational codes and unprojected profile metadata are deliberately omitted.
    query: [
      business?.name, settings.activity_specialty, profile.category, profile.bio, profile.activity_specialty,
      profile.governorate, profile.markaz, profile.village,
      provider?.name_ar, provider?.name_en, provider?.description, provider?.provider_kind,
    ],
  };
  return FILTER_KEYS.every((key) => {
    const expected = normalizedMatchValue(filters?.[key]);
    if (!expected) return true;
    if (key === "query") {
      const tokens = expected.split(" ").filter(Boolean);
      return tokens.every((token) =>
        values.query.some((candidate) => normalizedMatchValue(candidate).includes(token))
      );
    }
    // Branch-aware area matching is performed only after getExplicitPublicContact.
    if (key === "area") return true;
    if (["governorate", "markaz", "village"].includes(key)) {
      const administrativeExpected = normalizedAdministrativeValue(expected);
      return values[key].some((candidate) => normalizedAdministrativeValue(candidate) === administrativeExpected);
    }
    return values[key].some((candidate) => normalizedMatchValue(candidate) === expected);
  });
}

export function matchesDirectoryAreaFilter(publicAddress, area) {
  const expected = normalizedMatchValue(area);
  if (!expected) return true;
  return typeof publicAddress === "string" &&
    normalizedMatchValue(publicAddress).includes(expected);
}

export function matchesDirectoryVerificationPhase(provider, phase) {
  if (phase !== "verified" && phase !== "unverified") return false;
  const verified = provider?.is_verified === true;
  return phase === "verified" ? verified : !verified;
}

export function getNextDirectoryCursorPosition({ lastId, lastPhase, lookaheadPhase }) {
  if (!isUuid(lastId) || !["verified", "unverified"].includes(lastPhase) ||
      !["verified", "unverified"].includes(lookaheadPhase)) {
    throw new Error("INVALID_CURSOR_POSITION");
  }
  if (lastPhase === "verified" && lookaheadPhase === "unverified") {
    return { phase: "unverified", lastId: null };
  }
  return { phase: lastPhase, lastId: lastId.toLowerCase() };
}

export async function hashDirectoryScope(filters, slugs = []) {
  const canonicalFilters = {};
  for (const key of FILTER_KEYS) if (filters?.[key]) canonicalFilters[key] = safeText(filters[key]);
  const canonical = JSON.stringify({ filters: canonicalFilters, slugs: [...slugs].sort() });
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(canonical));
  return base64UrlEncode(new Uint8Array(digest));
}

async function getSigningKey(secret) {
  if (typeof secret !== "string" || secret.length < 32) throw new Error("CURSOR_SECRET_MISCONFIGURED");
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function issueDirectoryCursor({
  lastId, phase = "verified", snapshotAt, scopeHash, secret, now = Date.now(),
}) {
  const validPhase = phase === "verified" || phase === "unverified";
  const validLastId = isUuid(lastId) || (phase === "unverified" && lastId === null);
  if (!validPhase || !validLastId || typeof snapshotAt !== "string" || !Number.isFinite(Date.parse(snapshotAt)) ||
      typeof scopeHash !== "string" || !scopeHash) throw new Error("INVALID_CURSOR_PAYLOAD");
  const payload = {
    v: 2,
    phase,
    lastId: isUuid(lastId) ? lastId.toLowerCase() : null,
    snapshotAt: new Date(snapshotAt).toISOString(),
    scopeHash,
    issuedAt: now,
  };
  const body = encoder.encode(JSON.stringify(payload));
  const key = await getSigningKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, body);
  return base64UrlEncode(body) + "." + base64UrlEncode(new Uint8Array(signature));
}

export async function verifyDirectoryCursor(token, { scopeHash, secret, now = Date.now() }) {
  if (typeof token !== "string" || token.length < 16 || token.length > MAX_CURSOR_LENGTH) {
    return { ok: false, code: "INVALID_CURSOR" };
  }
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, code: "INVALID_CURSOR" };
  try {
    const body = base64UrlDecode(parts[0]);
    const signature = base64UrlDecode(parts[1]);
    const key = await getSigningKey(secret);
    const valid = await crypto.subtle.verify("HMAC", key, signature, body);
    if (!valid) return { ok: false, code: "INVALID_CURSOR" };
    const payload = JSON.parse(new TextDecoder().decode(body));
    const validPhase = payload?.phase === "verified" || payload?.phase === "unverified";
    const validLastId = isUuid(payload?.lastId) ||
      (payload?.phase === "unverified" && payload?.lastId === null);
    if (!isRecord(payload) || payload.v !== 2 || !validPhase || !validLastId ||
        payload.scopeHash !== scopeHash || !Number.isFinite(payload.issuedAt) ||
        typeof payload.snapshotAt !== "string") return { ok: false, code: "INVALID_CURSOR" };
    const snapshotMs = Date.parse(payload.snapshotAt);
    if (!Number.isFinite(snapshotMs) || snapshotMs > now + MAX_CLOCK_SKEW_MS ||
        now - snapshotMs > MAX_CURSOR_AGE_MS || payload.issuedAt > now + MAX_CLOCK_SKEW_MS ||
        now - payload.issuedAt > MAX_CURSOR_AGE_MS) return { ok: false, code: "INVALID_CURSOR" };
    return {
      ok: true,
      phase: payload.phase,
      lastId: isUuid(payload.lastId) ? payload.lastId.toLowerCase() : null,
      snapshotAt: new Date(snapshotMs).toISOString(),
    };
  } catch {
    return { ok: false, code: "INVALID_CURSOR" };
  }
}
