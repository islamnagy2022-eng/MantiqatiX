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

async function newScenario(browser, scenario = null) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const session = scenario ? makeSession(scenario) : null;
  await context.addInitScript(({ key, value }) => {
    localStorage.removeItem(key);
    if (value) localStorage.setItem(key, value);
  }, { key: storageKey, value: session ? JSON.stringify(session) : null });

  const rpcObservation = { scopedBranchId: undefined };
  const catalogReadRequests = [];
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
      return json({ accessMode: 'PUBLIC_DIRECTORY_READ_ONLY', businesses: [] });
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
      return json({ subscribers: [], settings: {} });
    }
    if (url.pathname.startsWith('/rest/v1/')) {
      return json([]);
    }
    return json({});
  });

  await page.goto(baseUrl + '?view=professional_dashboard', { waitUntil: 'domcontentloaded' });
  return { context, page, rpcObservation, catalogReadRequests };
}

async function waitForDashboard(page) {
  await page.locator('nav[aria-label="أقسام الداشبورد"]').waitFor({ state: 'visible', timeout: 15000 });
}
async function waitForDeniedDashboard(page) {
  await page.waitForFunction(() => !new URLSearchParams(window.location.search).has('view'), null, { timeout: 15000 });
  assert.equal(await page.locator('nav[aria-label="أقسام الداشبورد"]').count(), 0);
}

async function assertNoHorizontalOverflow(page, label) {
  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(hasOverflow, false, label + ' must not have horizontal overflow');
}

const browser = await chromium.launch({ headless: true });
const results = [];
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
      await page.setViewportSize({ width: 1440, height: 900 });
      await assertNoHorizontalOverflow(page, '1440px desktop owner dashboard');
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
} finally {
  await browser.close();
}
console.log('PROFESSIONAL_DASHBOARD_BROWSER_E2E=PASS (' + results.join(', ') + ')');
