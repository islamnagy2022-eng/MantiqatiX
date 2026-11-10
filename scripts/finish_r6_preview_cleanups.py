#!/usr/bin/env python3
"""Final R6 cleanup pass: remove residual demo data and disable unconfigured integrations."""
from pathlib import Path
import re
import sys

if len(sys.argv) != 2:
    raise SystemExit("usage: finish_r6_preview_cleanups.py <extracted-app-directory>")
root = Path(sys.argv[1]).resolve()

def read(rel: str) -> str:
    p = root / rel
    if not p.is_file():
        raise SystemExit(f"Required file missing: {rel}")
    return p.read_text(encoding="utf-8")

def write(rel: str, value: str) -> None:
    (root / rel).write_text(value, encoding="utf-8")

def replace_once(src: str, old: str, new: str, label: str) -> str:
    count = src.count(old)
    if count != 1:
        raise SystemExit(f"Expected one {label} anchor; found {count}.")
    return src.replace(old, new, 1)

def replace_all(src: str, old: str, new: str, label: str, minimum: int = 1) -> str:
    count = src.count(old)
    if count < minimum:
        raise SystemExit(f"Expected at least {minimum} {label} anchors; found {count}.")
    return src.replace(old, new)

def replace_between(src: str, start: str, end: str, new: str, label: str) -> str:
    a = src.find(start)
    b = src.find(end, a + len(start)) if a >= 0 else -1
    if a < 0 or b < 0:
        raise SystemExit(f"Could not locate {label} boundaries.")
    return src[:a] + new + src[b:]

ctx_path = root / "src/context/AppContext.tsx"
ctx = read("src/context/AppContext.tsx")

# Directory-only Preview: do not reload stale browser snapshots or fictional business KPIs.
if "creditLimit: IS_PREVIEW_MODE ? 0 : b.creditLimit," not in ctx:
    ctx = replace_all(
        ctx,
        "        paymentStatus: IS_PREVIEW_MODE ? 'pending' : 'paid',",
        "        paymentStatus: IS_PREVIEW_MODE ? 'pending' : 'paid',\n"
        "        creditLimit: IS_PREVIEW_MODE ? 0 : b.creditLimit,\n"
        "        usedCreditBalance: IS_PREVIEW_MODE ? 0 : b.usedCreditBalance,\n"
        "        totalSalesAmount: IS_PREVIEW_MODE ? 0 : b.totalSalesAmount,\n"
        "        totalServicesSalesAmount: IS_PREVIEW_MODE ? 0 : b.totalServicesSalesAmount,\n"
        "        totalOrdersCount: IS_PREVIEW_MODE ? 0 : b.totalOrdersCount,\n"
        "        viewsCount: IS_PREVIEW_MODE ? 0 : b.viewsCount,\n"
        "        commissionPercentage: IS_PREVIEW_MODE ? 0 : b.commissionPercentage,\n"
        "        commissionFixed: IS_PREVIEW_MODE ? 0 : b.commissionFixed,\n"
        "        commissionPerOrder: IS_PREVIEW_MODE ? 0 : b.commissionPerOrder,",
        "business financial normalization",
        minimum=2,
    )
if "if (IS_PREVIEW_MODE) return INITIAL_BUSINESSES.map(normalizeAdoptedBiz);" not in ctx:
    ctx = replace_once(
        ctx,
        "    };\n    try {\n      const saved = appStorage.getItem(STORAGE_KEYS.BUSINESSES);",
        "    };\n    if (IS_PREVIEW_MODE) return INITIAL_BUSINESSES.map(normalizeAdoptedBiz);\n"
        "    try {\n      const saved = appStorage.getItem(STORAGE_KEYS.BUSINESSES);",
        "business snapshot bypass",
    )
