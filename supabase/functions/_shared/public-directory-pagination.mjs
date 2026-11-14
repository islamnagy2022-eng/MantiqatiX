const PAGE_SIZE = 20;
const MAX_CURSOR_LENGTH = 2048;
const MAX_FILTER_LENGTH = 100;
const MAX_SLUGS = 20;
const MAX_CURSOR_AGE_MS = 6 * 60 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const FILTER_KEYS = ["activity", "specialty", "governorate", "markaz", "village"];
const encoder = new TextEncoder();

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const safeText = (value, max = MAX_FILTER_LENGTH) =>
  typeof value === "string" ? value.normalize("NFKC").trim().replace(/\\s+/g, " ").slice(0, max) : "";
const base64UrlEncode = (bytes) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/g, "");
};
const base64UrlDecode = (value) => {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("INVALID_BASE64URL");
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};
const isUuid = (value) => typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const normalizedMatchValue = (value) => safeText(value, 200).toLocaleLowerCase("ar-EG");

export const PUBLIC_DIRECTORY_PAGE_SIZE = PAGE_SIZE;

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
      profile.category, settings.category_code, settings.activity_code,
      settings.activity_group_code, settings.taxonomy_group_code,
      provider?.provider_kind, provider?.name_ar, provider?.name_en,
    ],
    specialty: [settings.activity_specialty, profile.activity_specialty, profile.specialty],
    governorate: [profile.governorate],
    markaz: [profile.markaz],
    village: [profile.village],
  };
  return FILTER_KEYS.every((key) => {
    const expected = normalizedMatchValue(filters?.[key]);
    if (!expected) return true;
    return values[key].some((candidate) => normalizedMatchValue(candidate) === expected);
  });
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

export async function issueDirectoryCursor({ lastId, snapshotAt, scopeHash, secret, now = Date.now() }) {
  if (!isUuid(lastId) || typeof snapshotAt !== "string" || !Number.isFinite(Date.parse(snapshotAt)) ||
      typeof scopeHash !== "string" || !scopeHash) throw new Error("INVALID_CURSOR_PAYLOAD");
  const payload = {
    v: 1,
    lastId: lastId.toLowerCase(),
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
    if (!isRecord(payload) || payload.v !== 1 || !isUuid(payload.lastId) ||
        payload.scopeHash !== scopeHash || !Number.isFinite(payload.issuedAt) ||
        typeof payload.snapshotAt !== "string") return { ok: false, code: "INVALID_CURSOR" };
    const snapshotMs = Date.parse(payload.snapshotAt);
    if (!Number.isFinite(snapshotMs) || snapshotMs > now + MAX_CLOCK_SKEW_MS ||
        now - snapshotMs > MAX_CURSOR_AGE_MS || payload.issuedAt > now + MAX_CLOCK_SKEW_MS ||
        now - payload.issuedAt > MAX_CURSOR_AGE_MS) return { ok: false, code: "INVALID_CURSOR" };
    return { ok: true, lastId: payload.lastId.toLowerCase(), snapshotAt: new Date(snapshotMs).toISOString() };
  } catch {
    return { ok: false, code: "INVALID_CURSOR" };
  }
}
