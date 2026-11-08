import assert from 'node:assert/strict';

const playwrightSpecifier = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = await import(playwrightSpecifier);
const rootUrl = process.env.PAGE_URL || 'https://islamnagy2022-eng.github.io/MantiqatiX/';
const root = new URL(rootUrl);
assert.equal(root.pathname, '/MantiqatiX/', 'the new V6 production app must be deployed at the Pages root');

const businessId = 'v6-root-qr-business';
const businessSlug = 'v6-root-qr-business';
const branchId = 'v6-root-qr-branch';
const productId = 'v6-root-qr-product';

const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.route('**/functions/v1/public-catalog-directory', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'apikey, content-type',
        },
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        accessMode: 'PUBLIC_DIRECTORY_READ_ONLY',
        businesses: [{
          id: businessId,
          slug: businessSlug,
          name: 'نشاط اختبار رابط QR',
          category: 'خدمات',
          status: 'ACTIVE',
          operationallyAvailable: true,
          selectedBranchId: branchId,
          provider: { kind: 'services', verified: true, description: 'اختبار واجهة عامة.' },
          profile: {
            governorate: 'المنوفية',
            markaz: 'بركة السبع',
            village: 'قرية الاختبار',
            whatsappPhone: '201001234567',
            phone: '01001234567',
            bio: 'ملف اختبار التوافق مع روابط QR القديمة.',
          },
          branches: [{ id: branchId, phone: '01001234567', address: 'عنوان اختبار' }],
          items: [{
            id: productId,
            name_ar: 'منتج اختبار الرابط',
            item_type: 'PRODUCT',
            metadata: {
              catalog_public: {
                is_available: true,
                show_price: true,
                category: 'عام',
              },
            },
          }],
          prices: [{
            catalog_item_id: productId,
            branch_id: branchId,
            unit_price: 125,
            currency: 'EGP',
          }],
        }],
      }),
    });
  });

  await page.route('**/rest/v1/rpc/get_mnty_targeted_advertisements', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'apikey, authorization, content-type',
        },
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: '[]',
    });
  });

  await page.goto(rootUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'اكتشف الأنشطة والخدمات القريبة منك' }).waitFor({ timeout: 15000 });
  assert.equal(new URL(page.url()).pathname, '/MantiqatiX/', 'home navigation must stay at the production root');
  console.log('V6_PRODUCTION_ROOT=PASS');

  const legacyQrUrl = new URL(rootUrl);
  legacyQrUrl.searchParams.set('businessId', businessId);
  await page.goto(legacyQrUrl.toString(), { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'نشاط اختبار رابط QR', exact: true }).waitFor({ timeout: 15000 });
  await page.getByRole('heading', { name: /قائمة عروض وكتالوج/ }).waitFor({ timeout: 15000 });
  assert.equal(new URL(page.url()).searchParams.get('businessId'), businessId);
  console.log('V6_LEGACY_BUSINESS_ID_QR=PASS');

  const canonicalStoreUrl = new URL(rootUrl);
  canonicalStoreUrl.searchParams.set('store', businessSlug);
  await page.goto(canonicalStoreUrl.toString(), { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'نشاط اختبار رابط QR', exact: true }).waitFor({ timeout: 15000 });
  assert.equal(new URL(page.url()).searchParams.get('store'), businessSlug);
  console.log('V6_CANONICAL_STORE_LINK=PASS');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(rootUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'اكتشف الأنشطة والخدمات القريبة منك' }).waitFor({ timeout: 15000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert.equal(overflow, false, 'V6 production root must not overflow at 390px');
  const mobilePrimaryNavigation = page.getByRole('navigation', { name: 'التنقل الرئيسي' });
  assert.equal(await mobilePrimaryNavigation.getByRole('button', { name: 'الدليل الطبي' }).count(), 1, 'Mobile primary navigation must expose one medical-directory destination');
  console.log('V6_PRODUCTION_ROOT_MOBILE=PASS width=390 no_horizontal_overflow=true');

  assert.deepEqual(errors, [], 'V6 production root browser errors: ' + errors.join('; '));
  console.log('V6_DEPLOYED_ROOT_BROWSER_E2E=PASS');
} finally {
  await browser.close();
}
