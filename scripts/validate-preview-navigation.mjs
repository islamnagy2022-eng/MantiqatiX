import fs from "node:fs";
import vm from "node:vm";

const entry = fs.readFileSync("web/preview/index.html", "utf8");
const dashboard = fs.readFileSync("web/preview/dashboard.html", "utf8");
const admin = fs.readFileSync("web/preview/admin.html", "utf8");
const adminScript = admin.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? "";
const home = fs.readFileSync("web/index.html", "utf8");
const pages = fs.readFileSync(".github/workflows/pages.yml", "utf8");
const sw = fs.readFileSync("web/sw.js", "utf8");

const checks = [
  ["Arabic RTL preview gateway", /<html lang="ar" dir="rtl">/.test(entry)],
  ["Preview opens the all-module demo by default", /window\.location\.replace\(['"]dashboard\.html['"]\)/.test(entry)],
  ["Preview has a manual public-home fallback", /href="\.\.\/"/.test(entry)],
  ["Preview has a direct demo link", /href="dashboard\.html"/.test(entry)],
  ["Gateway clearly labels demo-only behavior", /وضع تجريبي فقط/.test(entry)],
  ["Demo dashboard is explicitly non-production", /Demo Mode/.test(dashboard) && /لا توجد عمليات فعلية/.test(dashboard)],
  ["Demo catalog includes platform modules across domains", /id:'marketing'/.test(dashboard) && /id:'orders'/.test(dashboard) && /id:'accounting'/.test(dashboard) && /id:'security'/.test(dashboard) && /id:'settings'/.test(dashboard)],
  ["Demo workspaces support local record creation and filtering", /recordForm/.test(dashboard) && /recordSearch/.test(dashboard) && /data\[current\.id\]\.unshift/.test(dashboard)],
  ["Published homepage exists in the Pages artifact root", fs.existsSync("web/index.html")],
  ["Homepage has a visible boot failure fallback", /تعذر تحميل واجهة المنصة/.test(home)],
  ["Homepage keeps Supabase failure in public mode", /public mode remains open/.test(home)],
  ["Pages artifact publishes web/ as the site root", /path:\s*\.\/web/.test(pages)],
  ["Production deploy is restricted to main", /github\.ref == 'refs\/heads\/main'/.test(pages)],
  ["Service worker uses network-first navigation with cached homepage fallback", /event\.request\.mode==='navigate'[\s\S]*?caches\.match\('\.\/index\.html'\)/.test(sw)],
  ["Demo dashboard declares Arabic RTL and mobile viewport", /<html lang="ar" dir="rtl">/.test(dashboard) && /name="viewport"/.test(dashboard)],
  ["Demo dashboard has tablet and phone responsive breakpoints", /@media\s*\(max-width:\s*1050px\)/.test(dashboard) && /@media\s*\(max-width:\s*680px\)/.test(dashboard)],
  ["Demo dashboard supports a local CSV export flow", dashboard.includes("exportBtn") && dashboard.includes("text/csv;charset=utf-8") && dashboard.includes("a.download=current.id+'-demo.csv'")],
  ["Demo dashboard supports simulated workflow and reset actions", /simulateBtn/.test(dashboard) && /resetModuleBtn/.test(dashboard) && /محاكاة ناجحة داخل الصفحة فقط/.test(dashboard)],
  ["Demo forms constrain input length and require a name", /id="recordName"[^>]*required[^>]*maxlength="100"/.test(dashboard) && /maxlength="400"/.test(dashboard)],
  ["Demo UI escapes record content before rendering HTML", dashboard.includes("function safe(s)") && dashboard.includes(".replace(/[&<>")],
  ["Demo global search supports the Enter key", dashboard.includes("globalSearch').addEventListener('keydown'") && dashboard.includes("e.key==='Enter'")],
  ["Demo navigation includes all four workspace tabs", /data-tab="overview"/.test(dashboard) && /data-tab="records"/.test(dashboard) && /data-tab="create"/.test(dashboard) && /data-tab="workflow"/.test(dashboard)],
  ["Demo mutations remain in page-memory data structures", dashboard.includes("let current=null, toastTimer=null, data={}") && dashboard.includes("data[current.id].unshift")],
  ["Demo dashboard stays standalone without network or persistence APIs", !/\bfetch\s*\(|\bsupabase\b|localStorage|sessionStorage/i.test(dashboard)],
  ["Dashboard links to the dedicated administration workspace", dashboard.includes('href="admin.html"')],
  ["Admin workspace is Arabic RTL and responsive", /<html lang="ar" dir="rtl">/.test(admin) && admin.includes('name="viewport"') && admin.includes('@media(max-width:760px)')],
  ["Admin workspace includes all 35 catalog modules", (() => { const match = admin.match(/const modules=([\s\S]*?);\nconst sections=/); return !!match && JSON.parse(match[1]).length === 35; })()],
  ["Admin workspace covers users, roles, operations, finance, security and release controls", ["view-roles","users","providers","orders","marketing","payments","accounting","security","integrations","backup","monitoring","releases","settings"].every(x => admin.includes(x))],
  ["Admin workspace supports local record creation, status changes and deletion", admin.includes("data-dynamic-form") && admin.includes("data-cycle") && admin.includes("data-delete") && admin.includes("data[key].unshift")],
  ["Admin workspace provides CSV exports and audit trail", admin.includes("exportAllBtn") && admin.includes("text/csv;charset=utf-8") && admin.includes("renderDynamicRecords('audit')")],
  ["Admin workspace clearly prevents production and external operations", admin.includes("لا يوجد اتصال بالخادم") && admin.includes("لا توجد عمليات خلفية") && !/fetch\s*\(/i.test(admin) && !/supabase/i.test(admin) && !admin.includes("localStorage") && !admin.includes("sessionStorage")],
  ["Admin workspace inline JavaScript parses successfully", (() => { try { if (!adminScript) return false; new vm.Script(adminScript); return true; } catch (error) { console.error("Admin JavaScript syntax error:", error.message); return false; } })()],
  ["Dashboard supports direct links to a module workspace", dashboard.includes("new URLSearchParams(window.location.search)") && dashboard.includes("openModule(requestedModule)") ]
];
const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
if (failed.length) {
  console.error(`Preview/navigation contract failed: ${failed.length}/${checks.length}`);
  process.exit(1);
}
console.log(`Preview/navigation contract passed: ${checks.length} checks`);
