#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = p => fs.readFileSync(p, 'utf8');
const index = read('web/index.html');
const sw = read('web/sw.js');
const home = read('web/home.js');
const css = read('web/home.css');
const homeJsVersion = index.match(/home\.js\?v=([A-Za-z0-9._-]+)/)?.[1];
const homeCssVersion = index.match(/home\.css\?v=([A-Za-z0-9._-]+)/)?.[1];
const swVersion = index.match(/sw\.js\?v=([A-Za-z0-9._-]+)/)?.[1];

assert.ok(homeJsVersion, 'L1: homepage JavaScript must have an explicit cache version');
assert.ok(homeCssVersion, 'L1: homepage CSS must have an explicit cache version');
assert.ok(swVersion, 'L1: service worker must have an explicit cache version');
assert.ok(sw.includes(`const CACHE='${swVersion}'`), 'L1: service-worker registration and cache generation must match');
assert.ok(sw.includes(`./home.js?v=${homeJsVersion}`), 'L1: service worker must precache the exact homepage JavaScript version');
assert.ok(sw.includes(`./home.css?v=${homeCssVersion}`), 'L1: service worker must precache the exact homepage CSS version');

for (const [needle, label] of [
  ['id="mx-module-hub"', 'homepage must expose the module hub'],
  ['id="mx-home-search"', 'homepage must expose the main search field'],
  ['id="mx-search-btn"', 'homepage must expose the search action'],
  ['id="mx-category-filter-input"', 'homepage must expose category filtering'],
  ['href="preview/dashboard.html"', 'homepage must link to the module tour'],
  ['href="preview/index.html"', 'homepage must link to the interactive preview'],
  ['href="preview/restaurants.html">جرّب مساحة المطاعم والكافيهات</a>', 'homepage must provide a direct restaurant demo entry'],
  ['لا تنشئ طلبات أو مدفوعات حقيقية', 'demo boundary must be explicit']
]) assert.ok(home.includes(needle), `L1: ${label}`);

assert.ok(/@media/.test(css), 'L1: homepage must include responsive CSS rules');
assert.ok(!home.includes('href="marketing-services.html"'), 'L1: deferred marketing services must not be linked as a live page');

console.log('L1 homepage source preflight: PASS (static contract only; not a browser E2E or production release certificate)');
