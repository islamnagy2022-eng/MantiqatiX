import fs from "node:fs";
import path from "node:path";

const root = path.resolve("web");
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(html|js|css|json|webmanifest|txt)$/i.test(entry.name)) files.push(full);
  }
}
walk(root);

const forbidden = [
  /service[_-]?role/i,
  /sb_secret_/i,
  /SUPABASE_SERVICE_ROLE_KEY/i,
  /SUPABASE_SECRET_KEY/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /postgres(?:ql)?:\/\//i,
  /sk_live_[A-Za-z0-9]/i,
  /xox[baprs]-[A-Za-z0-9-]+/i
];

const findings = [];
for (const file of files) {
  const rel = path.relative(process.cwd(), file).replaceAll("\\", "/");
  if (rel === "web/vendor/supabase.js") continue;
  const source = fs.readFileSync(file, "utf8");
  for (const pattern of forbidden) {
    if (pattern.test(source)) {
      findings.push(`${path.relative(process.cwd(), file)}: forbidden secret pattern ${pattern}`);
    }
  }
}

const config = path.join(root, "config.js");
if (fs.existsSync(config)) {
  const cfg = fs.readFileSync(config, "utf8");
  const httpEndpoint = /https?:\/\/[^\s"']+/i;
  const supabaseEndpoint = /https:\/\/[A-Za-z0-9-]+\.supabase\.co/i;
  if (httpEndpoint.test(cfg) && !supabaseEndpoint.test(cfg)) {
    findings.push("web/config.js: unexpected non-Supabase HTTP endpoint detected");
  }
}

if (findings.length) {
  console.error("Production web security validation failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}
console.log(`Production web security validation passed: scanned ${files.length} web assets.`);