if "if (IS_PREVIEW_MODE) return resolveList(INITIAL_PRODUCTS);" not in ctx:
    ps = ctx.find("  const [products, setProducts] = useState<Product[]>(() => {")
    pe = ctx.find("  const [subscribers, setSubscribers]", ps)
    if ps < 0 or pe < 0:
        raise SystemExit("Cannot locate product state initializer.")
    product_block = replace_once(
        ctx[ps:pe],
        "      });\n    try {\n      const saved = appStorage.getItem(STORAGE_KEYS.PRODUCTS);",
        "      });\n    if (IS_PREVIEW_MODE) return resolveList(INITIAL_PRODUCTS);\n"
        "    try {\n      const saved = appStorage.getItem(STORAGE_KEYS.PRODUCTS);",
        "product snapshot bypass",
    )
    ctx = ctx[:ps] + product_block + ctx[pe:]

# Clear fake load-test / telemetry figures; zeros mean 'not measured', not simulated uptime.
if "const emptyTelemetryMetrics: TelemetryMetrics" not in ctx:
    ms = ctx.find("  const [telemetryMetrics, setTelemetryMetrics]")
    me = ctx.find("  const runLoadTest =", ms)
    if ms < 0 or me < 0:
        raise SystemExit("Cannot locate telemetry state initializer.")
    metrics_block = """  const emptyTelemetryMetrics: TelemetryMetrics = {
    cpu: 0, memory: 0, activeConnections: 0, maxConnections: 0,
    cacheHitRatio: 0, queueDepth: 0, reqPerSec: 0, errorRate: 0,
    readLatencyP50: 0, readLatencyP95: 0, readLatencyP99: 0, writeLatencyP95: 0,
    globalRPS: 0, dbConnectionPoolActive: 0, dbConnectionPoolMax: 0,
    latencyP50Ms: 0, latencyP95Ms: 0, latencyP99Ms: 0, activePods: 0,
  };
  const [telemetryMetrics, setTelemetryMetrics] = useState<TelemetryMetrics>(() => IS_PREVIEW_MODE ? emptyTelemetryMetrics : getLiveTelemetryMetrics(1));
  const [isLoadTesting, setIsLoadTesting] = useState(false);
  const [lastLoadTestResult, setLastLoadTestResult] = useState<LoadTestBenchmarkResult | null>(() => IS_PREVIEW_MODE ? null : simulateEnterpriseLoadTest(10000));
  const [loadTestHistory, setLoadTestHistory] = useState<LoadTestBenchmarkResult[]>(() => IS_PREVIEW_MODE ? [] : [
    simulateEnterpriseLoadTest(1000),
    simulateEnterpriseLoadTest(10000),
  ]);

"""
    ctx = ctx[:ms] + metrics_block + ctx[me:]
if "معاينة مستقلة — لا توجد بيانات تشغيل سابقة" not in ctx:
    ctx = replace_once(
        ctx,
        "  const [lastLiveSyncTimestamp, setLastLiveSyncTimestamp] = useState<string>(() => {\n    try {",
        "  const [lastLiveSyncTimestamp, setLastLiveSyncTimestamp] = useState<string>(() => {\n"
        "    if (IS_PREVIEW_MODE) return 'معاينة مستقلة — لا توجد بيانات تشغيل سابقة';\n    try {",
        "last sync marker",
    )

# Old sample grants and promo signs are not authentic activities or campaigns.
if "const [freeAdminGrantLogs, setFreeAdminGrantLogs] = useState<FreeAdminGrantRecord[]>(() => []);" not in ctx:
    ctx = replace_between(
        ctx,
        "  const [freeAdminGrantLogs, setFreeAdminGrantLogs] = useState<FreeAdminGrantRecord[]>(() => {",
        "  useEffect(() => {\n    try {\n      appStorage.setItem('mantiqatix_free_admin_grant_logs_v6'",
        "  const [freeAdminGrantLogs, setFreeAdminGrantLogs] = useState<FreeAdminGrantRecord[]>(() => []);\n\n",
        "free admin grant history",
    )
