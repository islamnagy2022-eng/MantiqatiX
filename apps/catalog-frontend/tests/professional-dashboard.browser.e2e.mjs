import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const playwrightSpecifier = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = await import(playwrightSpecifier);
const baseUrl = process.env.MANTIQUATIX_E2E_BASE_URL || 'http://127.0.0.1:4173/MantiqatiX/';
const config = readFileSync(new URL('../public/config.js', import.meta.url), 'utf8');
const supabaseUrl = config.match(/supabaseUrl:\s*'([^']+)'/)?.[1];
assert.ok(supabaseUrl, 'public config must expose the configured Supabase URL');
const supabaseOrigin = new URL(supabaseUrl).origin;
const storageKey = 'mantiqatix.production.auth';
const tenantId = 'tenant-e2e';
const businessId = '10000000-0000-0000-0000-000000000001';
const branchId = 'branch-e2e';
const employeePositionId = '20000000-0000-0000-0000-000000000001';
const targetEmployeeId = '30000000-0000-0000-0000-000000000001';

const roles = {
  businessOwner: {
    id: '00000000-0000-0000-0000-000000000012',
    email: 'e2e-business-owner@example.test',
    role: 'OWNER',
    businessId,
    permissions: {},
  },
  owner: {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'e2e-owner@example.test',
    role: 'OWNER',
    businessId: null,
    permissions: {},
    extraMemberships: [{
      id: 'membership-employee-business-row',
      role: 'EMPLOYEE',
      businessId,
      branchId,
      permissions: { modules: { CATALOG: ['view'] } },
      created_at: '2026-02-02T00:00:00.000Z',
    }],
  },
  employeeCatalogViewer: {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'e2e-catalog-viewer@example.test',
    role: 'EMPLOYEE',
    permissions: { modules: { CATALOG: ['view'] } },
  },
  employeeRosterViewer: {
    id: '00000000-0000-0000-0000-000000000003',
    email: 'e2e-roster-viewer@example.test',
    role: 'EMPLOYEE',
    permissions: { modules: { EMPLOYEES: ['view'] } },
  },
  branchOwner: {
    id: '00000000-0000-0000-0000-000000000008',
    email: 'e2e-branch-owner@example.test',
    role: 'OWNER',
    businessId,
    branchId,
    permissions: {},
  },
  unsupportedManager: {
    id: '00000000-0000-0000-0000-000000000004',
    email: 'e2e-manager@example.test',
    role: 'MANAGER',
    permissions: { modules: { CATALOG: ['view'], EMPLOYEES: ['manage'] } },
  },
  platformAdmin: {
    id: '00000000-0000-0000-0000-000000000099',
    email: 'e2e-platform-admin@example.test',
    role: 'SUPER_ADMIN',
    businessId: null,
    permissions: { scope: 'PLATFORM', full_control: true },
  },
};

const fakeBusiness = {
  id: businessId,
  tenantId,
  organizationId: 'org-e2e',
  name: 'نشاط اختبار الداشبورد',
  category: 'أنشطة تجارية',
  status: 'ACTIVE',
  operationalStatus: 'ACTIVE',
  publicEnabled: false,
  createdAt: '2026-01-15T12:00:00.000Z',
  branches: [{ id: branchId, tenantId, businessId, name: 'الفرع الرئيسي' }],
};

function makeSession(scenario) {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: 'e2e-access-token-not-a-real-credential',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: 'e2e-refresh-token-not-a-real-credential',
    user: {
      id: scenario.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: scenario.email,
      email_confirmed_at: '2026-01-01T00:00:00.000Z',
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: { full_name: 'Dashboard E2E' },
      created_at: '2026-01-01T00:00:00.000Z',
      identities: [],
    },
  };
}

