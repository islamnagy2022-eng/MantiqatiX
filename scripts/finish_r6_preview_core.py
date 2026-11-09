#!/usr/bin/env python3
"""R6 mandatory clean-baseline pass: no demo identities or operational history."""
from pathlib import Path
import re
import sys

if len(sys.argv) != 2:
    raise SystemExit("usage: finish_r6_preview_core.py <extracted-app-directory>")
root = Path(sys.argv[1]).resolve()

def read(rel):
    p = root / rel
    if not p.is_file():
        raise SystemExit(f"Missing source file: {rel}")
    return p.read_text(encoding="utf-8")

def write(rel, data):
    (root / rel).write_text(data, encoding="utf-8")

def between(src, start, end, replacement, name):
    a = src.find(start)
    b = src.find(end, a + len(start)) if a >= 0 else -1
    if a < 0 or b < 0:
        raise SystemExit(f"Could not locate {name} boundaries")
    return src[:a] + replacement + src[b:]

def once(src, old, new, name):
    count = src.count(old)
    if count != 1:
        raise SystemExit(f"Expected one {name} anchor, found {count}")
    return src.replace(old, new, 1)

# Remove built-in account identities and hard-coded admin access.
seed = read("src/data/seedData.ts")
seed = seed.replace("  adminPassword: 'preview-only-admin',", "  adminPassword: '',")
if "INITIAL_SUBSCRIBERS: Subscriber[] = []" not in seed:
    seed, n = re.subn(r"export const INITIAL_SUBSCRIBERS: Subscriber\[\] = \[.*?\n\];", "export const INITIAL_SUBSCRIBERS: Subscriber[] = [];", seed, count=1, flags=re.S)
    if n != 1:
        raise SystemExit("Could not remove initial subscriber accounts")
write("src/data/seedData.ts", seed)

# Remove non-public owner/staff identities and obsolete billing/verification claims
# from the bundled public directory seed itself (not only from runtime copies).
seed = read("src/data/seedData.ts")
biz_start = seed.find("export const INITIAL_BUSINESSES: Business[] = [")
biz_end = seed.find("export const INITIAL_SUBSCRIBERS", biz_start)
if biz_start < 0 or biz_end < 0:
    raise SystemExit("Could not locate initial directory seed boundaries")
biz_block = seed[biz_start:biz_end]
# Remove staff identity arrays, preserving public listing metadata.
biz_block, employees_removed = re.subn(
    r"(?m)^\s*employees:\s*\[\s*\n.*?^\s*\],\s*\n",
    "",
    biz_block,
    flags=re.S,
)
# Replace sensitive or operational properties, leaving business name, description,
# public location, hours, media, category and catalog links intact.
safe_defaults = {
    "ownerWhatsApp": "''",
    "phone": "''",
    "email": "''",
    "ownerEmail": "''",
    "ownerSubscriberId": "''",
    "isVerified": "false",
    "verificationStatus": "'unverified'",
    "verificationBadgeLevel": "'none'",
    "subscriptionTier": "'free'",
    "sectorPackageLevel": "1",
    "maxAllowedBusinesses": "1",
    "monthlySubscriptionFee": "0",
    "paymentDueDay": "0",
    "paymentDueDate": "''",
    "paymentStatus": "'pending'",
    "overdueDaysCount": "0",
    "paymentConfirmedByAdmin": "false",
    "lastPaymentDate": "undefined",
    "creditLimit": "0",
    "usedCreditBalance": "0",
    "totalSalesAmount": "0",
    "totalServicesSalesAmount": "0",
    "totalOrdersCount": "0",
    "viewsCount": "0",
}
for prop, value in safe_defaults.items():
    biz_block = re.sub(
        rf"(?m)^(\s*){re.escape(prop)}:\s*.*?,\s*$",
        rf"\1{prop}: {value},",
        biz_block,
    )
biz_block = re.sub(
    r"(?m)^(\s*)paymobConfig:\s*.*?,\s*$",
    r"\1paymobConfig: { ...DEFAULT_PAYMOB_CONFIG, enabled: false, merchantApiKey: '' },",
    biz_block,
)
seed = seed[:biz_start] + biz_block + seed[biz_end:]
write("src/data/seedData.ts", seed)

