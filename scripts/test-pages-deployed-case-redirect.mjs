import assert from 'node:assert/strict';

const pageUrl = process.env.PAGE_URL || process.argv[2];
const playwrightModule = process.env.PLAYWRIGHT_MODULE;
assert.ok(pageUrl, 'PAGE_URL or the first argument must contain the deployed Pages URL');
assert.ok(playwrightModule, 'PLAYWRIGHT_MODULE must point to the installed Playwright entry point');

const { chromium } = await import(playwrightModule);
const canonical = new URL(pageUrl);
if (!canonical.pathname.endsWith('/')) canonical.pathname += '/';
const basePath = canonical.pathname;
const query = new URLSearchParams({
  activity: 'cat_medical_health_medical_practices',
  specialty: 'باطنة',
  store: 'case-redirect',
}).toString();
const hash = '#specialty';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(45000);

  async function verifyRedirect(label, inputUrl) {
    await page.goto(inputUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(
      (url) => url.pathname === basePath && url.search === '?' + query && url.hash === hash,
      { timeout: 20000 },
    );
    const finalUrl = new URL(page.url());
    assert.equal(finalUrl.pathname, basePath, label + ': canonical Pages base path must be restored');
    assert.equal(finalUrl.search, '?' + query, label + ': activity/store query parameters must survive');
    assert.equal(finalUrl.hash, hash, label + ': hash must survive');
    console.log('PASS ' + label + ' -> ' + finalUrl.pathname + finalUrl.search + finalUrl.hash);
  }

  // GitHub Pages serves the repository base path case-sensitively before our 404.html can run.
  // Keep base-path casing canonical and test case normalization only within that served scope.
  const mixedCaseNested = new URL(canonical);
  mixedCaseNested.pathname = basePath + 'UnKnOwN/AcTiViTy/';
  mixedCaseNested.search = query;
  mixedCaseNested.hash = hash;
  await verifyRedirect('mixed-case-nested-path-fallback', mixedCaseNested.href);

  const unknownNested = new URL(canonical);
  unknownNested.pathname = basePath + 'Unknown/Activity/';
  unknownNested.search = query;
  unknownNested.hash = hash;
  await verifyRedirect('unknown-nested-path-fallback', unknownNested.href);

  await page.goto(canonical.href, { waitUntil: 'domcontentloaded' });
  assert.equal(page.url(), canonical.href, 'canonical root must load without a redirect loop');
  console.log('PASS canonical-root-no-redirect-loop');
  console.log('PAGES_DEPLOYED_CASE_REDIRECT=PASS checks=3');
} finally {
  await browser.close();
}
