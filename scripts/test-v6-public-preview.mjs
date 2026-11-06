import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const playwrightPath = process.env.PLAYWRIGHT_PACKAGE || '/tmp/v6-preview-playwright/node_modules/playwright';
const { chromium } = require(playwrightPath);
const siteRoot = path.resolve(process.argv[2] || '');
const screenshotDir = process.env.V6_PREVIEW_SCREENSHOT_DIR ? path.resolve(process.env.V6_PREVIEW_SCREENSHOT_DIR) : null;
if (screenshotDir) fs.mkdirSync(screenshotDir, { recursive: true });
if (!fs.existsSync(path.join(siteRoot, 'index.html')) || !fs.existsSync(path.join(siteRoot, 'v6-preview', 'index.html'))) {
  throw new Error('COMPOSED_PAGES_ARTIFACT_MISSING_ROOT_OR_V6_PREVIEW');
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};
async function waitForImageReadiness(page) {
  await page.waitForFunction(
    () => Array.from(document.images).every((image) => image.complete),
    null,
    { timeout: 15000 },
  );
  await page.evaluate(async () => {
    await Promise.all(Array.from(document.images).map((image) =>
      typeof image.decode === 'function' ? image.decode().catch(() => undefined) : undefined
    ));
  });
  return page.locator('img').evaluateAll((images) => images.map((image) => ({
    alt: image.alt,
    loaded: image.naturalWidth > 0 && image.naturalHeight > 0,
    naturalWidth: image.naturalWidth,
    src: image.currentSrc || image.src,
  })));
}

async function resetScrollForScreenshot(page) {
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    document.body.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
  });
  await page.waitForFunction(() => window.scrollY === 0);
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
  const prefix = '/MantiqatiX/';
  if (!requestUrl.pathname.startsWith(prefix)) { res.writeHead(404).end(); return; }
  const relative = decodeURIComponent(requestUrl.pathname.slice(prefix.length));
  let filePath = path.resolve(siteRoot, relative || 'index.html');
  if (!filePath.startsWith(siteRoot + path.sep) && filePath !== path.join(siteRoot, 'index.html')) { res.writeHead(403).end(); return; }
  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
    const body = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});

