import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const playwrightSpecifier = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = await import(playwrightSpecifier);
const baseUrl = process.env.MANTIQUATIX_E2E_BASE_URL || 'http://127.0.0.1:4173/MantiqatiX/';
const config = readFileSync(new URL('../public/config.js', import.meta.url), 'utf8');
const supabaseUrl = config.match(/supabaseUrl:\s*'([^']+)'/)?.[1];
const supabaseAnonKey = config.match(/supabaseKey:\s*'([^']+)'/)?.[1];
assert.ok(supabaseUrl, 'public config must expose the configured Supabase URL');
assert.ok(supabaseAnonKey, 'public config must expose the public Supabase key');
const supabaseOrigin = new URL(supabaseUrl).origin;
const liveDirectoryResponse = await fetch(`${supabaseUrl}/functions/v1/public-catalog-directory`, {
  headers: { apikey: supabaseAnonKey, Accept: 'application/json' },
});
assert.equal(liveDirectoryResponse.status, 200, 'live public directory must respond HTTP 200');
const liveDirectory = await liveDirectoryResponse.json();
assert.equal(liveDirectory.accessMode, 'PUBLIC_DIRECTORY_READ_ONLY');
assert.ok(Array.isArray(liveDirectory.businesses), 'live public directory must return businesses');
const verifiedBusinessTargets = [
  { id: 'c9d9d2a6-32b1-4f7d-b7c9-43ae48525281', label: 'Sameh Market', expectProducts: true },
  { id: '703f4526-3292-43b4-b83b-3e0d9355704c', label: 'Burger Fakher', expectProducts: true },
  { id: '92d4455a-31ef-4a77-acbf-71134ca98e9e', label: 'Shaeir Sanitary Ware', expectProducts: false },
  { id: '5f02dbe8-7bb3-477b-a8e6-688f75ceaece', label: 'AMMAN COFFEE', expectProducts: false },
];
for (const target of verifiedBusinessTargets) {
  const business = liveDirectory.businesses.find((row) => row.id === target.id);
  assert.ok(business, 'live public directory must include ' + target.label);
  assert.equal(business.provider?.verified, true, target.label + ' must be marked verified by the public API');
  assert.equal(business.status, 'ACTIVE', target.label + ' must be active');
  assert.ok(Array.isArray(business.items), target.label + ' must expose a catalog item array');
  if (target.expectProducts) {
    assert.ok(business.items.length > 0, target.label + ' must expose active public products');
  }
}
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
    branchId: null,
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

