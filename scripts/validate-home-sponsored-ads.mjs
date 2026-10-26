#!/usr/bin/env node
import fs from "node:fs";

const home=fs.readFileSync("web/home.js","utf8");
const pages=fs.readFileSync(".github/workflows/pages.yml","utf8");
// Ad implementation remains available for a later phase, but the launch homepage must not invoke it.
const preservedImplementation=[
  ["advertisement_id","Deferred targeted-ad implementation keeps stable advertisement identifiers"],
  ["renderSideTargetedAd","Deferred ad renderer remains available for later activation"],
  ["data-targeted-ad","Deferred ad cards retain a stable advertisement identifier"],
  ["safeAdUrl","Ad creative/target URLs keep the safe URL boundary"],
  ["mx-side-ad","Ad side-rail implementation remains in source for later activation"],
];
for(const [needle,label] of preservedImplementation){
  if(!home.includes(needle)) throw new Error("FAIL: "+label+" ("+needle+")");
}
if(home.includes("HOME_SPONSORED") || home.includes("get_mnty_targeted_advertisements") || home.includes('id="mx-offers"') || home.includes('id="mx-growth"')){
  throw new Error("FAIL: deferred sponsored-ad RPC or public CTA is still active in the launch homepage");
}
if(!/a\.advertisement_id/.test(home) || !/x\.advertisement_id/.test(home)){
  throw new Error("FAIL: deferred targeted-ad implementation must remain aligned to advertisement_id");
}
if(!/validate-home-sponsored-ads\.mjs/.test(pages)){
  throw new Error("FAIL: pages workflow does not invoke validate-home-sponsored-ads.mjs");
}
console.log("PASS: targeted ads are deferred from the launch homepage while safe implementation is preserved.");
