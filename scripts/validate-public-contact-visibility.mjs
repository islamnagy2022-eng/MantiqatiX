import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const helper = read("../supabase/functions/_shared/public-contact-visibility.mjs");
const helperTests = read("../supabase/functions/_shared/public-contact-visibility.test.mjs");
const directory = read("../supabase/functions/public-catalog-directory/index.ts");
const catalog = read("../supabase/functions/public-catalog/index.ts");
const admin = read("../supabase/functions/catalog-admin/index.ts");
const merchant = read("../apps/catalog-frontend/src/components/merchant/MerchantDashboard.tsx");
const appContext = read("../apps/catalog-frontend/src/context/AppContext.tsx");
const production = read("../apps/catalog-frontend/src/lib/production.ts");
const types = read("../apps/catalog-frontend/src/types/index.ts");

const responseBlock = (source, expression) => {
  const start = source.indexOf(expression);
  if (start < 0) return "";
  const end = source.indexOf("\n      }),", start);
  return source.slice(start, end < 0 ? start + 1800 : end + 10);
};

const checks = [
  ["shared projection is valid plain JavaScript", !helper.includes("value: unknown") && !helper.includes("branchValue: unknown") && !helper.includes("as Record<")],
  ["empty public projection is fully blank by default", /phoneDisplay: ""/.test(helper) && /whatsappNumber: ""/.test(helper) && /whatsappUrl: ""/.test(helper) && /address: ""/.test(helper) && /additionalContactPhones: \[\]/.test(helper) && /googleMapsUrl: ""/.test(helper)],
  ["publication requires both affirmative owner consent and verified audit state", /profile\.public_contact_enabled !== true \|\| profile\.public_contact_consent_audit_verified !== true/.test(helper)],
  ["phone, WhatsApp, address, additional numbers and maps are projected only through the shared helper", /phoneDisplay: safeText\(phoneSource/.test(helper) && /whatsappNumber,/.test(helper) && /address: safeText\(branch\.address \|\| profile\.address/.test(helper) && /additionalContactPhones,/.test(helper) && /googleMapsUrl: safeGoogleMapsUrl/.test(helper)],
  ["WhatsApp links require HTTPS and an allow-listed host", /url\.protocol !== "https:"/.test(helper) && /wa\.me.*api\.whatsapp\.com.*web\.whatsapp\.com/.test(helper)],
  ["Google Maps links require HTTPS and an allow-listed maps host", /allowedHosts = \["google\.com", "www\.google\.com", "maps\.google\.com", "maps\.app\.goo\.gl", "goo\.gl"\]/.test(helper)],
  ["public directory uses shared consent projection", directory.includes('import { getExplicitPublicContact }') && directory.includes("getExplicitPublicContact(profile, branch)")],
  ["public catalogue uses shared consent projection", catalog.includes('import { getExplicitPublicContact }') && catalog.includes("getExplicitPublicContact(profile, selectedBranch)")],
  ["directory public map URL and contact fields come from consent projection", /google_maps_url: publicContact\.googleMapsUrl/.test(directory) && /phoneDisplay: publicContact\.phoneDisplay/.test(directory) && /address: publicContact\.address/.test(directory) && /additionalContactPhones: publicContact\.additionalContactPhones/.test(directory)],
  ["catalogue public map URL and contact fields come from consent projection", /google_maps_url: publicContact\.googleMapsUrl/.test(catalog) && /phoneDisplay: publicContact\.phoneDisplay/.test(catalog) && /address: publicContact\.address/.test(catalog) && /additionalContactPhones: publicContact\.additionalContactPhones/.test(catalog)],
  ["directory does not return operational branch phone or address in branch objects", /branches: \(branches \|\| \[\]\)\.map\(\(entry: any\) => \(\{ id: entry\.id, name: entry\.name, code: entry\.code \}\)\)/.test(directory)],
  ["catalogue does not return operational branch phone or address in branch objects", /branches: branches\.map\(\(branch: any\) => \(\{\s*id: branch\.id,\s*name: branch\.name,\s*code: branch\.code,\s*\}\)\)/.test(catalog)],
  ["top-level public contactPhone cannot bypass consent", /contactPhone: publicContact\.phoneDisplay \|\| publicContact\.whatsappNumber/.test(directory) && /contactPhone: publicContact\.phoneDisplay \|\| publicContact\.whatsappNumber/.test(catalog)],
  ["server validates consent input as a boolean", /hasOwnProperty\.call\(body, "publicContactEnabled"\)/.test(admin) && /INVALID_PUBLIC_CONTACT_CONSENT/.test(admin)],
  ["server forces audit verification false before persisting changed consent", /submittedSocialFields\["public_contact_consent_audit_verified"\] = false/.test(admin)],
  ["server writes a durable consent-granted/revoked audit record", /PUBLIC_CONTACT_CONSENT_GRANTED/.test(admin) && /PUBLIC_CONTACT_CONSENT_REVOKED/.test(admin) && /service\.from\("audit_logs"\)\.insert/.test(admin)],
  ["server fails closed when consent audit persistence fails", /PUBLIC_CONTACT_CONSENT_AUDIT_FAILED/.test(admin)],
  ["server activates public consent only after audit and a compare-and-set update", admin.indexOf("service.from(\"audit_logs\").insert") < admin.indexOf("public_contact_consent_audit_verified: true") && admin.includes('.eq("updated_at", pendingBusiness.updated_at)') && admin.includes("PUBLIC_CONTACT_CONSENT_ACTIVATION_CONFLICT")],
  ["owner dashboard presents explicit public-contact consent and submits its current value", merchant.includes("bizPublicContactEnabled") && merchant.includes("أوافق صراحة") && merchant.includes("publicContactEnabled: bizPublicContactEnabled")],
  ["AppContext sends consent to the authenticated catalog-admin action", appContext.includes("publicContactEnabled: Boolean(updated.publicContactEnabled)")],
  ["client enforces audited consent for public contact and precise-location fields", production.includes('["PUBLIC_READ_ONLY", "PUBLIC_DIRECTORY_READ_ONLY"]') && production.includes("const hasAuditedPublicContact = profile.public_contact_enabled === true && profile.public_contact_consent_audit_verified === true;") && production.includes("ownerWhatsApp: isPublicProjection ? publicWhatsApp") && production.includes("phone: isPublicProjection ? publicPhone") && production.includes("additionalContactPhones: isPublicProjection") && production.includes("address: isPublicProjection") && production.includes("googleMapsUrl: isPublicProjection && !hasAuditedPublicContact") && production.includes("latitude: publicLocationAllowed ? parseFirstOptionalCoordinate") && production.includes("longitude: publicLocationAllowed ? parseFirstOptionalCoordinate") && production.includes("email: isPublicProjection ? ''")],
  ["business type exposes the contact-consent state", types.includes("publicContactEnabled?: boolean;")],
  ["unit tests cover no-consent, audited consent, audit pending, revocation, invalid values and map privacy", [
    "without explicit audited consent","explicit audited owner consent","audit event is verified","revoking consent","unsafe WhatsApp URLs","precise map links"
  ].every((text) => helperTests.includes(text))],
];

for (const [name, ok] of checks) console.log((ok ? "PASS " : "FAIL ") + name);
assert.equal(checks.every(([, ok]) => ok), true, "Public contact privacy contract failed");
console.log("\\n" + checks.length + "/" + checks.length + " public contact privacy source checks passed.");
