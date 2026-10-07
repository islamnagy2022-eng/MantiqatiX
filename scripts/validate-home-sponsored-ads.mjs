#!/usr/bin/env node
import fs from "node:fs";

const home=fs.readFileSync("web/home.js","utf8");
const pages=fs.readFileSync(".github/workflows/pages.yml","utf8");
const required=[
  ["advertisement_id","Targeted advertisement RPC contract must use advertisement_id"],
  ["renderSideTargetedAd","Homepage must render the live sponsored side rail"],
  ["HOME_SPONSORED","Homepage must request the sponsored ad space"],
  ["data-targeted-ad","Targeted ad cards must retain a stable advertisement identifier"],
  ["safeAdUrl","Ad creative/target URLs must pass the safe URL boundary"],
  ["mx-side-ad","Homepage must expose the sponsored side-rail mount"],
];
for(const [needle,label] of required){
  if(!home.includes(needle)) throw new Error("FAIL: "+label+" ("+needle+")");
}
if(!/a\.advertisement_id/.test(home) || !/x\.advertisement_id/.test(home)){
  throw new Error("FAIL: targeted ad lookup/rendering is not aligned to advertisement_id");
}
if(!/validate-home-sponsored-ads\.mjs/.test(pages)){
  throw new Error("FAIL: pages workflow does not invoke validate-home-sponsored-ads.mjs");
}
if(!/HOME_SPONSORED/.test(home)) throw new Error("FAIL: HOME_SPONSORED contract missing");
console.log("PASS: homepage sponsored-ad contract is wired to advertisement_id and CI validation.");