rules = read("src/utils/rules.ts")
if "DEMO_CUSTOMER_ACCOUNTS: DemoCustomerAccount[] = []" not in rules:
    rules, n = re.subn(r"export const DEMO_CUSTOMER_ACCOUNTS: DemoCustomerAccount\[\] = \[.*?\n\];", "export const DEMO_CUSTOMER_ACCOUNTS: DemoCustomerAccount[] = [];", rules, count=1, flags=re.S)
    if n != 1:
        raise SystemExit("Could not remove bundled customer demo credentials")
write("src/utils/rules.ts", rules)

# Keep the initial database free of demo users and operational history.
server = read("server.ts")
clean_initial_builder = r'''function buildCleanInitialDb(schemaVersion: string): Record<string, any> {
  const businesses: Business[] = INITIAL_BUSINESSES.map((b): Business => {
    const imgs = ensureBusinessStaticImages(b.logoUrl, b.coverUrl, b.functionalGroupId);
    return {
      ...b, ownerWhatsApp: '', phone: '', email: '', ownerEmail: '', ownerSubscriberId: '',
      employees: [], adminApprovedPhone: false, subscriptionTier: 'free', sectorPackageLevel: 1,
      maxAllowedBusinesses: 1, monthlySubscriptionFee: 0, paymentDueDay: 0, paymentDueDate: '',
      lastPaymentDate: undefined, consultationFee: 0,
      customLinks: (b.customLinks || []).filter((l) => l.type === 'link'),
      logoUrl: imgs.logoUrl, coverUrl: imgs.coverUrl,
      isVerified: false, verificationStatus: 'unverified', isFrozen: false,
      paymentStatus: 'pending', paymentConfirmedByAdmin: false, overdueDaysCount: 0,
      totalSalesAmount: 0, totalServicesSalesAmount: 0, totalOrdersCount: 0, viewsCount: 0,
      creditLimit: 0, usedCreditBalance: 0, commissionType: 'subscription_only',
      commissionPercentage: 0, commissionFixed: 0, commissionFixedPerItem: 0, commissionPerOrder: 0,
      paymobConfig: { ...(b.paymobConfig || {}), enabled: false, merchantApiKey: '' },
    };
  });
  const products = INITIAL_PRODUCTS.map((p) => {
    const owner = businesses.find((b) => b.id === p.businessId);
    return { ...p, imageUrl: resolveProductImage(p, owner?.functionalGroupId) };
  });
  const adminSettings = {
    ...INITIAL_ADMIN_SETTINGS, adminPassword: '', adminWhatsApp: '',
    siteVisitorsCount: 0, todayVisitorsCount: 0, aiStudioApiKey: '',
    defaultPaymobFeePercentage: 0, defaultPaymobFeeFixed: 0,
  };
  return {
    schemaVersion, isOfficialProduction: false,
    committedAt: new Date().toISOString(), businesses, products, adminSettings,
    subscribers: [], salesRecords: [], adRequests: [], contactMessages: [],
    subscriptionRequests: [], wallets: [], walletTransactions: [], generatedCampaigns: [],
    memberDirectMessages: [], mantygoRequests: [], mantygoCustomChannels: [], paymentIntents: [],
    autoRenewBusinessIds: [], billingSweepLogs: [], mediaAssets: [], whatsappDispatches: [],
    securityAuditLogs: [], backupRecords: [],
  };
}

function buildDefaultProductionDb(): Record<string, any> {
  return buildCleanInitialDb(CURRENT_SCHEMA_VERSION);
}

function buildDefaultPreviewDb(): Record<string, any> {
  return buildCleanInitialDb(PREVIEW_SCHEMA_VERSION);
}'''
server = between(server, "function buildDefaultProductionDb(): Record<string, any> {", "function sanitizeSerializedDbJson(jsonStr: string): string {", clean_initial_builder, "clean production and Preview database builders")
write("server.ts", server)

