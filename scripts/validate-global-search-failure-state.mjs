import fs from "node:fs";
import assert from "node:assert/strict";

const source=fs.readFileSync("web/app.js","utf8");
assert.match(source,/const sourceErrors=\[\]/,"search must track source failures separately from empty results");
assert.match(source,/sourceErrors\.push\(\{label:source\.label,key:source\.key\}\)/,"each failed source must be recorded");
assert.match(source,/results\.searchErrors=sourceErrors/,"search results must preserve partial-failure metadata");
assert.match(source,/تعذر إكمال البحث في/,"all-failed searches must disclose an unavailable source");
assert.match(source,/نتائج جزئية: تعذر البحث في/,"partial results must disclose incomplete source coverage");
assert.match(source,/globalSearchCan\)/,"search sources must remain permission-filtered");
assert.match(source,/aria-live=(?:'|")polite(?:'|")/,"partial-failure status should be accessible");
assert.match(source,/if\(!searchableSources\)return '<div class="mx-global-search-empty" role="status">لا توجد مصادر بحث متاحة لهذا الحساب أو الدور الحالي\./,"zero permitted search sources must not be reported as zero matching records");
console.log("Global search failure-state contract PASS: empty results are distinct from partial/unavailable sources.");
