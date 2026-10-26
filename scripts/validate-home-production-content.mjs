#!/usr/bin/env node
import fs from "node:fs";

const home=fs.readFileSync("web/home.js","utf8");
const css=fs.readFileSync("web/home.css","utf8");
const app=fs.readFileSync("web/app.js","utf8");

const forbidden=[
  ["نموذج إعلاني تجريبي","homepage must not ship fabricated sponsored offers"],
  ["تقييم تجريبي","homepage must not ship fabricated reviews"],
  ["PARTNER MOCK","homepage must not ship fabricated partner names"],
  ["نموذج عرض — تُربط ببيانات الموقع المنشورة عند تفعيل الخريطة","homepage must not ship a simulated map as if it were a product surface"]
];

for(const [needle,label] of forbidden){
  if(home.includes(needle)) throw new Error("FAIL: "+label+" ("+needle+")");
}
const required=[
  ["renderTargetedAds","homepage must render live sponsored advertisements"],
  ["mx-ref-live-info","homepage must contain a truthful about/info section"],
  ["mx-ref-live-state","homepage must contain a truthful data-availability state"],
  ["mx-ref-local-discovery","homepage must use a truthful local-discovery surface"],
  ["mx-discovery-location","homepage must retain explicit location opt-in"],
  ["mx-about-add","homepage about CTA must remain wired"]
];
for(const [needle,label] of required){
  if(!home.includes(needle) && !css.includes(needle)) throw new Error("FAIL: "+label+" ("+needle+")");
}
if(!home.includes('id="mx-sector-count"')) throw new Error("FAIL: live sector count mount missing");
if(!home.includes("dynamicTaxonomy(services,providers).length")) throw new Error("FAIL: sector KPI must use canonical/live taxonomy count");
if(!home.includes("const PUBLIC_CATEGORY_ALIASES = {EDUCATION:'EDU',MARKETING:'DIGITAL',SPORTS:'FITNESS',TRIPS:'TRAVEL',ERP:'TECH'}")) throw new Error("FAIL: backend sector codes must map to canonical public sectors");
if(!home.includes("publicCategoryCode(x?.category_code)")) throw new Error("FAIL: live service counts must use canonical public sector codes");
if(!home.includes("publicCategoryCode(x?.provider_kind)")) throw new Error("FAIL: live provider counts must use canonical public sector codes");
if(!home.includes("Object.keys(PUBLIC_DIRECTORY_COUNTS||{})")) throw new Error("FAIL: public sector directory must include all discovered live sector codes");
if(home.includes('id="mx-module-hub"')) throw new Error("FAIL: deferred module tour must be hidden from the launch homepage");
if(home.includes('href="preview/dashboard.html"')) throw new Error("FAIL: all-module demo links must be hidden from the launch homepage");
if(home.includes('معاينة جميع الموديولات') || home.includes('خدمات التسويق الرقمي — قيد التطوير')) throw new Error("FAIL: deferred modules must not be advertised in the public navigation");

if(home.includes('href="preview/index.html"')) throw new Error("FAIL: interactive module tour link must be hidden for the launch scope");
if(!home.includes("LAUNCH_SECTOR_CODES = Object.freeze(['FOOD','HEALTH','PHARMACY','GROCERY'])")) throw new Error("FAIL: homepage launch must be restricted to the four selected sectors");

if(home.includes('mx-public-module-hub') || home.includes('mx-ref-digital-workspace')) throw new Error("FAIL: deferred public workspaces must be removed from the launch page");
if(!css.includes(".mx-public-module-hub") || !css.includes("@media(max-width:760px){.mx-public-module-hub")) throw new Error("FAIL: public module tour must have responsive styles");
for(const [needle,label] of [
  ['id="mx-category-filter-input"',"sector pages must expose a public category search"],
  ['id="mx-category-filter-clear"',"sector search must provide a clear action"],
  ["card.textContent.toLocaleLowerCase('ar').includes(term)","sector search must filter visible service/provider cards locally"],
  ["applyCategoryFilter();","sector results must be filtered after loading"]
]) if(!home.includes(needle)) throw new Error("FAIL: "+label+" ("+needle+")");
if(!home.includes("history.pushState({provider:providerKey},'', '#provider/'+encodeURIComponent(providerKey))")) throw new Error("FAIL: public provider profile must preserve a shareable route and browser back navigation");
if(!home.includes('id="mx-profile-sector-services"')) throw new Error("FAIL: public provider profiles must load sector service catalog");
if(!home.includes(".from('marketing_services').select('id,code,name_ar,name_en,category_code,description').eq('status','ACTIVE').eq('category_code',categoryCode)")) throw new Error("FAIL: provider profile catalog must use active public sector services only");
if(!home.includes("لا تعني بالضرورة أن النشاط يقدم كل خدمة")) throw new Error("FAIL: public sector catalog must not imply unverified provider-service relationships");
if(!home.includes(".limit(12)")) throw new Error("FAIL: provider profile sector catalog must remain bounded");
if(!home.includes('class="mx-category-service-details" hidden')) throw new Error("FAIL: public service cards must expose expandable service details");
if(!home.includes("b.setAttribute('aria-expanded',expanded?'true':'false')")) throw new Error("FAIL: expandable service details must expose their state accessibly");
if(!css.includes(".mx-category-service-details[hidden]{display:none!important}")) throw new Error("FAIL: expandable service details must respect their hidden state");
if(!css.includes(".mx-category-result-card[hidden]{display:none!important}")) throw new Error("FAIL: filtered sector cards must be hidden accessibly and consistently");
if(!css.includes(".mx-category-filter__controls")) throw new Error("FAIL: sector search controls must have responsive styling");

const appLaunchStart=app.indexOf("async function accountView()");
const appLaunchEnd=app.indexOf("async function providerOnboardingView()",appLaunchStart);
const accountSource=appLaunchStart>=0&&appLaunchEnd>appLaunchStart?app.slice(appLaunchStart,appLaunchEnd):"";
if(!app.includes("signInWithGoogle")||!app.includes("sb.auth.signInWithOAuth({provider:'google'")||!app.includes('id="google-auth"')) throw new Error("FAIL: existing Google OAuth login route must remain active");
if(!app.includes("LAUNCH_WORKSPACE_MODULES")||!app.includes("if(!isLaunchModule(name))")) throw new Error("FAIL: deferred workspace routes must be hidden and guarded");
if(!app.includes("domainModules.filter(m=>LAUNCH_DOMAIN_KEYS.has(m.key))")) throw new Error("FAIL: module management page must show launch modules only");
if(!app.includes("لوحة صاحب النشاط")||!app.includes("لوحة قيادة المنصة")&&!app.includes("مركز قيادة المنصة")) throw new Error("FAIL: owner/platform dashboard surfaces must remain available");
if(accountSource.includes("digital_page_products")||accountSource.includes("commercialHtml")) throw new Error("FAIL: deferred digital-page commerce must not be an account-center dependency");
if(!app.includes("mx-auth-launch")||!app.includes("mx-account-card")) throw new Error("FAIL: launch auth/account presentation classes must be connected to existing screens");

console.log("PASS: homepage production-content contract contains no fabricated offers/reviews/partners/map and keeps live-data boundaries.");
console.log("PASS: public sector pages include responsive local search across loaded services and providers.");
