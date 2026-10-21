import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync("web/module-blueprints.js", "utf8");
assert.match(source, /role="tabpanel"/, "module cards must expose tabpanel semantics");
assert.match(source, /aria-labelledby="mnty-blueprint-tab-/,
  "each panel must be labelled by its controlling tab");
assert.match(source, /aria-controls="mnty-blueprint-panel-/,
  "each tab must point to its corresponding panel");
assert.match(source, /event\.key==='ArrowRight'\|\|event\.key==='ArrowLeft'/,
  "tabs must support arrow-key navigation");
assert.match(source, /event\.key==='Home'/, "tabs must support Home navigation");
assert.match(source, /event\.key==='End'/, "tabs must support End navigation");
assert.match(source, /btn\.focus\(\)/, "keyboard navigation must move focus");
assert.match(source, /x\.tabIndex=active\?0:-1/,
  "only the selected tab should be in the tab sequence");
assert.match(source, /cards\.forEach\(\(c,i\)=>\{c\.hidden=i!==selected\}\)/,
  "selection must expose only the selected panel");
console.log("Module blueprint keyboard/accessibility contract PASS.");
