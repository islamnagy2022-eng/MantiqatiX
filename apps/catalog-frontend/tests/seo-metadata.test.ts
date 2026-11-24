import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveRouteSeoMetadata } from '../src/utils/seoMetadata';

const base = {
  origin: 'https://islamnagy2022-eng.github.io',
  basePath: '/MantiqatiX/',
  allowIndexing: true,
};

test('private account and dashboard routes remain noindex', () => {
  for (const view of ['merchant_admin', 'super_admin', 'professional_dashboard', 'account_portal', 'login'] as const) {
    const result = resolveRouteSeoMetadata({ ...base, view });
    assert.equal(result.robots, 'noindex,nofollow');
    assert.equal(result.canonicalUrl, null);
  }
});

test('public root uses the canonical project URL', () => {
  const result = resolveRouteSeoMetadata({ ...base, view: 'directory' });
  assert.equal(result.robots, 'index,follow');
  assert.equal(result.canonicalUrl, 'https://islamnagy2022-eng.github.io/MantiqatiX/');
});

test('public contact and site-map views have distinct canonical routes', () => {
  const contact = resolveRouteSeoMetadata({ ...base, view: 'contact_us' });
  const siteMap = resolveRouteSeoMetadata({ ...base, view: 'site_map' });
  assert.equal(contact.canonicalUrl, 'https://islamnagy2022-eng.github.io/MantiqatiX/?view=contact_us');
  assert.equal(siteMap.canonicalUrl, 'https://islamnagy2022-eng.github.io/MantiqatiX/?view=site_map');
});

test('verified and explicitly public storefront gets a stable canonical URL', () => {
  const result = resolveRouteSeoMetadata({
    ...base,
    view: 'public_storefront',
    business: {
      id: 'business-123',
      name: 'نشاط موثق',
      bio: 'خدمات موثوقة',
      category: 'خدمات',
      governorate: 'الغربية',
      markaz: 'طنطا',
      isVerified: true,
      publicEnabled: true,
      operationalStatus: 'ACTIVE',
      publicationStatus: 'PUBLISHED',
    },
  });
  assert.equal(result.robots, 'index,follow');
  assert.equal(result.canonicalUrl, 'https://islamnagy2022-eng.github.io/MantiqatiX/?store=business-123');
  assert.match(result.title, /نشاط موثق/);
});

test('verified official platform showcase may be indexed without a commercial catalogue', () => {
  const result = resolveRouteSeoMetadata({
    ...base,
    view: 'public_storefront',
    business: { id: 'official-1', name: 'MantiqatiX', isVerified: true, isOfficialShowcase: true },
  });
  assert.equal(result.robots, 'index,follow');
  assert.equal(result.canonicalUrl, 'https://islamnagy2022-eng.github.io/MantiqatiX/?store=official-1');
});

test('unverified, unpublished, frozen, inactive and private storefronts remain noindex', () => {
  const invalidBusinesses = [
    { id: 'b1', name: 'نشاط', isVerified: false, publicEnabled: true },
    { id: 'b2', name: 'نشاط', isVerified: true, publicEnabled: true, isFrozen: true },
    { id: 'b3', name: 'نشاط', isVerified: true, publicEnabled: true, publicationStatus: 'DRAFT' },
    { id: 'b4', name: 'نشاط', isVerified: true, publicEnabled: false, catalogPublished: false },
    { id: 'b5', name: 'نشاط', isVerified: true, publicEnabled: true, operationalStatus: 'PAUSED' },
  ];
  for (const business of invalidBusinesses) {
    const result = resolveRouteSeoMetadata({ ...base, view: 'public_storefront', business });
    assert.equal(result.robots, 'noindex,nofollow');
    assert.equal(result.canonicalUrl, null);
  }
});

test('directory activity and specialty routes use stable canonical query URLs', () => {
  const result = resolveRouteSeoMetadata({
    ...base,
    view: 'directory',
    activityId: 'medical-health',
    activityName: 'الأنشطة الطبية',
    specialtyName: 'طب الأطفال',
  });
  assert.equal(result.robots, 'index,follow');
  assert.equal(result.canonicalUrl, 'https://islamnagy2022-eng.github.io/MantiqatiX/?activity=medical-health&specialty=%D8%B7%D8%A8+%D8%A7%D9%84%D8%A3%D8%B7%D9%81%D8%A7%D9%84');
  assert.match(result.title, /طب الأطفال/);
});

test('preview and legacy base paths are not indexable when canonical production path is false', () => {
  const result = resolveRouteSeoMetadata({ ...base, allowIndexing: false, view: 'directory' });
  assert.equal(result.robots, 'noindex,nofollow');
  assert.equal(result.canonicalUrl, null);
});

test('descriptions are sanitized and bounded', () => {
  const result = resolveRouteSeoMetadata({
    ...base,
    view: 'public_storefront',
    business: { id: 'b6', name: 'نشاط', bio: '<b>خدمة</b> '.repeat(40), isVerified: true, publicEnabled: true },
  });
  assert.ok(result.description.length <= 160);
  assert.ok(!result.description.includes('<b>'));
});

test('SEO hook is restricted to the canonical root base path and no AI support action is enabled', () => {
  const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(appSource, /VITE_CANONICAL_BASE_PATH/);
  assert.match(appSource, /window\.location\.pathname === canonicalBasePath/);
  assert.doesNotMatch(appSource, /SupportAssistant|technical_support/);
});