async function newScenario(browser, scenario = null, publicDirectoryBusinesses = [], options = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const session = scenario ? makeSession(scenario) : null;
  await context.addInitScript(({ key, value, geoKey, geoPreference }) => {
    localStorage.removeItem(key);
    if (value) localStorage.setItem(key, value);
    // Initialize geographic test state once per browser context, not on every
    // navigation/reload; the GPS test must verify the app's own persisted choice.
    if (!sessionStorage.getItem('__mantiqatix_e2e_geo_initialized')) {
      localStorage.removeItem(geoKey);
      if (geoPreference) localStorage.setItem(geoKey, JSON.stringify(geoPreference));
      sessionStorage.setItem('__mantiqatix_e2e_geo_initialized', '1');
    }
  }, {
    key: storageKey,
    value: session ? JSON.stringify(session) : null,
    geoKey: 'mantiqatix.geo-discovery.v1',
    // Non-GPS scenarios begin with the Egypt-wide manual fallback. GPS scenarios
    // opt out so they can verify the first-visit consent flow independently.
    geoPreference: options.geoFirstVisit ? null : (options.geoPreference || {
      completed: true, mode: 'manual', governorate: 'all', markaz: 'all', village: 'all', area: 'all',
    }),
  });

  const rpcObservation = { scopedBranchId: undefined };
  const catalogReadRequests = [];
  const directoryAdminRequests = [];
  const platformAdminRequests = [];
  const platformSettingsState = { settings: options.platformSettings || {} };
  const directoryListingsState = options.directoryListingsState || { listings: [] };
  const directoryListingPageRequests = [];
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
      try { body = request.method() === 'POST' ? request.postDataJSON() || {} : {}; } catch { /* no JSON body */ }
      const action = String(body.action || '').toUpperCase();
      platformAdminRequests.push({
        action,
        settings: body.settings || null,
        authorization: request.headers().authorization || '',
      });
      if (action === 'GET_SETTINGS') return json({ settings: platformSettingsState.settings });
      if (action === 'SAVE_SETTINGS') {
        platformSettingsState.settings = { ...platformSettingsState.settings, ...(body.settings || {}) };
        return json({ success: true, settings: platformSettingsState.settings, auditLogged: true });
      }
      if (action === 'LIST_SUBSCRIBERS') return json({ subscribers: [] });
      return json({ subscribers: [], settings: platformSettingsState.settings });
    }
    if (url.pathname.endsWith('/functions/v1/directory-listings')) {
      let body = {};
      try { body = request.method() === 'POST' ? request.postDataJSON() || {} : {}; } catch { /* no JSON body */ }
      if (request.method() === 'GET') {
        const params = Object.fromEntries(url.searchParams.entries());
        if (options.directoryListingsPageHandler) {
          directoryListingPageRequests.push(params);
          return json(options.directoryListingsPageHandler(params));
        }
        return json({ listings: directoryListingsState.listings });
      }
      if (body.action === 'ADMIN_LIST') {
        directoryAdminRequests.push({ action: body.action, authorization: request.headers().authorization || '' });
        return json({ listings: directoryListingsState.listings, claims: [], businesses: [] });
      }
      if (body.action === 'UPSERT_LISTING') {
        directoryAdminRequests.push({ action: body.action, payload: body, authorization: request.headers().authorization || '' });
        const existing = directoryListingsState.listings.find((listing) => listing.id === body.id);
        const saved = {
          ...(existing || {}),
          id: body.id || 'listing-e2e-created-0001',
          slug: body.slug || 'directory-e2e-' + String(body.displayName || 'listing').replace(/\\s+/g, '-').toLowerCase(),
          display_name: body.displayName,
          listing_type: body.listingType,
          functional_group_id: body.functionalGroupId,
          taxonomy_category_id: body.taxonomyCategoryId,
          taxonomy_specialty: body.taxonomySpecialty || null,
          specialty: body.specialty || body.taxonomySpecialty || null,
          phone: body.phone || null,
          secondary_phone: body.secondaryPhone || null,
          address: body.address || null,
          governorate: body.governorate || 'المنوفية',
          district: body.district || 'بركة السبع',
          village: body.village || null,
          source_name: body.sourceName || 'إدخال إدارة المنصة',
          source_url: body.sourceUrl || null,
          listing_status: body.listingStatus || 'DRAFT',
          claim_status: existing?.claim_status || 'UNCLAIMED',
          outreach_status: body.outreachStatus || 'NEW',
          outreach_notes: body.outreachNotes || null,
          last_contacted_at: body.lastContactedAt || null,
          subscription_offer_at: body.subscriptionOfferAt || null,
          next_follow_up_at: body.nextFollowUpAt || null,
          completeness: body.completeness || {},
          updated_at: new Date().toISOString(),
        };
        directoryListingsState.listings = [saved, ...directoryListingsState.listings.filter((listing) => listing.id !== saved.id)];
        return json({ listing: saved }, existing ? 200 : 201);
      }
      return json({ error: 'UNSUPPORTED_DIRECTORY_ACTION' }, 400);
    }
    if (url.pathname.startsWith('/rest/v1/')) {
      return json([]);
    }
    return json({});
  });

  await page.goto(baseUrl + (options.initialRoute || '?view=professional_dashboard'), { waitUntil: 'domcontentloaded' });
  return { context, page, rpcObservation, catalogReadRequests, directoryAdminRequests, directoryListingsState, directoryListingPageRequests, platformAdminRequests, platformSettingsState };
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
  // 0. Public activity lists render 20 cards, then append 20 more per explicit action.
  {
    const paginationSource = liveDirectory.businesses[0];
    assert.ok(paginationSource, 'a real public directory activity must be available as the E2E fixture shape');
    const paginationFixtures = Array.from({ length: 45 }, (_, index) => {
      const name = 'نشاط اختبار التصفح ' + String(index + 1).padStart(2, '0');
      return {
        ...paginationSource,
        id: 'pagination-e2e-' + String(index + 1).padStart(2, '0'),
        slug: 'pagination-e2e-' + String(index + 1).padStart(2, '0'),
        name,
        status: 'ACTIVE',
        operationalStatus: 'ACTIVE',
        publicEnabled: true,
        settings: { ...(paginationSource.settings || {}), catalog_public_enabled: true },
        profile: { ...(paginationSource.profile || {}), bio: 'نشاط تجريبي لاختبار التحميل التدريجي' },
        provider: { ...(paginationSource.provider || {}), name, verified: index < 3 },
      };
    });
    const { context, page } = await newScenario(browser, null, paginationFixtures);
    try {
      await page.getByText('نتائج البحث الموحدة (45)', { exact: true }).waitFor({ state: 'visible', timeout: 15000 });
      const testCards = page.getByRole('heading').filter({ hasText: /^نشاط اختبار التصفح \d{2}$/ });
      await testCards.first().waitFor({ state: 'visible', timeout: 15000 });
      assert.equal(await testCards.count(), 20, 'directory must render exactly the first 20 activity cards');
      await page.getByRole('button', { name: 'رؤية المزيد من الأنشطة', exact: true }).click();
      await page.waitForFunction(() => [...document.querySelectorAll('h3')]
        .filter((node) => /^نشاط اختبار التصفح \d{2}$/.test((node.textContent || '').trim())).length === 40);
      assert.equal(await testCards.count(), 40, 'first load-more action must append exactly 20 activity cards');
      await page.getByRole('button', { name: 'رؤية المزيد من الأنشطة', exact: true }).click();
      await page.waitForFunction(() => [...document.querySelectorAll('h3')]
        .filter((node) => /^نشاط اختبار التصفح \d{2}$/.test((node.textContent || '').trim())).length === 45);
      assert.equal(await testCards.count(), 45, 'last load-more action must append the remaining activities without duplicates');
      results.push('directory-progressive-pagination-20-20-remaining-five');
    } finally { await context.close(); }
  }

  // 0b. Public directory uses a 20-row server page and continues with the returned keyset cursor.
  {
    const pageRows = Array.from({ length: 25 }, (_, index) => {
      const suffix = String(index + 1).padStart(2, '0');
      return {
        id: '123e4567-e89b-42d3-a456-' + String(index + 1).padStart(12, '0'),
        slug: 'cursor-doctor-' + suffix,
        display_name: 'عيادة اختبار المؤشر ' + suffix,
        listing_type: 'doctor',
        functional_group_id: 'medical_health',
        taxonomy_category_id: 'cat_medical_health_medical_practices',
        taxonomy_specialty: 'طب أطفال',
        specialty: 'طب أطفال',
        phone: '0100000' + String(index + 1).padStart(4, '0'),
        secondary_phone: null,
        address: 'شارع العيادة ' + suffix,
        governorate: 'محافظة المنوفية',
        district: 'مركز بركة السبع',
        village: 'قرية بركة السبع',
        listing_status: 'PUBLISHED',
        claim_status: 'UNCLAIMED',
        metadata: {},
        created_at: '2026-11-01T00:00:00.000Z',
      };
    });
    const { context, page, directoryListingPageRequests } = await newScenario(browser, null, [], {
      geoPreference: {
        completed: true, mode: 'manual',
        governorate: 'المنوفية', markaz: 'بركة السبع',
        village: 'all', area: 'all',
      },
      directoryListingsPageHandler: (params) => {
        const secondPage = params.cursor === 'e2e-cursor-page-two';
        return {
          listings: secondPage ? pageRows.slice(20) : pageRows.slice(0, 20),
          nextCursor: secondPage ? null : 'e2e-cursor-page-two',
          hasMore: !secondPage,
          pageSize: 20,
        };
      },
    });
    try {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      const cursorCards = page.getByRole('heading').filter({ hasText: /^عيادة اختبار المؤشر \d{2}$/ });
      try {
        await cursorCards.first().waitFor({ state: 'visible', timeout: 15000 });
      } catch {
        throw new Error('Server-cursor E2E did not render first-page cards. Page requests: ' +
          JSON.stringify(directoryListingPageRequests) + '; visible page text: ' +
          JSON.stringify((await page.locator('body').innerText().catch(() => '')).slice(0, 1800)));
      }
      assert.equal(await cursorCards.count(), 20, 'public directory must initially render exactly one 20-row server page');
      await page.getByRole('button', { name: 'رؤية المزيد من الأنشطة', exact: true }).click();
      await page.waitForFunction(() => [...document.querySelectorAll('h3')]
        .filter((node) => /^عيادة اختبار المؤشر \d{2}$/.test((node.textContent || '').trim())).length === 25);
      assert.equal(await cursorCards.count(), 25, 'cursor continuation must append the remaining five public listings without duplicates');
      assert.ok(directoryListingPageRequests.length >= 2, 'the root directory must request a second server page after load more');
      assert.equal(directoryListingPageRequests[0].limit, '20', 'the first server request must be bounded to 20 rows');
      assert.equal(directoryListingPageRequests[0].governorate, 'المنوفية', 'the first server request must retain the selected governorate');
      assert.equal(directoryListingPageRequests[0].district, 'بركة السبع', 'the first server request must retain the selected markaz/district');
      const continuationRequest = directoryListingPageRequests.find((request) => request.cursor === 'e2e-cursor-page-two');
      assert.ok(continuationRequest, 'the continuation request must carry the exact nextCursor returned by the first page');
      assert.equal(continuationRequest.limit, '20', 'continuation must preserve the page-size bound');
      assert.equal(continuationRequest.governorate, 'المنوفية', 'continuation must preserve the selected governorate');
      assert.equal(continuationRequest.district, 'بركة السبع', 'continuation must preserve the selected markaz/district');
      results.push('directory-server-cursor-pagination-20-plus-5-geographic-scope');
    } finally { await context.close(); }
  }

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
    const { context, page } = await newScenario(browser, null, [], { geoFirstVisit: true });
    try {
      await context.grantPermissions(['geolocation'], { origin: new URL(baseUrl).origin });
      await context.setGeolocation({ latitude: 30.55, longitude: 31.01 });
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      const consentDialog = page.getByRole('dialog', { name: 'اكتشف الأنشطة الأقرب إليك' });
      await consentDialog.waitFor({ state: 'visible', timeout: 15000 });
      await consentDialog.getByRole('button', { name: 'السماح باستخدام موقعي' }).click();
      await page.getByText(/تم تحديد موقعك/, { exact: false }).waitFor({ state: 'visible', timeout: 10000 });
      await consentDialog.waitFor({ state: 'hidden', timeout: 5000 });
      const savedGeoPreference = await page.evaluate(() => JSON.parse(localStorage.getItem('mantiqatix.geo-discovery.v1') || 'null'));
      assert.equal(savedGeoPreference?.completed, true, 'explicit consent must be persisted before the dialog closes');
      assert.equal(savedGeoPreference?.mode, 'auto', 'accepted GPS consent must be remembered as automatic location mode');
      const gpsButton = page.getByRole('button', { name: /تحديث موقعي|حدد موقعي/ });
      await gpsButton.waitFor({ state: 'visible', timeout: 5000 });
      const leakedCoordinates = await page.evaluate(() =>
        Object.entries(localStorage).some(([key, value]) => /userCoordinates|latitude|longitude/i.test(key + ' ' + value) || value.includes('30.55') || value.includes('31.01'))
      );
      assert.equal(leakedCoordinates, false, 'visitor GPS coordinates must not be persisted to local storage');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('dialog', { name: 'اكتشف الأنشطة الأقرب إليك' }).waitFor({ state: 'detached', timeout: 5000 });
      await page.getByRole('button', { name: /تحديث موقعي|حدد موقعي/ }).waitFor({ state: 'visible', timeout: 5000 });
      const leakedCoordinatesAfterReload = await page.evaluate(() =>
        Object.entries(localStorage).some(([key, value]) => /userCoordinates|latitude|longitude/i.test(key + ' ' + value) || value.includes('30.55') || value.includes('31.01'))
      );
      assert.equal(leakedCoordinatesAfterReload, false, 'silent returning-visitor location refresh must not persist coordinates');
      await assertNoHorizontalOverflow(page, '390px mobile catalog GPS');
      await page.setViewportSize({ width: 1440, height: 900 });
      await assertNoHorizontalOverflow(page, '1440px desktop catalog GPS');
      results.push('catalog-gps-consent-distance-state-not-persisted-responsive');
    } finally { await context.close(); }
  }

  {
    const { context, page } = await newScenario(browser, null, [], { geoFirstVisit: true });
    try {
      await context.grantPermissions([], { origin: new URL(baseUrl).origin });
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      const consentDialog = page.getByRole('dialog', { name: 'اكتشف الأنشطة الأقرب إليك' });
      await consentDialog.waitFor({ state: 'visible', timeout: 15000 });
      await consentDialog.getByRole('button', { name: 'السماح باستخدام موقعي' }).click();
      await page.getByText(/لم تسمح بالوصول إلى الموقع|تعذر تحديد موقعك/, { exact: false }).waitFor({ state: 'visible', timeout: 10000 });
      await consentDialog.waitFor({ state: 'hidden', timeout: 5000 });
      await page.getByRole('button', { name: /حدد موقعي/ }).waitFor({ state: 'visible', timeout: 5000 });
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
      const logoLinks = page.locator('a[aria-label="فتح الرابط الخارجي للصورة التعريفية"]');
      const coverLinks = page.locator('a[aria-label="فتح الرابط الخارجي لصورة الغلاف"]');
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

  // 9. Platform-admin directory edit/create round-trip normalizes legacy category and specialty values.
  {
    const legacyListing = {
      id: 'listing-e2e-legacy-medical-0001',
      slug: 'legacy-medical-e2e',
      display_name: 'عيادة اختبار قديمة',
      listing_type: 'doctor',
      functional_group_id: 'medical_health',
      taxonomy_category_id: 'cat_medical_health_doctor',
      taxonomy_specialty: 'طبيب اطفال',
      specialty: 'طبيب أطفال',
      phone: '01012345678',
      secondary_phone: null,
      address: 'شارع الاختبار',
      governorate: 'المنوفية',
      district: 'بركة السبع',
      village: 'قرية الاختبار',
      source_name: 'Browser E2E fixture',
      source_url: null,
      listing_status: 'PUBLISHED',
      claim_status: 'UNCLAIMED',
      outreach_status: 'CONTACTED',
      outreach_notes: 'ملاحظة سابقة',
      last_contacted_at: '2026-10-30T00:00:00.000Z',
      subscription_offer_at: null,
      next_follow_up_at: null,
      completeness: { name: true, phone: true, specialty: true, address: true },
    };
    const directoryListingsState = { listings: [legacyListing] };
    const { context, page, directoryAdminRequests } = await newScenario(
      browser,
      roles.platformAdmin,
      [],
      { initialRoute: '?view=super_admin&tab=directory_listings', directoryListingsState },
    );
    try {
      await page.getByText('عيادة اختبار قديمة', { exact: true }).waitFor({ state: 'visible', timeout: 15000 });
      await page.getByRole('button', { name: /استكمال \/ تعديل/ }).click();
      const groupSelect = page.getByLabel('المجموعة الوظيفية *');
      const categorySelect = page.getByLabel('النشاط الرئيسي داخل المجموعة *');
      const specialtySelect = page.getByLabel('التخصص \/ النوع الدقيق داخل التصنيف');
      assert.equal(await groupSelect.inputValue(), 'medical_health', 'legacy listing must load into its canonical group');
      assert.equal(await categorySelect.inputValue(), 'cat_medical_health_medical_practices', 'legacy doctor category must normalize to the canonical medical activity');
      assert.equal(await specialtySelect.inputValue(), 'أطفال', 'legacy doctor specialty must load as a selectable canonical specialty');
      await page.getByLabel('اسم النشاط أو الجهة *').fill('عيادة اختبار بعد التعديل');
      await page.getByLabel('التخصص', { exact: true }).fill('أطفال');
      await specialtySelect.selectOption('أطفال');
      await page.getByRole('button', { name: 'حفظ البيانات' }).click();
      await page.getByText('تم تحديث الصفحة.', { exact: true }).waitFor({ state: 'visible' });
      await page.getByText('عيادة اختبار بعد التعديل', { exact: true }).waitFor({ state: 'visible' });
      const updateRequest = directoryAdminRequests.find((request) => request.action === 'UPSERT_LISTING');
      assert.ok(updateRequest, 'editing a legacy listing must call the directory UPSERT_LISTING action');
      assert.equal(updateRequest.authorization, 'Bearer e2e-access-token-not-a-real-credential', 'directory admin writes must carry the signed-in bearer token');
      assert.equal(updateRequest.payload.id, legacyListing.id, 'editing must update the existing listing rather than create a duplicate');
      assert.equal(updateRequest.payload.listingType, 'doctor', 'editing must preserve the underlying listing type');
      assert.equal(updateRequest.payload.functionalGroupId, 'medical_health');
      assert.equal(updateRequest.payload.taxonomyCategoryId, 'cat_medical_health_medical_practices');
      assert.equal(updateRequest.payload.taxonomySpecialty, 'أطفال');
      assert.equal(updateRequest.payload.phone, legacyListing.phone, 'editing taxonomy must preserve the existing contact number');
      assert.equal(updateRequest.payload.listingStatus, 'PUBLISHED', 'editing taxonomy must preserve publication status');

      await page.getByLabel('اسم النشاط أو الجهة *').fill('مركز اختبار جديد');
      await page.getByLabel('نوع الجهة').selectOption('clinic');
      await page.getByLabel('التخصص', { exact: true }).fill('أطفال');
      await specialtySelect.selectOption('أطفال');
      await page.getByRole('button', { name: 'حفظ البيانات' }).click();
      await page.getByText('تم إنشاء الصفحة.', { exact: true }).waitFor({ state: 'visible' });
      await page.getByText('مركز اختبار جديد', { exact: true }).waitFor({ state: 'visible' });
      const createRequest = directoryAdminRequests.filter((request) => request.action === 'UPSERT_LISTING').at(-1);
      assert.ok(createRequest);
      assert.equal(createRequest.payload.id, undefined, 'creating a new listing must not reuse the prior listing ID');
      assert.equal(createRequest.payload.listingType, 'clinic');
      assert.equal(createRequest.payload.functionalGroupId, 'medical_health');
      assert.equal(createRequest.payload.taxonomyCategoryId, 'cat_medical_health_medical_practices');
      assert.equal(createRequest.payload.taxonomySpecialty, 'أطفال');
      await groupSelect.selectOption('food_grocery');
      assert.equal(await page.getByLabel('نوع الجهة').inputValue(), 'business', 'non-medical groups must default to a general business record type');
      assert.equal(await page.getByLabel('نوع الجهة').locator('option').count(), 1, 'non-medical groups must not expose medical-only record types');
      assert.ok(directoryListingsState.listings.some((listing) => listing.id === legacyListing.id && listing.display_name === 'عيادة اختبار بعد التعديل'));
      assert.ok(directoryListingsState.listings.some((listing) => listing.display_name === 'مركز اختبار جديد'));
      results.push('platform-admin-directory-legacy-specialty-edit-and-new-listing-save-round-trip');
    } finally { await context.close(); }
  }

  // 10. A non-platform role cannot open the platform-admin directory route or load its admin bundle.
  {
    const { context, page, directoryAdminRequests } = await newScenario(
      browser,
      roles.unsupportedManager,
      [],
      { initialRoute: '?view=super_admin&tab=directory_listings' },
    );
    try {
      const firstVisitLocationDialog = page.getByRole('dialog', { name: 'اكتشف الأنشطة الأقرب إليك' });
      if (await firstVisitLocationDialog.isVisible().catch(() => false)) {
        await firstVisitLocationDialog.getByRole('button', { name: 'عرض مصر بالكامل' }).click();
        await firstVisitLocationDialog.waitFor({ state: 'hidden', timeout: 5000 });
      }
      await page.locator('section[aria-label="المجموعات والأنشطة"]').waitFor({ state: 'visible', timeout: 15000 });
      assert.equal(await page.getByText('دليل الأنشطة والمطالبات', { exact: true }).count(), 0, 'non-platform roles must not render the directory admin tab');
      assert.equal(directoryAdminRequests.some((request) => request.action === 'ADMIN_LIST'), false, 'non-platform roles must not request the admin directory bundle');
      results.push('non-platform-role-denied-directory-admin-route');
    } finally { await context.close(); }
  }

  // Super Admin can edit one canonical activity and persist its marketing/capability copy through the guarded platform settings endpoint.
  {
    const { context, page, platformAdminRequests, platformSettingsState } = await newScenario(
      browser,
      roles.platformAdmin,
      [],
      { initialRoute: '?view=super_admin&tab=activity_modules' },
    );
    try {
      await page.getByRole('heading', { name: 'إعدادات وحدات الأنشطة', exact: true }).waitFor({ state: 'visible', timeout: 15000 });
      await page.getByRole('status').getByText(
        'معاينة إعدادات الأنشطة متاحة، لكن الحفظ الإداري موقوف مؤقتًا حتى نشر واختبار خدمة الحفظ الذري مع سجل التدقيق على Supabase. لم يتم إرسال أي تعديل أو تغيير بيانات الإنتاج.',
        { exact: true },
      ).waitFor({ state: 'visible', timeout: 10000 });
      assert.equal(await page.getByLabel('اختر النشاط').count(), 0, 'the unverified editor must not expose editable activity settings');
      assert.equal(platformAdminRequests.filter((request) => request.action === 'SAVE_SETTINGS').length, 0, 'no settings write may be sent before atomic audit support is deployed');
      results.push('activity-module-admin-writes-disabled-until-atomic-audit-backend');
    } finally { await context.close(); }
  }

  // Geographic regression: verified business in a markaz with no village remains discoverable when village is left unselected.
  {
    const zeftaFixture = {
      id: '92d4455a-31ef-4a77-acbf-71134ca98e9e',
      tenantId: 'tenant-zefta-e2e',
      organizationId: 'org-zefta-e2e',
      name: 'شعير للأدوات الصحية',
      category: 'أدوات صحية وفلاتر مياه',
      status: 'ACTIVE',
      operationalStatus: 'ACTIVE',
      publicEnabled: true,
      isVerified: true,
      governorate: 'الغربية',
      markaz: 'زفتى',
      village: '',
      profile: { governorate: 'الغربية', markaz: 'زفتى', village: '', bio: 'نشاط اختبار جغرافي' },
      provider: { verified: true },
      branches: [],
      items: [],
    };
    const { context, page } = await newScenario(browser, null, [zeftaFixture]);
    try {
      await page.getByRole('heading', { name: 'شعير للأدوات الصحية', exact: true }).waitFor({ state: 'visible', timeout: 15000 });
      const govSelect = page.locator('label').filter({ hasText: 'المحافظة' }).locator('select');
      const markazSelect = page.locator('label').filter({ hasText: 'المركز / المدينة' }).locator('select');
      const villageSelect = page.locator('label').filter({ hasText: 'القرية / الحي' }).locator('select');
      await govSelect.selectOption({ label: 'الغربية' });
      await markazSelect.selectOption({ label: 'زفتى' });
      assert.equal(await villageSelect.inputValue(), 'all', 'village must remain unselected when the business has no village');
      assert.equal(await villageSelect.locator('option').filter({ hasText: /^زفتى$/ }).count(), 0, 'markaz name must not be misrepresented as a village');
      await page.getByRole('heading', { name: 'شعير للأدوات الصحية', exact: true }).waitFor({ state: 'visible' });
      assert.equal(await page.getByText('نتائج البحث الموحدة (1)', { exact: true }).count(), 1, 'Zefta markaz search with no village filter must retain Shaeir');
      results.push('zefta-markaz-search-retains-business-with-empty-village');
    } finally { await context.close(); }
  }


  // 11. Direct activity cards open a dedicated, refreshable activity module page.
  {
    const { context, page } = await newScenario(browser);
    try {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      const firstVisitLocationDialog = page.getByRole('dialog', { name: 'اكتشف الأنشطة الأقرب إليك' });
      if (await firstVisitLocationDialog.isVisible().catch(() => false)) {
        await firstVisitLocationDialog.getByRole('button', { name: 'عرض مصر بالكامل' }).click();
        await firstVisitLocationDialog.waitFor({ state: 'hidden', timeout: 5000 });
      }
      await page.getByRole('button', { name: /الطب والصحة/ }).first().click();
      const activityCard = page.getByRole('button', { name: /ممارسات وعيادات طبية/ }).first();
      await activityCard.waitFor({ state: 'visible' });
      await activityCard.click();
      const modulePage = page.locator('main[dir="rtl"]');
      await modulePage.getByRole('heading', { name: 'ممارسات وعيادات طبية', exact: true }).waitFor({ state: 'visible' });
      assert.equal(new URL(page.url()).searchParams.get('activity'), 'cat_medical_health_medical_practices', 'activity module route must be shareable and refreshable');
      assert.equal(new URL(page.url()).searchParams.get('group'), 'medical_health', 'activity route must preserve its parent group folder across refreshes');
      await modulePage.getByRole('button', { name: 'التخصصات', exact: true }).click();
      await modulePage.getByRole('button', { name: /باطنة/ }).waitFor({ state: 'visible' });
      await assertNoHorizontalOverflow(page, '390px direct activity module');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('main[dir="rtl"]').getByRole('heading', { name: 'ممارسات وعيادات طبية', exact: true }).waitFor({ state: 'visible' });
      await page.getByRole('button', { name: /العودة إلى الطب والصحة/ }).click();
      await page.getByRole('heading', { name: 'الطب والصحة', exact: true }).waitFor({ state: 'visible' });
      await page.getByRole('button', { name: 'كل المجموعات', exact: true }).click();
      await page.getByRole('heading', { name: 'المجموعات الوظيفية', exact: true }).waitFor({ state: 'visible' });
      await assertNoHorizontalOverflow(page, '390px direct activity return');
      results.push('direct-activity-module-route-refresh-specialty-and-back-navigation');
    } finally { await context.close(); }
  }

  // 12. Specialty folders open their own result list and scoped search while retaining geography and browser navigation.
  {
    const withPhone = {
      id: 'listing-module-phone-0001',
      slug: 'clinic-module-phone',
      display_name: 'عيادة اختبار داخل النشاط',
      listing_type: 'clinic',
      functional_group_id: 'medical_health',
      taxonomy_category_id: 'cat_medical_health_medical_practices',
      taxonomy_specialty: 'باطنة',
      specialty: 'باطنة',
      phone: '01012345678',
      secondary_phone: null,
      address: 'شارع الاختبار',
      governorate: 'المنوفية',
      district: 'بركة السبع',
      village: 'قرية الاختبار',
      source_name: 'Activity module E2E',
      source_url: null,
      listing_status: 'PUBLISHED',
      claim_status: 'UNCLAIMED',
    };
    const withoutPhone = {
      ...withPhone,
      id: 'listing-module-no-phone-0002',
      slug: 'clinic-module-no-phone',
      display_name: 'عيادة اختبار بدون رقم',
      phone: null,
      secondary_phone: null,
    };
    const outsideGeo = {
      ...withPhone,
      id: 'listing-module-outside-geo-0003',
      slug: 'clinic-module-outside-geo',
      display_name: 'عيادة خارج النطاق الجغرافي',
      governorate: 'القاهرة',
      district: 'مدينة نصر',
      village: 'الحي السابع',
    };
    const { context, page } = await newScenario(browser, null, [], {
      geoPreference: {
        completed: true, mode: 'manual', governorate: 'المنوفية',
        markaz: 'بركة السبع', village: 'قرية الاختبار', area: 'all',
      },
      directoryListingsState: { listings: [withPhone, withoutPhone, outsideGeo] },
    });
    try {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      const firstVisitLocationDialog = page.getByRole('dialog', { name: 'اكتشف الأنشطة الأقرب إليك' });
      if (await firstVisitLocationDialog.isVisible().catch(() => false)) {
        await firstVisitLocationDialog.getByRole('button', { name: 'عرض مصر بالكامل' }).click();
        await firstVisitLocationDialog.waitFor({ state: 'hidden', timeout: 5000 });
      }
      await page.getByRole('button', { name: /الطب والصحة/ }).first().click();
      await page.getByRole('button', { name: /ممارسات وعيادات طبية/ }).first().click();
      const modulePage = page.locator('main[dir="rtl"]');
      await modulePage.getByRole('heading', { name: 'ممارسات وعيادات طبية', exact: true }).waitFor({ state: 'visible' });
      await modulePage.getByRole('button', { name: /باطنة/ }).waitFor({ state: 'visible' });
      await modulePage.getByRole('button', { name: /باطنة/ }).click();
      assert.equal(new URL(page.url()).searchParams.get('specialty'), 'باطنة', 'specialty folder must have a dedicated, refreshable URL');
      await modulePage.getByText('عيادة اختبار داخل النشاط', { exact: true }).waitFor({ state: 'visible' });
      assert.equal(await modulePage.getByText('غير موثق', { exact: true }).count(), 1, 'published unclaimed records must carry the red unverified badge');
      assert.equal(await modulePage.getByText('عيادة اختبار بدون رقم', { exact: true }).count(), 0, 'entities without a public phone number must not render');
      assert.equal(await modulePage.getByText('عيادة خارج النطاق الجغرافي', { exact: true }).count(), 0, 'the specialty page must preserve the selected geo scope');

      const specialtySearch = modulePage.getByRole('searchbox', { name: 'البحث داخل باطنة' });
      await specialtySearch.waitFor({ state: 'visible' });
      await specialtySearch.fill('مركز غير موجود');
      await modulePage.getByText('لا توجد نتائج مطابقة داخل هذا التخصص والنطاق الجغرافي المحدد.', { exact: true }).waitFor({ state: 'visible' });
      assert.equal(await modulePage.getByText('عيادة اختبار داخل النشاط', { exact: true }).count(), 0, 'search must only retain matching results from the active specialty');
      await specialtySearch.fill('عيادة اختبار داخل النشاط');
      await modulePage.getByText('عيادة اختبار داخل النشاط', { exact: true }).waitFor({ state: 'visible' });

      await page.goBack();
      await modulePage.getByRole('button', { name: /باطنة/ }).waitFor({ state: 'visible' });
      assert.equal(new URL(page.url()).searchParams.has('specialty'), false, 'browser back must return to the specialty folders');
      await modulePage.getByRole('button', { name: /باطنة/ }).click();
      await modulePage.getByText('عيادة اختبار داخل النشاط', { exact: true }).waitFor({ state: 'visible' });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('main[dir="rtl"]').getByText('عيادة اختبار داخل النشاط', { exact: true }).waitFor({ state: 'visible' });
      await assertNoHorizontalOverflow(page, '390px specialty directory');
      await page.setViewportSize({ width: 768, height: 1024 });
      await assertNoHorizontalOverflow(page, '768px specialty directory');
      await page.setViewportSize({ width: 1440, height: 900 });
      await assertNoHorizontalOverflow(page, '1440px specialty directory');
      results.push('activity-specialty-folders-scoped-search-geography-and-refresh');
    } finally { await context.close(); }
  }

  // 13. Domain profiles must expose different marketing plans and operating capabilities.
  {
    const { context, page } = await newScenario(browser);
    try {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      const firstVisitLocationDialog = page.getByRole('dialog', { name: 'اكتشف الأنشطة الأقرب إليك' });
      if (await firstVisitLocationDialog.isVisible().catch(() => false)) {
        await firstVisitLocationDialog.getByRole('button', { name: 'عرض مصر بالكامل' }).click();
        await firstVisitLocationDialog.waitFor({ state: 'hidden', timeout: 5000 });
      }
      await page.getByRole('button', { name: /الأغذية والضيافة/ }).first().click();
      await page.getByRole('button', { name: /مطاعم/ }).first().click();
      const modulePage = page.locator('main[dir="rtl"]');
      await modulePage.getByRole('heading', { name: 'مطاعم', exact: true }).waitFor({ state: 'visible' });
      await modulePage.getByRole('button', { name: 'التسويق والإعلان', exact: true }).click();
      await modulePage.getByText('السكان القريبون', { exact: false }).waitFor({ state: 'visible' });
      await modulePage.getByText('صور أصلية للمنتجات والأطباق', { exact: false }).waitFor({ state: 'visible' });
      await modulePage.getByRole('button', { name: 'إعداد الخطة التسويقية', exact: true }).click();
      await modulePage.getByText('مسودة خطة مطاعم', { exact: true }).waitFor({ state: 'visible' });
      await modulePage.getByText('تقويم المحتوى المقترح', { exact: true }).waitFor({ state: 'visible' });
      await modulePage.getByText('قمع التحويل ومؤشرات الأداء', { exact: true }).waitFor({ state: 'visible' });
      await modulePage.getByRole('button', { name: 'إدارة المجال', exact: true }).click();
      await modulePage.getByRole('heading', { name: 'القائمة والمنتجات', exact: true }).waitFor({ state: 'visible' });
      await modulePage.getByRole('heading', { name: 'الطلبات والتوصيل', exact: true }).waitFor({ state: 'visible' });
      await modulePage.getByLabel('القائمة والمنتجات: قيد التجهيز', { exact: true }).waitFor({ state: 'visible' });
      await assertNoHorizontalOverflow(page, '390px restaurant activity operations');
      await page.goto(baseUrl + '?activity=cat_medical_health_pharmacies', { waitUntil: 'domcontentloaded' });
      const pharmacyModule = page.locator('main[dir="rtl"]');
      await pharmacyModule.getByRole('heading', { name: 'صيدليات', exact: true }).waitFor({ state: 'visible' });
      await pharmacyModule.getByRole('button', { name: 'التسويق والإعلان', exact: true }).click();
      await pharmacyModule.getByText('إعلان ساعات العمل والمناوبة', { exact: true }).waitFor({ state: 'visible' });
      await pharmacyModule.getByRole('button', { name: 'إدارة المجال', exact: true }).click();
      await pharmacyModule.getByText('إدارة ملف الصيدلية وساعات المناوبة', { exact: false }).waitFor({ state: 'visible' });
      await pharmacyModule.getByRole('heading', { name: 'الأدوية والمستلزمات', exact: true }).waitFor({ state: 'visible' });
      await pharmacyModule.getByRole('heading', { name: 'المناوبات وساعات العمل', exact: true }).waitFor({ state: 'visible' });
      await pharmacyModule.getByRole('heading', { name: 'طلبات التوصيل', exact: true }).waitFor({ state: 'visible' });
      assert.equal(await pharmacyModule.getByText('قيد التجهيز', { exact: true }).count(), 3, 'All pharmacy operations must remain disabled until verified backend workflows exist.');
      results.push('activity-module-registry-renders-domain-specific-marketing-and-operations');
      results.push('activity-module-registry-renders-pharmacy-specific-override');
    } finally { await context.close(); }
  }

  // Live verified activities must render badges and open their corresponding catalogues.
  {
    const { context, page } = await newScenario(browser, null, liveDirectory.businesses);
    try {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

      const findVerifiedCard = async (target) => {
        const heading = page.getByRole('heading', { name: target.name, exact: true }).first();
        await heading.waitFor({ state: 'visible', timeout: 15000 });
        const card = heading.locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " group ")][1]');
        await card.getByText('موثّق', { exact: true }).waitFor({ state: 'visible', timeout: 10000 });
        assert.equal(await card.getByText('غير موثق', { exact: true }).count(), 0, target.name + ' must not show an unverified badge');
        return card;
      };

      for (const target of verifiedBusinessTargets) {
        const liveBusiness = liveDirectory.businesses.find((row) => row.id === target.id);
        const card = await findVerifiedCard(liveBusiness);
        await card.getByRole('button', { name: /الكتالوج/ }).click();

        await page.getByRole('heading', { name: 'قائمة عروض وكتالوج ' + liveBusiness.name, exact: true })
          .waitFor({ state: 'visible', timeout: 15000 });
        await page.getByText('موثّق رسمياً', { exact: true }).waitFor({ state: 'visible', timeout: 10000 });

        if (target.expectProducts) {
          const firstPublicItem = liveBusiness.items[0];
          const firstItemName = String(firstPublicItem.name_ar || firstPublicItem.name_en || '').trim();
          assert.ok(firstItemName, target.label + ' public item must have a display name');
          await page.getByRole('heading', { name: firstItemName, exact: true }).first()
            .waitFor({ state: 'visible', timeout: 15000 });
          assert.ok(await page.getByText(/المعروض:/).count() > 0, target.label + ' catalogue must display a product count');
          results.push(target.label.toLowerCase().replaceAll(' ', '-') + '-verified-badge-and-live-product-rendered');
        } else {
          await page.getByRole('heading', { name: 'لا توجد منتجات أو خدمات مطابقة', exact: true })
            .waitFor({ state: 'visible', timeout: 10000 });
          results.push(target.label.toLowerCase().replaceAll(' ', '-') + '-verified-badge-and-empty-catalog-state-rendered');
        }

        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      }
    } finally { await context.close(); }
  }

  
} finally {
  await browser.close();
}
console.log('PRIMARY_CATALOG_BROWSER_E2E=PASS (' + results.join(', ') + ')');