if "const [promotionalSignageBanners, setPromotionalSignageBanners] = useState<PromotionalSignageItem[]>(() => []);" not in ctx:
    ctx = replace_between(
        ctx,
        "  const [promotionalSignageBanners, setPromotionalSignageBanners] = useState<PromotionalSignageItem[]>(() => {",
        "  useEffect(() => {\n    try {\n      appStorage.setItem('mantiqatix_promo_signage_v6'",
        "  const [promotionalSignageBanners, setPromotionalSignageBanners] = useState<PromotionalSignageItem[]>(() => []);\n\n",
        "sample advertising banner history",
    )
if "pixelId: '', isEnabled: false" not in ctx:
    ctx = replace_once(
        ctx,
        "  const [metaPixelConfig, setMetaPixelConfig] = useState<MetaPixelConfig>(() => {\n    try {",
        "  const [metaPixelConfig, setMetaPixelConfig] = useState<MetaPixelConfig>(() => {\n"
        "    if (IS_PREVIEW_MODE) return { ...DEFAULT_META_PIXEL_CONFIG, pixelId: '', isEnabled: false, conversionsApiEnabled: false, testEventCode: '' };\n"
        "    try {",
        "Preview Pixel disabled",
    )
if "if (IS_PREVIEW_MODE) return [];" not in ctx[ctx.find("const [metaPixelEvents"):ctx.find("const [metaPixelEvents") + 250]:
    ctx = replace_once(
        ctx,
        "  const [metaPixelEvents, setMetaPixelEvents] = useState<MetaPixelEventRecord[]>(() => {\n    try {",
        "  const [metaPixelEvents, setMetaPixelEvents] = useState<MetaPixelEventRecord[]>(() => {\n"
        "    if (IS_PREVIEW_MODE) return [];\n    try {",
        "Preview Pixel events empty",
    )
if "if (IS_PREVIEW_MODE) return Object.fromEntries(INITIAL_BUSINESSES.map((b) => [b.id, 1]))" not in ctx:
    ctx = replace_once(
        ctx,
        "  const [businessActiveStages, setBusinessActiveStages] = useState<Record<string, 1 | 2 | 3 | 4 | 5>>(() => {\n    try {",
        "  const [businessActiveStages, setBusinessActiveStages] = useState<Record<string, 1 | 2 | 3 | 4 | 5>>(() => {\n"
        "    if (IS_PREVIEW_MODE) return Object.fromEntries(INITIAL_BUSINESSES.map((b) => [b.id, 1])) as Record<string, 1 | 2 | 3 | 4 | 5>;\n"
        "    try {",
        "Preview business stage seed reset",
    )
ctx_path.write_text(ctx, encoding="utf-8")

# Wallets must always start with zero money, no credit, and no artificial advertising grants.
rules = read("src/utils/rules.ts")
ws = rules.find("export function createInitialPlatformWallets(")
we = rules.find("/**\n * Pure atomic ledger processor", ws)
if ws < 0 or we < 0:
    raise SystemExit("Cannot locate wallet factory boundaries.")
wallet = rules[ws:we]
wallet_replacements = {
    "availableBalance: 48500,": "availableBalance: 0,",
    "pendingBalance: 3200,": "pendingBalance: 0,",
    "creditLimit: 1000000,": "creditLimit: 0,",
    "adGrantBalance: 999999,": "adGrantBalance: 0,",
    "totalDeposited: 55000,": "totalDeposited: 0,",
    "isFreeSponsoredAdsEnabled: true,": "isFreeSponsoredAdsEnabled: false,",
    "availableBalance: b.isVerified ? 1200 + (idx % 5) * 450 : 250,": "availableBalance: 0,",
    "pendingBalance: b.isVerified ? 150 : 0,": "pendingBalance: 0,",
    "creditLimit: b.creditLimit ?? (b.subscriptionTier === 'advanced' ? 10000 : b.subscriptionTier === 'regular' ? 3000 : 500),": "creditLimit: 0,",
    "usedCredit: b.usedCreditBalance ?? b.usedCredit ?? 0,": "usedCredit: 0,",
    "adGrantBalance: b.subscriptionTier === 'advanced' ? 500 : 100,": "adGrantBalance: 0,",
    "totalDeposited: b.isVerified ? 2000 : 250,": "totalDeposited: 0,",
    "totalSpentOnAds: b.isVerified ? 300 : 0,": "totalSpentOnAds: 0,",
    "availableBalance: s.walletBalance ?? 850,": "availableBalance: 0,",
    "creditLimit: 2000,": "creditLimit: 0,",
    "adGrantBalance: 150,": "adGrantBalance: 0,",
    "totalDeposited: s.walletBalance ?? 850,": "totalDeposited: 0,",
}
for old, new in wallet_replacements.items():
    if old in wallet:
        wallet = wallet.replace(old, new)
    elif new not in wallet:
        raise SystemExit(f"Wallet fixture could not be verified or neutralized: {old}")
