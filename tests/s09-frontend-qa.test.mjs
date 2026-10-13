import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(root, 'web');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

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
  const files = fs.readdirSync(web).filter((name) => /\.(?:js|html|json)$/i.test(name));
  const patterns = [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /SUPABASE_SERVICE_ROLE_KEY/i, /service_role\s*[:=]\s*["'][^"']{12,}/i, /\bsk_live_[A-Za-z0-9]{12,}\b/, /\bgh[pousr]_[A-Za-z0-9]{30,}\b/];
  const findings = [];
  for (const name of files) {
    const content = fs.readFileSync(path.join(web, name), 'utf8');
    for (const pattern of patterns) if (pattern.test(content)) findings.push(name + ': matched ' + pattern);
  }
  assert.deepEqual(findings, [], findings.join('\n'));
});

test('S09-CONFIG-001: browser config excludes server-role key markers', () => {
  const config = read('web/config.js');
  assert.doesNotMatch(config, /SUPABASE_SERVICE_ROLE_KEY|-----BEGIN .*PRIVATE KEY-----/i);
  assert.match(config, /SUPABASE_URL|supabaseUrl|createClient/i, 'configuration contract not recognized; review manually');
});
