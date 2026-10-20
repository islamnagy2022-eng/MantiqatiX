import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('web/industry-workspaces.js', 'utf8');
const document = {
  head: { appendChild() {} },
  getElementById() { return null; },
  createElement(tag) { return { tag, id: '', textContent: '' }; }
};
const context = { window: {}, document };
vm.runInNewContext(source, context, { filename: 'web/industry-workspaces.js' });
const api = context.window.MNTYIndustryWorkspace;
assert.ok(api, 'industry workspace API must initialize');
assert.equal(api.sectorCount, 27, 'exactly 27 sector workspaces must initialize');
assert.equal(new Set(api.sectorCodes).size, 27, 'sector codes must be unique');

for (const code of api.sectorCodes) {
  const route = 'قطاع: ' + code;
  assert.equal(api.supports(route), true, code + ' route must be canonical');
  const html = api.render(route);
  assert.ok(html.includes(code + ' / INDUSTRY WORKSPACE'), code + ' detail must render');
  assert.match(html, /role="tablist"/, code + ' must expose a tablist');
  assert.match(html, /role="tabpanel"/, code + ' must expose a tab panel');
  assert.match(html, /aria-labelledby="mxiw-tab-overview"/, code + ' panel must be labelled by its active tab');
  assert.equal((html.match(/aria-selected="true"/g) || []).length, 1, code + ' must have exactly one selected tab');
  assert.match(html, /tabindex="0"/, code + ' must have a keyboard-focusable active tab/panel');

  const tabIds = [...html.matchAll(/<button[^>]*role="tab"[^>]*id="(mxiw-tab-[^"]+)"/g)].map(match => match[1]);
  const labelledBy = html.match(/role="tabpanel"[^>]*aria-labelledby="([^"]+)"/)?.[1];
  assert.ok(tabIds.length > 0, code + ' must expose actual tab controls');
  assert.equal(new Set(tabIds).size, tabIds.length, code + ' tab IDs must be unique');
  assert.ok(tabIds.includes(labelledBy), code + ' tab panel must reference an existing tab ID');
  assert.equal((html.match(/aria-controls="mxiw-panel"/g) || []).length, tabIds.length, code + ' every tab must point to the panel');
  assert.equal((html.match(/role="tabpanel"/g) || []).length, 1, code + ' must expose exactly one active tab panel');
}

assert.equal(api.supports('الموديولات القطاعية'), true, 'sector directory route must be supported');
assert.equal(api.supports('قطاع: UNKNOWN'), false, 'unknown sector route must be rejected');
assert.equal(api.supports('قطاع: FOOD<script>alert(1)</script>'), false, 'script-bearing route must be rejected');
const hub = api.renderHub();
assert.match(hub, /role="status" aria-live="polite"/, 'directory count must be announced');
assert.match(hub, /دليل الموديولات القطاعية/, 'directory must render its title');
assert.equal((hub.match(/class="mxiw-sector-card"/g) || []).length, 27, 'directory must render one card for each canonical sector');
for (const code of api.sectorCodes) {
  assert.ok(hub.includes('data-mxiw-open="' + code + '"'), code + ' must be discoverable from the sector directory');
}
assert.ok(source.includes("value=\"'+esc(state.search)+'\""), 'search text must be HTML-escaped before insertion into the input value');
assert.ok(source.includes("data-mxiw-group=\"'+esc(g)+'\""), 'filter labels must be escaped before HTML insertion');
assert.match(api.render('قطاع: DIGITAL'), /data-mxiw-live="التسويق والإعلان"/, 'marketing sector must expose the existing marketing workspace');
assert.match(api.render('قطاع: FOOD'), /data-mxiw-live="المطاعم والمطابخ"/, 'food sector must preserve the existing restaurant workspace link');
assert.doesNotMatch(source, /\bsb\.from\s*\(|\.insert\s*\(|\.update\s*\(|\.delete\s*\(|\bfetch\s*\(|invokeMntyFunction|invokeMntyApi|createClient/, 'sector workspace source must remain backend-free');
console.log('Industry workspace runtime contract: PASS');
console.log('27 routes rendered; tab/panel ID relationships, keyboard accessibility, invalid-route rejection, and frontend-only boundary verified.');
