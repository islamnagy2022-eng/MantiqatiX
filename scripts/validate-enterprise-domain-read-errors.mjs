import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync("web/app.js", "utf8");
const index = fs.readFileSync("web/index.html", "utf8");
const start = source.indexOf("async function loadEnterpriseDomainData(m)");
const end = source.indexOf("async function loadRestaurantWorkspace()", start);
assert.ok(start >= 0 && end > start, "enterprise domain loader must remain present");
const loader = source.slice(start, end);
assert.match(loader, /cache\.errors\s*=\s*errors/, "per-table read failures must be retained");
assert.match(loader, /errors\[table\]=\{code:result\.error\.code\|\|'READ_FAILED'\}/, "PostgREST errors must not be converted to success without a diagnostic");
assert.match(loader, /catch\(error\)/, "network/query exceptions must be handled");
assert.match(loader, /finally\s*\{\s*cache\.loading=false;\s*renderApp\(\);/, "loader state must be reset even after query errors");

const panelStart = source.indexOf("function enterpriseReadErrorPanel(errors)");
const panelEnd = source.indexOf("async function loadRestaurantWorkspace()", panelStart);
assert.ok(panelStart >= 0 && panelEnd > panelStart, "visible read-error panel must be present");
const panel = source.slice(panelStart, panelEnd);
assert.match(panel, /عدم ظهور سجلات هنا لا يعني أن المصدر خالٍ من البيانات/, "error panel must distinguish denied/unavailable from an empty dataset");
assert.match(source.slice(source.indexOf("function domainModuleWorkspace()")), /enterpriseReadErrorPanel\(d\.errors\)/, "domain workspace must render read failures");
assert.match(source.slice(source.indexOf("function domainModuleWorkspace()")), /d\.errors\?\.\[t\]\?'غير متاح'/, "failed sources must not display a false zero count");

assert.match(source, /\['ACCOUNTING','ERP','FACTORIES','TRIPS','MATRIMONY','MEDICAL'\]\.includes\(m\.key\)/, "medical module must use the same honest read-error loader");
assert.match(source, /if\(m\.key==='MEDICAL'\)return enterpriseReadErrorPanel\(d\.errors\)\+medicalWorkspace\(d\.rows\|\|\{\}\)/, "medical module must render its dedicated workspace");
assert.match(index, /app\.js\?v=rc451/, "main app cache key must be bumped for the workspace changes");

console.log("Enterprise domain read error visibility contract: PASS");