write("src/utils/rules.ts", rules[:ws] + wallet + rules[we:])

# Meta Pixel is opt-in only. Remove the embedded ID, test event and fake conversion history.
pixel = read("src/utils/aiPixelCommissionEngine.ts")
if "  pixelId: '1482950394857210'," in pixel:
    pixel = replace_once(pixel, "  pixelId: '1482950394857210',\n  isEnabled: true,", "  pixelId: '',\n  isEnabled: false,", "default Meta Pixel identity")
if "  testEventCode: 'TEST_MX_2026'," in pixel:
    pixel = replace_once(pixel, "  conversionsApiEnabled: true,\n  testEventCode: 'TEST_MX_2026',", "  conversionsApiEnabled: false,\n  testEventCode: '',", "default Pixel test event")
if "export const INITIAL_META_PIXEL_EVENTS: MetaPixelEventRecord[] = [];" not in pixel:
    pixel, changed = re.subn(
        r"export const INITIAL_META_PIXEL_EVENTS: MetaPixelEventRecord\[\] = \[.*?\n\];",
        "export const INITIAL_META_PIXEL_EVENTS: MetaPixelEventRecord[] = [];",
        pixel,
        count=1,
        flags=re.S,
    )
    if changed != 1:
        raise SystemExit("Could not clear initial Meta Pixel event fixtures.")
write("src/utils/aiPixelCommissionEngine.ts", pixel)

# The HTML shell must not initialize a third-party Meta Pixel in the isolated Preview.
html = read("index.html")
if "1482950394857210" in html or "window.fbq" in html:
    html, changed = re.subn(
        r"(?s)\s*<!--\s*Meta Pixel Code.*?</script>\s*",
        "\n",
        html,
        count=1,
    )
    if changed != 1:
        raise SystemExit("Could not safely remove the embedded Meta Pixel HTML block.")
if "1482950394857210" in html or "window.fbq" in html or "fbq('init'" in html:
    raise SystemExit("Third-party Pixel bootstrap remains in the Preview HTML.")
write("index.html", html)

# Keep setup documentation aligned with the guest-only, read-only Preview behavior.
preview_readme = """# MantiqaTix — R6 Preview معزولة

هذه نسخة معاينة عامة للقراءة فقط، مبنية على R6 بعد إزالة بيانات التشغيل المحلية والأسرار.

## حدود المعاينة
- دليل الأنشطة والمنتجات مأخوذ من حزمة R6 ويظل غير موثق حتى المراجعة.
- لا توجد حسابات عملاء أو مقدمي خدمة أو إدارة تجريبية.
- تسجيل الدخول ولوحات الإدارة والكتابة والطلبات والرسائل والمحافظ والمدفوعات والفوترة وواتساب والنسخ الاحتياطي معطلة.
- لا تتصل هذه البيئة بقاعدة Supabase الإنتاجية.
- كل طلب API غير مسموح به صراحةً يرجع 503 في وضع Preview.
- لا يتم تشغيل Meta Pixel أو إرسال PageView أو أحداث تحويل في هذه البيئة.
- التخزين المحلي منفصل ويستخدم بادئة mantiqatix_preview:: فقط.

## التشغيل داخل بيئة Preview
- يجب ضبط PREVIEW_MODE=true وVITE_PREVIEW_MODE=true.
- استخدم Bun بالإصدار المثبت في bun.lock لتثبيت الاعتماديات.
- لا تضع مفاتيح إنتاج أو حسابات أو بيانات حقيقية في هذه البيئة.
- أي بيانات دليل يجب اعتمادها يدويًا قبل وصفها بأنها موثقة.

هذه ليست نسخة Production ولا تسمح بإجراء معاملات فعلية.
"""
write("PREVIEW_README_AR.md", preview_readme)

