import fs from "node:fs";
import vm from "node:vm";

const entry = fs.readFileSync("web/preview/index.html", "utf8");
const dashboard = fs.readFileSync("web/preview/dashboard.html", "utf8");
const admin = fs.readFileSync("web/preview/admin.html", "utf8");
const login = fs.readFileSync("web/preview/login.html", "utf8");
const restaurant = fs.readFileSync("web/preview/restaurant.html", "utf8");
const adminScript = admin.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? "";
const loginScript = login.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? "";
const dashboardScript = dashboard.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? "";
const entryScript = entry.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? "";
const home = fs.readFileSync("web/index.html", "utf8");
const pages = fs.readFileSync(".github/workflows/pages.yml", "utf8");
const sw = fs.readFileSync("web/sw.js", "utf8");

const customerRestaurants = fs.readFileSync("web/preview/restaurants.html", "utf8");
const customerOrder = fs.readFileSync("web/preview/restaurant-order.html", "utf8");
const sharedCart = fs.readFileSync("web/preview/shared-cart.js", "utf8");
const cartPage = fs.readFileSync("web/preview/cart.html", "utf8");
const customerRestaurantsScript = customerRestaurants.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? "";
const customerOrderScript = customerOrder.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? "";

const checks = [
  ["Restaurant and cafe category opens customer restaurant discovery", entry.includes("if(selected==='FOOD'){window.location.href='restaurants.html';return;}")],
  ["Customer restaurant page lists the three requested demo restaurants", ["مطعم الزعيم", "مطعم أولاد جابر", "الأصلي", "بركة السبع"].every(x => customerRestaurants.includes(x))],
  ["Customer discovery links to restaurant menu and ordering", customerRestaurants.includes('href="restaurant-order.html?restaurant=') && customerRestaurants.includes('data-kind="كشري وسندوتشات"') && customerRestaurants.includes('data-kind="فول وطعمية"') && customerRestaurants.includes('data-kind="مشويات"')],
  ["Customer order page supports size, extras, quantities, multi-item cart and demo checkout", ["data-pick", "data-size", "data-extra", "data-inc", "data-dec", "data-del", "DEMO-", "تأكيد الطلب التجريبي"].every(x => customerOrder.includes(x))],
  ["Customer restaurant menu supports live search and accessible result count", customerOrder.includes('id="menuSearch"') && customerOrder.includes('id="menuCount"') && customerOrder.includes("addEventListener('input',renderMenu)")],
  ["Customer restaurant ordering is local-only and does not use backend or browser persistence", /لا يوجد دفع أو إرسال للمطعم/.test(customerOrder) && !/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|createClient\s*\(/i.test(customerOrder)],
  ["Customer restaurant page JavaScript parses successfully", (() => { try { if (!customerRestaurantsScript) return false; new vm.Script(customerRestaurantsScript); return true; } catch (error) { console.error("Customer restaurants JavaScript syntax error:", error.message); return false; } })()],
  ["Customer order page JavaScript parses successfully", (() => { try { if (!customerOrderScript) return false; new vm.Script(customerOrderScript); return true; } catch (error) { console.error("Customer order JavaScript syntax error:", error.message); return false; } })()],
  ["Preview homepage and restaurant workspace link to customer restaurant journey", entry.includes('href="restaurants.html"') && restaurant.includes('href="restaurants.html"')],
  ["Restaurant demo is clearly isolated from live backend", /وضع تجريبي فقط/.test(restaurant) && /لا يوجد اتصال بالخادم/.test(restaurant) && /لم يتم إرساله إلى أي خادم/.test(restaurant)],
  ["Restaurant demo supports multi-item orders and order-state transitions", /إنشاء طلب متعدد الأصناف/.test(restaurant) && /id="orderLines"/.test(restaurant) && /data-next/.test(restaurant) && /data-filter/.test(restaurant)],
  ["Restaurant demo is linked from preview homepage and module dashboard", /href="restaurant\.html"/.test(entry) && /href="restaurant\.html"/.test(dashboard)],
  ["Arabic RTL preview gateway", /<html lang="ar" dir="rtl">/.test(entry)],
  ["Preview root opens the developed homepage directly", /id="heroTitle"/.test(entry) && /id="categoryGrid"/.test(entry) && /id="serviceCards"/.test(entry) && !/window\.location\.replace/.test(entry)],
  ["Preview keeps the live backend-connected homepage separate", !/href="\.\.\//.test(entry)],
  ["Homepage links to module demo, admin and authentication workspaces", /href="dashboard\.html"/.test(entry) && /href="admin\.html"/.test(entry) && /href="login\.html"/.test(entry)],
  ["Preview banner exposes direct links to all demo workspaces", /aria-label="روابط التجربة"[\s\S]*?href="dashboard\.html"[\s\S]*?href="admin\.html"[\s\S]*?href="login\.html"/.test(entry)],
  ["Homepage clearly labels demo-only behavior", /معاينة تفاعلية/.test(entry) && /لا يوجد اتصال بالـ Backend/.test(entry) && /لا يوجد اتصال بالخادم/.test(entry)],
  ["Homepage has interactive search, location, category and service components", /id="searchForm"/.test(entry) && /id="locationSelect"/.test(entry) && /id="categoryGrid"/.test(entry) && /id="serviceCards"/.test(entry)],
  ["Homepage supports local-only request and provider onboarding simulations", /requestForm/.test(entry) && /joinForm/.test(entry) && /لم يتم إرسال أو حفظ أي بيانات/.test(entry)],
  ["Homepage has no external requests, persistence or Supabase client", !/\bfetch\s*\(|\bXMLHttpRequest\b|localStorage|sessionStorage|createClient\s*\(/i.test(entry)],
  ["Homepage inline JavaScript parses successfully", (() => { try { if (!entryScript) return false; new vm.Script(entryScript); return true; } catch (error) { console.error("Homepage JavaScript syntax error:", error.message); return false; } })()],
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
  ["Demo navigation includes overview, subpages, records, create, specialized, workflow and permissions tabs", ["overview","subpages","records","create","specialized","workflow","permissions"].every(x => dashboard.includes('data-tab="'+x+'"'))],
  ["Demo mutations remain in page-memory data structures", dashboard.includes("let current=null, toastTimer=null, data={}, editingRecordId=null") && dashboard.includes("data[current.id].unshift")],
  ["Demo dashboard stays standalone without network or persistence APIs", !/\bfetch\s*\(|\bsupabase\b|localStorage|sessionStorage/i.test(dashboard)],
  ["Dashboard links to the dedicated administration workspace", dashboard.includes('href="admin.html"')],
  ["Admin workspace is Arabic RTL and responsive", /<html lang="ar" dir="rtl">/.test(admin) && admin.includes('name="viewport"') && admin.includes('@media(max-width:760px)')],
  ["Admin workspace includes all 35 catalog modules", (() => { const match = admin.match(/const modules=([\s\S]*?);\nconst sections=/); return !!match && JSON.parse(match[1]).length === 35; })()],
  ["Admin workspace covers users, roles, operations, finance, security and release controls", ["view-roles","users","providers","orders","marketing","sponsored","payments","accounting","security","integrations","backup","monitoring","releases","settings"].every(x => admin.includes(x))],
  ["Admin workspace supports local record creation, status changes and deletion", admin.includes("data-dynamic-form") && admin.includes("data-cycle") && admin.includes("data-delete") && admin.includes("data[key].unshift")],
  ["Admin workspace provides CSV exports and audit trail", admin.includes("exportAllBtn") && admin.includes("text/csv;charset=utf-8") && admin.includes("renderDynamicRecords('audit')")],
  ["Admin audit screen renders searchable session events and exports them", admin.includes("if(key==='audit')renderDynamicRecords('audit')") && admin.includes("key==='audit'?[['time','event','area','result']") && admin.includes("سجل التدقيق للقراءة فقط")],
  ["Admin workspace clearly prevents production and external operations", admin.includes("لا يوجد اتصال بالخادم") && admin.includes("لا توجد عمليات خلفية") && !/fetch\s*\(/i.test(admin) && !/createClient\s*\(/i.test(admin) && !admin.includes("localStorage") && !admin.includes("sessionStorage")],
  ["Admin workspace inline JavaScript parses successfully", (() => { try { if (!adminScript) return false; new vm.Script(adminScript); return true; } catch (error) { console.error("Admin JavaScript syntax error:", error.message); return false; } })()],
  ["Dashboard supports direct links to a module workspace", dashboard.includes("new URLSearchParams(window.location.search)") && dashboard.includes("openModule(requestedModule)") ],
  ["Sponsored placements are a dedicated marketing subpage, not an extra module", dashboard.includes("الإعلانات الممولة والظهور المدفوع") && admin.includes("الإعلانات الممولة والظهور المدفوع") && !dashboard.includes("id:'sponsored'") && !admin.includes('"id":"sponsored"')],
  ["Preview authentication matches the Google sign-in entry experience", login.includes("SECURE GOOGLE SIGN-IN") && login.includes("المتابعة باستخدام Google") && login.includes('href="../index.html?openAuth=1"') && login.includes("لا تدخل كلمة مرور Google في هذه الصفحة")],
  ["Preview login routes to the real platform Google OAuth flow without collecting credentials", !/fetch\s*\(|\bXMLHttpRequest|createClient\s*\(/i.test(login) && !login.includes("localStorage") && !login.includes("sessionStorage") && login.includes('href="../index.html?openAuth=1"')],
  ["Google sign-in preview is a static accessible page without inline JavaScript", !loginScript && login.includes('aria-label="متابعة تسجيل الدخول بحساب Google"')],
  ["Admin and dashboard link to the demo authentication page", admin.includes('href="login.html"') && dashboard.includes('href="login.html"')],
  ["All 35 module workspaces include domain-specific form configurations", (() => { const match = dashboard.match(/const specialized=(\{[\s\S]*?\});\n\nconst workspacePageNames=/); return !!match && Object.keys(JSON.parse(match[1])).length === 35; })()],
  ["Every module has valid unique specialized form fields", (() => { const mm = dashboard.match(/const modules=\[([\s\S]*?)\n\];/); const sm = dashboard.match(/const specialized=(\{[\s\S]*?\});\n\nconst workspacePageNames=/); if (!mm || !sm) return false; const ids = [...mm[1].matchAll(/\{id:'([^']+)'/g)].map(x => x[1]); const cfg = JSON.parse(sm[1]); return ids.length === 35 && ids.every(id => Array.isArray(cfg[id]?.fields) && cfg[id].fields.length >= 3 && new Set(cfg[id].fields.map(f => f[0])).size === cfg[id].fields.length && cfg[id].fields.every(f => f.length >= 3 && ['text','select','number','email','date','textarea'].includes(f[2]) && (f[2] !== 'select' || Array.isArray(f[3]) && f[3].length > 0))) && Object.keys(cfg).length === ids.length; })()],
  ["Admin demo safety control cannot be disabled and filters show only available states", admin.includes("حماية العرض التجريبي مفعلة دائمًا") && admin.includes("key==='strictDemo'") && !admin.includes('<option>قيد التطوير</option>') && !admin.includes('<option>مخطط</option>')],
  ["Module workspace exposes a dedicated specialized-function tab", dashboard.includes('data-tab="specialized"') && dashboard.includes('id="specializedForm"') && dashboard.includes("renderSpecialized()")],
  ["All 35 modules have at least five named subpages", (() => { const mm = dashboard.match(/const modules=\[([\s\S]*?)\n\];/); const pp = dashboard.match(/const workspacePageNames=\{([\s\S]*?)\n\};/); if (!mm || !pp) return false; const ids = [...mm[1].matchAll(/\{id:'([^']+)'/g)].map(x => x[1]); const pageIds = [...pp[1].matchAll(/^([a-z]+):\[([^\n]+)\]/gm)]; return ids.length === 35 && pageIds.length === 35 && ids.every(id => { const row = pageIds.find(x => x[1] === id); return !!row && (row[2].match(/,/g)||[]).length >= 4; }); })()],
  ["Module workspace includes permissions matrix and six role profiles", dashboard.includes('data-tab="permissions"') && dashboard.includes("const roleMatrix=") && ["owner","manager","operator","reviewer","analyst","viewer"].every(r => dashboard.includes(r)) && dashboard.includes("renderPermissions()")],
  ["Module records support details, edit, delete and status updates", ["data-view-record","data-edit-record","data-delete-record","data-cycle","editingRecordId"].every(x => dashboard.includes(x)) && dashboard.includes("تم تعديل السجل التجريبي محليًا فقط.")],
  ["Role selection changes visible actions and enforces demo-side permission guards", dashboard.includes("function applyRolePreview()") && dashboard.includes("activeRole='owner'") && dashboard.includes("if(!(roleMatrix[activeRole]||roleMatrix.viewer).delete)") && dashboard.includes("if(!(roleMatrix[activeRole]||roleMatrix.viewer).edit)") && dashboard.includes("if(!(roleMatrix[activeRole]||roleMatrix.viewer).approve") && dashboard.includes("data-approve-record")],
  ["Role preview keeps production authorization explicitly out of scope", dashboard.includes("يجب تطبيق RBAC وRLS والتحقق على الخادم قبل الإنتاج") && dashboard.includes("لا تُطبق صلاحيات حقيقية")],
  ["Marketing sponsored ads remain reachable as a subpage", dashboard.includes("marketing:['لوحة التسويق الداخلي'") && dashboard.includes("الإعلانات الممولة والظهور المدفوع")],
  ["Module-specific actions save only local synthetic records", dashboard.includes("data[current.id].unshift") && dashboard.includes("تم تنفيذ المحاكاة المتخصصة محليًا فقط.")],
  ["Dashboard inline JavaScript parses successfully", (() => { try { if (!dashboardScript) return false; new vm.Script(dashboardScript); return true; } catch (error) { console.error("Dashboard JavaScript syntax error:", error.message); return false; } })()]
];

checks.push(["Project profile page supports per-project logo and cover previews", (() => {
  const page = fs.readFileSync("web/preview/project.html", "utf8");
  return page.includes('id="logoFile"') && page.includes('id="coverFile"') &&
    page.includes('id="publicLogo"') && page.includes('id="publicCover"') &&
    page.includes("5*1024*1024") && page.includes("لم يتم حفظ البيانات أو رفع الصور");
})()]);
checks.push(["Service card image is the clickable project entry point", entry.includes('class="card-visual" type="button" data-project=') && !entry.includes('class="btn ghost" type="button" data-details=')]);


checks.push(["Central cart page groups items by seller and supports quantity updates", cartPage.includes("groups=new Map()") && cartPage.includes("data-inc") && cartPage.includes("data-del") && cartPage.includes("window.MXCart.total()")]);
checks.push(["Restaurant ordering uses the shared cart module", customerOrder.includes('src="shared-cart.js"') && customerOrder.includes("window.MXCart.add") && customerOrder.includes("window.MXCart.removeMerchant(key)")]);
checks.push(["Shared cart storage schema excludes customer and payment fields", sharedCart.includes("mantiqatix.demo.cart.v1") && sharedCart.includes("sessionStorage") && !sharedCart.includes("customerName") && !sharedCart.includes("phoneNumber") && !sharedCart.includes("paymentToken")]);
checks.push(["Shared cart JavaScript parses successfully", (() => { try { new vm.Script(sharedCart); return true; } catch (error) { console.error("Shared cart syntax error:", error.message); return false; } })()]);
checks.push(["Shared cart rejects malformed and duplicate additions", sharedCart.includes("reason:'invalid'") && sharedCart.includes("reason:'duplicate-id'") && sharedCart.includes("reason:ok?undefined:'storage-unavailable'")]);
checks.push(["Shared cart revalidates stored lines, bounds quantities and recomputes totals", sharedCart.includes("Number(x.unit)<=100000000") && sharedCart.includes("Math.min(20,Number(x.qty))") && sharedCart.includes("total:unit*qty") && sharedCart.includes("x.extras.slice(0,20)")]);
checks.push(["Shared cart runtime normalizes tampered session data", (() => {
  let stored = JSON.stringify([
    {id:"valid-1",merchantId:"shop-a",merchantName:"A",module:"products",name:"Item",unit:25,qty:99,total:1,extras:Array(30).fill("x".repeat(120)),note:"n".repeat(300)},
    {id:"bad-price",name:"Bad",unit:-5,qty:1},
    {id:"bad-qty",name:"Bad quantity",unit:5,qty:0}
  ]);
  const storage = {getItem:()=>stored,setItem:(k,v)=>{stored=v;},removeItem:()=>{stored="[]";}};
  const context = {window:{},sessionStorage:storage,crypto:{randomUUID:()=>"generated-id"}};
  try {
    vm.runInNewContext(sharedCart,context);
    const rows=context.window.MXCart.list();
    return rows.length===1 && rows[0].qty===20 && rows[0].total===500 && rows[0].extras.length===20 && rows[0].extras[0].length===80 && rows[0].note.length===100;
  } catch (error) { console.error("Shared cart runtime validation failed:",error.message); return false; }
})()]);
checks.push(["Shared cart add/update/remove enforce quantity and recompute line totals", (() => {
  let stored="[]";
  const storage={getItem:()=>stored,setItem:(k,v)=>{stored=v;return true;},removeItem:()=>{stored="[]";}};
  const context={window:{},sessionStorage:storage,crypto:{randomUUID:()=>"runtime-line-id"}};
  try {
    vm.runInNewContext(sharedCart,context);
    const cart=context.window.MXCart;
    const added=cart.add({id:"line-1",merchantId:"shop-a",name:"Demo",unit:12.5,qty:99,total:0});
    const afterAdd=cart.list()[0];
    if(!added.ok||afterAdd.qty!==20||afterAdd.unit!==13||afterAdd.total!==260)return false;
    if(!cart.update("line-1",3))return false;
    if(cart.list()[0].qty!==3||cart.total()!==39||cart.count()!==3)return false;
    if(!cart.remove("line-1"))return false;
    return cart.list().length===0&&cart.total()===0;
  } catch(error) { console.error("Shared cart mutation test failed:",error.message); return false; }
})()]);

checks.push(["Shared cart rejects invalid quantity updates without corrupting existing lines", (() => {
  let stored=JSON.stringify([{id:"line-safe",merchantId:"shop-a",name:"Safe",unit:10,qty:2,total:20}]);
  const storage={getItem:()=>stored,setItem:(k,v)=>{stored=v;return true;},removeItem:()=>{stored="[]";}};
  const context={window:{},sessionStorage:storage,crypto:{randomUUID:()=>"runtime-id"}};
  try {
    vm.runInNewContext(sharedCart,context);
    const cart=context.window.MXCart;
    if(cart.update("line-safe","not-a-number")!==false)return false;
    if(cart.update("line-safe",NaN)!==false)return false;
    const rows=cart.list();
    return rows.length===1&&rows[0].qty===2&&rows[0].total===20;
  } catch(error) { console.error("Shared cart invalid quantity test failed:",error.message); return false; }
})()]);
checks.push(["Shared cart removes duplicate IDs from tampered stored data", (() => {
  let stored=JSON.stringify([
    {id:"duplicate",merchantId:"shop-a",name:"First",unit:10,qty:1},
    {id:"duplicate",merchantId:"shop-b",name:"Second",unit:99,qty:2},
    {id:"unique",merchantId:"shop-a",name:"Third",unit:5,qty:1}
  ]);
  const storage={getItem:()=>stored,setItem:(k,v)=>{stored=v;return true;},removeItem:()=>{stored="[]";}};
  const context={window:{},sessionStorage:storage,crypto:{randomUUID:()=>"runtime-id"}};
  try {
    vm.runInNewContext(sharedCart,context);
    const rows=context.window.MXCart.list();
    return rows.length===2&&rows[0].id==="duplicate"&&rows[0].name==="First"&&rows[1].id==="unique";
  } catch(error) { console.error("Shared cart duplicate storage test failed:",error.message); return false; }
})()]);

checks.push(["Restaurant demo checkout filters the current restaurant cart before empty-cart validation", (() => {
  const start=customerOrderScript.indexOf("document.getElementById('checkout').addEventListener('submit'");
  if(start<0)return false;
  const end=customerOrderScript.indexOf("});renderCart()",start);
  if(end<0)return false;
  const handler=customerOrderScript.slice(start,end);
  const declaration=handler.indexOf("let cart=window.MXCart.list().filter(x=>x.merchantId===key)");
  const emptyCheck=handler.indexOf("if(!cart.length)");
  return declaration>=0&&emptyCheck>declaration&&!handler.includes("if(!cart.length){alert('أضف صنفًا للسلة أولًا')");
})()]);


const ownerDashboard = fs.readFileSync("web/preview/business-owner.html", "utf8");
const ownerScript = ownerDashboard.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? "";
checks.push(["Business-owner dashboard is linked from the preview homepage", entry.includes('href="business-owner.html"')]);
checks.push(["Business-owner dashboard includes all eight owner work areas", ["overview","orders","services","customers","team","marketing","reports","settings"].every(id => ownerDashboard.includes('id="' + id + '"'))]);
checks.push(["Business-owner dashboard clearly labels demo data and no live backend", /معاينة تجريبية/.test(ownerDashboard) && /بيانات تجريبية ثابتة/.test(ownerDashboard) && /لا توجد اتصالات خلفية/.test(ownerDashboard) && !/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|createClient\s*\(/i.test(ownerDashboard)]);
checks.push(["Business-owner dashboard has accessible Arabic RTL navigation and responsive layouts", /<html lang="ar" dir="rtl">/.test(ownerDashboard) && /aria-label="القائمة الرئيسية"/.test(ownerDashboard) && /@media\(max-width:650px\)/.test(ownerDashboard)]);
checks.push(["Business-owner dashboard inline JavaScript parses successfully", (() => { try { if (!ownerScript) return false; new vm.Script(ownerScript); return true; } catch (error) { console.error("Business-owner dashboard JavaScript syntax error:", error.message); return false; } })()]);

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
if (failed.length) {
  console.error(`Preview/navigation contract failed: ${failed.length}/${checks.length}`);
  process.exit(1);
}
console.log(`Preview/navigation contract passed: ${checks.length} checks`);
