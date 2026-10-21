#!/usr/bin/env node
import fs from "node:fs";

const home=fs.readFileSync("web/home.js","utf8");
const css=fs.readFileSync("web/home.css","utf8");

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

const searchRecovery=[
  [home.includes('id="mx-home-search-status" class="mx-home-search-status" role="status" aria-live="polite" hidden'),"homepage catalog search must expose an accessible status region"],
  [home.includes("const showHomeSearchStatus=(message,showRetry=false)=>"),"homepage search must have a reusable safe status renderer"],
  [home.includes("retry.textContent='إعادة المحاولة'"),"homepage search failures must expose a retry action"],
  [home.includes("const servicesFailed=servicesRes.status!=='fulfilled'||Boolean(servicesRes.value?.error)"),"homepage catalog must track service-source failure separately"],
  [home.includes("const providersFailed=providersRes.status!=='fulfilled'||Boolean(providersRes.value?.error)"),"homepage catalog must track provider-source failure separately"],
  [home.includes("تعذر تحميل الخدمات؛ تظهر نتائج مقدمي الخدمات المتاحة فقط"),"homepage must preserve available provider results when services fail"],
  [home.includes("تعذر تحميل مقدمي الخدمات؛ تظهر نتائج الخدمات المتاحة فقط"),"homepage must preserve available service results when providers fail"],
  [css.includes(".mx-home-search-status[hidden]{display:none}")&&css.includes("@media(max-width:560px){.mx-home-search-status"),"homepage search recovery must remain responsive and honor hidden state"]
];
for(const [ok,message] of searchRecovery){if(!ok)throw new Error("FAIL: "+message)}

console.log("PASS: homepage production-content contract contains no fabricated offers/reviews/partners/map and keeps live-data boundaries.");