# Unreviewed advertising artwork/coupons must not appear as live offers.
banners = read("src/utils/bookingPaymentEngine.ts")
if "export const DEFAULT_PROMOTIONAL_SIGNAGE_BANNERS: PromotionalSignageItem[] = [];" not in banners:
    banners, changed = re.subn(
        r"export const DEFAULT_PROMOTIONAL_SIGNAGE_BANNERS: PromotionalSignageItem\[\] = \[.*?\n\];",
        "export const DEFAULT_PROMOTIONAL_SIGNAGE_BANNERS: PromotionalSignageItem[] = [];",
        banners,
        count=1,
        flags=re.S,
    )
    if changed != 1:
        raise SystemExit("Could not clear default sample campaign banners.")
write("src/utils/bookingPaymentEngine.ts", banners)

# Replace static references to a non-owned third-party Pixel ID in dashboard labels.
for rel in [
    "src/components/admin/UnifiedEnterpriseDashboard.tsx",
    "src/components/admin/AdminDashboard.tsx",
    "src/components/merchant/MerchantDashboard.tsx",
]:
    write(rel, read(rel).replace("1482950394857210", "غير مهيأ"))

# Rewrite legacy tests that treated fake customer/subscriber identities as product data.
rules_test = read("src/utils/rules.test.ts")

def replace_test_block(source: str, start_marker: str, end_marker: str, replacement: str, label: str) -> str:
    start = source.find(start_marker)
    end = source.find(end_marker, start + len(start_marker)) if start >= 0 else -1
    if start < 0 or end < 0:
        raise SystemExit(f"Could not locate {label} boundaries")
    return source[:start] + replacement + "\n\n" + source[end:]

