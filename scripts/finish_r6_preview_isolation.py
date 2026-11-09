#!/usr/bin/env python3
"""Final browser-side data isolation for the public R6 preview."""
from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit("usage: finish_r6_preview_isolation.py <extracted-app-directory>")
root = Path(sys.argv[1]).resolve()
ctx_path = root / "src/context/AppContext.tsx"
seed_path = root / "src/data/seedData.ts"
main_path = root / "src/main.tsx"
server_path = root / "server.ts"
for p in (ctx_path, seed_path, main_path, server_path):
    if not p.is_file():
        raise SystemExit(f"Required file missing: {p}")

ctx = ctx_path.read_text(encoding="utf-8")
if "const seededWallets = createInitialPlatformWallets" not in ctx:
    old = "    const defaultWallets = createInitialPlatformWallets(INITIAL_BUSINESSES, INITIAL_SUBSCRIBERS);"
    new = """    const seededWallets = createInitialPlatformWallets(INITIAL_BUSINESSES, INITIAL_SUBSCRIBERS);
    const defaultWallets = IS_PREVIEW_MODE
      ? seededWallets.map((w) => ({ ...w, availableBalance: 0, pendingBalance: 0, creditLimit: 0, usedCredit: 0, adGrantBalance: 0, totalDeposited: 0, totalSpentOnAds: 0 }))
      : seededWallets;"""
    if old not in ctx:
        raise SystemExit("Wallet initializer changed; refusing a partial patch.")
    ctx = ctx.replace(old, new, 1)
if "const safeParsed = IS_PREVIEW_MODE" not in ctx:
    old = """          const existingIds = new Set(parsed.map((w) => w.id));
          const missingWallets = defaultWallets.filter((w) => !existingIds.has(w.id));
          return [...parsed, ...missingWallets];"""
    new = """          const safeParsed = IS_PREVIEW_MODE ? parsed.map((w) => ({ ...w, availableBalance: 0, pendingBalance: 0, creditLimit: 0, usedCredit: 0, adGrantBalance: 0, totalDeposited: 0, totalSpentOnAds: 0 })) : parsed;
          const existingIds = new Set(safeParsed.map((w) => w.id));
          const missingWallets = defaultWallets.filter((w) => !existingIds.has(w.id));
          return [...safeParsed, ...missingWallets];"""
    if old not in ctx:
        raise SystemExit("Saved wallet initializer changed; refusing a partial patch.")
    ctx = ctx.replace(old, new, 1)
wallet_marker = "  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>(() => {\n    try {"
if "const [walletTransactions" in ctx and "setWalletTransactions" in ctx and "if (IS_PREVIEW_MODE) return [];" not in ctx[ctx.find("const [walletTransactions"):ctx.find("const [walletTransactions")+300]:
    if wallet_marker not in ctx:
        raise SystemExit("Wallet transaction initializer changed; refusing a partial patch.")
    ctx = ctx.replace(wallet_marker, wallet_marker.replace("\n    try {", "\n    if (IS_PREVIEW_MODE) return [];\n    try {"), 1)
sales_marker = "  const [salesRecords, setSalesRecords] = useState<SaleRecord[]>(() => {\n    try {"
if sales_marker in ctx and "if (IS_PREVIEW_MODE) return [];" not in ctx[ctx.find("const [salesRecords"):ctx.find("const [salesRecords")+250]:
    ctx = ctx.replace(sales_marker, sales_marker.replace("\n    try {", "\n    if (IS_PREVIEW_MODE) return [];\n    try {"), 1)
business_old = """        isVerified: true,
        verificationStatus: 'verified',
        isFrozen: false,
        paymentStatus: IS_PREVIEW_MODE ? 'pending' : 'paid',"""
business_new = """        isVerified: IS_PREVIEW_MODE ? false : true,
        verificationStatus: IS_PREVIEW_MODE ? 'unverified' : 'verified',
        isFrozen: false,
        paymentStatus: IS_PREVIEW_MODE ? 'pending' : 'paid',
        creditLimit: IS_PREVIEW_MODE ? 0 : b.creditLimit,
        usedCreditBalance: IS_PREVIEW_MODE ? 0 : b.usedCreditBalance,
        totalSalesAmount: IS_PREVIEW_MODE ? 0 : b.totalSalesAmount,
        totalServicesSalesAmount: IS_PREVIEW_MODE ? 0 : b.totalServicesSalesAmount,
        totalOrdersCount: IS_PREVIEW_MODE ? 0 : b.totalOrdersCount,
        viewsCount: IS_PREVIEW_MODE ? 0 : b.viewsCount,"""
if business_new not in ctx and business_old in ctx:
    ctx = ctx.replace(business_old, business_new, 1)
ctx_path.write_text(ctx, encoding="utf-8")

seed = seed_path.read_text(encoding="utf-8")
seed = seed.replace("  heroTitle: 'خريطة الموقع ودليل العمل الرسمي المعتمد لمنصة MantiqaTix',", "  heroTitle: 'دليل الأنشطة والخدمات — MantiqaTix',")
seed = seed.replace("    'النسخة التشغيلية الحقيقية المعتمدة التي تجمع 15 قطاعاً اقتصادياً وخدمياً في مصر ببيانات فعلية حية، كتالوجات مستقلة، طلبات واتساب فورية، ودفع إلكتروني ذكي.',", "    'استكشف الأنشطة والخدمات والكتالوجات في نسخة تجريبية منفصلة. بيانات الدليل مأخوذة من حزمة المصدر وتخضع للمراجعة قبل اعتمادها.',")
seed_path.write_text(seed, encoding="utf-8")

main = main_path.read_text(encoding="utf-8")
old = "if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {"
new = "if (import.meta.env.VITE_PREVIEW_MODE !== 'true' && typeof window !== 'undefined' && 'serviceWorker' in navigator) {"
if new not in main:
    if old not in main:
        raise SystemExit("Service worker registration anchor changed; refusing a partial patch.")
    main = main.replace(old, new, 1)
main_path.write_text(main, encoding="utf-8")

server = server_path.read_text(encoding="utf-8")
if "      creditLimit: 0,\n      usedCreditBalance: 0," not in server:
    server = server.replace("      totalOrdersCount: 0,\n      viewsCount: 0,", "      totalOrdersCount: 0,\n      viewsCount: 0,\n      creditLimit: 0,\n      usedCreditBalance: 0,", 1)
server_path.write_text(server, encoding="utf-8")

checks = [
    "const seededWallets = createInitialPlatformWallets" in ctx,
    "const safeParsed = IS_PREVIEW_MODE" in ctx,
    "const [walletTransactions" in ctx and "if (IS_PREVIEW_MODE) return [];" in ctx[ctx.find("const [walletTransactions"):ctx.find("const [walletTransactions")+300],
    "const [salesRecords" in ctx and "if (IS_PREVIEW_MODE) return [];" in ctx[ctx.find("const [salesRecords"):ctx.find("const [salesRecords")+250],
    "VITE_PREVIEW_MODE !== 'true'" in main,
]
if not all(checks):
    raise SystemExit("Preview browser/financial isolation verification failed.")
print("Preview financial and client isolation applied and verified.")
