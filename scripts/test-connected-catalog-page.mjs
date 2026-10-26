import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync('web/demo/activity.html', 'utf8');
const source = fs.readFileSync('web/demo/activity.js', 'utf8');
const id = '22222222-2222-4222-8222-222222222222';
const dom = new JSDOM(html, { url: 'https://islamnagy2022-eng.github.io/MantiqatiX/demo/activity.html?business=' + id, runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
let invoked = null;
window.MANTIQATIX_DEMO_CONFIG = { supabaseUrl: 'https://lkijdgqanbqjudiducjt.supabase.co', supabaseKey: 'sb_publishable_demo_test_key', tenantId: 'MNTY-PLATFORM', organizationId: 'MNTY-MAIN', environment: 'DEMO', paymentsEnabled: false };
window.supabase = {
  createClient(url, key, options) {
    assert.match(url, /lkijdgqanbqjudiducjt/);
    assert.equal(options.auth.persistSession, false, 'public catalog should not persist a user session');
    return { functions: { async invoke(name, args) {
      invoked = { name, args };
      return { data: { ok: true, environment: 'DEMO', paymentsEnabled: false,
        business: { id, name: 'متجر الاختبار', sectorCode: 'STORE', description: 'وصف النشاط التجريبي', phone: '01000000000', city: 'القاهرة' },
        branch: { id: '33333333-3333-4333-8333-333333333333', name: 'الفرع الرئيسي', phone: '', address: 'وسط البلد' },
        items: [
          { id: '44444444-4444-4444-8444-444444444444', name: 'منتج آمن', description: '<script>alert(1)</script>', itemType: 'PRODUCT', stock: 5, price: 39.5, currency: 'EGP' },
          { id: '55555555-5555-4555-8555-555555555555', name: 'خدمة ثانية', description: 'وصف مختصر', itemType: 'SERVICE', stock: 0, price: null, currency: 'EGP' }
        ] }, error: null };
    } } };
  }
};
window.eval(source);
await new Promise(resolve => window.setTimeout(resolve, 30));
const app = window.document.querySelector('#activity-app');
assert.equal(invoked.name, 'demo-public-catalog');
assert.equal(invoked.args.body.businessId, id);
assert.match(app.textContent, /متجر الاختبار/);
assert.match(app.textContent, /القاهرة/);
assert.match(app.textContent, /01000000000/);
assert.match(app.textContent, /المنتجات والخدمات/);
assert.match(app.textContent, /ج\.م/);
assert.equal(app.querySelectorAll('.activity-product').length, 2);
assert.match(app.textContent, /إدارة الكتالوج/);
assert.ok(!app.querySelector('script'), 'untrusted item descriptions cannot inject script elements');
assert.match(app.innerHTML, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/, 'catalog descriptions are HTML-escaped');
const bad = new JSDOM(html, { url: 'https://example.test/demo/activity.html', runScripts: 'outside-only' });
bad.window.MANTIQATIX_DEMO_CONFIG = window.MANTIQATIX_DEMO_CONFIG;
bad.window.supabase = window.supabase;
bad.window.eval(source);
await new Promise(resolve => bad.window.setTimeout(resolve, 20));
assert.match(bad.window.document.querySelector('#activity-app').textContent, /رابط الكتالوج غير مكتمل/);
bad.window.close();
window.close();
console.log('Connected activity catalog tests PASS: public profile, product prices, manager link, escaping, and invalid-link rejection.');