async function newScenario(browser, scenario = null, publicDirectoryBusinesses = []) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const session = scenario ? makeSession(scenario) : null;
  await context.addInitScript(({ key, value }) => {
    localStorage.removeItem(key);
    if (value) localStorage.setItem(key, value);
  }, { key: storageKey, value: session ? JSON.stringify(session) : null });

  const rpcObservation = { scopedBranchId: undefined };
  const catalogReadRequests = [];
  const taxonomyMappingCalls = [];
  const page = await context.newPage();
  await page.route(supabaseOrigin + '/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const corsHeaders = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': 'authorization,apikey,content-type,x-client-info,prefer,accept-profile,content-profile,range',
      'access-control-max-age': '86400',
    };
    const json = (body, status = 200) => route.fulfill({
      status,
      headers: corsHeaders,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });

    if (request.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: corsHeaders, body: '' });
    }
    if (url.pathname.endsWith('/auth/v1/user')) {
      return json(session?.user || {});
    }
    if (url.pathname.endsWith('/auth/v1/token')) {
      return session ? json(session) : json({ error: 'invalid_grant' }, 400);
    }
    if (url.pathname.endsWith('/rest/v1/user_memberships')) {
      if (!scenario) return json([]);
      const baseMembership = {
        id: 'membership-' + scenario.role.toLowerCase(),
        user_id: scenario.id,
        tenant_id: tenantId,
        organization_id: 'org-e2e',
        business_id: scenario.businessId !== undefined ? scenario.businessId : businessId,
        branch_id: scenario.branchId || null,
        role: scenario.role,
        permissions: scenario.permissions,
        status: 'ACTIVE',
        created_at: '2026-01-01T00:00:00.000Z',
      };
      const additionalMemberships = (scenario.extraMemberships || []).map((extra) => ({
        id: extra.id || 'membership-extra-' + String(extra.role).toLowerCase(),
        user_id: scenario.id,
        tenant_id: tenantId,
        organization_id: 'org-e2e',
        business_id: extra.businessId !== undefined ? extra.businessId : businessId,
        branch_id: extra.branchId || null,
        role: extra.role,
        permissions: extra.permissions || {},
        status: 'ACTIVE',
        created_at: extra.created_at || '2026-02-01T00:00:00.000Z',
      }));
      // Return the business-scoped employee row first to guard against assuming
      // the first membership is the strongest role. OWNER is tenant-wide here.
      return json([...additionalMemberships, baseMembership]);
    }
    if (url.pathname.endsWith('/rest/v1/rpc/mnty_business_employee_list_scoped') || url.pathname.endsWith('/rest/v1/rpc/mnty_business_employee_list')) {
      if (url.pathname.endsWith('/rest/v1/rpc/mnty_business_employee_list_scoped')) {
        let body = {};
        try { body = request.postDataJSON() || {}; } catch { /* no JSON body */ }
        rpcObservation.scopedBranchId = body.p_branch_id ?? null;
      }
      return json({
        positions: [{
          id: employeePositionId,
          title: 'موظف عرض فقط',
          department: 'الكتالوج',
          description: '',
          employment_type: 'FULL_TIME',
          permission_template: { modules: { EMPLOYEES: ['view'] } },
          is_hiring: false,
          is_active: true,
        }],
        employees: [{
          id: targetEmployeeId,
          job_position_id: employeePositionId,
          position_title: 'موظف عرض فقط',
          full_name: 'موظف اختبار',
          email: 'e2e-listed-employee@example.test',
          phone: '',
          status: 'ACTIVE',
          user_id: '00000000-0000-0000-0000-000000000005',
        }],
      });
    }
    if (url.pathname.endsWith('/functions/v1/public-catalog-directory')) {
      return json({ accessMode: 'PUBLIC_DIRECTORY_READ_ONLY', businesses: publicDirectoryBusinesses });
    }
    if (url.pathname.endsWith('/functions/v1/public-catalog')) {
      const businessId = url.searchParams.get('businessId');
      const fixture = publicDirectoryBusinesses.find((business) => business.id === businessId);
      if (!fixture) return json({ error: 'BUSINESS_NOT_PUBLIC' }, 404);
      return json({
        business: { id: fixture.id, name: fixture.name, code: fixture.id, operationalStatus: 'ACTIVE', isOperationallyAvailable: true },
        provider: { name: fixture.name, kind: fixture.category, description: fixture.profile?.bio || '', slug: fixture.id, verified: Boolean(fixture.provider?.verified) },
        profile: { ...fixture.profile, category: fixture.category },
        branches: [], selectedBranchId: null, items: [], prices: [], options: [],
        contactPhone: '', paymentsEnabled: false, accessMode: 'PUBLIC_READ_ONLY',
      });
    }
    if (url.pathname.endsWith('/functions/v1/catalog-admin')) {
      let body = {};
      try { body = request.postDataJSON() || {}; } catch { /* GET/no JSON body */ }
      if (body.action === 'CATALOG_READ') {
        catalogReadRequests.push({ businessId: body.businessId, branchId: body.branchId });
        return json({
          business: fakeBusiness,
          provider: { name: fakeBusiness.name, kind: fakeBusiness.category, verified: false },
          branches: fakeBusiness.branches,
          selectedBranchId: body.branchId || null,
          items: [],
          prices: [],
        });
      }
      if (body.action === 'BUSINESS_LIST') return json({ businesses: [fakeBusiness] });
      return json({ businesses: [], items: [], prices: [], branches: [] });
    }
    if (url.pathname.endsWith('/functions/v1/catalog-platform-admin')) {
      let body = {};
      try { body = request.postDataJSON() || {}; } catch { /* no JSON body */ }
      if (body.action === 'TAXONOMY_MAPPING_PREVIEW' || body.action === 'TAXONOMY_MAPPING_APPLY') {
        taxonomyMappingCalls.push({ action: body.action, body });
        if (body.action === 'TAXONOMY_MAPPING_PREVIEW') {
          return json({
            success: true,
            preview: {
              sourceGroupId: body.sourceGroupId,
              sourceCategoryId: body.sourceCategoryId,
              targetGroupId: body.targetGroupId,
              targetCategoryId: body.targetCategoryId,
              targetClassificationType: body.targetClassificationType,
              businessCount: 2,
              listingCount: 2,
              totalCount: 4,
              previewDigest: '45945945945945945945945945945945',
              canApply: true,
              sample: [{
                record_type: 'business',
                record_id: businessId,
                display_name: 'نشاط معاينة',
                old_group_id: body.sourceGroupId,
                old_category_id: body.sourceCategoryId,
                new_group_id: body.targetGroupId,
                new_category_id: body.targetCategoryId,
              }],
            },
          });
        }
        return json({
          success: true,
          result: {
            success: true,
            auditId: '45900000-0000-4000-8000-000000000077',
            businessCount: 2,
            listingCount: 2,
            totalCount: 4,
          },
        });
      }
      if (body.action === 'LIST_SUBSCRIBERS') return json({ subscribers: [] });
      if (body.action === 'GET_SETTINGS') return json({ settings: {} });
      if (body.action === 'TENANT_LIST') return json({ tenants: [] });
      return json({ success: true, settings: {} });
    }
    if (url.pathname.startsWith('/rest/v1/')) {
      return json([]);
    }
    return json({});
  });

  await page.goto(baseUrl + '?view=professional_dashboard', { waitUntil: 'domcontentloaded' });
  return { context, page, rpcObservation, catalogReadRequests, taxonomyMappingCalls };
}

