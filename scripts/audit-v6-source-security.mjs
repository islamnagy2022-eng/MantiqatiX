#!/usr/bin/env node
/**
 * Static safety gate for the supplied V6 source tree.
 * It reports finding identifiers only: never prints credential values or source lines.
 * Usage: node scripts/audit-v6-source-security.mjs /path/to/extracted-v6
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "");
if (!process.argv[2] || !fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  console.error("Usage: node scripts/audit-v6-source-security.mjs <extracted-v6-directory>");
  process.exit(2);
}

const read = (relative) => {
  const file = path.join(root, relative);
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
};
const findings = [];
const seed = read("src/data/seedData.ts");
const server = read("server.ts");
const context = read("src/context/AppContext.tsx");
const app = read("src/App.tsx");
const metrics = read("src/utils/loadTestingEngine.ts");

const add = (id, detail) => findings.push({ id, detail });

if (/api[_-]?key\s*[:=]\s*['"][^'"]{12,}['"]/i.test(seed) ||
    /secret[_-]?key\s*[:=]\s*['"][^'"]{8,}['"]/i.test(seed) ||
    /merchant[_-]?key\s*[:=]\s*['"][^'"]{8,}['"]/i.test(seed)) {
  add("V6-SEC-001", "Credential-shaped literals exist in seed/default configuration; values suppressed.");
}
if (/adminPassword\s*:\s*['"][^'"]+['"]/i.test(seed) ||
    /password\s*:\s*['"][^'"]+['"]/i.test(seed)) {
  add("V6-SEC-002", "Hardcoded password-shaped default exists; value suppressed.");
}
if (/DEFAULT_PAYMOB_CONFIG[\s\S]{0,500}?enabled\s*:\s*true/i.test(seed)) {
  add("V6-PAY-001", "Default Paymob configuration appears enabled.");
}
if (/\/api\/production-state/.test(server) &&
    /app\.(?:get|post)\s*\(\s*['"]\/api\/production-state['"]/i.test(server)) {
  add("V6-SEC-003", "File-backed production-state API routes exist in the candidate server.");
}
if (/listen\([^)]*0\.0\.0\.0/.test(server)) {
  add("V6-SEC-004", "Candidate server binds to 0.0.0.0; production exposure requires explicit security review.");
}
if (/commitCurrentDataAsOfficialLive/.test(context) &&
    /localStorage\.setItem\([^)]*ADOPTED_BASELINE/.test(context) &&
    /return\s*\{\s*success\s*:\s*true/.test(context)) {
  add("V6-DATA-001", "Local snapshot can be marked official and return success without authoritative persistence.");
}
if (/visitorCount|totalVisitors|visitors/i.test(app) &&
    /\|\|\s*\d{2,}/.test(app)) {
  add("V6-METRIC-001", "A hardcoded numeric visitor fallback may be presented as live analytics.");
}
if (/Math\.random\s*\(/.test(metrics) && /load|stress|virtual users|concurrent/i.test(metrics)) {
  add("V6-METRIC-002", "Load-testing utility uses random simulation; results are not measured production telemetry.");
}

if (findings.length) {
  console.error("V6_SOURCE_SECURITY_AUDIT=BLOCKED");
  for (const finding of findings) console.error(`- ${finding.id}: ${finding.detail}`);
  console.error(`TOTAL_BLOCKERS=${findings.length}`);
  process.exit(1);
}
console.log("V6_SOURCE_SECURITY_AUDIT=PASS");
console.log("No configured static blockers were detected. This does not replace manual review, type-check, tests, or runtime security validation.");