rules_test = replace_test_block(
    rules_test,
    "test('All 26 INITIAL_BUSINESSES",
    "test('Role Isolation & Demo Accounts",
    """test('R6 clean directory baseline retains 26 unverified listings and no initial operational records', () => {
  assert.equal(INITIAL_BUSINESSES.length, 26);
  assert.equal(INITIAL_SUBSCRIBERS.length, 0);
  assert.equal(INITIAL_SALES_RECORDS.length, 0);

  for (const biz of INITIAL_BUSINESSES) {
    assert.equal(biz.isVerified, false);
    assert.equal(biz.verificationStatus, 'unverified');
    assert.equal(biz.isFrozen, false);
    assert.equal(biz.paymentStatus, 'pending');
    assert.equal(biz.commissionPerOrder, 0);
    assert.equal(biz.commissionPercentage, 0);
    assert.equal(biz.commissionFixed, 0);
    assert.equal(biz.commissionType, 'subscription_only');
    assert.equal(biz.ownerEmail || '', '');
    assert.equal(biz.ownerWhatsApp || '', '');
    assert.equal(biz.phone || '', '');
    assert.equal(biz.totalSalesAmount || 0, 0);
    assert.equal(biz.totalServicesSalesAmount || 0, 0);
    assert.equal(biz.totalOrdersCount || 0, 0);
    assert.equal(biz.viewsCount || 0, 0);
    assert.equal(biz.creditLimit || 0, 0);
    assert.equal(biz.usedCreditBalance || 0, 0);
    const lat = biz.lat ?? biz.coordinates?.lat;
    const lng = biz.lng ?? biz.coordinates?.lng;
    assert.ok(typeof lat === 'number' && typeof lng === 'number', `Business ${biz.id} must keep its directory coordinates`);
  }
});""",
    "legacy business baseline test",
)
rules_test = replace_test_block(
    rules_test,
    "test('Role Isolation & Demo Accounts",
    "test('Adopted businesses have empty phone/WhatsApp",
    """test('R6 clean baseline contains no demo identities while role permission rules remain defined', () => {
  assert.equal(DEMO_CUSTOMER_ACCOUNTS.length, 0);
  assert.equal(INITIAL_SUBSCRIBERS.length, 0);
  assert.equal(authenticateCustomerAccount('preview_customer', 'preview-only'), null);
  assert.equal(authenticateSubscriber(INITIAL_SUBSCRIBERS, 'preview_provider', 'preview-only'), null);

  const customerAccessible = getAccessibleBusinessesForRole(
    { role: 'customer', subscriberId: 'removed_demo_customer', subscriberName: 'Removed Demo' },
    INITIAL_BUSINESSES
  );
  assert.equal(customerAccessible.length, 0);

  const merchantAccessible = getAccessibleBusinessesForRole(
    { role: 'subscriber', subscriberId: 'nonexistent_subscriber', businessId: INITIAL_BUSINESSES[0].id, subscriberName: 'Unlinked Preview' },
    INITIAL_BUSINESSES
  );
  assert.equal(merchantAccessible.length, 1);
  assert.equal(merchantAccessible[0].id, INITIAL_BUSINESSES[0].id);

  const adminAccessible = getAccessibleBusinessesForRole(
    { role: 'admin', subscriberName: 'Preview Admin' },
    INITIAL_BUSINESSES
  );
  assert.equal(adminAccessible.length, INITIAL_BUSINESSES.length);

  const custPerms = getRolePermissionsSummary('customer');
  assert.equal(custPerms.isCustomer, true);
  assert.equal(custPerms.canViewMerchantTools, false);
  assert.equal(custPerms.canAccessMerchantDashboard, false);
  assert.equal(custPerms.canAccessAdminDashboard, false);

  const merchantPerms = getRolePermissionsSummary('subscriber');
  assert.equal(merchantPerms.isMerchant, true);
  assert.equal(merchantPerms.canViewMerchantTools, true);
  assert.equal(merchantPerms.canAccessMerchantDashboard, true);
  assert.equal(merchantPerms.canSwitchBusinessesInDashboard, false);
  assert.equal(merchantPerms.canAccessAdminDashboard, false);

  const adminPerms = getRolePermissionsSummary('admin');
  assert.equal(adminPerms.isAdmin, true);
  assert.equal(adminPerms.canViewMerchantTools, true);
  assert.equal(adminPerms.canAccessAdminDashboard, true);
  assert.equal(adminPerms.canSwitchBusinessesInDashboard, true);

  const wallets = createInitialPlatformWallets(INITIAL_BUSINESSES, []);
  assert.equal(wallets.some((w) => String(w.id).startsWith('wallet_cust_')), false);
  for (const wallet of wallets) {
    assert.equal(wallet.availableBalance || 0, 0);
    assert.equal(wallet.pendingBalance || 0, 0);
    assert.equal(wallet.creditLimit || 0, 0);
    assert.equal(wallet.usedCredit || 0, 0);
    assert.equal(wallet.adGrantBalance || 0, 0);
    assert.equal(wallet.totalDeposited || 0, 0);
    assert.equal(wallet.totalSpentOnAds || 0, 0);
  }

  assert.equal(
    PLATFORM_OFFICIAL_LOGO_URL,
    '/assets/aistudio/9db84106-5e82-4728-8045-566110fcff3a_506a1bed.png'
  );
});""",
    "legacy demo identity and role test",
)
rules_test = rules_test.replace(
    "test('Adopted businesses have empty phone/WhatsApp until Admin edits, and each of the 15 sectors has 3x default images (12 per sector = 180 total)'",
    "test('Unverified directory businesses have no exposed phone/WhatsApp, and each sector has its default image set'",
)
rules_test = rules_test.replace(
    "// 1. All 26 adopted businesses are active & verified WITHOUT phone or WhatsApp numbers initially",
    "// 1. The 26 directory listings remain unverified and expose no owner phone or WhatsApp initially",
)
rules_test = rules_test.replace("    assert.equal(biz.isVerified, true);", "    assert.equal(biz.isVerified, false);")
rules_test = rules_test.replace("    assert.equal(biz.verificationStatus, 'verified');", "    assert.equal(biz.verificationStatus, 'unverified');")
write("src/utils/rules.test.ts", rules_test)

