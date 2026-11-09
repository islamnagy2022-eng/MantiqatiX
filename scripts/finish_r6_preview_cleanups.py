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
    "sample signage list empty": "DEFAULT_PROMOTIONAL_SIGNAGE_BANNERS: PromotionalSignageItem[] = [];" in banners,
}
failed = [name for name, passed in assertions.items() if not passed]
if failed:
    raise SystemExit("Clean-up verification failed: " + "; ".join(failed))

print("R6 clean-up pass completed: unreviewed directory metrics, stale browser snapshots, seeded wallets/grants, sample ads, telemetry, and unconfigured tracking defaults are cleared.")
