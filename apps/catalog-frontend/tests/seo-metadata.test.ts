import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveRouteSeoMetadata } from '../src/utils/seoMetadata';

const base = {
  origin: 'https://islamnagy2022-eng.github.io',
  basePath: '/MantiqatiX/',
  allowIndexing: true,
};

test('private dashboards and account routes are never indexable', () => {
  for (const view of ['merchant_admin', 'super_admin', 'professional_dashboard', 'account_portal', 'login'] as const) {
    const result = resolveRouteSeoMetadata({ ...base, view });
    assert.equal(result.robots, 'noindex,nofollow');
    assert.equal(result.canonicalUrl, null);
  }
});

test('public root routes use the canonical project URL', () => {
  const result = resolveRouteSeoMetadata({ ...base, view: 'directory' });
  assert.equal(result.robots, 'index,follow');
  assert.equal(result.canonicalUrl, 'https://islamnagy2022-eng.github.io/MantiqatiX/');
});

test('verified public business gets a stable canonical storefront URL', () => {
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
    },
  });
  assert.equal(result.robots, 'index,follow');
  assert.equal(result.canonicalUrl, 'https://islamnagy2022-eng.github.io/MantiqatiX/?store=business-123');
  assert.match(result.title, /نشاط موثق/);
});

test('unverified, frozen, or non-published business profiles stay noindex', () => {
  for (const business of [
    { id: 'b1', name: 'نشاط', isVerified: false },
    { id: 'b2', name: 'نشاط', isVerified: true, isFrozen: true },
    { id: 'b3', name: 'نشاط', isVerified: true, publicationStatus: 'DRAFT' },
    { id: 'b4', name: 'نشاط', isVerified: true, publicEnabled: false },
  ]) {
    const result = resolveRouteSeoMetadata({ ...base, view: 'public_storefront', business });
    assert.equal(result.robots, 'noindex,nofollow');
    assert.equal(result.canonicalUrl, null);
  }
});

test('activity and specialty routes receive distinct stable metadata', () => {
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
  assert.match(result.title, /الأنشطة الطبية/);
});

test('preview and non-canonical builds remain noindex', () => {
  const result = resolveRouteSeoMetadata({ ...base, allowIndexing: false, view: 'directory' });
  assert.equal(result.robots, 'noindex,nofollow');
  assert.equal(result.canonicalUrl, null);
});

test('descriptions are sanitized and bounded', () => {
  const result = resolveRouteSeoMetadata({
    ...base,
    view: 'public_storefront',
    business: { id: 'b5', name: 'نشاط', bio: '<b>خدمة</b> '.repeat(40), isVerified: true },
  });
  assert.ok(result.description.length <= 160);
  assert.ok(!result.description.includes('<b>'));
});

test('SEO metadata is recomputed when public visibility or operational state changes', () => {
  const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(appSource, /currentBusiness\?\.publicEnabled/);
  assert.match(appSource, /currentBusiness\?\.catalogPublished/);
  assert.match(appSource, /currentBusiness\?\.operationalStatus/);
});