await new Promise((resolve) => server.listen(4173, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/functions/v1/public-catalog-directory', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'apikey, content-type',
      } });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({
      accessMode: 'PUBLIC_DIRECTORY_READ_ONLY',
      businesses: (() => {
        const fixtureBusinesses = Array.from({ length: 25 }, (_, index) => {
        const number = index + 1;
        const businessId = `v6-preview-business-${number}`;
        const branchId = `v6-preview-branch-${number}`;
        const itemId = `v6-preview-item-${number}`;
        const itemNames = number === 1
          ? ['منتج تجريبي', 'منتج إضافي 2', 'منتج إضافي 3']
          : [number === 1 ? 'منتج تجريبي' : `منتج تجريبي رقم ${number}`];
        return {
          id: businessId,
          slug: `v6-preview-business-${number}`,
          name: number === 1 ? 'نشاط تجريبي للاختبار' : number === 2 ? 'نشاط اختباري فريد 2' : number === 4 ? 'صيدلية اختبار 4' : number === 25 ? 'نشاط غير موثق للاختبار' : `نشاط تجريبي رقم ${number}`,
          category: ['متاجر', 'مطاعم', 'خدمات', 'صحة'][index % 4],
          operationallyAvailable: true,
          selectedBranchId: branchId,
          provider: { kind: 'retail', verified: number !== 25, description: 'بيانات اختبار للعرض العام.' },
          profile: {
            governorate: 'القاهرة',
            markaz: 'مدينة نصر',
            village: ['الحي الأول', 'الحي الثاني', 'الحي الثالث', 'الحي الرابع'][index % 4],
            whatsappPhone: `20100123456${number}`,
            bio: number === 4 ? 'صيدلية اختبارية للتحقق من تصنيف الصيدليات.' : 'نشاط تجريبي للتحقق من صفحة النشاط.',
          },
          branches: [{ id: branchId, phone: `0100123456${number}`, address: `عنوان اختبار ${number}` }],
          items: itemNames.map((name, itemIndex) => ({
            id: `${itemId}-${itemIndex + 1}`,
            name_ar: name,
            item_type: 'PRODUCT',
            metadata: { catalog_public: { is_available: true, show_price: true } },
          })),
          prices: itemNames.map((_, itemIndex) => ({
            catalog_item_id: `${itemId}-${itemIndex + 1}`,
            branch_id: branchId,
            unit_price: 150 + number + itemIndex,
          })),
        };
        });
        // The source deliberately sends the unverified listing first. The adapter must move it after all verified activities.
        return [fixtureBusinesses[24], ...fixtureBusinesses.slice(0, 24)];
      })(),
    }) });
  });

  const previewUrl = 'http://127.0.0.1:4173/MantiqatiX/v6-preview/';
  await page.goto(previewUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'اكتشف الأنشطة والخدمات القريبة منك' }).waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: /عرض النشاط/ }).first().waitFor({ timeout: 15000 });
  const homeCover = page.getByTestId('r5-public-home-cover');
  assert.equal(await homeCover.count(), 1, 'Canonical r5 public homepage cover must be rendered');
  await homeCover.getByRole('heading', { name: 'اكتشف الأنشطة والخدمات المتاحة' }).waitFor();
  assert.equal(await homeCover.getByRole('button', { name: 'استكشف الأنشطة' }).count(), 1);
  assert.equal(await homeCover.getByRole('button', { name: 'الدليل الطبي' }).count(), 1);
  assert.equal(await homeCover.getByRole('button', { name: 'تواصل معنا' }).count(), 1);
  await homeCover.getByRole('button', { name: 'الشريحة التالية' }).click();
  await homeCover.getByRole('heading', { name: 'تصفح صفحات الأنشطة والكتالوجات' }).waitFor();
  await homeCover.getByRole('button', { name: 'الشريحة السابقة' }).click();
  await homeCover.getByRole('heading', { name: 'اكتشف الأنشطة والخدمات المتاحة' }).waitFor();
  console.log('V6_R5_PUBLIC_HOME_COVER=PASS slides=3 public_ctas=3');
  const liveCatalogStrip = page.getByTestId('live-published-catalog-strip');
  assert.equal(await liveCatalogStrip.count(), 1, 'A live published catalog strip must render when verified published products exist');
  assert.equal(await liveCatalogStrip.getByTestId('live-published-catalog-card').count(), 26, 'The strip must include only real available products from verified activities');
  assert.equal(await liveCatalogStrip.getByRole('button', { name: 'عرض النشاط' }).count(), 26, 'Each live product card must route to its owning activity');
  assert.doesNotMatch(await liveCatalogStrip.innerText(), /الأعلى طلباً|طلبات|ترتيب شعبية/, 'The public live catalog strip must not invent popularity or order metrics');
  console.log('V6_LIVE_PUBLISHED_CATALOG=PASS items=26 verified_only=true no_fake_metrics=true');
  const activityCardNodes = page.getByTestId('directory-activity-card');
  assert.equal(await activityCardNodes.count(), 20, 'Directory card test scope must exclude live published product cards');
  const activityCards = activityCardNodes.getByRole('button', { name: /عرض النشاط/ });
  assert.equal(await activityCards.count(), 20, 'Directory must initially render only the first 20 of 25 activities');
  assert.match(await page.locator('body').innerText(), /25 نتيجة مطابقة/, 'Directory must report all 25 matching activities, not only the visible page');
  const loadMore = page.getByRole('button', { name: /رؤية المزيد/ });
  assert.equal(await loadMore.count(), 1, 'A load-more control must appear when results exceed 20');
  await loadMore.click();
  assert.equal(await activityCards.count(), 25, 'Load more must reveal the remaining five activities');
  console.log('V6_PREVIEW_DIRECTORY_PAGINATION=PASS initial=20 total=25 loaded=25');
  const unverifiedDot = page.getByTestId('unverified-status-dot');
  assert.equal(await unverifiedDot.count(), 1, 'The unverified listing must display exactly one red status dot');
  const unverifiedName = page.getByText('نشاط غير موثق للاختبار', { exact: true });
  const verifiedName = page.getByText('نشاط تجريبي للاختبار', { exact: true }).first();
  const verifiedPrecedesUnverified = await verifiedName.evaluate(
    (verified, unverified) => Boolean(verified.compareDocumentPosition(unverified) & Node.DOCUMENT_POSITION_FOLLOWING),
    await unverifiedName.elementHandle(),
  );
  assert.equal(verifiedPrecedesUnverified, true, 'Verified activity must appear before the unverified listing in DOM order');
  assert.equal(
    await unverifiedDot.evaluate((node) => node.parentElement?.innerText.trim() === 'غير موثق'),
    true,
    'The red status dot must sit beside the accessible unverified text label',
  );
  console.log('V6_PREVIEW_VERIFICATION_SORT=PASS verified_first=true unverified_last=true red_dot=true');
  const verificationFilterLabels = await page.locator('button').evaluateAll((buttons) =>
    buttons.map((button) => button.innerText.trim()).filter((label) => /موثق|^الكل/.test(label))
  );
  const unverifiedFilter = page.getByRole('button', { name: 'غير موثق', exact: true });
  assert.equal(await unverifiedFilter.count(), 1, 'Public directory must expose one unverified-only filter');
  await unverifiedFilter.click();
  assert.equal(await activityCards.count(), 1, 'Unverified-only filter must return exactly the unverified test activity');
  assert.equal(await page.getByText('نشاط غير موثق للاختبار', { exact: true }).count(), 1, 'Unverified-only filter must show the unverified listing only');
  const allFilter = page.getByRole('button', { name: 'الكل', exact: true });
  assert.equal(await allFilter.count(), 1, 'Public directory must expose one all-activities filter');
  await allFilter.click();
  assert.equal(await activityCards.count(), 20, 'Clearing verification filter must reset to the first 20 of 25 activities');
  await resetScrollForScreenshot(page);
  const cardBounds = await activityCards.evaluateAll((cards) => cards.map((card) => {
    const rect = card.getBoundingClientRect();
    return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) };
  }));
  assert.ok(cardBounds.every((rect) => rect.width > 0 && rect.height > 0), 'Every desktop activity card must have visible dimensions');
  console.log(`V6_PREVIEW_MULTI_ACTIVITY_LAYOUT=${JSON.stringify(cardBounds)}`);
  const directorySearch = page.getByPlaceholder(/ابحث عن نشاط أو خدمة أو تخصص/);
  await directorySearch.fill('نشاط اختباري فريد 2');
  await page.waitForFunction(() => document.body.innerText.includes('نشاط اختباري فريد 2'));
  assert.equal(await activityCards.count(), 1, 'Directory search must reduce 25 activities to the unique matching result');
  assert.equal(await page.getByText('نشاط تجريبي للاختبار', { exact: true }).count(), 0, 'Directory search must hide non-matching activities');
  await directorySearch.fill('');
  await page.waitForFunction(() => document.body.innerText.includes('نشاط تجريبي للاختبار'));
  assert.equal(await activityCards.count(), 20, 'Clearing directory search must reset visible results to the first 20 of 25');
  assert.equal(await page.getByRole('button', { name: /رؤية المزيد/ }).count(), 1, 'Load more must return after clearing search');
  console.log('V6_PREVIEW_DIRECTORY_SEARCH=PASS');
  await page.getByRole('button', { name: /صحة\s+\d+\s+نشاط/ }).click();
  await page.getByRole('heading', { name: 'تخصصات: صحة' }).waitFor();
  await page.getByRole('button', { name: 'صيدليات ومستلزمات وخدمة 24 ساعة' }).click();
  await page.getByText('صيدلية اختبار 4', { exact: true }).waitFor();
  assert.equal(await activityCards.count(), 1, 'Selecting a specialty must filter activities within the selected activity');
  console.log('V6_PREVIEW_ACTIVITY_SPECIALTY_FILTER=PASS activity=صحة specialty=صيدليات');
  await page.getByRole('button', { name: 'عرض كل الأنشطة' }).click();
  await page.getByRole('heading', { name: 'الأنشطة المتاحة' }).waitFor();
  assert.equal(await activityCards.count(), 20, 'Resetting activity and specialty must restore the first 20 results');
  const directoryImages = await waitForImageReadiness(page);
  console.log(`V6_PREVIEW_DIRECTORY_IMAGE_AUDIT=${JSON.stringify(directoryImages)}`);
  const runtimeConfig = await page.evaluate(() => Boolean(window.MNTY_CONFIG?.supabaseUrl && window.MNTY_CONFIG?.supabaseKey));
  assert.equal(runtimeConfig, true, 'V6 must load the shared root public config.js');
  await resetScrollForScreenshot(page);
  if (screenshotDir) {
    await page.screenshot({ path: path.join(screenshotDir, 'v6-desktop-directory.png'), fullPage: true, animations: 'disabled' });
    console.log('V6_VISUAL_CAPTURE=desktop-directory');
  }

  const publicBody = await page.locator('body').innerText();
  for (const forbidden of ['المحفظة', 'سلة المشتريات', 'إتمام الطلب', 'صندوق رسائل الإدارة']) {
    assert.equal(publicBody.includes(forbidden), false, `Public shell must not expose ${forbidden}`);
  }

  await activityCards.first().click();
  const activityHeadings = page.getByRole('heading', { name: 'نشاط تجريبي للاختبار', exact: true });
  assert.ok(await activityHeadings.count() >= 1, 'Activity profile heading must be rendered');
  await activityHeadings.first().waitFor();
  await page.getByText('منتج تجريبي', { exact: true }).waitFor();
  await page.getByText('منتج إضافي 2', { exact: true }).waitFor();
  await page.getByText('منتج إضافي 3', { exact: true }).waitFor();
  console.log('V6_PREVIEW_MULTI_PRODUCT_CATALOG=PASS products=3');
  const profileImages = await waitForImageReadiness(page);
  console.log(`V6_PREVIEW_PROFILE_IMAGE_AUDIT=${JSON.stringify(profileImages)}`);
  const profileBody = await page.locator('body').innerText();
  assert.equal(profileBody.includes('إضافة للسلة'), false);
  assert.equal(profileBody.includes('إتمام الطلب'), false);
  await resetScrollForScreenshot(page);
  if (screenshotDir) {
    await page.screenshot({ path: path.join(screenshotDir, 'v6-desktop-activity-profile.png'), fullPage: true, animations: 'disabled' });
    console.log('V6_VISUAL_CAPTURE=desktop-activity-profile');
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileProfileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert.equal(mobileProfileOverflow, false, 'Mobile activity profile must not overflow horizontally');
  for (const productName of ['منتج تجريبي', 'منتج إضافي 2', 'منتج إضافي 3']) {
    await page.getByText(productName, { exact: true }).waitFor();
  }
  console.log('V6_PREVIEW_MOBILE_ACTIVITY_PROFILE=PASS products=3');
  await resetScrollForScreenshot(page);
  if (screenshotDir) {
    await page.screenshot({ path: path.join(screenshotDir, 'v6-mobile-activity-profile.png'), fullPage: true, animations: 'disabled' });
    console.log('V6_VISUAL_CAPTURE=mobile-activity-profile');
  }

  await page.getByRole('button', { name: 'الدليل الطبي' }).click();
  await page.getByRole('heading', { name: 'الأطباء والعيادات والصيدليات' }).waitFor();
  await page.getByRole('button', { name: 'تواصل معنا' }).click();
  await page.getByText('تأكيد إرسال الرسالة').waitFor();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'دليل الأنشطة' }).click();
  await page.getByRole('heading', { name: 'اكتشف الأنشطة والخدمات القريبة منك' }).waitFor();
  assert.equal(await activityCards.count(), 20, 'Mobile directory must initially render 20 activities');
  assert.equal(await page.getByRole('button', { name: /رؤية المزيد/ }).count(), 1, 'Mobile directory must expose load more for remaining activities');
  const mobileImages = await waitForImageReadiness(page);
  console.log(`V6_PREVIEW_MOBILE_IMAGE_AUDIT=${JSON.stringify(mobileImages)}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert.equal(overflow, false, 'Mobile Preview must not overflow horizontally');
  await page.getByRole('button', { name: /رؤية المزيد/ }).click();
  assert.equal(await activityCards.count(), 25, 'Mobile load more must reveal all 25 activities without overflow');
  const mobileOverflowAfterLoadMore = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert.equal(mobileOverflowAfterLoadMore, false, 'Mobile directory must not overflow after loading more activities');
  console.log('V6_PREVIEW_MOBILE_PAGINATION=PASS initial=20 total=25');
  await resetScrollForScreenshot(page);
  if (screenshotDir) {
    await page.screenshot({ path: path.join(screenshotDir, 'v6-mobile-directory.png'), fullPage: true, animations: 'disabled' });
    console.log('V6_VISUAL_CAPTURE=mobile-directory');
  }

  const axePath = '/tmp/v6-preview-playwright/node_modules/axe-core/axe.min.js';
  if (fs.existsSync(axePath)) {
    await page.addScriptTag({ path: axePath });
    const axe = await page.evaluate(async () => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
    const critical = axe.violations.filter((item) => item.impact === 'critical');
    if (critical.length) {
      const details = critical.flatMap((item) => item.nodes.map((node) => ({
        rule: item.id,
        impact: item.impact,
        target: node.target,
        html: node.html,
        summary: node.failureSummary,
      })));
      throw new Error(`V6_PREVIEW_A11Y_CRITICAL=${JSON.stringify(details)}`);
    }
    const nonCritical = axe.violations.filter((item) => item.impact !== 'critical');
    if (nonCritical.length) {
      const details = nonCritical.flatMap((item) => item.nodes.map((node) => ({
        rule: item.id,
        impact: item.impact,
        target: node.target,
        html: node.html,
        summary: node.failureSummary,
      })));
      console.log(`V6_PREVIEW_A11Y_NONCRITICAL=${JSON.stringify(details)}`);
    }
    console.log(`V6_PREVIEW_A11Y: ${nonCritical.length} non-critical violation group(s); critical=0`);
  }
  assert.deepEqual(errors, [], `Browser runtime errors: ${errors.join('; ')}`);
  console.log('V6_PUBLIC_PREVIEW_BROWSER_E2E=PASS');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}