# Make Preview state independent from production/browser snapshots and start with no users or transactions.
ctx = read("src/context/AppContext.tsx")
if "const IS_PREVIEW_MODE = import.meta.env.VITE_PREVIEW_MODE === 'true';" not in ctx:
    ctx = once(ctx, "import { appStorage } from '../utils/appStorage';", "import { appStorage } from '../utils/appStorage';\n\nconst IS_PREVIEW_MODE = import.meta.env.VITE_PREVIEW_MODE === 'true';", "Preview mode flag")
if "if (IS_PREVIEW_MODE) return [];" not in ctx[ctx.find("const [subscribers"):ctx.find("const [subscribers") + 250]:
    ctx = between(ctx, "  const [subscribers, setSubscribers] = useState<Subscriber[]>(() => {", "  const addSaleRecord =", '''  const [subscribers, setSubscribers] = useState<Subscriber[]>(() => {
    if (IS_PREVIEW_MODE) return [];
    try { const saved = appStorage.getItem(STORAGE_KEYS.SUBSCRIBERS); return saved ? JSON.parse(saved) : INITIAL_SUBSCRIBERS; }
    catch { return INITIAL_SUBSCRIBERS; }
  });
  const [salesRecords, setSalesRecords] = useState<SaleRecord[]>(() => {
    if (IS_PREVIEW_MODE) return [];
    try { const saved = appStorage.getItem(STORAGE_KEYS.SALES); return saved ? JSON.parse(saved) : INITIAL_SALES_RECORDS; }
    catch { return INITIAL_SALES_RECORDS; }
  });

''', "subscriber/sales state")
for marker, name in [
    ("  const [adRequests, setAdRequests] = useState<AdRequest[]>(() => {", "ad request state"),
    ("  const [contactMessages, setContactMessages] = useState<ContactMessage[]>(() => {", "contact message state"),
    ("  const [subscriptionRequests, setSubscriptionRequests] = useState<SubscriptionRequest[]>(() => {", "subscription request state"),
]:
    idx = ctx.find(marker)
    if idx < 0:
        raise SystemExit(f"Missing {name}")
    if "if (IS_PREVIEW_MODE) return [];" not in ctx[idx:idx+200]:
        ctx = ctx.replace(marker, marker + "\n    if (IS_PREVIEW_MODE) return [];", 1)
