import fs from "node:fs";

const entry = fs.readFileSync("web/preview/index.html", "utf8");
const dashboard = fs.readFileSync("web/preview/dashboard.html", "utf8");
const home = fs.readFileSync("web/index.html", "utf8");
const pages = fs.readFileSync(".github/workflows/pages.yml", "utf8");
const sw = fs.readFileSync("web/sw.js", "utf8");

const checks = [
  ["Arabic RTL preview gateway", /<html lang="ar" dir="rtl">/.test(entry)],
  ["Preview auto-redirects to its parent site root", /window\.location\.replace\(['"]\.\.\/['"]\)/.test(entry)],
  ["Preview has a manual homepage fallback", /href="\.\.\/"/.test(entry)],
  ["Preview keeps a separate dashboard link", /href="dashboard\.html"/.test(entry)],
  ["Dashboard is explicitly a demo, not production", /(?:لا تحفظ بيانات تشغيل حقيقية|لا تحفظ بيانات حقيقية|غير إنتاجية|غير إنتاجي)/i.test(entry + "\n" + dashboard)],
  ["Published homepage exists in the Pages artifact root", fs.existsSync("web/index.html")],
  ["Homepage has a visible boot failure fallback", /تعذر تحميل واجهة المنصة/.test(home)],
  ["Homepage keeps Supabase failure in public mode", /public mode remains open/.test(home)],
  ["Pages artifact publishes web/ as the site root", /path:\s*\.\/web/.test(pages)],
  ["Production deploy is restricted to main", /github\.ref == 'refs\/heads\/main'/.test(pages)],
  ["Service worker uses network-first navigation with cached homepage fallback", /event\.request\.mode==='navigate'[\s\S]*?caches\.match\('\.\/index\.html'\)/.test(sw)],
  ["Demo dashboard declares Arabic RTL and mobile viewport", /<html lang="ar" dir="rtl">/.test(dashboard) && /name="viewport"/.test(dashboard)],
  ["Demo dashboard has tablet and phone responsive breakpoints", /@media\s*\(max-width:\s*980px\)/.test(dashboard) && /@media\s*\(max-width:\s*650px\)/.test(dashboard)],
  ["Demo dashboard remains standalone without network or browser persistence APIs", !/\bfetch\s*\(|\bsupabase\b|localStorage|sessionStorage/i.test(dashboard)]
];
const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
if (failed.length) {
  console.error(`Preview/navigation contract failed: ${failed.length}/${checks.length}`);
  process.exit(1);
}
console.log(`Preview/navigation contract passed: ${checks.length} checks`);
