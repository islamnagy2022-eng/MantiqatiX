#!/usr/bin/env python3
from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit("usage: harden_r6_preview.py <extracted-app-directory>")
root = Path(sys.argv[1]).resolve()
server, app, context, seed = (
    root / "server.ts",
    root / "src/App.tsx",
    root / "src/context/AppContext.tsx",
    root / "src/data/seedData.ts",
)
for p in (server, app, context, seed):
    if not p.is_file():
        raise SystemExit(f"Required source file missing: {p}")

source = server.read_text(encoding="utf-8")
if "PREVIEW_ALLOWED_API_PATHS" not in source:
    anchor = "  const app = express();\n  app.use(express.json({ limit: '25mb' }));\n"
    if anchor not in source:
        raise SystemExit("Express bootstrap anchor changed; refusing partial patch.")
    hardened = """  const app = express();
  app.use(express.json({ limit: PREVIEW_MODE ? '1mb' : '25mb' }));

  if (PREVIEW_MODE) {
    app.disable('x-powered-by');
    app.use((_req, res, next) => {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Cache-Control', 'no-store');
      next();
    });
    const PREVIEW_ALLOWED_API_PATHS = new Set(['/health', '/businesses', '/products']);
    const previewRateWindows = new Map<string, { startedAt: number; count: number }>();
    app.use('/api', (req, res, next) => {
      const now = Date.now();
      const ip = req.socket.remoteAddress || 'unknown';
      const window = previewRateWindows.get(ip);
      if (!window || now - window.startedAt >= 60_000) {
        previewRateWindows.set(ip, { startedAt: now, count: 1 });
      } else {
        window.count += 1;
        if (window.count > 180) {
          return res.status(429).json({ success: false, previewOnly: true, error: 'Preview request limit reached.' });
        }
      }
      if (previewRateWindows.size > 5000) {
        for (const [key, value] of previewRateWindows) {
          if (now - value.startedAt >= 60_000) previewRateWindows.delete(key);
        }
      }
      if (req.method === 'GET' && PREVIEW_ALLOWED_API_PATHS.has(req.path)) return next();
      return res.status(503).json({
        success: false, previewOnly: true, readOnly: true,
        error: 'هذا الرابط للمعاينة فقط. عمليات الكتابة والبيانات الإدارية معطلة.',
      });
    });
  }
"""
    source = source.replace(anchor, hardened, 1)
source = source.replace(
    "      isVerified: true,\n      verificationStatus: 'verified',",
    "      isVerified: PREVIEW_MODE ? false : true,\n      verificationStatus: PREVIEW_MODE ? 'unverified' : 'verified',",
    1,
)
health_label = "      backend: 'MantiqaTix Production Backend Engine',"
preview_health_label = "      backend: PREVIEW_MODE ? 'MantiqaTix Isolated Preview Backend' : 'MantiqaTix Production Backend Engine',"
if health_label in source:
    if source.count(health_label) != 1:
        raise SystemExit("Unexpected health backend label count; refusing ambiguous patch.")
    source = source.replace(health_label, preview_health_label, 1)
elif preview_health_label not in source:
    raise SystemExit("Health backend label anchor changed; refusing an unverified Preview label.")
server.write_text(source, encoding="utf-8")

source = seed.read_text(encoding="utf-8")
source = source.replace(
    "developmentStatusTitle: 'حالة التشغيل الفعلي للمنصة (النسخة الحقيقية المعتمدة 100%)',",
    "developmentStatusTitle: 'نسخة تجريبية منفصلة قيد المراجعة — غير معتمدة للإنتاج',",
)
source = source.replace("developmentProgressPercent: 100,", "developmentProgressPercent: 0,")
source = source.replace(
    "developmentPhaseLabel: 'التشغيل الفعلي الكامل — جميع البيانات الحالية والـ 15 قطاعاً معتمدة كبيانات فعلية رسمية',",
    "developmentPhaseLabel: 'بيئة Preview لاختبار الواجهات والكتالوج — لا تمثل اعتماداً تشغيلياً أو مالياً',",
)
source = source.replace(
    "developmentNotes:\n    'تم اعتماد كافة البيانات الحالية كبيانات فعلية رسمية بالنسخة الحقيقية للمنصة، وتفعيل كافة الـ 15 قطاعاً رئيسياً بالواجهة الرئيسية بباقات الـ 3 مستويات، وربط الدليل المجاني والأنشطة الموثقة ونظام المحفظة والرسائل والإعلانات الممولة.',",
    "developmentNotes:\n    'هذه نسخة تجريبية معزولة. بيانات الدليل والكتالوج مأخوذة من حزمة المصدر وتحتاج مراجعة واعتماداً مستقلاً قبل عرضها كبيانات موثقة أو تشغيل أي معاملات فعلية.',",
)
seed.write_text(source, encoding="utf-8")

source = context.read_text(encoding="utf-8")
if "const IS_PREVIEW_MODE = import.meta.env.VITE_PREVIEW_MODE === 'true';" not in source:
    source = source.replace(
        "import { appStorage } from '../utils/appStorage';",
        "import { appStorage } from '../utils/appStorage';\n\nconst IS_PREVIEW_MODE = import.meta.env.VITE_PREVIEW_MODE === 'true';",
        1,
    )
source = source.replace(
    "developmentProgressPercent: 100,\n            developmentStatusTitle: 'حالة التشغيل الفعلي للمنصة (النسخة الحقيقية المعتمدة 100%)',",
    "developmentProgressPercent: IS_PREVIEW_MODE ? 0 : 100,\n            developmentStatusTitle: IS_PREVIEW_MODE\n              ? 'نسخة تجريبية منفصلة قيد المراجعة — غير معتمدة للإنتاج'\n              : 'حالة التشغيل الفعلي للمنصة (النسخة الحقيقية المعتمدة 100%)',",
    1,
)
context.write_text(source, encoding="utf-8")

source = app.read_text(encoding="utf-8")
if "MANTIQATIX_PREVIEW_NOTICE" not in source:
    marker = '    <div className="min-h-screen flex flex-col bg-slate-50/70 text-slate-800">'
    notice = """    <div className="min-h-screen flex flex-col bg-slate-50/70 text-slate-800">
      {import.meta.env.VITE_PREVIEW_MODE === 'true' && (
        <div role="status" aria-label="MANTIQATIX_PREVIEW_NOTICE"
          className="w-full bg-amber-100 text-amber-950 border-b border-amber-300 px-3 py-2 text-center text-xs sm:text-sm font-bold"
          dir="rtl">
          بيئة تجريبية معزولة — لا توجد معاملات حقيقية — التعديلات محلية على متصفحك فقط ولا تُحفظ على الخادم
        </div>
      )}"""
    if marker not in source:
        raise SystemExit("App root marker changed; refusing partial notice patch.")
    source = source.replace(marker, notice, 1)
app.write_text(source, encoding="utf-8")

docker = root / "Dockerfile"
if docker.is_file():
    source = docker.read_text(encoding="utf-8")
    if "HEALTHCHECK" not in source:
        source += '\nHEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 CMD ["node", "-e", "fetch(\\\'http://127.0.0.1:8080/api/health\\\').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"]\n'
        docker.write_text(source, encoding="utf-8")

if "PREVIEW_ALLOWED_API_PATHS" not in server.read_text(encoding="utf-8"):
    raise SystemExit("Preview API isolation guard verification failed.")
if "MANTIQATIX_PREVIEW_NOTICE" not in app.read_text(encoding="utf-8"):
    raise SystemExit("Preview notice verification failed.")
print("R6 preview hardening applied and verified.")