if "  const [wallets, setWallets]" in ctx and "if (IS_PREVIEW_MODE) return [];" not in ctx[ctx.find("const [wallets"):ctx.find("const [wallets")+250]:
    ctx = between(ctx, "  const [wallets, setWallets] = useState<WalletAccount[]>(() => {", "  const [activeWalletId, setActiveWalletId", '''  const [wallets, setWallets] = useState<WalletAccount[]>(() => {
    if (IS_PREVIEW_MODE) return [];
    try { const saved = appStorage.getItem(STORAGE_KEYS.WALLETS); return saved ? JSON.parse(saved) : []; }
    catch { return []; }
  });
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>(() => {
    if (IS_PREVIEW_MODE) return [];
    try { const saved = appStorage.getItem(STORAGE_KEYS.WALLET_TXS); return saved ? JSON.parse(saved) : []; }
    catch { return []; }
  });

''', "wallet and ledger state")
if "const [generatedCampaigns" in ctx and "if (IS_PREVIEW_MODE) return [];" not in ctx[ctx.find("const [generatedCampaigns"):ctx.find("const [generatedCampaigns")+250]:
    ctx = between(ctx, "  const [generatedCampaigns, setGeneratedCampaigns] = useState<GeneratedMarketingCampaign[]>(() => {", "  const commitCurrentDataAsOfficialLive =", '''  const [generatedCampaigns, setGeneratedCampaigns] = useState<GeneratedMarketingCampaign[]>(() => {
    if (IS_PREVIEW_MODE) return [];
    try { const saved = appStorage.getItem(STORAGE_KEYS.CAMPAIGNS); return saved ? JSON.parse(saved) : []; }
    catch { return []; }
  });

''', "generated campaign state")
if "const [memberDirectMessages" in ctx and "if (IS_PREVIEW_MODE) return [];" not in ctx[ctx.find("const [memberDirectMessages"):ctx.find("const [memberDirectMessages")+250]:
    ctx = between(ctx, "  const [memberDirectMessages, setMemberDirectMessages] = useState<MemberDirectMessage[]>(() => {", "  useEffect(() => {\n    try {\n      appStorage.setItem(STORAGE_KEYS.MEMBER_MESSAGES", '''  const [memberDirectMessages, setMemberDirectMessages] = useState<MemberDirectMessage[]>(() => {
    if (IS_PREVIEW_MODE) return [];
    try { const saved = appStorage.getItem(STORAGE_KEYS.MEMBER_MESSAGES); return saved ? JSON.parse(saved) : []; }
    catch { return []; }
  });

''', "member messages state")
ctx = ctx.replace("  const [authSession, setAuthSession] = useState<AuthSession>(() => {\n    try {", "  const [authSession, setAuthSession] = useState<AuthSession>(() => {\n    if (IS_PREVIEW_MODE) return { role: 'guest' };\n    try {", 1)
if "if (IS_PREVIEW_MODE) return { ...INITIAL_ADMIN_SETTINGS" not in ctx:
    ctx = ctx.replace("  const [adminSettings, setAdminSettings] = useState<AdminSettings>(() => {\n    try {", "  const [adminSettings, setAdminSettings] = useState<AdminSettings>(() => {\n    if (IS_PREVIEW_MODE) return { ...INITIAL_ADMIN_SETTINGS, adminPassword: '', adminWhatsApp: '', siteVisitorsCount: 0, todayVisitorsCount: 0, aiStudioApiKey: '', defaultPaymobFeePercentage: 0, defaultPaymobFeeFixed: 0, functionalGroups: DEFAULT_FUNCTIONAL_GROUPS, siteMapConfig: { ...DEFAULT_SITE_MAP_CONFIG, developmentProgressPercent: 0, developmentStatusTitle: 'نسخة تجريبية منفصلة — غير معتمدة للإنتاج' } };\n    try {", 1)
ctx = ctx.replace("  const [merchantNotifications, setMerchantNotifications] = useState<MerchantToastNotification[]>(() => {\n    return [", "  const [merchantNotifications, setMerchantNotifications] = useState<MerchantToastNotification[]>(() => {\n    if (IS_PREVIEW_MODE) return [];\n    return [", 1)
for sig in [
    "  const loginAsCustomer = (identifier: string, passwordInput: string = 'preview-only') => {",
    "  const loginAsSubscriber = (identifier: string, passwordInput: string) => {",
    "  const loginAsAdmin = (passwordInput: string) => {",
]:
    if sig not in ctx:
        raise SystemExit("Missing expected local password login handler: " + sig)
    if "if (IS_PREVIEW_MODE) return { success: false" not in ctx[ctx.find(sig):ctx.find(sig)+280]:
        ctx = ctx.replace(sig, sig + "\n    if (IS_PREVIEW_MODE) return { success: false, error: 'تسجيل الدخول غير متاح في نسخة المعاينة. استخدم الدليل العام فقط.' };", 1)
ctx = ctx.replace("'preview-only'", "''")
write("src/context/AppContext.tsx", ctx)

# Replace/disable demo sign-in controls in the UI.
for rel in ["src/App.tsx", "src/components/Navbar.tsx", "src/components/auth/LoginModal.tsx", "src/components/auth/UserProfileModal.tsx"]:
    ui = read(rel)
    for token in ["'preview_customer'", "'preview_provider'", "'preview-only-admin'", "'preview-only'"]:
        ui = ui.replace(token, "''")
    ui = ui.replace("useState('admin')", "useState('')")
    ui = ui.replace("كل الحسابات التجريبية", "الدخول غير متاح في المعاينة")
    write(rel, ui)