async function waitForDashboard(page) {
  await page.locator('nav[aria-label="أقسام الداشبورد"]').waitFor({ state: 'visible', timeout: 15000 });
}
async function waitForDeniedDashboard(page) {
  await page.waitForFunction(() => !new URLSearchParams(window.location.search).has('view'), null, { timeout: 15000 });
  assert.equal(await page.locator('nav[aria-label="أقسام الداشبورد"]').count(), 0);
}

async function assertNoHorizontalOverflow(page, label) {
  const measurement = await page.evaluate(() => {
    const offenders = [...document.querySelectorAll('body *')]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          classes: typeof element.className === 'string' ? element.className : '',
          text: (element.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 90),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
        };
      })
      .filter((item) => item.width > 0 && (item.left < -1 || item.right > window.innerWidth + 1))
      .slice(0, 12);
    return {
      hasOverflow: document.documentElement.scrollWidth > window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      offenders,
    };
  });
  assert.equal(measurement.hasOverflow, false, label + ' must not have horizontal overflow: ' + JSON.stringify(measurement));
}

const browser = await chromium.launch({ headless: true });
const results = [];

async function auditAccessibility(page, label) {
  const axePath = process.env.AXE_CORE_SCRIPT;
  if (!axePath) return;
  if (!(await page.evaluate(() => Boolean(window.axe)))) {
    await page.addScriptTag({ path: axePath });
  }
  const audit = await page.evaluate(async () => {
    const scope = document.querySelector('main') || document.body;
    const report = await window.axe.run(scope, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });
    return report.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      targets: violation.nodes.slice(0, 5).map((node) => node.target),
    }));
  });
  const blocking = audit.filter((violation) => ['critical', 'serious'].includes(violation.impact));
  assert.equal(
    blocking.length,
    0,
    label + ' must have no critical/serious WCAG 2.1 A/AA violations: ' + JSON.stringify(blocking.slice(0, 10)),
  );
  results.push(label + '-axe-no-critical-serious-wcag21-violations');
}

