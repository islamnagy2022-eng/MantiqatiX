import fs from "node:fs";

const source = fs.readFileSync("web/app.js", "utf8");
const start = source.indexOf("const moduleAliases=");
const end = source.indexOf(";\nfunction normCode", start);
if (start < 0 || end < 0) {
  console.error("FAIL: could not locate moduleAliases contract in web/app.js");
  process.exit(1);
}
const aliases = source.slice(start, end + 1);

const canonicalRegistryCodes = [
  "ANALYTICS", "CONTROL", "CRM", "DOMAINS", "EDUCATION", "FASHION",
  "FINANCE", "GOVERNANCE", "GROCERY", "HOME", "JOBS", "MAINTENANCE",
  "MANTIGO", "MARKETING", "MATRIMONY", "MEDICAL", "MODULES", "OPERATIONS",
  "PRO_SERVICES", "REGISTRATION", "RESTAURANTS", "SETTINGS", "SMM", "USED_ITEMS"
];

const missing = canonicalRegistryCodes.filter(code => !aliases.includes("'" + code + "'"));
if (missing.length) {
  console.error("Canonical registry codes missing from UI feature-flag aliases: " + missing.join(", "));
  process.exit(1);
}

const professionalServices = aliases.match(/'الخدمات المهنية':\[([^\]]*)\]/)?.[1] || "";
const mantigo = aliases.match(/'MantiGO والمزايدات':\[([^\]]*)\]/)?.[1] || "";
if (!professionalServices.includes("'ACCOUNTING_SERVICES'") || mantigo.includes("'ACCOUNTING_SERVICES'")) {
  console.error("ACCOUNTING_SERVICES must map to professional services, not MantiGO.");
  process.exit(1);
}

// Public discovery/navigation must remain available when no flag exists.
// Entitlement denial belongs at restricted actions/server RPCs, not by hiding
// the service catalog from guests before sign-in/subscription.
if (!/function moduleEnabled\(name\)[\s\S]*?\}\s*return true\}/.test(source)) {
  console.error("Missing-flag visibility fallback changed; review guest discovery/entitlement contract before changing it.");
  process.exit(1);
}

console.log("Module feature-flag code contract PASS: " + canonicalRegistryCodes.length + " canonical codes mapped; guest visibility fallback preserved.");
