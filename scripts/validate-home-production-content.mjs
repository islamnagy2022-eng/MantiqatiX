#!/usr/bin/env node
import fs from "node:fs";

const home=fs.readFileSync("web/home.js","utf8");
const css=fs.readFileSync("web/home.css","utf8");

const forbidden=[
  ["نموذج إعلاني تجريبي","homepage must not ship fabricated sponsored offers"],
  ["تقييم تجريبي","homepage must not ship fabricated reviews"],
  ["PARTNER MOCK","homepage must not ship fabricated partner names"],
  ["متاجر","homepage must not ship unverified store links in the public shell"],
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
console.log("PASS: homepage production-content contract contains no fabricated offers/reviews/partners/map and keeps live-data boundaries.");
