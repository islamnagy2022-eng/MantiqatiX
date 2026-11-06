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
      businesses: [{
        id: 'v6-preview-business-1', slug: 'v6-preview-business', name: 'نشاط تجريبي للاختبار', category: 'متاجر',
        operationallyAvailable: true, selectedBranchId: 'v6-preview-branch-1',
        provider: { kind: 'retail', verified: true, description: 'بيانات اختبار للعرض العام.' },
        profile: { governorate: 'القاهرة', markaz: 'مدينة نصر', village: 'الحي الأول', whatsappPhone: '201001234567', bio: 'نشاط تجريبي للتحقق من صفحة النشاط.' },
        branches: [{ id: 'v6-preview-branch-1', phone: '01001234567', address: 'عنوان اختبار' }],
        items: [{ id: 'v6-preview-item-1', name_ar: 'منتج تجريبي', item_type: 'PRODUCT', metadata: { catalog_public: { is_available: true, show_price: true } } }],
        prices: [{ catalog_item_id: 'v6-preview-item-1', branch_id: 'v6-preview-branch-1', unit_price: 150 }],
      }],
    }) });
  });

  const previewUrl = 'http://127.0.0.1:4173/MantiqatiX/v6-preview/';
  await page.goto(previewUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'اكتشف الأنشطة والخدمات القريبة منك' }).waitFor({ timeout: 15000 });
  await page.getByText('نشاط تجريبي للاختبار', { exact: true }).waitFor({ timeout: 15000 });
  const runtimeConfig = await page.evaluate(() => Boolean(window.MNTY_CONFIG?.supabaseUrl && window.MNTY_CONFIG?.supabaseKey));
  assert.equal(runtimeConfig, true, 'V6 must load the shared root public config.js');
  if (screenshotDir) {
    await page.screenshot({ path: path.join(screenshotDir, 'v6-desktop-directory.png'), fullPage: true, animations: 'disabled' });
    console.log('V6_VISUAL_CAPTURE=desktop-directory');
  }

  const publicBody = await page.locator('body').innerText();
  for (const forbidden of ['المحفظة', 'سلة المشتريات', 'إتمام الطلب', 'صندوق رسائل الإدارة']) {
    assert.equal(publicBody.includes(forbidden), false, `Public shell must not expose ${forbidden}`);
  }

  await page.getByRole('button', { name: /عرض النشاط/ }).click();
  const activityHeadings = page.getByRole('heading', { name: 'نشاط تجريبي للاختبار', exact: true });
  assert.ok(await activityHeadings.count() >= 1, 'Activity profile heading must be rendered');
  await activityHeadings.first().waitFor();
  await page.getByText('منتج تجريبي', { exact: true }).waitFor();
  const profileBody = await page.locator('body').innerText();
  assert.equal(profileBody.includes('إضافة للسلة'), false);
  assert.equal(profileBody.includes('إتمام الطلب'), false);
  if (screenshotDir) {
    await page.screenshot({ path: path.join(screenshotDir, 'v6-desktop-activity-profile.png'), fullPage: true, animations: 'disabled' });
    console.log('V6_VISUAL_CAPTURE=desktop-activity-profile');
  }

  await page.getByRole('button', { name: 'الدليل الطبي' }).click();
  await page.getByRole('heading', { name: 'الأطباء والعيادات والصيدليات' }).waitFor();
  await page.getByRole('button', { name: 'تواصل معنا' }).click();
  await page.getByText('تأكيد إرسال الرسالة').waitFor();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'دليل الأنشطة' }).click();
  await page.getByRole('heading', { name: 'اكتشف الأنشطة والخدمات القريبة منك' }).waitFor();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert.equal(overflow, false, 'Mobile Preview must not overflow horizontally');
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