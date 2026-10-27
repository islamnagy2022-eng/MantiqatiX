#!/usr/bin/env node
import fs from "node:fs";

const home=fs.readFileSync("web/home.js","utf8");
const css=fs.readFileSync("web/home.css","utf8");
const previewWorkflow=fs.readFileSync(".github/workflows/preview-pages.yml","utf8");

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
if(home.includes('preview/')) throw new Error("FAIL: production homepage must not link to experimental preview routes");
if(home.includes('mx-module-hub') || home.includes('معاينة جميع الموديولات')) throw new Error("FAIL: production homepage must not expose the demo module tour");
if(home.includes('href="smm.html"')) throw new Error("FAIL: retired SMM route must not be exposed from the production homepage");
if(previewWorkflow.includes("pages: write") || previewWorkflow.includes("actions/upload-pages-artifact") || previewWorkflow.includes("actions/deploy-pages")) throw new Error("FAIL: retired preview workflow must not publish to GitHub Pages");
if(!/workflow_dispatch:/.test(previewWorkflow)) throw new Error("FAIL: retired preview workflow must not auto-trigger");
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
console.log("PASS: homepage production-content contract contains no fabricated offers/reviews/partners/map and keeps live-data boundaries.");
console.log("PASS: public sector pages include responsive local search across loaded services and providers.");