# Tests document the intentionally empty initial operational dataset.
test = read("src/utils/aiPixelCommissionEngine.test.ts")
if "assert.deepEqual(reports, []);" not in test:
    test = replace_once(
        test,
        "    assert.equal(reports.length, DEFAULT_PROMOTIONAL_SIGNAGE_BANNERS.length);\n"
        "    assert.ok(reports[0].roasMultiplier >= reports[reports.length - 1].roasMultiplier);\n"
        "    for (const r of reports) {\n"
        "      assert.ok(r.impressions > 0);\n"
        "      assert.ok(r.clicks > 0);\n"
        "      assert.ok(r.actualBookingsCount > 0);\n"
        "      assert.ok(r.revenueGeneratedEgp > 0);\n"
        "    }",
        "    assert.deepEqual(DEFAULT_PROMOTIONAL_SIGNAGE_BANNERS, []);\n"
        "    assert.deepEqual(INITIAL_META_PIXEL_EVENTS, []);\n"
        "    assert.deepEqual(reports, []);",
        "sample campaign analytics test",
    )
write("src/utils/aiPixelCommissionEngine.test.ts", test)
booking_test = read("src/utils/bookingPaymentEngine.test.ts")
if "assert.deepEqual(DEFAULT_PROMOTIONAL_SIGNAGE_BANNERS, []);" not in booking_test:
    booking_test = replace_once(
        booking_test,
        "    assert.ok(DEFAULT_PROMOTIONAL_SIGNAGE_BANNERS.length >= 4);",
        "    assert.deepEqual(DEFAULT_PROMOTIONAL_SIGNAGE_BANNERS, []);",
        "sample advertising fixture test",
    )
write("src/utils/bookingPaymentEngine.test.ts", booking_test)

# Final invariant checks.
ctx = read("src/context/AppContext.tsx")
rules = read("src/utils/rules.ts")
pixel = read("src/utils/aiPixelCommissionEngine.ts")
banners = read("src/utils/bookingPaymentEngine.ts")
assertions = {
    "Preview directory data cannot hydrate from browser storage": "if (IS_PREVIEW_MODE) return INITIAL_BUSINESSES.map(normalizeAdoptedBiz);" in ctx,
    "Preview catalogue data cannot hydrate from browser storage": "if (IS_PREVIEW_MODE) return resolveList(INITIAL_PRODUCTS);" in ctx,
    "Preview telemetry starts unmeasured": "IS_PREVIEW_MODE ? emptyTelemetryMetrics" in ctx,
    "sample grant record removed": "grant_seed_1" not in ctx,
    "sample ad banners removed": "sign_mega_1" not in ctx,
    "zero starting wallet values": "availableBalance: 48500" not in rules and "adGrantBalance: 999999" not in rules,
    "default Pixel disabled": "pixelId: '',\n  isEnabled: false" in pixel,
    "Pixel event history empty": "INITIAL_META_PIXEL_EVENTS: MetaPixelEventRecord[] = [];" in pixel,
    "HTML shell has no third-party Pixel": "1482950394857210" not in read("index.html") and "window.fbq" not in read("index.html"),
    "Preview README has no old demo credentials": "preview_customer" not in read("PREVIEW_README_AR.md") and "preview_provider" not in read("PREVIEW_README_AR.md"),
    "sample signage list empty": "DEFAULT_PROMOTIONAL_SIGNAGE_BANNERS: PromotionalSignageItem[] = [];" in banners,
}
failed = [name for name, passed in assertions.items() if not passed]
if failed:
    raise SystemExit("Clean-up verification failed: " + "; ".join(failed))

print("R6 clean-up pass completed: unreviewed directory metrics, stale browser snapshots, seeded wallets/grants, sample ads, telemetry, and unconfigured tracking defaults are cleared.")
