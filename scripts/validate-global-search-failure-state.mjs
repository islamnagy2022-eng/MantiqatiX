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
assert.match(source,/const seq=\+\+globalSearchSeq;if\(value\.length<2\)/,"every query, including clear/short query, must invalidate older in-flight searches");
assert.match(source,/try\{const results=await globalSearch\(value\);if\(seq!==globalSearchSeq\)return/,"global search must ignore responses from superseded queries");
assert.match(source,/catch\(_\)\{if\(seq!==globalSearchSeq\)return;gso\.innerHTML=.*تعذر إكمال البحث الآن\. تحقق من الاتصال ثم حاول مرة أخرى/,"unexpected global-search failures must render safe actionable feedback instead of leaving the loading state");
assert.match(source,/role="status" aria-live="polite">جاري البحث في البيانات المتاحة/,"search loading state must be announced accessibly");
assert.match(source,/globalSearchSeq\+\+;[\s\S]{0,120}gsi\.value='';gso\.innerHTML='';gso\.classList\.remove\('is-open'\)/,"Escape must cancel pending debounce and invalidate in-flight results");
assert.match(source,/const rawQuery=String\(queryText\|\|\x27\x27\)\.trim\(\)/,"search must normalize raw input before building filters");
assert.match(source,/rawQuery\.replace\(\/\[\^\\p\{L\}\\p\{N\}\\s_-\]\/gu,' '\)/,"search must strip PostgREST filter grammar metacharacters from user input");

assert.ok(source.includes('id="mx-global-search-input" type="search" inputmode="search" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" value="${esc(query)}" autocomplete="off" aria-controls="mx-global-search-results" aria-expanded="false"'), "global search input must expose controlled listbox results and expanded state");
assert.ok(source.includes('id="mx-global-search-results" class="mx-global-search-results" role="listbox" aria-label="نتائج البحث"'), "global search results must expose a listbox");
assert.ok(source.includes('role="option" aria-selected="false" class="mx-global-search-hit"'), "search results must expose keyboard-focusable options");
assert.ok(source.includes("if(e.key==='ArrowDown'&&gso?.classList.contains('is-open'))"), "ArrowDown must move keyboard focus from the combobox to its results");
assert.ok(source.includes("if(e.key==='ArrowUp'){e.preventDefault();if(index<=0)gsi?.focus();else options[index-1]?.focus()}"), "ArrowUp must move through results and return to the search input");
assert.ok(source.includes("gsi?.setAttribute('aria-expanded','true')"), "search must announce when its result region opens");
assert.ok(source.includes("gsi?.setAttribute('aria-expanded','false')"), "search must announce when its result region closes");
assert.ok(source.includes("if(!document.documentElement.dataset.mxGlobalSearchOutsideBound)"), "outside-click dismissal must be installed once across page rerenders");
assert.ok(source.includes("clearTimeout(window.__MNTYGlobalSearchTimer)"), "outside clicks must cancel pending debounce to prevent a hidden search from reopening");
assert.ok(!source.includes("document.addEventListener('click',e=>{if(!e.target.closest('.mx-global-search-wrap'))gso?.classList.remove('is-open')},{once:true})"), "outside-click dismissal must not remove itself after the first click");

console.log("Global search failure-state contract PASS: empty results are distinct from partial/unavailable sources.");
