import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('web/digital-page.js', 'utf8');

async function render({ search = '', page = null, sections = [] } = {}) {
  const root = { innerHTML: '' };
  const meta = { content: '' };
  let pageLookups = 0;
  let sectionLookups = 0;
  const client = {
    from(table) {
      const query = {
        select() { return this; },
        eq() { return this; },
        maybeSingle: async () => {
          pageLookups += 1;
          return { data: page, error: null };
        },
        order() { return this; },
        then(resolve, reject) {
          sectionLookups += 1;
          return Promise.resolve({ data: sections, error: null }).then(resolve, reject);
        },
      };
      if (table === 'digital_page_sections') {
        query.maybeSingle = undefined;
      }
      return query;
    },
  };
  const document = {
    title: '',
    getElementById: () => root,
    querySelector: () => meta,
  };
  const context = {
    window: { MANTIQATIX_CONFIG: { supabaseUrl: 'https://example.invalid', supabaseKey: 'public-test-key' } },
    supabase: { createClient: () => client },
    document,
    location: { search },
    URLSearchParams,
  };
  vm.runInNewContext(source, context, { filename: 'digital-page.js' });
  await new Promise(resolve => setImmediate(resolve));
  return { html: root.innerHTML, title: document.title, meta: meta.content, pageLookups, sectionLookups };
}

const incomplete = await render();
assert.match(incomplete.html, /رابط الصفحة غير مكتمل/);
assert.equal(incomplete.pageLookups, 0, 'missing slug must not query page data');

const unpublished = await render({ search: '?slug=missing', page: null });
assert.match(unpublished.html, /الصفحة غير منشورة أو غير موجودة/);
assert.equal(unpublished.sectionLookups, 0, 'unpublished/missing page must not load sections');

const published = await render({
  search: '?slug=demo',
  page: {
    id: 'page-test',
    page_type: 'MENU',
    slug: 'demo',
    title: 'Cafe <script>alert(1)</script>',
    subtitle: 'Menu',
    description: 'Test description',
    seo_title: 'Demo menu',
    seo_description: 'Safe description',
    version: 1,
    status: 'PUBLISHED',
  },
  sections: [{
    id: 'section-test',
    section_type: 'MENU',
    sort_order: 1,
    title: 'Drinks',
    active: true,
    data: { items: [{ name: 'Tea <img src=x>', description: 'Hot drink', price: '30', currency: 'EGP' }] },
  }],
});
assert.equal(published.title, 'Demo menu');
assert.equal(published.meta, 'Safe description');
assert.match(published.html, /Drinks/);
assert.match(published.html, /30/);
assert.match(published.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
assert.match(published.html, /Tea &lt;img src=x&gt;/);
assert.ok(!published.html.includes('<script>alert(1)</script>'), 'page content must be HTML-escaped');
assert.equal(published.sectionLookups, 1);

console.log('Digital page runtime tests: PASS (missing slug, unpublished page, published MENU render, HTML escaping).');