try {
  // 1. Guest direct URL must not render privileged dashboard UI.
  {
    const { context, page } = await newScenario(browser);
    try {
      await waitForDeniedDashboard(page);
      assert.equal(await page.getByText('مركز التحكم', { exact: true }).count(), 0);
      results.push('guest-direct-route-denied');
    } finally { await context.close(); }
  }

  // 2. Explicit owner membership restores the dashboard after direct URL navigation and refresh.
  {
    const { context, page, catalogReadRequests } = await newScenario(browser, roles.owner);
    try {
      await waitForDashboard(page);
      await page.getByText('نشاط اختبار الداشبورد', { exact: true }).first().waitFor({ state: 'visible' });
      assert.equal(catalogReadRequests.length > 0, true, 'owner bootstrap must load catalog data');
      assert.equal(catalogReadRequests.every((request) => !request.branchId), true, 'tenant-wide owner must not inherit branch scope from a weaker employee membership');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForDashboard(page);
      assert.equal(catalogReadRequests.every((request) => !request.branchId), true, 'direct refresh must keep the tenant-wide catalog scope');
      assert.equal(await page.getByText('مساحة عمل محدودة الصلاحيات', { exact: true }).count(), 0);
      assert.equal(await page.getByText('نشاطك', { exact: true }).count() > 0, true);
      await assertNoHorizontalOverflow(page, '390px mobile owner dashboard');
      await auditAccessibility(page, 'owner-mobile-dashboard');
      await page.setViewportSize({ width: 1440, height: 900 });
      await assertNoHorizontalOverflow(page, '1440px desktop owner dashboard');
      await auditAccessibility(page, 'owner-desktop-dashboard');
      results.push('owner-route-refresh-and-membership-scope-restored-with-responsive-layout');
    } finally { await context.close(); }
  }

  // 3. Supported EMPLOYEE membership with an explicit catalog-view grant gets only the scoped workspace.
  {
    const { context, page } = await newScenario(browser, roles.employeeCatalogViewer);
    try {
      await waitForDashboard(page);
      await page.getByText('مساحة عمل محدودة الصلاحيات', { exact: true }).waitFor({ state: 'visible' });
      assert.equal(await page.getByText('إجمالي المشتركين', { exact: true }).count(), 0);
      await assertNoHorizontalOverflow(page, '390px mobile limited-employee dashboard');
      results.push('employee-view-only-scoped');
    } finally { await context.close(); }
  }

  // 4. Employee roster VIEW is read-only in the actual rendered module.
  {
    const { context, page } = await newScenario(browser, roles.employeeRosterViewer);
    try {
      await waitForDashboard(page);
      await page.getByText('مساحة عمل محدودة الصلاحيات', { exact: true }).waitFor({ state: 'visible' });
      await page.getByRole('button', { name: 'المستخدمون والصلاحيات' }).click();
      await page.getByText(/وضع عرض فقط/).waitFor({ state: 'visible' });
      assert.equal(await page.getByText('حفظ الوظيفة', { exact: true }).count(), 0);
      assert.equal(await page.getByText('إضافة الموظف', { exact: true }).count(), 0);
      results.push('employee-roster-view-is-read-only');
    } finally { await context.close(); }
  }

  // 5. A branch-scoped owner sees the scoped roster and the UI passes the branch scope to every roster read.
  {
    const { context, page, rpcObservation } = await newScenario(browser, roles.branchOwner);
    try {
      // A branch-scoped OWNER can use the scoped dashboard but not the broad legacy tabs.
      await page.goto(baseUrl + '?view=merchant_admin', { waitUntil: 'domcontentloaded' });
      await waitForDeniedDashboard(page);
      assert.equal(await page.getByText('مركز التحكم', { exact: true }).count(), 0);
      await page.goto(baseUrl + '?view=professional_dashboard', { waitUntil: 'domcontentloaded' });
      await waitForDashboard(page);
      await page.getByRole('button', { name: 'المستخدمون والصلاحيات' }).click();
      await page.getByText(/الوظائف المسجلة/).waitFor({ state: 'visible' });
      assert.equal(rpcObservation.scopedBranchId, branchId, 'branch owner roster RPC must include the active membership branch');
      assert.equal(await page.getByText('حفظ الوظيفة', { exact: true }).count() > 0, true);
      assert.equal(await page.getByRole('button', { name: 'الإعدادات والإدارة' }).count(), 0, 'branch owner must not see unscoped business-wide settings');
      results.push('branch-owner-legacy-route-denied-and-rpc-scoped');
    } finally { await context.close(); }
  }

  // 6. MANAGER on a raw user_memberships row is denied until the server resolver supports that grant source.
  {
    const { context, page } = await newScenario(browser, roles.unsupportedManager);
    try {
      await waitForDeniedDashboard(page);
      assert.equal(await page.getByText('مركز التحكم', { exact: true }).count(), 0);
      results.push('unsupported-manager-grant-denied');
    } finally { await context.close(); }
  }

  // 7. Permanent storefront links and QR images must encode the deployed base path and stable business ID.
  {
    const { context, page } = await newScenario(browser, roles.businessOwner);
    try {
      await page.goto(baseUrl + '?view=merchant_admin&merchantTab=qr', { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: /QR كود نشاط: نشاط اختبار الداشبورد/ }).waitFor({ state: 'visible', timeout: 15000 });

      const publicLink = page.locator('a[href*="store="]').filter({ hasText: /store=/ }).first();
      const href = await publicLink.getAttribute('href');
      assert.ok(href, 'merchant QR section must render the permanent public storefront URL');

      const actualUrl = new URL(href);
      const deployedBase = new URL(baseUrl);
      assert.equal(actualUrl.origin, deployedBase.origin, 'permanent URL must use the deployed origin');
      assert.equal(actualUrl.pathname, deployedBase.pathname, 'permanent URL must preserve the deployed application base path');
      assert.equal(actualUrl.searchParams.get('store'), businessId, 'permanent URL must use the stable business ID');

      await auditAccessibility(page, 'merchant-qr-tab');
      const qrImage = page.locator('img[alt="QR Code for نشاط اختبار الداشبورد"]').first();
      const qrImageSource = await qrImage.getAttribute('src');
      assert.ok(qrImageSource, 'merchant QR image must have a generated source URL');
      const qrUrl = new URL(qrImageSource);
      assert.equal(qrUrl.hostname, 'api.qrserver.com', 'QR image must use the configured QR provider');
      assert.equal(qrUrl.searchParams.get('data'), actualUrl.toString(), 'QR image data must match the permanent storefront link');

      await page.getByRole('button', { name: /عرض و طباعة الكود بالكامل/ }).click();
      await page.getByText('QR كود دائم ومستقر', { exact: true }).waitFor({ state: 'visible' });
      await auditAccessibility(page, 'merchant-qr-modal');
      const modalLink = page.locator('a[href*="store="]').filter({ hasText: /store=/ });
      assert.equal(await modalLink.count(), 2, 'QR section and QR modal must expose the same permanent link');
      assert.equal(await modalLink.nth(1).getAttribute('href'), actualUrl.toString(), 'QR modal must use the same canonical URL');
      results.push('permanent-store-link-and-qr-encode-deployed-base-path-and-stable-business-id');
    } finally { await context.close(); }
  }

  // 8. Catalog GPS asks only after click, handles granted/denied permissions, and never persists visitor coordinates.
  {
    const { context, page } = await newScenario(browser);
    try {
      await context.grantPermissions(['geolocation'], { origin: new URL(baseUrl).origin });
      await context.setGeolocation({ latitude: 30.55, longitude: 31.01 });
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      const gpsButton = page.getByRole('button', { name: /حدد موقعي/ });
      await gpsButton.waitFor({ state: 'visible', timeout: 15000 });
      await gpsButton.click();
      await page.getByText(/تم تحديد موقعك/, { exact: false }).waitFor({ state: 'visible', timeout: 10000 });
      const leakedCoordinates = await page.evaluate(() =>
        Object.entries(localStorage).some(([key, value]) => /userCoordinates|latitude|longitude/i.test(key + ' ' + value) || value.includes('30.55') || value.includes('31.01'))
      );
      assert.equal(leakedCoordinates, false, 'visitor GPS coordinates must not be persisted to local storage');
      await assertNoHorizontalOverflow(page, '390px mobile catalog GPS');
      await page.setViewportSize({ width: 1440, height: 900 });
      await assertNoHorizontalOverflow(page, '1440px desktop catalog GPS');
      results.push('catalog-gps-consent-distance-state-not-persisted-responsive');
    } finally { await context.close(); }
  }

  {
    const { context, page } = await newScenario(browser);
    try {
      await context.grantPermissions([], { origin: new URL(baseUrl).origin });
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      const gpsButton = page.getByRole('button', { name: /حدد موقعي/ });
      await gpsButton.waitFor({ state: 'visible', timeout: 15000 });
      await gpsButton.click();
      await page.getByText(/لم تسمح بالوصول إلى الموقع|تعذر تحديد موقعك/, { exact: false }).waitFor({ state: 'visible', timeout: 10000 });
      results.push('catalog-gps-permission-denial-keeps-manual-search-available');
    } finally { await context.close(); }
  }


  // 9. Verified activities expose only explicitly configured external brand URLs.
  {
    const displayLogo = 'https://assets.example.test/fallback-logo.svg';
    const displayCover = 'https://assets.example.test/fallback-cover.svg';
    const fixtures = [
      { id: '40000000-0000-0000-0000-000000000001', name: 'نشاط رابطين خارجيين', category: 'أنشطة تجارية', status: 'ACTIVE', publicEnabled: true, profile: { logoUrl: displayLogo, coverUrl: displayCover, externalLogoUrl: 'https://cdn.example.test/both-logo.svg', externalCoverUrl: 'https://cdn.example.test/both-cover.svg' }, provider: { verified: true } },
      { id: '40000000-0000-0000-0000-000000000002', name: 'نشاط رابط لوجو فقط', category: 'أنشطة تجارية', status: 'ACTIVE', publicEnabled: true, profile: { logoUrl: displayLogo, coverUrl: displayCover, externalLogoUrl: 'https://cdn.example.test/logo-only.svg', externalCoverUrl: '' }, provider: { verified: true } },
      { id: '40000000-0000-0000-0000-000000000003', name: 'نشاط رابط غلاف فقط', category: 'أنشطة تجارية', status: 'ACTIVE', publicEnabled: true, profile: { logoUrl: displayLogo, coverUrl: displayCover, externalLogoUrl: '', externalCoverUrl: 'https://cdn.example.test/cover-only.svg' }, provider: { verified: true } },
      { id: '40000000-0000-0000-0000-000000000004', name: 'نشاط بلا روابط خارجية', category: 'أنشطة تجارية', status: 'ACTIVE', publicEnabled: true, profile: { logoUrl: displayLogo, coverUrl: displayCover, externalLogoUrl: '', externalCoverUrl: '' }, provider: { verified: true } },
      { id: '40000000-0000-0000-0000-000000000005', name: 'نشاط غير موثق بروابط', category: 'أنشطة تجارية', status: 'ACTIVE', publicEnabled: true, profile: { logoUrl: displayLogo, coverUrl: displayCover, externalLogoUrl: 'https://cdn.example.test/unverified-logo.svg', externalCoverUrl: 'https://cdn.example.test/unverified-cover.svg' }, provider: { verified: false } },
    ];
    const { context, page } = await newScenario(browser, null, fixtures);
    try {
      await page.getByRole('heading', { name: 'نشاط رابطين خارجيين', exact: true }).waitFor({ state: 'visible', timeout: 15000 });
      const logoLinks = page.locator('a[title="فتح رابط اللوجو الخارجي"]');
      const coverLinks = page.locator('a[title="فتح رابط الغلاف الخارجي"]');
      assert.equal(await logoLinks.count(), 2, 'only verified activities with explicit external logo URLs should show logo links');
      assert.equal(await coverLinks.count(), 2, 'only verified activities with explicit external cover URLs should show cover links');
      assert.equal(await page.locator('a[href="https://cdn.example.test/both-logo.svg"]').count(), 1);
      assert.equal(await page.locator('a[href="https://cdn.example.test/both-cover.svg"]').count(), 1);
      assert.equal(await page.locator('a[href="https://cdn.example.test/logo-only.svg"]').count(), 1);
      assert.equal(await page.locator('a[href="https://cdn.example.test/cover-only.svg"]').count(), 1);
      assert.equal(await page.locator('a[href*="fallback-"]').count(), 0, 'display fallback images must never be exposed as external links');
      assert.equal(await page.locator('a[href*="unverified-"]').count(), 0, 'unverified activities must not expose external brand links');
      for (const link of await [...await logoLinks.all(), ...await coverLinks.all()]) {
        assert.equal(await link.getAttribute('target'), '_blank', 'external links must open in a new tab');
        assert.match(await link.getAttribute('rel') || '', /noopener/);
        assert.match(await link.getAttribute('rel') || '', /noreferrer/);
      }
      await page.goto(baseUrl + '?store=40000000-0000-0000-0000-000000000001', { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'نشاط رابطين خارجيين', exact: true }).waitFor({ state: 'visible', timeout: 15000 });
      assert.equal(await page.locator('a[href="https://cdn.example.test/both-logo.svg"]').count(), 1, 'direct storefront load must preserve the external logo URL');
      assert.equal(await page.locator('a[href="https://cdn.example.test/both-cover.svg"]').count(), 1, 'direct storefront load must preserve the external cover URL');
      results.push('verified-external-logo-cover-links-only-with-explicit-urls-in-directory-and-storefront');
    } finally { await context.close(); }
  }

  // 9. Only a platform-wide admin can access the taxonomy mapping screen; preview is read-only and apply requires fresh digest confirmation.
  {
    const { context, page, taxonomyMappingCalls } = await newScenario(browser, roles.platformAdmin);
    try {
      await page.goto(baseUrl + '?view=super_admin&tab=taxonomy', { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'إدارة ربط التصنيفات وإعادة توزيع السجلات', exact: true }).waitFor({ state: 'visible', timeout: 15000 });
      await assertNoHorizontalOverflow(page, '390px taxonomy admin mapping panel');
      await page.getByRole('button', { name: 'إنشاء معاينة آمنة', exact: true }).click();
      await page.getByText('معاينة المعاينة', { exact: false }).waitFor({ state: 'hidden', timeout: 1000 }).catch(() => {});
      await page.getByText('اكتملت المعاينة دون تعديل أي بيانات.', { exact: false }).waitFor({ state: 'visible', timeout: 10000 });
      assert.equal(taxonomyMappingCalls.length, 1, 'one preview RPC must be called');
      assert.equal(taxonomyMappingCalls[0].action, 'TAXONOMY_MAPPING_PREVIEW');
      assert.equal(await page.getByText('4', { exact: true }).count() >= 1, true, 'preview must render affected-record counts');
      await page.getByRole('button', { name: 'إلغاء المعاينة', exact: true }).click();
      assert.equal(taxonomyMappingCalls.length, 1, 'cancel must not call the apply RPC');
      await page.getByRole('button', { name: 'إنشاء معاينة آمنة', exact: true }).click();
      await page.getByText('اكتملت المعاينة دون تعديل أي بيانات.', { exact: false }).waitFor({ state: 'visible', timeout: 10000 });
      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: 'اعتماد التغيير وتسجيله', exact: true }).click();
      await page.waitForFunction(() => document.body.textContent.includes('رقم سجل التدقيق'), null, { timeout: 10000 });
      assert.equal(taxonomyMappingCalls.length, 3, 'one new preview and one apply RPC must be called after cancellation');
      assert.equal(taxonomyMappingCalls[2].action, 'TAXONOMY_MAPPING_APPLY');
      assert.match(taxonomyMappingCalls[2].body.expectedPreviewDigest, /^[a-f0-9]{32}$/);
      results.push('platform-admin-taxonomy-preview-cancel-and-confirmed-apply-flow');
    } finally { await context.close(); }
  }

  // 10. Folder-style taxonomy navigation follows the current production labels.
  {
    const { context, page } = await newScenario(browser);
    try {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: /كافة الأنشطة/ }).first().click();
      const taxonomyMain = page.locator('main[dir="rtl"]');
      await taxonomyMain.getByRole('heading', { name: 'المجالات الرئيسية', exact: true }).waitFor({ state: 'visible' });
      await taxonomyMain.getByRole('button', { name: /الطب والصحة/ }).first().click();
      await taxonomyMain.getByRole('heading', { name: 'الطب والصحة', exact: true }).waitFor({ state: 'visible' });
      await taxonomyMain.getByRole('button', { name: /عيادات طبية/ }).waitFor({ state: 'visible' });
      await taxonomyMain.getByRole('button', { name: /صيدليات/ }).waitFor({ state: 'visible' });
      await assertNoHorizontalOverflow(page, '390px taxonomy group/category browser');
      await taxonomyMain.getByRole('button', { name: /عيادات طبية/ }).click();
      await taxonomyMain.getByRole('heading', { name: 'عيادات طبية', exact: true }).waitFor({ state: 'visible' });
      await taxonomyMain.getByRole('button', { name: /عيادات عامة/ }).waitFor({ state: 'visible' });
      await taxonomyMain.getByRole('button', { name: /رجوع للمجالات والأنشطة/ }).click();
      await taxonomyMain.getByRole('heading', { name: 'الطب والصحة', exact: true }).waitFor({ state: 'visible' });
      await taxonomyMain.getByRole('button', { name: /رجوع للمجالات/ }).click();
      await taxonomyMain.getByRole('heading', { name: 'المجالات الرئيسية', exact: true }).waitFor({ state: 'visible' });
      // Let the folder cards finish their enter/hover layout before measuring document overflow.
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await assertNoHorizontalOverflow(page, '390px taxonomy return to groups');
      results.push('taxonomy-folder-group-category-back-navigation-and-mobile-layout');
    } finally { await context.close(); }
  }

  // 10. Selecting a specialty applies the specialty filter and returns to the catalog.
  {
    const { context, page } = await newScenario(browser);
    try {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: /كافة الأنشطة/ }).first().click();
      const taxonomyMain = page.locator('main[dir="rtl"]');
      await taxonomyMain.getByRole('button', { name: /الطب والصحة/ }).first().click();
      await taxonomyMain.getByRole('button', { name: /عيادات طبية/ }).click();
      await taxonomyMain.getByRole('button', { name: /عيادات عامة/ }).click();
      const taxonomyBreadcrumb = page.getByRole('navigation', { name: 'مسار المجال والنشاط' });
      await taxonomyBreadcrumb.getByText('عيادات طبية', { exact: true }).waitFor({ state: 'visible' });
      await taxonomyBreadcrumb.getByText('عيادات عامة', { exact: true }).waitFor({ state: 'visible' });
      await assertNoHorizontalOverflow(page, '390px selected taxonomy specialty');
      await page.setViewportSize({ width: 768, height: 1024 });
      await assertNoHorizontalOverflow(page, '768px selected taxonomy specialty');
      await page.setViewportSize({ width: 1440, height: 900 });
      await assertNoHorizontalOverflow(page, '1440px selected taxonomy specialty');
      results.push('taxonomy-specialty-selection-returns-to-catalog-and-filters');
    } finally { await context.close(); }
  }

} finally {
  await browser.close();
}
console.log('PRIMARY_CATALOG_BROWSER_E2E=PASS (' + results.join(', ') + ')');