login = read("src/components/auth/LoginModal.tsx")
if "نسخة معاينة عامة" not in login:
    login = once(login, "  if (!isLoginModalOpen) return null;", "  if (!isLoginModalOpen) return null;\n  if (import.meta.env.VITE_PREVIEW_MODE === 'true') return (\n    <div className=\"fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4\" dir=\"rtl\">\n      <div className=\"max-w-md w-full rounded-2xl bg-white p-6 text-center shadow-2xl\">\n        <h3 className=\"text-lg font-black text-slate-900\">نسخة معاينة عامة</h3>\n        <p className=\"mt-3 text-sm leading-7 text-slate-600\">تسجيل الدخول ولوحات الإدارة معطلة في بيئة الاختبار. يمكنك تصفح الأنشطة والكتالوج فقط.</p>\n        <button type=\"button\" onClick={() => setIsLoginModalOpen(false)} className=\"mt-5 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white\">إغلاق</button>\n      </div>\n    </div>\n  );", "read-only Preview login modal")
write("src/components/auth/LoginModal.tsx", login)
nav = read("src/components/Navbar.tsx")
if "VITE_PREVIEW_MODE !== 'true'" not in nav:
    nav = once(nav, '          <div className="flex items-center gap-1.5 flex-wrap">', '          {import.meta.env.VITE_PREVIEW_MODE !== \'true\' && (\n          <div className="flex items-center gap-1.5 flex-wrap">', "role-testing bar start")
    nav = once(nav, '          </div>\n\n          <div className="flex items-center gap-2.5 flex-wrap">', '          </div>\n          )}\n\n          <div className="flex items-center gap-2.5 flex-wrap">', "role-testing bar end")
write("src/components/Navbar.tsx", nav)

# Locked Bun install; minimal non-root runtime image.
dockerfile = """FROM oven/bun:1.4.4-debian AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
ENV VITE_PREVIEW_MODE=true
RUN bun run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PREVIEW_MODE=true VITE_PREVIEW_MODE=true DISABLE_HMR=true PORT=8080
COPY --chown=node:node --from=build /app/package.json ./package.json
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/server.ts ./server.ts
COPY --chown=node:node --from=build /app/src ./src
COPY --chown=node:node --from=build /app/dist ./dist
RUN mkdir -p /app/.data-preview && chown -R node:node /app
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:8080/api/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"]
CMD ["./node_modules/.bin/tsx", "server.ts"]
"""
write("Dockerfile", dockerfile)
write(".dockerignore", """.git
node_modules
dist
.data
.data/
.data-preview
.data-preview/
.aistudio
.aistudio/
.env
.env.*
*.log
coverage
""")

# Verify core release invariants before the secondary cleanup pass continues.
seed = read("src/data/seedData.ts")
rules = read("src/utils/rules.ts")
server = read("server.ts")
ctx = read("src/context/AppContext.tsx")
assertions = {
    "no initial subscriber accounts": "INITIAL_SUBSCRIBERS: Subscriber[] = [];" in seed,
    "no bundled customer demo accounts": "DEMO_CUSTOMER_ACCOUNTS: DemoCustomerAccount[] = [];" in rules,
    "server starts with empty operations": "subscribers: []," in server and "walletTransactions: []," in server and "backupRecords: []," in server,
    "server seed factories contain no demo ledger rows": "tx_seed_" not in server and "mmsg_seed_" not in server,
    "Preview visitor session only": "if (IS_PREVIEW_MODE) return { role: 'guest' };" in ctx,
    "all local password handlers denied": ctx.count("if (IS_PREVIEW_MODE) return { success: false") >= 3,
    "Preview sales/subscriber state empty": ctx.count("if (IS_PREVIEW_MODE) return [];") >= 5,
    "Preview local role testing hidden": "VITE_PREVIEW_MODE !== 'true'" in read("src/components/Navbar.tsx"),
    "Preview login modal gated": "نسخة معاينة عامة" in read("src/components/auth/LoginModal.tsx"),
}
failed = [name for name, ok in assertions.items() if not ok]
if failed:
    raise SystemExit("Core Preview sanitation failed: " + "; ".join(failed))
print("R6 core sanitation complete: no demo users, local passwords, fake operational snapshots or password-login path remains in Preview.")
