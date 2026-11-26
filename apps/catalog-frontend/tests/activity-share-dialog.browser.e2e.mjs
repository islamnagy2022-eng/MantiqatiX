import assert from 'node:assert/strict';

const playwrightSpecifier = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = await import(playwrightSpecifier);
const baseUrl = process.env.MANTIQUATIX_E2E_BASE_URL || 'http://127.0.0.1:4173/MantiqatiX/';

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    localStorage.setItem('mantiqatix.geo-discovery.v1', JSON.stringify({
      completed: true,
      mode: 'manual',
      governorate: 'all',
      markaz: 'all',
      village: 'all',
      area: 'all',
    }));
  });

  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  const shareButton = page.locator('button[aria-label^="مشاركة نشاط "').first();
  await shareButton.waitFor({ state: 'visible', timeout: 30000 });

  const shareLabel = await shareButton.getAttribute('aria-label');
  assert.ok(shareLabel, 'activity share button must have an accessible name');
  const activityName = shareLabel
    .replace(/^مشاركة نشاط /, '')
    .replace(/ وإنشاء رمز QR$/, '');
  await shareButton.click();

  const dialog = page.getByRole('dialog', { name: activityName });
  await dialog.waitFor({ state: 'visible' });
  assert.equal(
    await page.evaluate(() => document.activeElement?.getAttribute('aria-label')),
    'إغلاق نافذة مشاركة النشاط',
    'opening the dialog must move focus to its close button',
  );

  const activityLink = dialog.locator('a[href]').first();
  const activityUrl = new URL(await activityLink.getAttribute('href'));
  const activityId = activityUrl.searchParams.get('activity');
  assert.ok(activityId, 'share URL must contain the selected activity identifier');
  assert.equal(activityUrl.origin, new URL(baseUrl).origin, 'share URL must stay on the current site origin');

  await page.keyboard.press('Shift+Tab');
  assert.equal(
    await page.evaluate(() => document.activeElement?.tagName),
    'A',
    'Shift+Tab from the first control must wrap to the final link inside the dialog',
  );
  await page.keyboard.press('Tab');
  assert.equal(
    await page.evaluate(() => document.activeElement?.getAttribute('aria-label')),
    'إغلاق نافذة مشاركة النشاط',
    'Tab from the final control must wrap to the first control inside the dialog',
  );

  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  assert.equal(
    await shareButton.evaluate((button) => button === document.activeElement),
    true,
    'closing the dialog must restore focus to the invoking share button',
  );

  await page.goto(activityUrl.toString(), { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: activityName, exact: true }).waitFor({ state: 'visible', timeout: 30000 });
  assert.equal(new URL(page.url()).searchParams.get('activity'), activityId);
  console.log('ACTIVITY_SHARE_DIALOG_BROWSER_E2E=PASS focus_trap=true focus_restore=true direct_link=true');
  await context.close();
} finally {
  await browser.close();
}
