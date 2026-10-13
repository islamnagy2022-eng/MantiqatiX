import fs from "node:fs";

const app = fs.readFileSync("web/app.js", "utf8");
const page = fs.readFileSync("web/smm.html", "utf8");
const pagesWorkflow = fs.readFileSync(".github/workflows/pages.yml", "utf8");
const gateway = fs.readFileSync("supabase/functions/smm-gateway/index.ts", "utf8");
const checks = [
  ["SMM is explicitly in the release-deferred set", /RELEASE_DEFERRED_MODULES\s*=\s*new Set\(\[[^\]]*خدمات التسويق الرقمي SMM/.test(app)],
  ["deferred module cannot be enabled by a remote feature flag", /function moduleEnabled\(name\)\s*\{\s*if\(RELEASE_DEFERRED_MODULES\.has\(name\)\)return false;/.test(app)],
  ["SMM app route renders development notice instead of embedded storefront", /function smmModulePage\(\)\s*\{return `[\s\S]*قيد التطوير[\s\S]*مؤجل عن نطاق الإطلاق الأول[\s\S]*`\}/.test(app)],
  ["main landing exposes a clickable SMM entry that leads only to the static holding page", /<a class="mnty-module-card" href="smm\.html"[^>]*aria-label="[^"]*SMM[^"]*"[^>]*>[\s\S]*خدمات التسويق الرقمي SMM — قيد التطوير[\s\S]*<\/a>/.test(app)],
  ["landing showcase labels SMM as deferred", /خدمات التسويق الرقمي SMM — قيد التطوير/.test(app) && /خارج نطاق الإطلاق الأول/.test(app)],
  ["standalone SMM page is noindex and explicitly under development", /name="robots" content="noindex,nofollow"/.test(page) && /قيد التطوير — خارج نطاق الإطلاق الأول/.test(page)],
  ["standalone SMM page does not load the SMM client or Supabase SDK", !/<script\b/i.test(page)],
  ["SMM implementation remains in source for post-launch work", fs.existsSync("web/smm.js") && fs.existsSync("web/smm.css")],
  ["internal marketing/advertising module remains in launch scope", /\['📣','التسويق والإعلان','التسويق الداخلي وشركات التسويق والعملاء المحتملون'\]/.test(app)],
];

checks.push([
  "launch Pages artifact excludes deferred SMM client JavaScript",
  pagesWorkflow.includes("rsync -a --delete --exclude='smm.js' web/ artifacts/web-release/") &&
    pagesWorkflow.includes("path: ./artifacts/web-release") &&
    pagesWorkflow.includes("test ! -e artifacts/web-release/smm.js") &&
    pagesWorkflow.includes(`test "$SMM_JS_STATUS" = "404"`) &&
    !pagesWorkflow.split("\n").some((line) => line.includes("for asset in") && line.includes("smm.js")),
]);

const handlerStart = gateway.indexOf("Deno.serve(async(req)=>{");
const handler = handlerStart >= 0 ? gateway.slice(handlerStart) : "";
const optionsIndex = handler.indexOf('if(req.method==="OPTIONS")');
const gateIndex = handler.indexOf('if(SMM_INITIAL_LAUNCH_DEFERRED||Deno.env.get("MNTY_SMM_ENABLED")!=="true"||Deno.env.get("MNTY_SMM_POST_LAUNCH_APPROVED")!=="true")return json({error:"SMM_DEFERRED"');
const authIndex = handler.indexOf("const user=await getUser(req)");
checks.push([
  "SMM gateway hard gate cannot be overridden by environment flags and runs before authentication",
  gateway.includes("const SMM_INITIAL_LAUNCH_DEFERRED=true;") &&
    optionsIndex >= 0 && gateIndex > optionsIndex && authIndex > gateIndex &&
    handler.includes('Deno.env.get("MNTY_SMM_ENABLED")!=="true"') &&
    handler.includes('Deno.env.get("MNTY_SMM_POST_LAUNCH_APPROVED")!=="true"') &&
    handler.includes('error:"SMM_DEFERRED"') &&
    handler.includes("},503);"),
]);

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log((ok ? "PASS " : "FAIL ") + name);
if (failed.length) process.exit(1);
console.log("SMM deferral contract PASS: user-facing SMM UI is unavailable for the first launch; source is retained for post-launch development.");
