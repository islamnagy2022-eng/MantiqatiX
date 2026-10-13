import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(root, 'web');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);

test('S09-ROUTE-001: public entry points declare mobile/Arabic metadata', () => {
  for (const file of ['web/index.html', 'web/smm.html', 'web/digital-page.html', 'web/digital-page-editor.html']) {
    assert.ok(fs.existsSync(path.join(root, file)), 'missing route document: ' + file);
    const html = read(file);
    assert.match(html, /<html\b/i, file + ': missing html root');
    assert.match(html, /<meta\b[^>]*name=["']viewport["']/i, file + ': missing viewport metadata');
    assert.match(html, /lang=["']ar["']/i, file + ': expected Arabic language declaration');
    assert.match(html, /dir=["']rtl["']/i, file + ': expected RTL direction');
  }
});

test('S09-ROUTE-002: first-party HTML asset references resolve within web root', () => {
  const htmlFiles = fs.readdirSync(web).filter((name) => name.endsWith('.html'));
  assert.ok(htmlFiles.length >= 4, 'expected main, SMM, digital-page, and editor routes');
  const missing = [];
  for (const name of htmlFiles) {
    const html = fs.readFileSync(path.join(web, name), 'utf8');
    for (const match of html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)) {
      const raw = match[1].trim();
      if (!raw || /^(?:#|[a-z][a-z0-9+.-]*:|\/\/)/i.test(raw)) continue;
      const clean = decodeURIComponent(raw.split(/[?#]/, 1)[0]);
      if (!clean) continue;
      const target = path.resolve(web, clean.startsWith('/') ? clean.slice(1) : path.join(path.dirname(name), clean));
      if (!(target === web || target.startsWith(web + path.sep))) missing.push(name + ': path escapes web root: ' + raw);
      else if (!fs.existsSync(target) && clean !== 'vendor/supabase.js') missing.push(name + ': missing asset ' + raw);
    }
  }
  assert.deepEqual(missing, [], missing.join('\n'));
});

test('S09-UX-001: main shell exposes boot status and no-JavaScript fallback', () => {
  const html = read('web/index.html');
  assert.match(html, /id=["']boot-status["']/i, 'missing visible application boot status');
  assert.match(html, /<noscript\b/i, 'missing no-JavaScript fallback');
});

test('S09-UX-002: SMM and digital-page routes load dedicated modules', () => {
  assert.match(read('web/smm.html'), /smm\.js(?:[?#"'])/i, 'SMM route does not load smm.js');
  assert.match(read('web/digital-page.html'), /digital-page\.js(?:[?#"'])/i, 'digital page route does not load its module');
  assert.match(read('web/digital-page-editor.html'), /digital-page-editor\.js(?:[?#"'])/i, 'editor route does not load its module');
});

test('S09-SEC-001: browser assets contain no known private-key/server-secret markers', () => {
  const files = walk(web).filter((file) => /\.(?:js|html|json)$/i.test(file));
  const patterns = [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /SUPABASE_SERVICE_ROLE_KEY/i, /service_role\s*[:=]\s*["'][^"']{12,}/i, /\bsk_live_[A-Za-z0-9]{12,}\b/, /\bgh[pousr]_[A-Za-z0-9]{30,}\b/];
  const findings = [];
  for (const name of files) {
    const content = fs.readFileSync(name, 'utf8');
    for (const pattern of patterns) if (pattern.test(content)) findings.push(path.relative(web, name) + ': matched ' + pattern);
  }
  assert.deepEqual(findings, [], findings.join('\n'));
});

test('S09-CONFIG-001: browser config excludes server-role key markers', () => {
  const config = read('web/config.js');
  assert.doesNotMatch(config, /SUPABASE_SERVICE_ROLE_KEY|-----BEGIN .*PRIVATE KEY-----/i);
  assert.match(config, /SUPABASE_URL|supabaseUrl|createClient/i, 'configuration contract not recognized; review manually');
});


test('S09-RESP-001: responsive styles provide narrow-screen layout rules', () => {
  const homepage = read('web/home-mobile-fixes.css');
  const smm = read('web/smm.css');
  const digital = read('web/digital-page.css');
  const editor = read('web/digital-page-editor.css');
  assert.match(homepage, /@media\s*\(/i, 'homepage mobile fixes must include media-query rules');
  assert.match(smm, /@media\s*\(/i, 'SMM stylesheet must include media-query rules');
  assert.match(digital, /(?:auto-fit|auto-fill|minmax|clamp\()/i, 'digital page should use fluid sizing or responsive grid');
  assert.match(editor, /(?:auto-fit|auto-fill|minmax|clamp\()/i, 'digital editor should use fluid sizing or responsive grid');
});

test('S09-FORM-001: digital-page editor declares native validation for core fields', () => {
  const html = read('web/digital-page-editor.html');
  assert.match(html, /id=["']title["'][^>]*\brequired\b/i, 'page title should be required');
  assert.match(html, /id=["']slug["'][^>]*\brequired\b/i, 'slug should be required');
  assert.match(html, /id=["']slug["'][^>]*\bpattern=/i, 'slug should declare a format constraint');
  assert.match(html, /id=["']title["'][^>]*\bmaxlength=/i, 'title should have a length bound');
  assert.match(html, /id=["']description["'][^>]*\bmaxlength=/i, 'description should have a length bound');
});

test('S09-ERR-001: digital-page routes expose an error/status surface and handle rejected requests', () => {
  const pageHtml = read('web/digital-page.html');
  const pageJs = read('web/digital-page.js');
  const editorHtml = read('web/digital-page-editor.html');
  const editorJs = read('web/digital-page-editor.js');
  assert.match(pageHtml, /id=["']page["']/i, 'public digital page must have a render target');
  assert.match(pageJs, /function fail\s*\(/, 'public digital page must define a failure renderer');
  assert.match(pageJs, /catch\s*\(/, 'public digital page must handle rejected operations');
  assert.match(editorHtml, /id=["']status["']/i, 'editor must expose a status region');
  assert.match(editorJs, /catch\s*\(/, 'editor must handle rejected operations');
});


test('S09-SEC-002: SMM order refresh binds IDs as escaped data, not inline JavaScript', () => {
  const smm = read('web/smm.js');
  assert.match(smm, /data-sync-order=/, 'order refresh buttons should use a data attribute');
  assert.match(smm, /querySelectorAll\(['"]\[data-sync-order\]['"]\)/, 'order refresh should bind click handlers from DOM data');
  assert.doesNotMatch(smm, /onclick=["']syncOrder\(/i, 'order IDs must not be interpolated into inline JavaScript');
  assert.match(smm, /esc\(o\.id\)/, 'order IDs inserted into markup should be HTML-escaped');
});


test('S09-FORM-002: SMM rejects non-finite/fractional quantities and prevents duplicate submits', () => {
  const smm = read('web/smm.js');
  assert.match(smm, /!Number\.isFinite\(qty\)\|\|!Number\.isInteger\(qty\)/, 'quantity must be a finite integer');
  assert.match(smm, /submit\.disabled=true/, 'submit must lock while a request is in flight');
  assert.match(smm, /submit\.disabled=false/, 'submit must be restored after a request failure');
  assert.match(smm, /submit\.textContent=['"]جارٍ إرسال الطلب/, 'in-flight state should be visible to the user');
});


test('S09-SEC-003: SMM admin actions bind provider/service IDs through DOM data attributes', () => {
  const smm = read('web/smm.js');
  assert.match(smm, /data-config-provider=/, 'provider configuration must use a data attribute');
  assert.match(smm, /data-sync-provider=/, 'provider sync must use a data attribute');
  assert.match(smm, /data-set-price=/, 'price save must use a data attribute');
  assert.match(smm, /querySelectorAll\('\[data-config-provider\]'\)/, 'provider configuration handler must be bound from the DOM');
  assert.match(smm, /querySelectorAll\('\[data-sync-provider\]'\)/, 'provider sync handler must be bound from the DOM');
  assert.match(smm, /querySelectorAll\('\[data-set-price\]'\)/, 'price save handler must be bound from the DOM');
  assert.doesNotMatch(smm, /onclick=["'](?:configProvider|syncProvider|setPrice)\(/i, 'dynamic admin IDs must not be interpolated into inline handlers');
  assert.match(smm, /input\.dataset\.priceService===String\(id\)/, 'price editor lookup must match its data ID without constructing selectors');
});


test('S09-UX-003: SMM order refresh prevents duplicate in-flight requests and restores control state', () => {
  const smm = read('web/smm.js');
  assert.match(smm, /async function syncOrder\(id,button\)/, 'refresh handler should receive its initiating button');
  assert.match(smm, /if\(button\?\.disabled\)return/, 'duplicate refresh clicks should be ignored while pending');
  assert.match(smm, /button\.textContent='جارٍ التحديث…'/, 'refresh should show a pending state');
  assert.match(smm, /finally\{if\(button\?\.isConnected\)/, 'refresh should restore the button after success or failure');
});


test('S09-UX-004: digital-page editor locks save/publish/unpublish actions while pending', () => {
  const editor = read('web/digital-page-editor.js');
  assert.match(editor, /const button=\$\('pageForm'\)\.querySelector\('\[type="submit"\]'\);if\(button\.disabled\)return/, 'save action should prevent duplicate submissions');
  assert.match(editor, /button\.textContent='جارٍ الحفظ…'/, 'save action should expose pending feedback');
  assert.match(editor, /const button=\$\('publish'\);if\(button\.disabled\)return/, 'publish action should prevent duplicate submissions');
  assert.match(editor, /button\.textContent='جارٍ النشر…'/, 'publish action should expose pending feedback');
  assert.match(editor, /finally\{button\.disabled=false;button\.textContent=original\}/, 'action buttons should be restored after success or failure');
  assert.match(editor, /تعذر إلغاء النشر/, 'unpublish errors should be handled visibly');
});


test('S09-FORM-003: digital-page section creation validates JSON and guards duplicate requests', () => {
  const editor = read('web/digital-page-editor.js');
  assert.match(editor, /const button=\$\('sectionForm'\)\.querySelector\('\[type="submit"\]'\);if\(button\.disabled\)return/, 'section creation should prevent duplicate submissions');
  assert.match(editor, /button\.textContent='جارٍ إضافة القسم…'/, 'section creation should show a pending state');
  assert.match(editor, /Array\.isArray\(data\)\|\|typeof data!=='object'/, 'section data should be a JSON object, not an array or primitive');
  assert.match(editor, /if\(count\.error\)throw count\.error/, 'count query errors must be surfaced before insert');
  assert.match(editor, /تعذر إضافة القسم/, 'section creation failures should be surfaced');
});


test('S09-UX-005: reopening a digital page loads every field used by the editor form', () => {
  const editor = read('web/digital-page-editor.js');
  assert.match(editor, /select\('id,page_type,business_id,provider_profile_id,slug,title,description,seo_title,seo_description,status,version,updated_at'\)/, 'page list projection should include all fields consumed by fill()');
  for (const field of ['description', 'seo_title', 'seo_description']) {
    assert.match(editor, new RegExp('p\\.' + field.replace(/[.*+?^$\{\}()|[\]\\]/g, '\\$&')), 'editor should preserve ' + field + ' when reopening a page');
  }
});


test('S09-FIN-001: admin credit UI validates positive amount and locks duplicate submissions', () => {
  const smm = read('web/smm.js');
  assert.match(smm, /userId= document\.getElementById\('uid'\)/i);
  assert.match(smm, /amount<=0/);
  assert.match(smm, /if\(button\.disabled\)return/);
  assert.match(smm, /button\.textContent='جارٍ إضافة الرصيد…'/);
  assert.match(smm, /finally\{button\.disabled=false;button\.textContent=original\}/);
});
