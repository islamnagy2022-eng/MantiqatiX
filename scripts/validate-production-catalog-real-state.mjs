import fs from 'node:fs';
import assert from 'node:assert/strict';

const admin = fs.readFileSync('apps/catalog-frontend/src/components/admin/AdminDashboard.tsx', 'utf8');
const context = fs.readFileSync('apps/catalog-frontend/src/context/AppContext.tsx', 'utf8');
const productionMapper = fs.readFileSync('apps/catalog-frontend/src/lib/production.ts', 'utf8');
const backend = fs.readFileSync('supabase/functions/catalog-platform-admin/index.ts', 'utf8');
const defaults = fs.readFileSync('apps/catalog-frontend/src/data/productionDefaults.ts', 'utf8');
const publicConfig = fs.readFileSync('apps/catalog-frontend/public/config.js', 'utf8');
const webConfig = fs.readFileSync('web/config.js', 'utf8');
const directory = fs.readFileSync('apps/catalog-frontend/src/components/DirectoryView.tsx', 'utf8');
const placeholder = fs.readFileSync('apps/catalog-frontend/public/business-placeholder.svg', 'utf8');
const itemPlaceholder = fs.readFileSync('apps/catalog-frontend/public/catalog-item-placeholder.svg', 'utf8');
const defaultImages = fs.readFileSync('apps/catalog-frontend/src/utils/defaultImages.ts', 'utf8');
const storefrontHeader = fs.readFileSync('apps/catalog-frontend/src/components/storefront/BusinessProfileHeader.tsx', 'utf8');
const storefrontCatalog = fs.readFileSync('apps/catalog-frontend/src/components/storefront/CatalogSection.tsx', 'utf8');
const merchantDashboard = fs.readFileSync('apps/catalog-frontend/src/components/merchant/MerchantDashboard.tsx', 'utf8');
const catalogAdminFunction = fs.readFileSync('supabase/functions/catalog-admin/index.ts', 'utf8');
const publicDirectoryFunction = fs.readFileSync('supabase/functions/public-catalog-directory/index.ts', 'utf8');
const publicCatalogFunction = fs.readFileSync('supabase/functions/public-catalog/index.ts', 'utf8');
const sharedDefaultImages = fs.readFileSync('supabase/functions/_shared/default-images.ts', 'utf8');
const adminStart = admin.indexOf('const handleAddBusiness');
const adminEnd = admin.indexOf('const handleCreateCategory', adminStart);
assert.ok(adminStart >= 0 && adminEnd > adminStart, 'business creation handler must exist');
const createUi = admin.slice(adminStart, adminEnd);

assert.doesNotMatch(admin, /adminPassInput|كلمة مرور لوحة الإدارة العامة/, 'admin settings must not expose a fake password field');
assert.doesNotMatch([defaults, publicConfig, webConfig].join('\n'), /201010171770/, 'runtime configuration must not ship a fabricated support WhatsApp number');
assert.match(defaults, /adminWhatsApp: ''/, 'platform support contact must remain unconfigured until a real number is saved');
assert.match(defaults, /defaultCommissionPerOrder: 0/, 'unverified commission must not have a fabricated default');
assert.doesNotMatch(admin, /اشتراك شهري ثابت|0\.01 جنيه|متبقي \{5 - biz\.overdueDaysCount\}/, 'admin billing UI must not fabricate a fixed plan or an automatic overdue countdown');
assert.match(admin, /isOfficialShowcase \? 'عرض رسمي معفى من رسوم الاشتراك'/, 'official showcase exemption must be distinguished from paid subscriptions');
assert.match(admin, /غير متاح في الإصدار الحالي/, 'unverified online payment controls must be clearly disabled');
assert.doesNotMatch(admin, /handleSavePaymobConfig|paymobMerchantApiKey|Integration ID|تفعيل Paymob/, 'admin UI must not collect gateway credentials or offer fake Paymob activation');
assert.match(productionMapper, /isOfficialShowcase: officialShowcase/, 'official platform showcase records must be mapped explicitly');
assert.match(productionMapper, /paymentDueDay: Number\(meta\.paymentDueDay \|\| 0\)/, 'missing due day must remain unset instead of defaulting to day one');
assert.match(productionMapper, /paymentDueDate: String\(meta\.paymentDueDate \|\| ''\)/, 'missing due date must remain unset instead of using registration date');
assert.match(productionMapper, /paymentGracePeriodDays: Number\(meta\.paymentGracePeriodDays \?\? 0\)/, 'configured payment grace period must survive production normalization');
assert.doesNotMatch(admin, /advanceBusinessOverdueDay|\+يوم تأخير|محاكاة مرور يوم تأخير/, 'production admin must not simulate overdue days');
assert.doesNotMatch(createUi, /images\.unsplash\.com|\+201000000000|نشاط تجاري معتمد مسجل/, 'new businesses must not receive fake imagery, phone numbers, or descriptions');
assert.doesNotMatch(directory, /إعلان عام #1|إعلان إقليمي #5|احجز هذه المساحة الإعلانية/, 'directory hero must not publish fabricated advertisement slides');
assert.doesNotMatch(directory, /201010171770|photo-1501339847302-ac426a4a7cbb|photo-1509785307050-d4066910ec1e/, 'directory must not fall back to a fabricated phone number or stock business images');
assert.match(directory, /businesses[\s\S]{0,180}publicEnabled/, 'directory hero slides must be built from real published business records');
assert.match(directory, /business-placeholder\.svg/, 'missing business images must use the neutral local placeholder');
assert.match(placeholder, /صورة النشاط غير متاحة/, 'placeholder must disclose that no real business image was provided');
assert.match(itemPlaceholder, /صورة المنتج أو الخدمة غير متاحة/, 'catalog items without owner images must use a neutral placeholder');
assert.doesNotMatch(defaultImages, /images\.unsplash\.com|PHOTO_RULES/, 'missing owner images must not be replaced by stock photos that could be mistaken for real catalog imagery');
assert.match(defaultImages, /catalog-item-placeholder\.svg/, 'products and services must use the local neutral placeholder');
assert.match(productionMapper, /const isStockImageUrl/, 'production mapper must identify legacy stock-image URLs');
assert.ok(
  productionMapper.includes("!savedImageUrl || stockImage || neutralPlaceholder || savedImageSource === 'auto'") &&
  productionMapper.includes("savedImageSource === 'ai'"),
  'Stock images and neutral placeholders must be rejected before preserving persisted AI-generated image metadata.'
);
assert.match(productionMapper, /isNeutralPlaceholderUrl/, 'neutral placeholder images must not be treated as owner uploads');
assert.match(productionMapper, /isStockImageUrl\(savedLogo\) && !officialShowcase/, 'legacy stock image URLs must only be restored for platform-owned showcase activities');
assert.match(productionMapper, /metadata\.image_url \|\| i\.imageUrl \|\| i\.image_url/, 'normalized public catalog responses must preserve actual owner-uploaded product images');
assert.match(productionMapper, /catalogPublished: Boolean\(raw\.catalogPublished/, 'public directory presence must stay separate from the enabled public catalogue flag');
assert.doesNotMatch(storefrontHeader, /platformAdCover|isCurrentSlideAd|images\.unsplash\.com/, 'storefront must not inject fabricated platform ad slides or stock cover photos');
assert.doesNotMatch(storefrontCatalog, /images\.unsplash\.com/, 'public product cards must not use stock-photo fallbacks');
assert.doesNotMatch(merchantDashboard, /images\.unsplash\.com/, 'merchant product lists must not show stock photos as real items');
assert.doesNotMatch(catalogAdminFunction, /return `https:\/\/images\.unsplash\.com|const rules:/, 'catalog admin must not generate stock-photo URLs for item imagery');
assert.match(catalogAdminFunction, /legacyStockUrl = \/\^https:/, 'catalog admin must clear legacy stock-photo URLs when an item is edited');
assert.match(catalogAdminFunction, /neutralPlaceholderUrl/, 'catalog admin must keep neutral placeholders out of owner image metadata');
assert.doesNotMatch(publicDirectoryFunction, /return `https:\/\/images\.unsplash\.com|const rules:/, 'public directory API must not generate stock-photo URLs for businesses');
assert.match(publicDirectoryFunction, /allowLegacyShowcaseImage[\s\S]{0,180}return ""/, 'public directory API must suppress stock-photo URLs except for verified platform-owned showcase activities');
assert.match(publicDirectoryFunction, /isOfficialShowcase\(b\)/, 'public directory may include platform-owned showcase activity records without enabling their catalog modules');
assert.doesNotMatch(publicCatalogFunction, /return `https:\/\/images\.unsplash\.com|const rules:/, 'public storefront API must not generate stock-photo URLs for products');
assert.match(publicCatalogFunction, /images\\\.unsplash\\\.com[\s\S]{0,180}return ""/, 'public storefront API must explicitly reject legacy stock-photo URLs');
assert.doesNotMatch(sharedDefaultImages, /images\.unsplash\.com|const rules:/, 'shared catalog image helper must not generate stock-photo URLs');
assert.match(createUi, /phoneDigits\.length > 0 && \(phoneDigits\.length < 10 \|\| phoneDigits\.length > 15\)/, 'owner WhatsApp is optional but validated when provided');
assert.doesNotMatch(createUi, /if \(!newBizGov\.trim\(\) \|\| !newBizMarkaz\.trim\(\)\)/, 'optional location data must not block admin activity creation');
assert.match(createUi, /paymentStatus: newBizSubscriptionMode === 'FREE' \? 'free' : 'pending'/, 'new business must distinguish admin-approved free activation from unpaid subscription');
assert.match(createUi, /paymentConfirmedByAdmin: false/, 'new business must not be marked as payment-confirmed by default');
assert.match(createUi, /paymentDueDate: newBizSubscriptionMode === 'FREE' \? '' : newBizPaymentDueDate/, 'paid subscription persists selected due date while free activation has no due date');
assert.match(createUi, /paymentGracePeriodDays: newBizSubscriptionMode === 'FREE' \? 0 : gracePeriodDays/, 'paid subscription persists grace period while free activation has none');
assert.match(createUi, /publicEnabled: newBizActivationMode === 'activate_now'/, 'new business form must explicitly choose whether to publish now');
assert.match(admin, /انتظار تأكيد النشر من الإدارة/, 'business form must offer waiting for explicit publication confirmation');
assert.match(admin, /إرسال النشاط للنشر بعد موافقة الإدارة/, 'business form must explain publication remains subject to admin approval');
assert.doesNotMatch(createUi, /paymentStatus: 'paid'|paymentConfirmedByAdmin: true|paymobConfig:/, 'new business must not be auto-paid or auto-enabled for Paymob');
assert.match(admin, /await confirmAdminPayment\(biz\.id\)/, 'payment confirmation UI must await the backend result');
assert.match(admin, /تعذر حفظ تأكيد السداد/, 'payment confirmation failure must be visible');
assert.match(admin, /const handleOperationalStatusChange = async[\s\S]*await updateBillingSetting\(business\.id, \{[\s\S]*isFrozen: status === 'FROZEN'/, 'manual freeze changes must await the persisted operational-status update');
assert.match(admin, /await updateAdminSettings\(/, 'platform settings UI must await server persistence');
assert.match(admin, /settingsFeedback\.type === 'success'/, 'settings UI must distinguish saved success from failure');

assert.match(context, /subscriptionMode: data\.subscriptionMode \|\| 'PAID', subscriptionAmount: data\.subscriptionAmount \?\? 0, paymentDueDate: data\.paymentDueDate/, 'create request carries subscription mode, amount and due date');
assert.match(context, /paymentGracePeriodDays: data\.paymentGracePeriodDays \?\? 7/, 'create request must carry the selected grace period');
assert.match(context, /publishNow: Boolean\(data\.publicEnabled\)/, 'create request must carry the explicit publication choice');
assert.match(context, /const updateAdminSettings = async/, 'settings persistence must be asynchronous');
assert.match(context, /if \(result\?\.success !== true\)/, 'local settings state must update only after server-confirmed success');
assert.match(context, /const toggleBusinessFreeze = async/, 'manual freeze changes must persist before local state changes');
assert.match(context, /Freeze is an independent operational flag[\s\S]{0,180}await updateBillingSetting\(businessId, \{ isFrozen: frozen \}\)/, 'Freeze/unfreeze must not overwrite the underlying payment status');
assert.ok(directory.includes("if ((!biz.publicEnabled && !biz.isOfficialShowcase) || biz.operationalStatus !== 'ACTIVE' || biz.isFrozen) return false;"), 'The public directory must hide unpublished, inactive, and frozen businesses except official showcases');
assert.match(directory, /const coverSlides: CoverSlide\[\] = liveFeaturedBusinesses\.map\(\(business\) =>/ , 'The home cover must be built from available business records only');
assert.match(directory, /publicEnabled \|\| business\.isOfficialShowcase[\s\S]{0,120}!business\.isFrozen/, 'The cover must exclude frozen and unavailable business records');
assert.match(directory, /section aria-label="الأنشطة المتاحة حاليًا"[\s\S]*activeCoverSlides\.length > 0/, 'The home cover must be one activity-focused carousel with an empty state');
assert.match(directory, /setSelectedBusinessId\(slide\.businessId\)[\s\S]{0,100}setCurrentView\('public_storefront'\)/, 'Clicking a cover image must open that activity public page');
assert.doesNotMatch(directory, /currentSlide\.badge|currentSlide\.title|currentSlide\.subtitle|اضغط على الصورة لفتح صفحة النشاط/, 'The cover must not render text or badges over activity cover images');
assert.match(directory, /activeCoverSlides\.length <= 1/, 'The cover autoplay must not start when zero or one activities are available');
assert.doesNotMatch(directory, /mnty-ad-space-booking-banner\.svg|marketingCreative|advertisingSlides/, 'The homepage must no longer show two separate promotional cover panels');
assert.doesNotMatch(context, /const advanceBusinessOverdueDay/, 'overdue-day simulation must be removed from production context');

const createStart = backend.indexOf('if (action === "CREATE_BUSINESS")');
const createEnd = backend.indexOf('if (action === "CREATE_SUBSCRIBER")', createStart);
assert.ok(createStart >= 0 && createEnd > createStart, 'server-side business creation action must exist');
const createServer = backend.slice(createStart, createEnd);
assert.match(createServer, /phoneDigits\.length > 0 && \(phoneDigits\.length < 10 \|\| phoneDigits\.length > 15\)/, 'server validates contact only when optional contact is provided');
assert.match(createServer, /governorate, markaz\].some\(\(value\) => value.length > 100 \|\| \(value.length > 0 && value.length < 2\)\)/, 'server validates optional location fields without requiring them');
assert.match(createServer, /catalog_public_enabled: false/, 'new business records must remain unpublished until explicit server-side approval');
assert.match(createServer, /status: "INACTIVE"/, 'new business records must not activate operationally at creation time');
assert.match(createServer, /paymentDueDate: subscriptionMode === "FREE" \? "" : paymentDueDate/, 'backend must leave due date blank for approved free activation');
assert.match(createServer, /paymentStatus: subscriptionMode === "FREE" \? "free" : "pending"/, 'backend must distinguish free activation from pending payment');
assert.match(createServer, /freeActivationApprovedByAdmin: subscriptionMode === "FREE"/, 'free activation must be explicitly admin-approved');
assert.match(createServer, /subscriptionAmount,/, 'subscription amount must persist to production settings');
assert.match(createServer, /paymentConfirmedByAdmin: false/, 'backend must never self-confirm payment during activity creation');
assert.match(createServer, /INVALID_PAYMENT_DUE_DATE/, 'backend must validate the chosen payment due date');
assert.match(createServer, /INVALID_PAYMENT_GRACE_PERIOD/, 'backend must validate the grace period range');
assert.match(backend, /INVALID_ADMIN_WHATSAPP/, 'server must validate platform WhatsApp settings');
assert.match(backend, /INVALID_DEFAULT_COMMISSION/, 'server must validate platform commission input');
assert.match(backend, /const merged = \{ \.\.\.current, \.\.\.safe \}/, 'partial platform settings saves must preserve existing settings');

const publicationStart = backend.indexOf('if (action === "BUSINESS_PUBLICATION_REVIEW")');
const publicationEnd = backend.indexOf('if (action === "BUSINESS_SETTINGS_UPDATE")', publicationStart);
assert.ok(publicationStart >= 0 && publicationEnd > publicationStart, 'Admin publication review action must exist before billing updates.');
const publicationReview = backend.slice(publicationStart, publicationEnd);
const approvalStart = publicationReview.indexOf('if (decision === "APPROVE") {');
const rejectionStart = publicationReview.indexOf('const nextSettings = { ...currentSettings, catalog_public_enabled: false');
assert.ok(approvalStart >= 0 && rejectionStart > approvalStart, 'Publication approval and rejection branches must remain separate.');
const approval = publicationReview.slice(approvalStart, rejectionStart);

assert.match(approval, /An explicit platform-admin decision may publish even when optional owner\/contact\/location data is incomplete/,
  'Explicit admin approval must be allowed even when optional profile fields are missing.');
assert.match(approval, /\.select\("id,status"\)\.eq\("business_id", businessId\)/,
  'Approval must find and reuse an existing provider profile before creating a new one.');
assert.match(approval, /providerUpdateError/, 'Provider-profile activation failures must not be silently ignored.');
assert.match(approval, /createProfileError/, 'Provider-profile creation failures must not be silently ignored.');
assert.match(approval, /catalog_public_enabled: true[\s\S]*publicationStatus: "PUBLISHED"/,
  'Approval must persist the public-catalog flag and canonical publication state together.');
assert.match(approval, /PLATFORM_BUSINESS_PUBLICATION_APPROVED/,
  'Publication approval must leave an audit record.');
assert.match(approval, /if \(auditError\)[\s\S]*PUBLICATION_AUDIT_FAILED/,
  'An audit-write failure must return a clear actionable error rather than silently reporting success.');
assert.doesNotMatch(approval, /paymentStatus\s*:\s*"paid"|paymentConfirmedByAdmin\s*:\s*true/,
  'Publication approval must not fake payment or payment confirmation.');

assert.match(// Supabase Edge Runtime provides Deno.serve at runtime; no runtime import is needed for its ambient type declarations.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set(["https://islamnagy2022-eng.github.io", "http://localhost:3000", "http://localhost:8080", "http://127.0.0.1:3000", "http://127.0.0.1:8080"]);
const headersFor = (origin: string | null) => ({
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://islamnagy2022-eng.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS", "Vary": "Origin", "Cache-Control": "no-store",
});
const response = (origin: string | null, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: headersFor(origin) });
const safeImage = (value: unknown, allowLegacyShowcaseImage = false) => {
  const s = String(value || "").trim();
  if (s.length > 1500 || !/^https:\/\//i.test(s)) return "";
  // Older official showcase cards already have category photos saved in production.
  // Restore those visuals only for platform-owned showcase activities; ordinary
  // businesses still require their own supplied images.
  if (/^https:\/\/images\.unsplash\.com\//i.test(s) && !allowLegacyShowcaseImage) return "";
  return s;
};

const isOfficialShowcase = (business: any) =>
  business?.settings?.source === "OFFICIAL_PLATFORM_SHOWCASE" ||
  business?.settings?.managed_by === "SUPER_ADMIN";

type DefaultImageKind = "activity" | "product" | "service" | "cover";
interface DefaultImageInput { name?: string | null; description?: string | null; category?: string | null; kind?: DefaultImageKind; }
const IMAGE_PUBLIC_BASE = "https://islamnagy2022-eng.github.io/MantiqatiX/";
type ArtKey = "food" | "health" | "pharmacy" | "auto" | "education" | "fitness" | "home" | "real-estate" | "travel" | "digital" | "fashion" | "grocery" | "marketing" | "maintenance" | "labs";
const imageContextText = (input: DefaultImageInput) => [input.name, input.description, input.category].filter(Boolean).join(" ").toLocaleLowerCase();
function imageArt(input: DefaultImageInput): ArtKey {
  const t = imageContextText(input);
  if (/صيدل|دواء|أدوية|pharmacy|medicine/.test(t)) return "pharmacy";
  if (/معمل|تحاليل|أشعة|مختبر|laborator|radiolog|lab/.test(t)) return "labs";
  if (/عياد|طبي|طبيب|أسنان|مستشفى|صحة|health|medical|clinic|hospital|dent/.test(t)) return "health";
  if (/مطعم|مأكولات|أطعمة|غذاء|أغذية|وجبات|مخبز|حلويات|قهوة|كافيه|food|restaurant|bakery|cafe|coffee/.test(t)) return "food";
  if (/سيار|قطع غيار|ميكانيك|كهرباء سيارات|auto|car|vehicle/.test(t)) return "auto";
  if (/ملابس|أزياء|موضة|خياطة|بوتيك|fashion|clothing|apparel/.test(t)) return "fashion";
  if (/بقال|سوبر ماركت|خضروات|فاكهة|مواد غذائية|تسوق|grocery|market|supermarket/.test(t)) return "grocery";
  if (/تعليم|تدريب|مدرس|دروس|جامعة|كتب|education|training|school|tutor/.test(t)) return "education";
  if (/جيم|لياقة|رياضة|تمارين|fitness|gym|sport/.test(t)) return "fitness";
  if (/سفر|سياحة|رحلات|حجز طيران|travel|tourism|flight/.test(t)) return "travel";
  if (/عقار|عقارات|تشطيب|ديكور|أثاث|منزل|مفروشات|سباكة|نجار|حداد|صيانة|تنظيف|home|furniture|real estate|property|maintenance|repair|plumb|carpenter/.test(t)) return /عقار|عقارات|real estate|property/.test(t) ? "real-estate" : "home";
  if (/تسويق|إعلان|إعلانات|تصميم|برمجة|رقمي|تكنولوجيا|software|digital|marketing|design|developer|technology/.test(t)) return "digital";
  if (/خدمات|استشارات|محام|قانون|مكتب|ترجمة|محاسبة|خدمة|service|legal|consult|account/.test(t)) return "marketing";
  return "grocery";
}
const activityImageAssets: Record<ArtKey, string> = {
  food:"legacy/activity/food.svg", health:"legacy/activity/medical.svg", pharmacy:"legacy/activity/pharmacy.svg",
  auto:"legacy/activity/auto.svg", education:"legacy/activity/education.svg", fitness:"legacy/activity/fitness.svg",
  home:"legacy/activity/home.svg", "real-estate":"legacy/activity/real-estate.svg", travel:"legacy/activity/travel.svg",
  digital:"legacy/activity/digital.svg", fashion:"legacy/activities/fashion.svg", grocery:"legacy/activities/grocery.svg",
  marketing:"legacy/activities/marketing.svg", maintenance:"legacy/activities/maintenance.svg", labs:"legacy/activity/labs.svg",
};
const itemImageAssets: Record<ArtKey, string> = {
  food:"legacy/activities/food.svg", health:"legacy/activities/health.svg", pharmacy:"legacy/activities/health.svg",
  auto:"legacy/activities/auto.svg", education:"legacy/activities/education.svg", fitness:"legacy/activities/health.svg",
  home:"legacy/activity/home.svg", "real-estate":"legacy/activity/real-estate.svg", travel:"legacy/activity/travel.svg",
  digital:"legacy/activities/marketing.svg", fashion:"legacy/activities/fashion.svg", grocery:"legacy/activities/grocery.svg",
  marketing:"legacy/activities/marketing.svg", maintenance:"legacy/activities/maintenance.svg", labs:"legacy/activities/health.svg",
};
function resolveDefaultImage(input: DefaultImageInput = {}): string {
  const art = imageArt(input);
  return IMAGE_PUBLIC_BASE + ((input.kind === "activity" || input.kind === "cover") ? activityImageAssets[art] : itemImageAssets[art]);
}
function resolveDefaultActivityImages(input: Omit<DefaultImageInput, "kind">) {
  return { logoUrl: resolveDefaultImage({ ...input, kind: "activity" }), coverUrl: resolveDefaultImage({ ...input, kind: "cover" }) };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (origin && !allowedOrigins.has(origin)) return response(origin, { error: "ORIGIN_NOT_ALLOWED" }, 403);
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: headersFor(origin) });
  if (req.method !== "GET") return response(origin, { error: "METHOD_NOT_ALLOWED" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL"), serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return response(origin, { error: "SERVER_MISCONFIGURED" }, 500);
  const db = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  try {
    // Never publish isolated security-test tenants in the public directory.
    const { data: tenants, error: tenantError } = await db.from("tenants")
      .select("id,name,code,status,settings").eq("status", "ACTIVE").limit(100);
    if (tenantError) throw tenantError;
    const productionTenantIds = (tenants || []).filter((t: any) => {
      const id = String(t.id || "").toUpperCase();
      const code = String(t.code || "").toUpperCase();
      const name = String(t.name || "").toLowerCase();
      const purpose = String(t.settings?.purpose || "").toLowerCase();
      const testIdentity = /(^|[-_])TEST([-_]|$)|ISOLATION/.test(id) || /(^|[-_])TEST([-_]|$)|ISOLATION/.test(code);
      return !testIdentity && !purpose.includes("test") && !purpose.includes("isolation")
        && !name.includes("isolation test") && !name.includes("اختبار العزل");
    }).map((t: any) => String(t.id)).filter(Boolean);
    if (!productionTenantIds.length) return response(origin, { businesses: [], accessMode: "PUBLIC_DIRECTORY_READ_ONLY" });
    const { data: businesses, error: businessError } = await db.from("businesses")
      .select("id,tenant_id,organization_id,name,code,status,settings")
      .in("tenant_id", productionTenantIds).eq("status", "ACTIVE").limit(250);
    if (businessError) throw businessError;
    // Customer-owned catalogues remain opt-in. Platform-owned showcase activities
    // are public directory cards even before their module/catalog is separately enabled.
    const directoryBusinesses = (businesses || []).filter((b: any) => {
      const operationalStatus = String(b.settings?.bizcatalog?.operationalStatus || (b.settings?.bizcatalog?.isFrozen ? "FROZEN" : "ACTIVE")).toUpperCase();
      return operationalStatus === "ACTIVE" && (b.settings?.catalog_public_enabled === true || isOfficialShowcase(b));
    });
    if (!directoryBusinesses.length) return response(origin, { businesses: [], accessMode: "PUBLIC_DIRECTORY_READ_ONLY" });
    const ids = directoryBusinesses.map((b: any) => b.id);
    const { data: providers, error: providerError } = await db.from("marketing_provider_profiles")
      .select("business_id,name_ar,name_en,provider_kind,description,slug,status,is_verified,is_featured")
      .in("business_id", ids).eq("status", "ACTIVE").limit(250);
    if (providerError) throw providerError;
    const providerMap = new Map((providers || []).map((p: any) => [String(p.business_id), p]));
    const publicBusinesses = directoryBusinesses.filter((b: any) => providerMap.has(String(b.id)));
    const buildPublicBusiness = async (business: any): Promise<any | null> => {
      const tenantId = String(business.tenant_id || "");
      const { data: branches, error: branchError } = await db.from("branches")
        .select("id,name,code,status,address,phone").eq("tenant_id", tenantId).eq("business_id", business.id).eq("status", "ACTIVE").order("name").limit(100);
      if (branchError) throw branchError;
      const catalogPublished = business.settings?.catalog_public_enabled === true;
      // A public catalogue needs a real branch. An official showcase card can be
      // displayed without one, since it does not expose products or operations.
      if (!branches?.length && catalogPublished) return null;
      const branch: any = branches?.[0] || null;
      const branchId = String(branch?.id || "");
      const provider: any = providerMap.get(String(business.id));
      const officialShowcase = isOfficialShowcase(business);
      let items: any[] = [];
      let prices: any[] = [];
      if (catalogPublished) {
        const { data: itemRows, error: itemError } = await db.from("catalog_items")
          .select("id,tenant_id,business_id,branch_id,item_type,name_ar,name_en,description,status,metadata")
          .eq("tenant_id", tenantId).eq("business_id", business.id).eq("status", "ACTIVE")
          .or(`branch_id.is.null,branch_id.eq.${branchId}`).order("name_ar").limit(150);
        if (itemError) throw itemError;
        items = (itemRows || []).filter((i: any) => i.metadata?.catalog_public?.is_available !== false);
        const itemIds = items.map((i: any) => i.id);
        if (itemIds.length) {
          const now = new Date().toISOString();
          const { data: p, error: priceError } = await db.from("catalog_item_prices")
            .select("id,catalog_item_id,branch_id,currency,unit_price,version,status,effective_from,effective_to")
            .eq("tenant_id", tenantId).in("catalog_item_id", itemIds).eq("status", "ACTIVE")
            .lte("effective_from", now).or(`effective_to.is.null,effective_to.gte.${now}`).order("version", { ascending: false }).limit(1000);
          if (priceError) throw priceError;
          const hiddenPriceIds = new Set(
            items.filter((item: any) => item.metadata?.catalog_public?.show_price === false)
              .map((item: any) => String(item.id))
          );
          // Never serialize price rows for catalog entries explicitly marked as quote-only.
          prices = (p || []).filter((price: any) => !hiddenPriceIds.has(String(price.catalog_item_id)));
        }
      }
      const profile = business.settings?.catalog_profile || {};
      const activityName = String(provider?.name_ar || provider?.name_en || business.name);
      const activityCategory = String(profile.category || business.settings?.category_code || business.settings?.activity_code || (provider?.provider_kind !== "OFFICIAL" ? provider?.provider_kind : ""));
      const defaultImages = resolveDefaultActivityImages({
        name: activityName,
        description: String(profile.bio || provider?.description || business.settings?.headline || ""),
        category: activityCategory,
      });
      const phone = String(branch?.phone || profile.whatsapp_phone || profile.phone || "");
      const cleanPhone = phone.replace(/\D/g, "");
      const whatsappPhone = cleanPhone.startsWith("00") ? cleanPhone.slice(2)
        : cleanPhone.startsWith("0") ? "20" + cleanPhone.slice(1)
        : cleanPhone.startsWith("1") && cleanPhone.length === 10 ? "20" + cleanPhone : cleanPhone;
      return {
        id: business.id, tenantId, organizationId: business.organization_id,
        status: business.status, operationalStatus: business.status,
        bizcatalog: business.settings?.bizcatalog || {},
        name: activityName,
        slug: provider?.slug || String(business.code || business.id),
        code: business.code, category: activityCategory,
        activityGroupCode: String(business.settings?.activity_group_code || business.settings?.taxonomy_group_code || ""),
        activityClassificationType: String(business.settings?.activity_classification_type || "activity").toLowerCase() === "profession" ? "profession" : "activity",
        activitySpecialty: String(business.settings?.activity_specialty || ""),
        profile: { bio: String(profile.bio || provider?.description || business.settings?.headline || ""), governorate: String(profile.governorate || ""), markaz: String(profile.markaz || ""), village: String(profile.village || ""), workingHours: String(profile.working_hours || ""), logoUrl: safeImage(profile.logo_url, officialShowcase) || defaultImages.logoUrl, coverUrl: safeImage(profile.cover_url, officialShowcase) || defaultImages.coverUrl, google_maps_url: String(profile.google_maps_url || ""), category: activityCategory, whatsappPhone },
        provider: { kind: activityCategory, description: provider?.description || profile.bio || business.settings?.headline || "", slug: provider?.slug || "", verified: Boolean(provider?.is_verified), featured: Boolean(provider?.is_featured) },
        branches: branches || [], selectedBranchId: branchId || null, items, prices, contactPhone: phone,
        catalogPublished, publicEnabled: catalogPublished, isOfficialShowcase: officialShowcase,
        operationalStatus: String(business.settings?.bizcatalog?.operationalStatus || (business.settings?.bizcatalog?.isFrozen ? 'FROZEN' : 'ACTIVE')).toUpperCase(),
        paymentsEnabled: false, accessMode: "PUBLIC_READ_ONLY",
      };
    };

    // Limit concurrency to avoid a long serial N+1 request chain without flooding
    // PostgREST when the directory contains many businesses.
    const results: any[] = [];
    const batchSize = 8;
    const publicBusinessList = publicBusinesses.slice(0, 100);
    for (let offset = 0; offset < publicBusinessList.length; offset += batchSize) {
      const batch = publicBusinessList.slice(offset, offset + batchSize);
      const built = await Promise.all(batch.map((business: any) => buildPublicBusiness(business)));
      results.push(...built.filter((business: any) => business !== null));
    }
    return response(origin, { businesses: results, accessMode: "PUBLIC_DIRECTORY_READ_ONLY" });
  } catch (error) {
    console.error("public-catalog-directory failed", error instanceof Error ? error.message : "UNKNOWN");
    return response(origin, { error: "PUBLIC_DIRECTORY_UNAVAILABLE" }, 500);
  }
});
, /catalog_public_enabled === true/,
  'Public directory must derive customer-activity visibility from the persisted publication flag.');
assert.match(// Supabase Edge Runtime provides Deno.serve at runtime; no runtime import is needed for its ambient type declarations.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set(["https://islamnagy2022-eng.github.io", "http://localhost:3000", "http://localhost:8080", "http://127.0.0.1:3000", "http://127.0.0.1:8080"]);
const headersFor = (origin: string | null) => ({
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://islamnagy2022-eng.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS", "Vary": "Origin", "Cache-Control": "no-store",
});
const response = (origin: string | null, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: headersFor(origin) });
const safeImage = (value: unknown, allowLegacyShowcaseImage = false) => {
  const s = String(value || "").trim();
  if (s.length > 1500 || !/^https:\/\//i.test(s)) return "";
  // Older official showcase cards already have category photos saved in production.
  // Restore those visuals only for platform-owned showcase activities; ordinary
  // businesses still require their own supplied images.
  if (/^https:\/\/images\.unsplash\.com\//i.test(s) && !allowLegacyShowcaseImage) return "";
  return s;
};

const isOfficialShowcase = (business: any) =>
  business?.settings?.source === "OFFICIAL_PLATFORM_SHOWCASE" ||
  business?.settings?.managed_by === "SUPER_ADMIN";

type DefaultImageKind = "activity" | "product" | "service" | "cover";
interface DefaultImageInput { name?: string | null; description?: string | null; category?: string | null; kind?: DefaultImageKind; }
const IMAGE_PUBLIC_BASE = "https://islamnagy2022-eng.github.io/MantiqatiX/";
type ArtKey = "food" | "health" | "pharmacy" | "auto" | "education" | "fitness" | "home" | "real-estate" | "travel" | "digital" | "fashion" | "grocery" | "marketing" | "maintenance" | "labs";
const imageContextText = (input: DefaultImageInput) => [input.name, input.description, input.category].filter(Boolean).join(" ").toLocaleLowerCase();
function imageArt(input: DefaultImageInput): ArtKey {
  const t = imageContextText(input);
  if (/صيدل|دواء|أدوية|pharmacy|medicine/.test(t)) return "pharmacy";
  if (/معمل|تحاليل|أشعة|مختبر|laborator|radiolog|lab/.test(t)) return "labs";
  if (/عياد|طبي|طبيب|أسنان|مستشفى|صحة|health|medical|clinic|hospital|dent/.test(t)) return "health";
  if (/مطعم|مأكولات|أطعمة|غذاء|أغذية|وجبات|مخبز|حلويات|قهوة|كافيه|food|restaurant|bakery|cafe|coffee/.test(t)) return "food";
  if (/سيار|قطع غيار|ميكانيك|كهرباء سيارات|auto|car|vehicle/.test(t)) return "auto";
  if (/ملابس|أزياء|موضة|خياطة|بوتيك|fashion|clothing|apparel/.test(t)) return "fashion";
  if (/بقال|سوبر ماركت|خضروات|فاكهة|مواد غذائية|تسوق|grocery|market|supermarket/.test(t)) return "grocery";
  if (/تعليم|تدريب|مدرس|دروس|جامعة|كتب|education|training|school|tutor/.test(t)) return "education";
  if (/جيم|لياقة|رياضة|تمارين|fitness|gym|sport/.test(t)) return "fitness";
  if (/سفر|سياحة|رحلات|حجز طيران|travel|tourism|flight/.test(t)) return "travel";
  if (/عقار|عقارات|تشطيب|ديكور|أثاث|منزل|مفروشات|سباكة|نجار|حداد|صيانة|تنظيف|home|furniture|real estate|property|maintenance|repair|plumb|carpenter/.test(t)) return /عقار|عقارات|real estate|property/.test(t) ? "real-estate" : "home";
  if (/تسويق|إعلان|إعلانات|تصميم|برمجة|رقمي|تكنولوجيا|software|digital|marketing|design|developer|technology/.test(t)) return "digital";
  if (/خدمات|استشارات|محام|قانون|مكتب|ترجمة|محاسبة|خدمة|service|legal|consult|account/.test(t)) return "marketing";
  return "grocery";
}
const activityImageAssets: Record<ArtKey, string> = {
  food:"legacy/activity/food.svg", health:"legacy/activity/medical.svg", pharmacy:"legacy/activity/pharmacy.svg",
  auto:"legacy/activity/auto.svg", education:"legacy/activity/education.svg", fitness:"legacy/activity/fitness.svg",
  home:"legacy/activity/home.svg", "real-estate":"legacy/activity/real-estate.svg", travel:"legacy/activity/travel.svg",
  digital:"legacy/activity/digital.svg", fashion:"legacy/activities/fashion.svg", grocery:"legacy/activities/grocery.svg",
  marketing:"legacy/activities/marketing.svg", maintenance:"legacy/activities/maintenance.svg", labs:"legacy/activity/labs.svg",
};
const itemImageAssets: Record<ArtKey, string> = {
  food:"legacy/activities/food.svg", health:"legacy/activities/health.svg", pharmacy:"legacy/activities/health.svg",
  auto:"legacy/activities/auto.svg", education:"legacy/activities/education.svg", fitness:"legacy/activities/health.svg",
  home:"legacy/activity/home.svg", "real-estate":"legacy/activity/real-estate.svg", travel:"legacy/activity/travel.svg",
  digital:"legacy/activities/marketing.svg", fashion:"legacy/activities/fashion.svg", grocery:"legacy/activities/grocery.svg",
  marketing:"legacy/activities/marketing.svg", maintenance:"legacy/activities/maintenance.svg", labs:"legacy/activities/health.svg",
};
function resolveDefaultImage(input: DefaultImageInput = {}): string {
  const art = imageArt(input);
  return IMAGE_PUBLIC_BASE + ((input.kind === "activity" || input.kind === "cover") ? activityImageAssets[art] : itemImageAssets[art]);
}
function resolveDefaultActivityImages(input: Omit<DefaultImageInput, "kind">) {
  return { logoUrl: resolveDefaultImage({ ...input, kind: "activity" }), coverUrl: resolveDefaultImage({ ...input, kind: "cover" }) };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (origin && !allowedOrigins.has(origin)) return response(origin, { error: "ORIGIN_NOT_ALLOWED" }, 403);
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: headersFor(origin) });
  if (req.method !== "GET") return response(origin, { error: "METHOD_NOT_ALLOWED" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL"), serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return response(origin, { error: "SERVER_MISCONFIGURED" }, 500);
  const db = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  try {
    // Never publish isolated security-test tenants in the public directory.
    const { data: tenants, error: tenantError } = await db.from("tenants")
      .select("id,name,code,status,settings").eq("status", "ACTIVE").limit(100);
    if (tenantError) throw tenantError;
    const productionTenantIds = (tenants || []).filter((t: any) => {
      const id = String(t.id || "").toUpperCase();
      const code = String(t.code || "").toUpperCase();
      const name = String(t.name || "").toLowerCase();
      const purpose = String(t.settings?.purpose || "").toLowerCase();
      const testIdentity = /(^|[-_])TEST([-_]|$)|ISOLATION/.test(id) || /(^|[-_])TEST([-_]|$)|ISOLATION/.test(code);
      return !testIdentity && !purpose.includes("test") && !purpose.includes("isolation")
        && !name.includes("isolation test") && !name.includes("اختبار العزل");
    }).map((t: any) => String(t.id)).filter(Boolean);
    if (!productionTenantIds.length) return response(origin, { businesses: [], accessMode: "PUBLIC_DIRECTORY_READ_ONLY" });
    const { data: businesses, error: businessError } = await db.from("businesses")
      .select("id,tenant_id,organization_id,name,code,status,settings")
      .in("tenant_id", productionTenantIds).eq("status", "ACTIVE").limit(250);
    if (businessError) throw businessError;
    // Customer-owned catalogues remain opt-in. Platform-owned showcase activities
    // are public directory cards even before their module/catalog is separately enabled.
    const directoryBusinesses = (businesses || []).filter((b: any) => {
      const operationalStatus = String(b.settings?.bizcatalog?.operationalStatus || (b.settings?.bizcatalog?.isFrozen ? "FROZEN" : "ACTIVE")).toUpperCase();
      return operationalStatus === "ACTIVE" && (b.settings?.catalog_public_enabled === true || isOfficialShowcase(b));
    });
    if (!directoryBusinesses.length) return response(origin, { businesses: [], accessMode: "PUBLIC_DIRECTORY_READ_ONLY" });
    const ids = directoryBusinesses.map((b: any) => b.id);
    const { data: providers, error: providerError } = await db.from("marketing_provider_profiles")
      .select("business_id,name_ar,name_en,provider_kind,description,slug,status,is_verified,is_featured")
      .in("business_id", ids).eq("status", "ACTIVE").limit(250);
    if (providerError) throw providerError;
    const providerMap = new Map((providers || []).map((p: any) => [String(p.business_id), p]));
    const publicBusinesses = directoryBusinesses.filter((b: any) => providerMap.has(String(b.id)));
    const buildPublicBusiness = async (business: any): Promise<any | null> => {
      const tenantId = String(business.tenant_id || "");
      const { data: branches, error: branchError } = await db.from("branches")
        .select("id,name,code,status,address,phone").eq("tenant_id", tenantId).eq("business_id", business.id).eq("status", "ACTIVE").order("name").limit(100);
      if (branchError) throw branchError;
      const catalogPublished = business.settings?.catalog_public_enabled === true;
      // A public catalogue needs a real branch. An official showcase card can be
      // displayed without one, since it does not expose products or operations.
      if (!branches?.length && catalogPublished) return null;
      const branch: any = branches?.[0] || null;
      const branchId = String(branch?.id || "");
      const provider: any = providerMap.get(String(business.id));
      const officialShowcase = isOfficialShowcase(business);
      let items: any[] = [];
      let prices: any[] = [];
      if (catalogPublished) {
        const { data: itemRows, error: itemError } = await db.from("catalog_items")
          .select("id,tenant_id,business_id,branch_id,item_type,name_ar,name_en,description,status,metadata")
          .eq("tenant_id", tenantId).eq("business_id", business.id).eq("status", "ACTIVE")
          .or(`branch_id.is.null,branch_id.eq.${branchId}`).order("name_ar").limit(150);
        if (itemError) throw itemError;
        items = (itemRows || []).filter((i: any) => i.metadata?.catalog_public?.is_available !== false);
        const itemIds = items.map((i: any) => i.id);
        if (itemIds.length) {
          const now = new Date().toISOString();
          const { data: p, error: priceError } = await db.from("catalog_item_prices")
            .select("id,catalog_item_id,branch_id,currency,unit_price,version,status,effective_from,effective_to")
            .eq("tenant_id", tenantId).in("catalog_item_id", itemIds).eq("status", "ACTIVE")
            .lte("effective_from", now).or(`effective_to.is.null,effective_to.gte.${now}`).order("version", { ascending: false }).limit(1000);
          if (priceError) throw priceError;
          const hiddenPriceIds = new Set(
            items.filter((item: any) => item.metadata?.catalog_public?.show_price === false)
              .map((item: any) => String(item.id))
          );
          // Never serialize price rows for catalog entries explicitly marked as quote-only.
          prices = (p || []).filter((price: any) => !hiddenPriceIds.has(String(price.catalog_item_id)));
        }
      }
      const profile = business.settings?.catalog_profile || {};
      const activityName = String(provider?.name_ar || provider?.name_en || business.name);
      const activityCategory = String(profile.category || business.settings?.category_code || business.settings?.activity_code || (provider?.provider_kind !== "OFFICIAL" ? provider?.provider_kind : ""));
      const defaultImages = resolveDefaultActivityImages({
        name: activityName,
        description: String(profile.bio || provider?.description || business.settings?.headline || ""),
        category: activityCategory,
      });
      const phone = String(branch?.phone || profile.whatsapp_phone || profile.phone || "");
      const cleanPhone = phone.replace(/\D/g, "");
      const whatsappPhone = cleanPhone.startsWith("00") ? cleanPhone.slice(2)
        : cleanPhone.startsWith("0") ? "20" + cleanPhone.slice(1)
        : cleanPhone.startsWith("1") && cleanPhone.length === 10 ? "20" + cleanPhone : cleanPhone;
      return {
        id: business.id, tenantId, organizationId: business.organization_id,
        status: business.status, operationalStatus: business.status,
        bizcatalog: business.settings?.bizcatalog || {},
        name: activityName,
        slug: provider?.slug || String(business.code || business.id),
        code: business.code, category: activityCategory,
        activityGroupCode: String(business.settings?.activity_group_code || business.settings?.taxonomy_group_code || ""),
        activityClassificationType: String(business.settings?.activity_classification_type || "activity").toLowerCase() === "profession" ? "profession" : "activity",
        activitySpecialty: String(business.settings?.activity_specialty || ""),
        profile: { bio: String(profile.bio || provider?.description || business.settings?.headline || ""), governorate: String(profile.governorate || ""), markaz: String(profile.markaz || ""), village: String(profile.village || ""), workingHours: String(profile.working_hours || ""), logoUrl: safeImage(profile.logo_url, officialShowcase) || defaultImages.logoUrl, coverUrl: safeImage(profile.cover_url, officialShowcase) || defaultImages.coverUrl, google_maps_url: String(profile.google_maps_url || ""), category: activityCategory, whatsappPhone },
        provider: { kind: activityCategory, description: provider?.description || profile.bio || business.settings?.headline || "", slug: provider?.slug || "", verified: Boolean(provider?.is_verified), featured: Boolean(provider?.is_featured) },
        branches: branches || [], selectedBranchId: branchId || null, items, prices, contactPhone: phone,
        catalogPublished, publicEnabled: catalogPublished, isOfficialShowcase: officialShowcase,
        operationalStatus: String(business.settings?.bizcatalog?.operationalStatus || (business.settings?.bizcatalog?.isFrozen ? 'FROZEN' : 'ACTIVE')).toUpperCase(),
        paymentsEnabled: false, accessMode: "PUBLIC_READ_ONLY",
      };
    };

    // Limit concurrency to avoid a long serial N+1 request chain without flooding
    // PostgREST when the directory contains many businesses.
    const results: any[] = [];
    const batchSize = 8;
    const publicBusinessList = publicBusinesses.slice(0, 100);
    for (let offset = 0; offset < publicBusinessList.length; offset += batchSize) {
      const batch = publicBusinessList.slice(offset, offset + batchSize);
      const built = await Promise.all(batch.map((business: any) => buildPublicBusiness(business)));
      results.push(...built.filter((business: any) => business !== null));
    }
    return response(origin, { businesses: results, accessMode: "PUBLIC_DIRECTORY_READ_ONLY" });
  } catch (error) {
    console.error("public-catalog-directory failed", error instanceof Error ? error.message : "UNKNOWN");
    return response(origin, { error: "PUBLIC_DIRECTORY_UNAVAILABLE" }, 500);
  }
});
, /operationalStatus === "ACTIVE"/,
  'Public directory must continue respecting operational state.');
assert.match(import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://islamnagy2022-eng.github.io",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
]);
const headersFor = (origin: string | null) => ({
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://islamnagy2022-eng.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Vary": "Origin",
  "Cache-Control": "no-store",
});
const response = (origin: string | null, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: headersFor(origin) });
// Accept the UUID-shaped legacy IDs already stored in PostgreSQL.
const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const safeImageUrl = (value: unknown) => {
  const candidate = String(value || "").trim();
  if (candidate.length > 1500 || !/^https:\/\//i.test(candidate)) return "";
  // Unsplash defaults were seeded by the former demo image resolver; do not present them as owner-provided photos.
  if (/^https:\/\/images\.unsplash\.com\//i.test(candidate)) return "";
  return candidate;
};

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (origin && !allowedOrigins.has(origin)) return response(origin, { error: "ORIGIN_NOT_ALLOWED" }, 403);
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: headersFor(origin) });
  if (req.method !== "GET") return response(origin, { error: "METHOD_NOT_ALLOWED" }, 405);

  const url = new URL(req.url);
  const businessId = (url.searchParams.get("businessId") || url.searchParams.get("business") || "").trim();
  const requestedBranchId = (url.searchParams.get("branchId") || "").trim();
  if (!isUuid(businessId)) return response(origin, { error: "INVALID_BUSINESS_ID" }, 400);
  if (requestedBranchId && (requestedBranchId.length > 80 || !/^[a-z0-9_-]+$/i.test(requestedBranchId))) {
    return response(origin, { error: "INVALID_BRANCH_ID" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return response(origin, { error: "SERVER_MISCONFIGURED" }, 500);
  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: business, error: businessError } = await db.from("businesses")
      .select("id,tenant_id,name,code,status,settings")
      .eq("id", businessId)
      .maybeSingle();
    if (businessError) throw businessError;
    if (!business || String(business.status || "").toUpperCase() !== "ACTIVE") {
      return response(origin, { error: "BUSINESS_NOT_PUBLIC" }, 404);
    }
    const operationalStatus = String(business.settings?.bizcatalog?.operationalStatus || (business.settings?.bizcatalog?.isFrozen ? "FROZEN" : "ACTIVE")).toUpperCase();
    if (operationalStatus !== "ACTIVE") return response(origin, { error: "BUSINESS_NOT_PUBLIC" }, 404);
    if (business.settings?.catalog_public_enabled !== true) {
      return response(origin, { error: "CATALOG_NOT_PUBLISHED" }, 404);
    }

    const { data: provider, error: providerError } = await db.from("marketing_provider_profiles")
      .select("business_id,name_ar,name_en,provider_kind,description,slug,status,is_verified,is_featured")
      .eq("business_id", businessId)
      .eq("status", "ACTIVE")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (providerError) throw providerError;
    if (!provider) return response(origin, { error: "CATALOG_NOT_PUBLIC" }, 404);

    const tenantId = String(business.tenant_id || "");
    if (!tenantId) return response(origin, { error: "BUSINESS_TENANT_MISSING" }, 500);
    const { data: branches, error: branchError } = await db.from("branches")
      .select("id,name,code,status,address,phone")
      .eq("tenant_id", tenantId)
      .eq("business_id", businessId)
      .eq("status", "ACTIVE")
      .order("name", { ascending: true })
      .limit(100);
    if (branchError) throw branchError;
    if (!branches?.length) return response(origin, { error: "NO_ACTIVE_BRANCH" }, 404);
    const selectedBranch = requestedBranchId
      ? branches.find((branch: any) => String(branch.id) === requestedBranchId)
      : branches[0];
    if (!selectedBranch) return response(origin, { error: "BRANCH_NOT_PUBLIC" }, 404);
    const branchId = String(selectedBranch.id);
    const now = new Date().toISOString();
    const itemQuery = () => db.from("catalog_items")
      .select("id,branch_id,item_type,name_ar,name_en,description,status,metadata")
      .eq("tenant_id", tenantId)
      .eq("business_id", businessId)
      .eq("status", "ACTIVE")
      .order("name_ar", { ascending: true })
      .limit(150);
    const [globalItemResult, branchItemResult] = await Promise.all([
      itemQuery().is("branch_id", null),
      itemQuery().eq("branch_id", branchId),
    ]);
    if (globalItemResult.error || branchItemResult.error) throw globalItemResult.error || branchItemResult.error;
    const rawItems = [...(globalItemResult.data || []), ...(branchItemResult.data || [])]
      .slice(0, 150)
      .sort((a: any, b: any) => String(a.name_ar || "").localeCompare(String(b.name_ar || ""), "ar"));

    const itemIds = rawItems.map((item: any) => item.id);
    let prices: any[] = [], options: any[] = [];
    if (itemIds.length) {
      const priceQuery = () => db.from("catalog_item_prices")
        .select("id,catalog_item_id,branch_id,currency,unit_price,version,status,effective_from,effective_to")
        .eq("tenant_id", tenantId).in("catalog_item_id", itemIds).eq("status", "ACTIVE")
        .lte("effective_from", now).or(`effective_to.is.null,effective_to.gte.${now}`)
        .order("version", { ascending: false });
      const [globalPriceResult, branchPriceResult, optionResult] = await Promise.all([
        priceQuery().is("branch_id", null),
        priceQuery().eq("branch_id", branchId),
        db.from("catalog_item_options")
          .select("id,catalog_item_id,name_ar,name_en,price_delta,status")
          .eq("tenant_id", tenantId).in("catalog_item_id", itemIds).eq("status", "ACTIVE")
          .order("name_ar", { ascending: true }),
      ]);
      if (globalPriceResult.error || branchPriceResult.error || optionResult.error) {
        throw globalPriceResult.error || branchPriceResult.error || optionResult.error;
      }
      prices = [...(globalPriceResult.data || []), ...(branchPriceResult.data || [])];
      options = optionResult.data || [];
    }

    const trackStockIds = rawItems
      .filter((item: any) => String(item.item_type || "").toUpperCase() === "PRODUCT" && item.metadata?.catalog_public?.track_stock === true)
      .map((item: any) => item.id);
    const stockAvailability = new Map<string, boolean>();
    if (trackStockIds.length) {
      const { data: activeWarehouses, error: warehousesError } = await db.from("warehouses")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("business_id", businessId)
        .eq("status", "ACTIVE")
        .or(`branch_id.is.null,branch_id.eq.${branchId}`)
        .limit(150);
      if (warehousesError) throw warehousesError;
      const warehouseIds = (activeWarehouses || []).map((warehouse: any) => String(warehouse.id));
      if (warehouseIds.length) {
        const stockQuery = () => db.from("stock_balances")
          .select("product_id,branch_id,warehouse_id,quantity_on_hand,quantity_reserved")
          .eq("tenant_id", tenantId)
          .eq("business_id", businessId)
          .in("warehouse_id", warehouseIds)
          .in("product_id", trackStockIds);
        const [globalStockResult, branchStockResult] = await Promise.all([
          stockQuery().is("branch_id", null),
          stockQuery().eq("branch_id", branchId),
        ]);
        if (globalStockResult.error || branchStockResult.error) throw globalStockResult.error || branchStockResult.error;
        const availableUnits = new Map<string, number>();
        for (const balance of [...(globalStockResult.data || []), ...(branchStockResult.data || [])] as any[]) {
          const free = Math.max(0, Number(balance.quantity_on_hand || 0) - Number(balance.quantity_reserved || 0));
          const key = String(balance.product_id);
          availableUnits.set(key, (availableUnits.get(key) || 0) + free);
        }
        for (const itemId of trackStockIds) stockAvailability.set(String(itemId), (availableUnits.get(String(itemId)) || 0) > 0);
      } else {
        for (const itemId of trackStockIds) stockAvailability.set(String(itemId), false);
      }
    }
    const items = (rawItems || []).map((item: any) => {
      const meta = item.metadata?.catalog_public || {};
      const comparePrice = Number(meta.compare_price);
      return {
        id: item.id,
        branchId: item.branch_id,
        type: String(item.item_type || "").toUpperCase() === "SERVICE" ? "SERVICE" : "PRODUCT",
        nameAr: item.name_ar,
        nameEn: item.name_en,
        description: item.description || "",
        category: String(meta.category || "عام").slice(0, 100),
        unit: String(meta.unit || "").slice(0, 40),
        imageUrl: safeImageUrl(meta.image_url),
        comparePrice: Number.isFinite(comparePrice) && comparePrice >= 0 ? comparePrice : null,
        trackStock: meta.track_stock === true,
        available: meta.is_available !== false && (meta.track_stock !== true || stockAvailability.get(String(item.id)) === true),
      };
    });

    const profile = business.settings?.catalog_profile || {};
    const selectedBranchPhone = String(selectedBranch.phone || "");
    return response(origin, {
      business: { id: business.id, name: business.name, code: business.code, operationalStatus: String(business.settings?.bizcatalog?.operationalStatus || "ACTIVE").toUpperCase() },
      provider: {
        name: provider.name_ar || provider.name_en || business.name,
        nameAr: provider.name_ar,
        nameEn: provider.name_en,
        kind: provider.provider_kind,
        description: provider.description || profile.bio || "",
        slug: provider.slug,
        verified: Boolean(provider.is_verified),
        featured: Boolean(provider.is_featured),
      },
      profile: {
        bio: String(profile.bio || provider.description || ""),
        governorate: String(profile.governorate || ""),
        markaz: String(profile.markaz || ""),
        village: String(profile.village || ""),
        workingHours: String(profile.working_hours || ""),
        logoUrl: safeImageUrl(profile.logo_url),
        coverUrl: safeImageUrl(profile.cover_url),
        google_maps_url: String(profile.google_maps_url || ""),
        facebookUrl: String(profile.facebook_url || ""),
        instagramUrl: String(profile.instagram_url || ""),
        tiktokUrl: String(profile.tiktok_url || ""),
        category: String(profile.category || provider.provider_kind || "").slice(0, 100),
      },
      branches: branches.map((branch: any) => ({
        id: branch.id,
        name: branch.name,
        code: branch.code,
        address: branch.address,
        phone: branch.phone,
      })),
      selectedBranchId: branchId,
      items,
      prices,
      options: options.map((option: any) => ({
        id: option.id, catalogItemId: option.catalog_item_id,
        nameAr: option.name_ar, nameEn: option.name_en,
        priceDelta: option.price_delta,
      })),
      contactPhone: selectedBranchPhone,
      paymentsEnabled: false,
      accessMode: "PUBLIC_READ_ONLY",
    });
  } catch (error) {
    console.error("public catalog read failed", error instanceof Error ? error.message : "UNKNOWN");
    return response(origin, { error: "PUBLIC_CATALOG_UNAVAILABLE" }, 500);
  }
});
, /catalog_public_enabled !== true/,
  'The public storefront must not serve an unpublished catalog.');
assert.match(import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Business } from '../types';
import {
  Store,
  Wrench,
  Search,
  MapPin,
  Sparkles,
  Layers,
  ArrowRight,
  CheckCircle2,
  MessageCircle,
  Stethoscope,
  Shirt,
  Car,
  Building2,
  Cpu,
  Megaphone,
  ShoppingCart,
  Sprout,
  Dumbbell,
  Plane,
  Landmark,
  Factory,
  Users,
  BriefcaseBusiness,
  Palette,
  GraduationCap,
  Utensils,
} from 'lucide-react';
import { formatEgyptianLocation } from '../utils/rules';
import { resolveDefaultImage } from '../utils/defaultImages';

const whatsappDigits = (value: unknown): string => {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = '20' + digits.slice(1);
  else if (digits.startsWith('1') && digits.length === 10) digits = '20' + digits;
  return digits.length >= 10 && digits.length <= 15 ? digits : '';
};

const ICONS_MAP: Record<string, React.ReactNode> = {
  medical_health: <Stethoscope className="h-7 w-7 text-emerald-600" strokeWidth={1.8} />,
  food_grocery: <Utensils className="h-7 w-7 text-amber-600" strokeWidth={1.8} />,
  fashion_beauty: <Shirt className="h-7 w-7 text-pink-600" strokeWidth={1.8} />,
  home_maintenance: <Wrench className="h-7 w-7 text-orange-600" strokeWidth={1.8} />,
  construction_decor: <Palette className="h-7 w-7 text-stone-600" strokeWidth={1.8} />,
  auto_transport: <Car className="h-7 w-7 text-sky-600" strokeWidth={1.8} />,
  real_estate: <Building2 className="h-7 w-7 text-teal-600" strokeWidth={1.8} />,
  education_training: <GraduationCap className="h-7 w-7 text-indigo-600" strokeWidth={1.8} />,
  technology_communications: <Cpu className="h-7 w-7 text-cyan-600" strokeWidth={1.8} />,
  professional_services: <BriefcaseBusiness className="h-7 w-7 text-violet-600" strokeWidth={1.8} />,
  marketing_media: <Megaphone className="h-7 w-7 text-fuchsia-600" strokeWidth={1.8} />,
  trade_ecommerce: <ShoppingCart className="h-7 w-7 text-blue-600" strokeWidth={1.8} />,
  agriculture_animals: <Sprout className="h-7 w-7 text-lime-700" strokeWidth={1.8} />,
  sports_fitness: <Dumbbell className="h-7 w-7 text-red-600" strokeWidth={1.8} />,
  tourism_events: <Plane className="h-7 w-7 text-purple-600" strokeWidth={1.8} />,
  finance_insurance: <Landmark className="h-5 w-5 sm:h-7 sm:w-7 text-emerald-700" strokeWidth={1.8} />,
  industry_workshops: <Factory className="h-5 w-5 sm:h-7 sm:w-7 text-slate-600" strokeWidth={1.8} />,
  public_community: <Users className="h-7 w-7 text-rose-600" strokeWidth={1.8} />,
};

interface CoverSlide {
  image: string;
  badge: string;
  title: string;
  subtitle: string;
  governorates: string[];
  businessId?: string;
}
const BUSINESS_PLACEHOLDER = `${import.meta.env.BASE_URL || '/'}business-placeholder.svg`;



export const DirectoryView: React.FC = () => {
  const {
    directoryBusinesses,
    directoryLoading,
    functionalGroups,
    categories,
    setSelectedBusinessId,
    setCurrentView,
    adminSettings,
  } = useApp();
  const businesses = directoryBusinesses;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
  const [selectedCategoryKind, setSelectedCategoryKind] = useState<'all' | 'activity' | 'profession'>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
  const [selectedGovFilter, setSelectedGovFilter] = useState<string>('all');
  const catalogRequestPhone = whatsappDigits(
    adminSettings.adminWhatsApp || (window as any).MNTY_SUPPORT?.whatsapp || ''
  );

  // Published catalogues and platform-owned showcase activities receive directory cards.
  // This does not activate a module or expose products for an unpublished catalogue.
  const liveFeaturedBusinesses = businesses
    .filter((business) => Boolean(business.publicEnabled || business.isOfficialShowcase) && business.operationalStatus === 'ACTIVE' && !business.isFrozen && Boolean(business.name.trim()))
    .slice(0, 30);
  const coverSlides: CoverSlide[] = liveFeaturedBusinesses.map((business) => ({
      image: business.coverUrl || resolveDefaultImage({ name: business.name, description: business.bio, category: business.category, kind: 'cover' }),
      badge: business.category || 'نشاط محلي',
      title: business.name,
      subtitle: business.bio || (business.catalogPublished ? 'تعرّف على بيانات النشاط وكتالوجه المنشور.' : 'تعرّف على هذا النشاط ضمن دليل MantiqatiX.'),
      governorates: [business.governorate || 'all'],
      businessId: business.id,
    }));

  // The directory uses the same canonical taxonomy as the administration forms.
  const selectGroup = (groupId: string) => {
    setSelectedGroupFilter(groupId);
    setSelectedCategoryKind('all');
    setSelectedCategoryId('all');
    setSelectedSpecialty('all');
  };
  const availableCategories = categories.filter((category) =>
    (selectedGroupFilter === 'all' || category.functionalGroupId === selectedGroupFilter) &&
    (selectedCategoryKind === 'all' || (category.classificationType || 'activity') === selectedCategoryKind)
  );
  const selectedTaxonomyCategory = categories.find((category) => category.id === selectedCategoryId);
  const categoryForBusiness = (business: Business) =>
    categories.find((category) => business.category === category.name || business.category.startsWith(category.name + ' — '));

  // Governorate filtering is applied to real published business records.
  const [currentCoverIndex, setCurrentCoverIndex] = useState(0);
  // Match the cover container to each image's real aspect ratio instead of cropping it to a fixed height.
  const [coverAspectRatio, setCoverAspectRatio] = useState('650 / 228');
  const coverImageRefs = useRef<Array<HTMLImageElement | null>>([]);

  // Filter slides based on selected governorate
  const activeCoverSlides = selectedGovFilter === 'all'
    ? coverSlides
    : coverSlides.filter((slide) => slide.governorates.includes(selectedGovFilter));

  useEffect(() => {
    setCurrentCoverIndex(0);
  }, [selectedGovFilter, activeCoverSlides.length]);

  useEffect(() => {
    if (activeCoverSlides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentCoverIndex((prev) => (prev + 1) % activeCoverSlides.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [activeCoverSlides.length]);

  useEffect(() => {
    const image = coverImageRefs.current[currentCoverIndex];
    if (image?.naturalWidth && image?.naturalHeight) {
      setCoverAspectRatio(`${image.naturalWidth} / ${image.naturalHeight}`);
    }
  }, [currentCoverIndex, activeCoverSlides[currentCoverIndex]?.image]);

  const filteredBusinesses = businesses.filter((biz) => {
    // Fail closed: the directory must never expose unpublished or frozen businesses,
    // even when the viewer is a platform administrator with a broader bootstrap scope.
    if ((!biz.publicEnabled && !biz.isOfficialShowcase) || biz.operationalStatus !== 'ACTIVE' || biz.isFrozen) return false;
    const matchesSearch =
      biz.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      biz.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      biz.bio.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesGroup =
      selectedGroupFilter === 'all' || biz.functionalGroupId === selectedGroupFilter;
    const matchedCategory = categoryForBusiness(biz);
    const matchesCategoryKind = selectedCategoryKind === 'all' ||
      (matchedCategory?.classificationType || biz.categoryClassificationType || 'activity') === selectedCategoryKind;
    const matchesCategory = selectedCategoryId === 'all' ||
      Boolean(matchedCategory && selectedTaxonomyCategory && matchedCategory.name === selectedTaxonomyCategory.name);
    const storedSpecialty = String(biz.activitySpecialty || '');
    const categorySuffix = matchedCategory ? biz.category.slice(matchedCategory.name.length).replace(/^\s*—\s*/, '') : '';
    const matchesSpecialty = selectedSpecialty === 'all' ||
      storedSpecialty === selectedSpecialty || categorySuffix === selectedSpecialty;

    const matchesGov =
      selectedGovFilter === 'all' || biz.governorate === selectedGovFilter;

    return matchesSearch && matchesGroup && matchesCategoryKind && matchesCategory && matchesSpecialty && matchesGov;
  }).sort((a, b) => {
    const targetGov = selectedGovFilter === 'all' ? 'الدقهلية' : selectedGovFilter;
    const aProx = a.governorate === targetGov ? 0 : 1;
    const bProx = b.governorate === targetGov ? 0 : 1;
    return aProx - bProx;
  });

  const uniqueGovernorships = Array.from(new Set(businesses.map((b) => b.governorate).filter(Boolean)));

  return (
    <div className="space-y-8 pb-20">
      {/* 1. Full-Width Horizontal Title Bar right under header */}
      <div className="w-full bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white py-6 px-4 sm:px-8 shadow-md border-y border-emerald-500/20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-right">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-black px-3 py-0.5 rounded-full mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>الدليل الشامل للأنشطة والخدمات في مصر • MantiqatiX</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
              اكتشف كافة المشاريع والخدمات في <span className="text-emerald-400">منطقتي X</span>
              {selectedGovFilter !== 'all' && <span className="text-amber-300 text-lg mr-2 font-bold">({selectedGovFilter})</span>}
            </h1>
          </div>

          {catalogRequestPhone && (
            <a
              href={`https://wa.me/${catalogRequestPhone}?text=${encodeURIComponent('مرحبًا، أريد طلب كتالوج لنشاطي على MantiqatiX.')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs py-3 px-6 rounded-2xl shadow-lg flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap"
            >
              <MessageCircle className="w-4 h-4" />
              <span>اطلب كتالوج لنشاطك</span>
            </a>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* 2. One full-width cover carousel showing only currently available activities. */}
        <section aria-label="الأنشطة المتاحة حاليًا" className="space-y-3">
          {activeCoverSlides.length > 0 ? (
            <div style={{ aspectRatio: coverAspectRatio }} className="relative w-full rounded-3xl overflow-hidden shadow-2xl bg-slate-900 group">
              {activeCoverSlides.map((slide, idx) => (
                <div
                  key={slide.businessId || `${slide.title}-${idx}`}
                  aria-hidden={idx !== currentCoverIndex}
                  className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                    idx === currentCoverIndex ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                  }`}
                >
                  {(idx === currentCoverIndex || idx === (currentCoverIndex + 1) % activeCoverSlides.length) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!slide.businessId) return;
                      setSelectedBusinessId(slide.businessId);
                      setCurrentView('public_storefront');
                    }}
                    aria-label={`افتح صفحة نشاط ${slide.title}`}
                    tabIndex={idx === currentCoverIndex ? 0 : -1}
                    className="absolute inset-0 block h-full w-full cursor-pointer text-left focus-visible:ring-4 focus-visible:ring-emerald-400"
                  >
                    <img
                      ref={(image) => { coverImageRefs.current[idx] = image; }}
                      src={slide.image || resolveDefaultImage({ name: slide.title, category: slide.badge, kind: 'cover' })}
                      alt={slide.title}
                      className="h-full w-full object-contain object-center transition-transform duration-700 group-hover:scale-[1.01]"
                      loading={idx === currentCoverIndex ? 'eager' : 'lazy'}
                      onLoad={(event) => {
                        if (idx !== currentCoverIndex) return;
                        const { naturalWidth, naturalHeight } = event.currentTarget;
                        if (naturalWidth > 0 && naturalHeight > 0) {
                          setCoverAspectRatio(`${naturalWidth} / ${naturalHeight}`);
                        }
                      }}
                      onError={(event) => {
                        const image = event.currentTarget;
                        const fallback = resolveDefaultImage({ name: slide.title, category: slide.badge, kind: 'cover' });
                        if (!image.src.endsWith(fallback.replace(/^.*\//, ''))) image.src = fallback;
                      }}
                    />

                  </button>
                  )}
                </div>
              ))}

              {activeCoverSlides.length > 1 && (
                <div className="absolute bottom-3 right-1/2 translate-x-1/2 z-30 flex items-center gap-1.5 bg-black/50 backdrop-blur-xs px-3 py-1.5 rounded-full border border-white/20 max-w-[90%] overflow-x-auto no-scrollbar">
                  {activeCoverSlides.map((slide, idx) => (
                    <button
                      key={slide.businessId || `${slide.title}-${idx}`}
                      type="button"
                      onClick={() => setCurrentCoverIndex(idx)}
                      className={`h-2 rounded-full transition-all cursor-pointer ${
                        idx === currentCoverIndex ? 'w-5 bg-amber-400' : 'w-1.5 bg-white/50 hover:bg-white'
                      }`}
                      aria-label={`اعرض نشاط ${slide.title}`}
                      aria-pressed={idx === currentCoverIndex}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-h-64 sm:min-h-80 md:min-h-96 w-full items-center justify-center rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 px-6 py-12 text-center text-white shadow-xl">
              <div className="max-w-xl space-y-3">
                <Store className="mx-auto h-10 w-10 text-emerald-300" />
                <h2 className="text-xl sm:text-2xl font-black">لا توجد أنشطة متاحة حاليًا</h2>
                <p className="text-sm leading-relaxed text-white/75">ستظهر هنا تلقائيًا صور الأنشطة المنشورة والمتاحة للزوار.</p>
              </div>
            </div>
          )}
        </section>

        {/* Functional Groups Filter Row */}
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-black text-lg text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-600" />
              <span>التصنيفات والمجموعات الوظيفية</span>
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              اختر قطاعاً لاستعراض الأنشطة التابعة له
            </span>
          </div>

          <div className="grid grid-cols-5 sm:grid-cols-5 lg:grid-cols-5 xl:grid-cols-10 gap-1.5 sm:gap-2">
            <button
              onClick={() => selectGroup('all')}
              aria-pressed={selectedGroupFilter === 'all'}
              className={`group flex min-h-28 sm:min-h-36 flex-col items-center justify-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl border bg-white p-1.5 sm:p-3 text-center transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${selectedGroupFilter === 'all' ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500' : 'border-slate-200 hover:border-emerald-200'}`}
            >
              <span className={`flex h-9 w-9 sm:h-14 sm:w-14 items-center justify-center rounded-xl sm:rounded-2xl ${selectedGroupFilter === 'all' ? 'bg-emerald-100' : 'bg-slate-100 group-hover:bg-emerald-50'}`}>
                <Store className={`h-7 w-7 ${selectedGroupFilter === 'all' ? 'text-emerald-700' : 'text-slate-600'}`} strokeWidth={1.8} />
              </span>
              <span className="space-y-1">
                <span className="block text-[10px] sm:text-sm font-black leading-tight text-slate-900">كافة الأنشطة</span>
                <span className="block text-[8px] sm:text-[11px] leading-tight text-slate-500 line-clamp-2">جميع القطاعات والمهن</span>
              </span>
              <span className="absolute right-2 top-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{businesses.length}</span>
            </button>

            {functionalGroups.map((group) => {
              const count = businesses.filter((b) => b.functionalGroupId === group.id).length;
              const isSelected = selectedGroupFilter === group.id;
              return (
                <button
                  key={group.id}
                  onClick={() => selectGroup(group.id)}
                  aria-pressed={isSelected}
                  className={`group relative flex min-h-28 sm:min-h-36 flex-col items-center justify-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl border bg-white p-1.5 sm:p-3 text-center transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${isSelected ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500' : 'border-slate-200 hover:border-emerald-200'}`}
                >
                  <span className={`flex h-9 w-9 sm:h-14 sm:w-14 items-center justify-center rounded-xl sm:rounded-2xl transition-colors ${isSelected ? 'bg-emerald-100' : 'bg-slate-100 group-hover:bg-emerald-50'}`}>
                    {ICONS_MAP[group.id] || <Layers className="h-5 w-5 sm:h-7 sm:w-7 text-slate-600" strokeWidth={1.8} />}
                  </span>
                  <span className="space-y-1">
                    <span className="block text-[10px] sm:text-sm font-black leading-tight text-slate-900">{group.shortName}</span>
                    <span className="block text-[8px] sm:text-[11px] leading-tight text-slate-500 line-clamp-2">{group.name}</span>
                  </span>
                  <span className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${isSelected ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Activity / profession / specialty filters driven by the canonical taxonomy */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="block text-xs font-bold text-slate-700">
            نوع التصنيف
            <select
              value={selectedCategoryKind}
              onChange={(e) => {
                setSelectedCategoryKind(e.target.value as 'all' | 'activity' | 'profession');
                setSelectedCategoryId('all');
                setSelectedSpecialty('all');
              }}
              className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-xs font-bold"
            >
              <option value="all">الأنشطة والمهن</option>
              <option value="activity">الأنشطة</option>
              <option value="profession">المهن</option>
            </select>
          </label>
          <label className="block text-xs font-bold text-slate-700">
            النشاط أو المهنة
            <select
              value={selectedCategoryId}
              onChange={(e) => {
                setSelectedCategoryId(e.target.value);
                setSelectedSpecialty('all');
              }}
              className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-xs font-bold"
            >
              <option value="all">كل الأنشطة والمهن</option>
              {functionalGroups
                .filter((group) => selectedGroupFilter === 'all' || group.id === selectedGroupFilter)
                .map((group) => {
                  const groupCategories = availableCategories.filter((category) => category.functionalGroupId === group.id);
                  if (!groupCategories.length) return null;
                  return (
                    <optgroup key={group.id} label={group.name}>
                      {groupCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {(category.classificationType === 'profession' ? 'مهنة: ' : 'نشاط: ') + category.name}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
            </select>
          </label>
          <label className="block text-xs font-bold text-slate-700">
            التخصص الدقيق
            <select
              value={selectedSpecialty}
              disabled={!selectedTaxonomyCategory?.specialties?.length}
              onChange={(e) => setSelectedSpecialty(e.target.value)}
              className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-xs font-bold disabled:opacity-50"
            >
              <option value="all">كل التخصصات</option>
              {(selectedTaxonomyCategory?.specialties || []).map((specialty) => (
                <option key={specialty} value={specialty}>{specialty}</option>
              ))}
            </select>
          </label>
        </div>

        {/* Search & Location Filter Bar */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="بحث عن اسم نشاط، مطعم، خدمة، أو منتج..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl pr-10 pl-4 py-3 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold whitespace-nowrap">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>المحافظة (تصفية الإعلانات والأنشطة):</span>
            </div>
            <select
              value={selectedGovFilter}
              onChange={(e) => setSelectedGovFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs sm:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden"
            >
              <option value="all">كافة المحافظات المصرية (إعلانات عامة)</option>
              {uniqueGovernorships.map((gov) => (
                <option key={gov} value={gov}>
                  محافظة {gov}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Businesses Grid (Sorted by Proximity) */}
        <div className="space-y-6">
          <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-black text-lg text-slate-900 flex items-center gap-2">
              <Store className="w-5 h-5 text-emerald-600" />
              <span>الأنشطة والخدمات المتاحة ({filteredBusinesses.length})</span>
            </h2>
          </div>

          {filteredBusinesses.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center space-y-3">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                <Store className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-slate-800 text-base">
                {directoryLoading ? 'جارٍ تحميل الأنشطة المنشورة' : businesses.length === 0 ? 'لا توجد أنشطة متاحة للعرض حاليا' : 'لا توجد أنشطة مطابقة للبحث'}
              </h3>
              <p className="text-xs text-slate-500 max-w-lg mx-auto">
                {directoryLoading
                  ? 'يتم الآن تحميل الأنشطة المنشورة من المنصة، وستظهر هنا تلقائيًا.'
                  : businesses.length === 0
                  ? 'ستظهر هنا الأنشطة النشطة المتاحة للزوار. تواصل مع إدارة المنصة إذا كنت تبحث عن نشاط غير موجود.'
                  : 'جرب تغيير كلمات البحث أو تصنيف القطاع أو المحافظة.'}
              </p>
              {!directoryLoading && businesses.length === 0 && catalogRequestPhone && (
                <a
                  href={`https://wa.me/${catalogRequestPhone}?text=${encodeURIComponent('مرحبًا، أريد تفعيل كتالوج لنشاطي على MantiqatiX')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-xs font-bold text-white hover:bg-emerald-700 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  تواصل مع إدارة المنصة
                </a>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-6">
              {filteredBusinesses.map((biz) => {
                const group = functionalGroups.find((g) => g.id === biz.functionalGroupId);

                return (
                  <div
                    key={biz.id}
                    className="min-w-0 bg-white rounded-xl sm:rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col justify-between hover:shadow-md sm:hover:shadow-xl transition-all group"
                  >
                    <div>
                      {/* Cover Photo & Badges */}
                      <div className="relative h-20 sm:h-36 bg-slate-800 overflow-hidden">
                        <img
                          src={biz.coverUrl || BUSINESS_PLACEHOLDER}
                          alt={biz.name}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => {
                            const image = e.currentTarget;
                            if (!image.src.endsWith('/business-placeholder.svg')) image.src = BUSINESS_PLACEHOLDER;
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                        {/* Top Badges */}
                        <div className="absolute top-1 right-1 sm:top-3 sm:right-3 flex flex-wrap items-center gap-1">
                          {biz.isVerified && (
                            <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>موثّق</span>
                            </span>
                          )}
                          {group && (
                            <span className={`hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${group.badgeColor}`}>
                              {group.shortName}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Logo & Basic Info */}
                      <div className="p-2 sm:p-5 relative">
                        <div className="absolute -top-5 right-2 sm:-top-10 sm:right-5 w-8 h-8 sm:w-16 sm:h-16 rounded-lg sm:rounded-2xl bg-white p-0.5 sm:p-1 shadow-sm sm:shadow-md ring-1 sm:ring-2 ring-white overflow-hidden">
                          <img
                            src={biz.logoUrl || resolveDefaultImage({ name: biz.name, description: biz.bio, category: biz.category, kind: 'activity' })}
                            alt={biz.name}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover rounded-xl bg-slate-100"
                            onError={(e) => {
                              const image = e.currentTarget;
                              const fallback = resolveDefaultImage({ name: biz.name, description: biz.bio, category: biz.category, kind: 'cover' });
                        if (!image.src.endsWith(fallback.replace(/^.*\//, ''))) image.src = fallback;
                            }}
                          />
                        </div>

                        <div className="pt-4 sm:pt-4 space-y-1 sm:space-y-2">
                          <div className="flex items-center justify-between">
                            <h3 className="w-full break-words font-black text-xs sm:text-base text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-2">
                              {biz.name}
                            </h3>
                            <span className="hidden sm:inline-block text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              {biz.category}
                            </span>
                          </div>

                          <p className="hidden sm:block text-xs text-slate-500 line-clamp-2 leading-relaxed">
                            {biz.bio}
                          </p>

                          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 font-medium pt-1">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                            <span>{formatEgyptianLocation(biz.governorate, biz.markaz, biz.village)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Footer */}
                    <div className="p-1.5 sm:p-5 sm:pt-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1 sm:gap-3 border-t border-slate-100 mt-1 sm:mt-2">
                      {whatsappDigits(biz.ownerWhatsApp) ? (
                        <a
                          href={`https://wa.me/${whatsappDigits(biz.ownerWhatsApp)}?text=${encodeURIComponent(
                            `مرحباً، أود الاستفسار عن نشاطكم: ${biz.name}`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-black text-[10px] sm:text-xs py-2 sm:py-2.5 px-1 sm:px-3 rounded-lg sm:rounded-xl flex items-center justify-center gap-1 transition-colors"
                        >
                          <MessageCircle className="hidden sm:block w-4 h-4 text-emerald-600" />
                          <span>واتساب</span>
                        </a>
                      ) : (
                        <span className="flex-1 text-center text-xs text-slate-400 py-2.5">رقم التواصل غير متاح</span>
                      )}

                      {biz.publicEnabled ? (
                        <button
                          onClick={() => {
                            setSelectedBusinessId(biz.id);
                            setCurrentView('public_storefront');
                          }}
                          className="flex-1 bg-slate-900 hover:bg-emerald-600 text-white font-black text-[10px] sm:text-xs py-2 sm:py-2.5 px-1 sm:px-3 rounded-lg sm:rounded-xl flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-xs"
                        >
                          <span>الكتالوج</span>
                          <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                        </button>
                      ) : (
                        <span className="flex-1 text-center text-xs text-slate-500 bg-slate-50 rounded-xl py-2.5">قسم ضمن دليل المنصة</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
, /business\.publicEnabled \|\| business\.isOfficialShowcase/,
  'Homepage covers must use published businesses, not unsubmitted drafts.');
assert.match(import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityCategory,
  AdminSettings,
  AuthSession,
  Business,
  CartItem,
  CustomerOrderData,
  FunctionalGroup,
  FunctionalGroupId,
  Product,
  Subscriber,
} from '../types';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_FUNCTIONAL_GROUPS,
  INITIAL_ADMIN_SETTINGS,
  normalizeCanonicalTaxonomySettings,
} from '../data/productionDefaults';
import {
  createBackupPayload,
  generateAdminCatalogRequestWhatsAppUrl,
  generateGmailInviteUrl,
  generateStorePublicUrl,
  generateWhatsAppOrderUrl,
} from '../utils/rules';
import { bootstrapProductionUser, callCatalogAdmin, callPlatformAdmin, fetchPublicCatalog, fetchPublicDirectory, generateCatalogAiImage, mapBusiness, mapProducts, supabase } from '../lib/production';
import { resolveDefaultImage } from '../utils/defaultImages';

export type ViewMode = 'public_storefront' | 'merchant_admin' | 'super_admin' | 'login' | 'directory';

interface AppContextType {
  currentView: ViewMode;
  setCurrentView: (view: ViewMode) => void;
  selectedBusinessId: string;
  setSelectedBusinessId: (id: string) => void;
  currentBusiness: Business | undefined;
  functionalGroups: FunctionalGroup[];
  categories: ActivityCategory[];
  addCategory: (cat: { name: string; functionalGroupId: FunctionalGroupId; description?: string; classificationType?: 'activity' | 'profession'; specialties?: string[] }) => Promise<ActivityCategory>;
  updateCategory: (cat: ActivityCategory) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  selectedFunctionalGroupFilter: string;
  setSelectedFunctionalGroupFilter: (id: string) => void;
  selectedCategoryFilter: string;
  setSelectedCategoryFilter: (id: string) => void;
  authSession: AuthSession;
  loginAsSubscriber: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginAsAdmin: (password?: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  registerWithEmail: (fullName: string, email: string, password: string) => Promise<{ success: boolean; error?: string; message?: string; needsConfirmation?: boolean }>;
  authLoading: boolean;
  authBootstrapError: string;
  logout: () => void;
  isLoginModalOpen: boolean;
  setIsLoginModalOpen: (open: boolean) => void;
  businesses: Business[];
  directoryBusinesses: Business[];
  directoryLoading: boolean;
  products: Product[];
  subscribers: Subscriber[];
  adminSettings: AdminSettings;
  updateBusiness: (business: Business) => Promise<void>;
  addBusiness: (business: Omit<Business, 'id' | 'createdAt'>) => Promise<string>;
  deleteBusiness: (id: string) => Promise<void>;
  getStorePublicLink: (business: Business) => string;
  updateBusinessLocation: (businessId: string, loc: { governorate: string; markaz: string; village: string; address?: string }) => Promise<void>;
  confirmAdminPayment: (businessId: string) => Promise<void>;
  updateBillingSetting: (businessId: string, settings: Record<string, unknown>) => Promise<void>;
  toggleBusinessFreeze: (businessId: string) => Promise<void>;
  businessProducts: Product[];
  addProduct: (product: Omit<Product, 'id'> & { deferAiImageGeneration?: boolean }) => Promise<{ success: boolean; message?: string }>;
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addSubscriber: (sub: { fullName: string; email: string; phone: string; businessId: string; username?: string; password?: string; authMethod: 'direct_password' | 'gmail_invite'; notes?: string; }) => Promise<Subscriber>;
  saveSubscriberMembership: (input: { subscriber: Subscriber; tenantId: string; businessId?: string; branchId?: string; role: string; status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'; catalogEnabled: boolean; catalogWrite: boolean; accountRestricted: boolean; }) => Promise<Subscriber>;
  updateSubscriber: (sub: Subscriber) => Promise<void>;
  deleteSubscriber: (id: string) => Promise<void>;
  sendGmailInvite: (subscriberId: string) => string;
  getSubscriberCredentialsText: (subscriberId: string) => string;
  updateAdminSettings: (settings: Partial<AdminSettings>) => Promise<void>;
  addBusinessCategory: (category: string) => void;
  cartItems: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  submitOrderViaWhatsApp: (customer: CustomerOrderData) => { success: boolean; url?: string; error?: string };
  requestCatalogViaAdminWhatsApp: (business?: Business) => string;
  exportBackupJSON: () => string;
  downloadBackupFile: () => void;
  importBackupJSON: (jsonString: string) => { success: boolean; error?: string; counts?: { businesses: number; products: number; subscribers: number } };
}
const AppContext = createContext<AppContextType | null>(null);

const baseUrl = import.meta.env.BASE_URL || '/';
const publicBaseUrl = () => `${window.location.origin}${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}`;

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [directoryBusinesses, setDirectoryBusinesses] = useState<Business[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [adminSettings, setAdminSettings] = useState<AdminSettings>({ ...INITIAL_ADMIN_SETTINGS, adminPassword: '', platformName: 'MantiqatiX', currency: 'ج.م' });
  const [authSession, setAuthSession] = useState<AuthSession>({ role: 'guest', isAuthenticated: false });
  const [authLoading, setAuthLoading] = useState(true);
  const [authBootstrapError, setAuthBootstrapError] = useState('');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [selectedFunctionalGroupFilter, setSelectedFunctionalGroupFilter] = useState('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const initialRouteParams = new URLSearchParams(window.location.search);
  const [selectedBusinessId, setSelectedBusinessIdState] = useState(initialRouteParams.get('manage') || '');
  const routeBusinessIdRef = useRef(initialRouteParams.get('store') || initialRouteParams.get('businessId') || initialRouteParams.get('manage') || '');
  const [currentView, setCurrentViewState] = useState<ViewMode>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('store') || params.has('businessId')) return 'public_storefront';
    const requestedView = params.get('view');
    return requestedView === 'super_admin' || requestedView === 'merchant_admin' || requestedView === 'directory'
      ? requestedView
      : 'directory';
  });

  // Keep the SPA's visible view in the URL so refreshes and copied links reopen
  // the same screen. Public storefronts use the existing stable ?store=<businessId> link.
  const updateBrowserRoute = (view: ViewMode, businessId = routeBusinessIdRef.current) => {
    const url = new URL(window.location.href);
    url.searchParams.delete('store');
    url.searchParams.delete('businessId');
    url.searchParams.delete('manage');
    if (view === 'public_storefront') {
      url.searchParams.delete('view');
      url.searchParams.delete('tab');
      if (businessId) url.searchParams.set('store', businessId);
    } else {
      url.searchParams.delete('view');
      if (view !== 'super_admin') url.searchParams.delete('tab');
      if (view !== 'directory' && view !== 'login') url.searchParams.set('view', view);
      if ((view === 'super_admin' || view === 'merchant_admin') && businessId) {
        url.searchParams.set('manage', businessId);
      }
    }
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) window.history.pushState({ mantiqatixView: view }, '', nextUrl);
  };

  const setCurrentView = (view: ViewMode) => {
    setCurrentViewState(view);
    updateBrowserRoute(view);
  };

  const commitSelectedBusinessId = (id: string) => {
    routeBusinessIdRef.current = id;
    setSelectedBusinessIdState(id);
  };
  // Prevent overlapping auth events and duplicate INITIAL_SESSION/getSession hydration.
  const authLoadSequence = useRef(0);
  const authUserIdRef = useRef<string | null | undefined>(undefined);
  const lastAuthLoadKeyRef = useRef<string | null>(null);
  const functionalGroups = adminSettings.functionalGroups || DEFAULT_FUNCTIONAL_GROUPS;
  const categories = adminSettings.categories || DEFAULT_CATEGORIES;
  const currentBusiness = (() => {
    if (authSession.role === 'subscriber' && currentView === 'merchant_admin') {
      // Never fall back to another public business if the subscriber's authorized
      // business is missing from the current production bootstrap.
      return businesses.find((b) => b.id === authSession.businessId);
    }
    const selected = businesses.find((b) => b.id === selectedBusinessId);
    if (selected) return selected;
    return authSession.role === 'admin' ? businesses[0] : undefined;
  })();
  const businessProducts = products.filter((p) => p.businessId === currentBusiness?.id && currentBusiness?.operationalStatus === 'ACTIVE' && !currentBusiness?.isFrozen);

  const applyUser = async (user: any, isCurrent: () => boolean = () => true) => {
    const boot = await bootstrapProductionUser(user || null);
    if (!isCurrent()) return;
    setAuthBootstrapError('');
    setAuthSession(boot.authSession);
    setBusinesses(boot.businesses);
    setProducts(boot.products);
    setSubscribers(boot.subscribers);
    setAdminSettings({ ...boot.adminSettings, adminPassword: '' });

    const params = new URLSearchParams(window.location.search);
    const requestedId = params.get('store') || params.get('businessId') || '';
    const requestedView = params.get('view');
    // A newly signed-in account always lands on the public home directory.
    // Explicit, role-authorized dashboard routes are still restorable on refresh.
    const defaultView: ViewMode = 'directory';

    // A share URL must continue to open its public catalog for signed-in and guest
    // users alike, but it must never bypass the public-catalog API's publication gate.
    if (requestedId) {
      const byId = boot.businesses.find((b) =>
        (b.id === requestedId || b.slug === requestedId) &&
        (b.publicEnabled || b.isOfficialShowcase) &&
        !b.isFrozen
      );
      if (byId) {
        commitSelectedBusinessId(byId.id);
        setCurrentView('public_storefront');
        return;
      }
      if (/^[0-9a-f-]{36}$/i.test(requestedId)) {
        const publicCatalog = await fetchPublicCatalog(requestedId).catch(() => null);
        if (!isCurrent()) return;
        if (publicCatalog) {
          setBusinesses((prev) => [publicCatalog.business, ...prev.filter((b) => b.id !== publicCatalog.business.id)]);
          setProducts((prev) => [...prev.filter((p) => p.businessId !== publicCatalog.business.id), ...publicCatalog.products]);
          commitSelectedBusinessId(publicCatalog.business.id);
          setCurrentView('public_storefront');
          return;
        }
      }
      commitSelectedBusinessId('');
      setCurrentView(defaultView);
      return;
    }

    const safeRequestedView: ViewMode = requestedView === 'directory'
      ? 'directory'
      : boot.authSession.role === 'admin'
        ? requestedView === 'merchant_admin' || requestedView === 'super_admin' ? requestedView : 'directory'
        : boot.authSession.role === 'subscriber'
          ? requestedView === 'merchant_admin' ? 'merchant_admin' : 'directory'
          : 'directory';

    const requestedManagedId = params.get('manage') || '';
    const requestedManagedBusiness = boot.businesses.find((business) => business.id === requestedManagedId);
    const preferred = boot.authSession.role === 'admin' && requestedManagedBusiness
      ? requestedManagedId
      : boot.authSession.businessId || boot.businesses[0]?.id || '';
    commitSelectedBusinessId(preferred);
    setCurrentView(safeRequestedView);
  };

  // Load the public directory independently from authentication so visitors see published activities immediately.
  useEffect(() => {
    let active = true;
    fetchPublicDirectory()
      .then((directory) => { if (active) setDirectoryBusinesses(directory.businesses); })
      .catch((error) => { console.warn('[MantiqatiX public directory]', error); })
      .finally(() => { if (active) setDirectoryLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const loadSession = async (session: any, force = false) => {
      const incomingUserId = session?.user?.id || null;
      const sessionKey = incomingUserId
        ? `${incomingUserId}:${String(session?.access_token || 'no-token')}`
        : 'signed-out';
      if (!force && lastAuthLoadKeyRef.current === sessionKey) return;
      lastAuthLoadKeyRef.current = sessionKey;

      const identityChanged = authUserIdRef.current !== incomingUserId;
      if (identityChanged) {
        authUserIdRef.current = incomingUserId;
        // Drop the previous identity's data before the next identity is hydrated.
        // A valid Google session without a business membership is still a signed-in user,
        // but it does not receive owner/admin permissions.
        setAuthSession({
          role: 'guest',
          isAuthenticated: Boolean(session?.user),
          userId: incomingUserId || undefined,
          email: session?.user?.email || undefined,
        });
        setBusinesses([]);
        setProducts([]);
        setSubscribers([]);
        setSelectedBusinessIdState('');
        setCartItems([]);
        setCurrentView('directory');
        setAuthBootstrapError('');
        setAuthLoading(true);
      } else if (force) {
        setAuthBootstrapError('');
        setAuthLoading(true);
      }

      const sequence = ++authLoadSequence.current;
      const isCurrent = () => active && sequence === authLoadSequence.current;
      try {
        if (isCurrent()) await applyUser(session?.user || null, isCurrent);
      } catch (error) {
        console.error('[MantiqatiX production bootstrap]', error);
        if (isCurrent()) {
          setAuthBootstrapError(error instanceof Error ? error.message : 'تعذر تحميل صلاحيات الحساب من قاعدة الإنتاج.');
          // Allow another auth event or a fresh page load to retry the same session.
          if (lastAuthLoadKeyRef.current === sessionKey) lastAuthLoadKeyRef.current = null;
          if (session?.user) {
            setAuthSession((previous) => previous.userId === incomingUserId
              ? { ...previous, role: previous.role === 'admin' || previous.role === 'subscriber' ? previous.role : 'guest', isAuthenticated: true, userId: incomingUserId, email: session.user.email || previous.email }
              : previous);
          }
        }
      } finally {
        if (isCurrent()) setAuthLoading(false);
      }
    };

    void supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        return loadSession(data.session);
      })
      .catch((error) => {
        if (!active) return;
        console.error('[MantiqatiX getSession]', error);
        setAuthBootstrapError(error instanceof Error ? error.message : 'تعذر قراءة جلسة Google الحالية.');
        setAuthLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === 'INITIAL_SESSION' ||
        event === 'SIGNED_IN' ||
        event === 'SIGNED_OUT' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'USER_UPDATED' ||
        event === 'PASSWORD_RECOVERY'
      ) {
        queueMicrotask(() => {
          if (active) void loadSession(session, event === 'USER_UPDATED' || event === 'PASSWORD_RECOVERY');
        });
      }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const setSelectedBusinessId = (id: string) => {
    commitSelectedBusinessId(id);
    setCartItems([]);
    if (currentView === 'public_storefront') updateBrowserRoute('public_storefront', id);
    else if (currentView === 'merchant_admin' || currentView === 'super_admin') updateBrowserRoute(currentView, id);
  };

  // Restore the in-app view when the user navigates with browser back/forward.
  useEffect(() => {
    const restoreRouteFromLocation = () => {
      const params = new URLSearchParams(window.location.search);
      const requestedId = params.get('store') || params.get('businessId') || '';
      if (requestedId) {
        routeBusinessIdRef.current = requestedId;
        setSelectedBusinessIdState(requestedId);
        setCurrentViewState('public_storefront');
        const known = businesses.some((business) => business.id === requestedId || business.slug === requestedId);
        if (!known && /^[0-9a-f-]{36}$/i.test(requestedId)) {
          void fetchPublicCatalog(requestedId).then((catalog) => {
            if (!catalog) return;
            routeBusinessIdRef.current = catalog.business.id;
            setBusinesses((prev) => [catalog.business, ...prev.filter((business) => business.id !== catalog.business.id)]);
            setProducts((prev) => [...prev.filter((product) => product.businessId !== catalog.business.id), ...catalog.products]);
            setSelectedBusinessIdState(catalog.business.id);
          }).catch(() => undefined);
        }
        return;
      }
      const requestedView = params.get('view');
      const requestedManagedId = requestedView === 'super_admin' || requestedView === 'merchant_admin'
        ? params.get('manage') || ''
        : '';
      routeBusinessIdRef.current = requestedManagedId;
      setSelectedBusinessIdState(requestedManagedId);
      setCurrentViewState(
        requestedView === 'super_admin' || requestedView === 'merchant_admin' || requestedView === 'directory'
          ? requestedView
          : 'directory'
      );
    };
    window.addEventListener('popstate', restoreRouteFromLocation);
    return () => window.removeEventListener('popstate', restoreRouteFromLocation);
  }, [businesses]);

  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      // Always return OAuth to the canonical GitHub Pages app root.
      // Carrying arbitrary query/hash state into Supabase redirect allowlists can
      // cause a successful Google consent flow to return without hydrating the app.
      // Supabase currently allowlists the platform root. The root shell relays
      // only OAuth callback parameters to /catalog-app/ before loading its own app.
      const redirectTo = new URL('/MantiqatiX/', window.location.origin).toString();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, queryParams: { prompt: 'select_account' } },
      });
      if (error) return { success: false, error: error.message || 'تعذر تسجيل الدخول بحساب Google.' };
      return { success: true };
    } catch (error: any) { return { success: false, error: error?.message || 'تعذر بدء تسجيل الدخول بحساب Google.' }; }
  };

  const registerWithEmail = async (fullName: string, identifier: string, password: string): Promise<{ success: boolean; error?: string; message?: string; needsConfirmation?: boolean }> => {
    const email = identifier.trim().toLowerCase();
    if (!fullName.trim()) return { success: false, error: 'اكتب الاسم الكامل.' };
    if (!email.includes('@')) return { success: false, error: 'اكتب بريدًا إلكترونيًا صالحًا.' };
    if (password.length < 8) return { success: false, error: 'كلمة المرور يجب ألا تقل عن 8 أحرف.' };
    try {
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName.trim(), name: fullName.trim() },
          emailRedirectTo: redirectTo,
        },
      });
      if (error) return { success: false, error: error.message || 'تعذر إنشاء الحساب.' };
      if (!data.user) return { success: false, error: 'لم يتم إنشاء الحساب. حاول مرة أخرى.' };
      if (data.session) {
        const boot = await bootstrapProductionUser(data.user);
        setAuthSession(boot.authSession);
        setBusinesses(boot.businesses);
        setProducts(boot.products);
        setSubscribers(boot.subscribers);
        setAdminSettings({ ...boot.adminSettings, adminPassword: '' });
        setSelectedBusinessIdState(boot.authSession.businessId || boot.businesses[0]?.id || '');
        setCurrentView('directory');
        return { success: true, message: 'تم إنشاء الحساب. تفعيل صلاحيات صاحب النشاط يحتاج اعتماد إدارة المنصة.' };
      }
      return {
        success: true,
        needsConfirmation: true,
        message: 'تم تسجيل طلب إنشاء الحساب. افتح رسالة التأكيد المرسلة إلى بريدك الإلكتروني، وبعدها يمكنك تسجيل الدخول. اشتراك النشاط يحتاج اعتماد الإدارة.',
      };
    } catch (error: any) {
      return { success: false, error: error?.message || 'تعذر إنشاء الحساب حاليًا.' };
    }
  };

  const loginAsSubscriber = async (identifier: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const email = identifier.trim().toLowerCase();
    if (!email.includes('@')) return { success: false, error: 'استخدم البريد الإلكتروني الذي سلمته لك إدارة المنصة وليس اسم مستخدم تجريبيا.' };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return { success: false, error: 'بيانات البريد الإلكتروني أو كلمة المرور غير صحيحة.' };
    try {
      const boot = await bootstrapProductionUser(data.user);
      setAuthSession(boot.authSession); setBusinesses(boot.businesses); setProducts(boot.products); setSubscribers(boot.subscribers);
      setAdminSettings({ ...boot.adminSettings, adminPassword: '' });
      setSelectedBusinessIdState(boot.authSession.businessId || boot.businesses[0]?.id || '');
      setCurrentView(boot.authSession.role === 'admin' ? 'super_admin' : boot.authSession.role === 'subscriber' ? 'merchant_admin' : 'directory');
      setIsLoginModalOpen(false);
      return { success: true };
    } catch (e: any) {
      // Do not sign out a valid user just because the production-role bootstrap failed.
      // Preserve the Supabase session so the problem can be diagnosed and retried safely.
      return { success: false, error: e?.message || 'تم تسجيل الدخول لكن تعذر تحميل صلاحيات الحساب. حاول تحديث الصفحة، ولن يتم حذف الجلسة.' };
    }
  };

  const loginAsAdmin = async (_password?: string) => loginWithGoogle();
  const logout = () => {
    void supabase.auth.signOut();
    setAuthSession({ role: 'guest', isAuthenticated: false }); setBusinesses([]); setProducts([]); setSubscribers([]);
    setSelectedBusinessIdState(''); setCurrentView('directory'); setCartItems([]);
  };

  const addCategory = async (data: { name: string; functionalGroupId: FunctionalGroupId; description?: string; classificationType?: 'activity' | 'profession'; specialties?: string[] }): Promise<ActivityCategory> => {
    const name = data.name.trim();
    if (name.length < 2 || name.length > 120) throw new Error('اسم النشاط أو المهنة يجب أن يكون من حرفين إلى 120 حرفًا.');
    const normalized = normalizeCanonicalTaxonomySettings(adminSettings);
    const classificationType = data.classificationType || 'activity';
    const duplicate = normalized.categories.some((category) =>
      category.classificationType === classificationType &&
      category.name.trim().toLocaleLowerCase('ar') === name.toLocaleLowerCase('ar'));
    if (duplicate) throw new Error('هذا النشاط أو المهنة موجود بالفعل ضمن التصنيف المختار.');
    const newCat: ActivityCategory = {
      id: `cat_custom_${crypto.randomUUID()}`,
      name,
      functionalGroupId: data.functionalGroupId,
      description: data.description?.trim(),
      classificationType,
      specialties: (data.specialties || []).map((item) => String(item).trim()).filter(Boolean).slice(0, 100),
      isCustom: true,
    };
    const categories = [...normalized.categories, newCat];
    const saved = normalizeCanonicalTaxonomySettings({ ...adminSettings, categories, defaultCategories: categories.map((category) => category.name) });
    await updateAdminSettings({ functionalGroups: saved.functionalGroups, categories: saved.categories, defaultCategories: saved.defaultCategories });
    return newCat;
  };
  const updateCategory = async (updated: ActivityCategory): Promise<void> => {
    const normalized = normalizeCanonicalTaxonomySettings(adminSettings);
    const categories = normalized.categories.map((category) => category.id === updated.id
      ? { ...updated, name: updated.name.trim(), specialties: (updated.specialties || []).map((item) => String(item).trim()).filter(Boolean).slice(0, 100) }
      : category);
    const saved = normalizeCanonicalTaxonomySettings({ ...adminSettings, categories, defaultCategories: categories.map((category) => category.name) });
    await updateAdminSettings({ functionalGroups: saved.functionalGroups, categories: saved.categories, defaultCategories: saved.defaultCategories });
  };
  const deleteCategory = async (id: string): Promise<void> => {
    const normalized = normalizeCanonicalTaxonomySettings(adminSettings);
    const existing = normalized.categories.find((category) => category.id === id);
    if (!existing) return;
    if (!existing.isCustom) throw new Error('لا يمكن حذف التصنيفات الأساسية من الدليل المعتمد.');
    const categories = normalized.categories.filter((category) => category.id !== id);
    const saved = normalizeCanonicalTaxonomySettings({ ...adminSettings, categories, defaultCategories: categories.map((category) => category.name) });
    await updateAdminSettings({ functionalGroups: saved.functionalGroups, categories: saved.categories, defaultCategories: saved.defaultCategories });
  };

  const refreshBusinessCatalog = async (businessId: string) => {
    const business = businesses.find((b) => b.id === businessId);
    if (!business?.tenantId) return;
    const result: any = await callCatalogAdmin({ action: 'CATALOG_READ', tenantId: business.tenantId, businessId, ...(business.branchId ? { branchId: business.branchId } : {}) });
    const mapped = mapBusiness({ ...result.business, tenantId: business.tenantId, organizationId: business.organizationId, branchId: result.selectedBranchId, branches: result.branches, profile: result.business?.profile }, result.provider);
    setBusinesses((prev) => prev.map((b) => b.id === businessId ? mapped : b));
    const mappedProducts = mapProducts(businessId, business.tenantId, result.selectedBranchId, result.items || [], result.prices || []);
    setProducts((prev) => [...prev.filter((p) => p.businessId !== businessId), ...mappedProducts]);
  };

  const updateBusiness = async (updated: Business): Promise<void> => {
    if (!updated.tenantId || !updated.branchId) {
      throw new Error('لا يوجد نطاق إنتاجي صالح لهذا النشاط أو الفرع.');
    }

    const defaultCover = !updated.coverUrl?.trim() ||
      /(?:business-placeholder\.svg|catalog-item-placeholder\.svg|\/legacy\/activity\/|\/legacy\/mnty-cover-ad-)/i.test(updated.coverUrl);
    let coverUrl = updated.coverUrl?.trim() || '';
    if (defaultCover) {
      const generated = await generateCatalogAiImage({
        businessId: updated.id,
        kind: 'activity',
        name: updated.name,
        category: updated.category,
        description: updated.bio,
      });
      coverUrl = generated || resolveDefaultImage({
        name: updated.name, description: updated.bio, category: updated.category, kind: 'cover',
      });
    }

    const logoUrl = updated.logoUrl?.trim() || resolveDefaultImage({
      name: updated.name, description: updated.bio, category: updated.category, kind: 'activity',
    });

    await callCatalogAdmin({
      action: 'BUSINESS_PROFILE_UPSERT',
      tenantId: updated.tenantId,
      businessId: updated.id,
      branchId: updated.branchId,
      name: updated.name,
      bio: updated.bio || '',
      phone: updated.ownerWhatsApp || updated.phone || '',
      facebookUrl: updated.facebookUrl || '',
      instagramUrl: updated.instagramUrl || '',
      tiktokUrl: updated.tiktokUrl || '',
      address: updated.address || '',
      governorate: updated.governorate || '',
      markaz: updated.markaz || '',
      village: updated.village || '',
      workingHours: updated.workingHours || '',
      logoUrl,
      coverUrl,
      publicEnabled: Boolean(updated.publicEnabled),
    });
    // Profile edits must not rewrite billing metadata from a potentially stale client snapshot.
    // Billing updates use dedicated admin actions and remain independent from contact/branding edits.
    await refreshBusinessCatalog(updated.id);
  };

  const addBusiness = async (data: Omit<Business, 'id' | 'createdAt'>): Promise<string> => {
    if (authSession.role !== 'admin') throw new Error('إضافة الأنشطة متاحة لإدارة المنصة فقط.');
    const result: any = await callPlatformAdmin({ action: 'CREATE_BUSINESS', business: { name: data.name, category: data.category, activityGroupCode: data.functionalGroupId, activityClassificationType: data.categoryClassificationType || 'activity', activitySpecialty: data.activitySpecialty || '', bio: data.bio, phone: data.ownerWhatsApp || data.phone || '', address: data.address || '', governorate: data.governorate || '', markaz: data.markaz || '', village: data.village || '', workingHours: data.workingHours || '', logoUrl: data.logoUrl || '', coverUrl: data.coverUrl || '', slug: data.slug || '', publishNow: Boolean(data.publicEnabled), subscriptionMode: data.subscriptionMode || 'PAID', subscriptionAmount: data.subscriptionAmount ?? 0, paymentDueDate: data.paymentDueDate, paymentGracePeriodDays: data.paymentGracePeriodDays ?? 7 } });
    if (!result?.business?.id) throw new Error('لم يرجع الخادم معرف النشاط المنشأ.');
    await applyUser((await supabase.auth.getUser()).data.user);
    setSelectedBusinessIdState(result.business.id);
    return result.business.id;
  };

  const updateBusinessLocation = async (businessId: string, loc: { governorate: string; markaz: string; village: string; address?: string }): Promise<void> => {
    const business = businesses.find((b) => b.id === businessId);
    if (!business) throw new Error('النشاط المطلوب غير موجود في بيانات الإنتاج الحالية.');
    await updateBusiness({ ...business, governorate: loc.governorate, markaz: loc.markaz, village: loc.village, address: loc.address ?? business.address });
  };
  const updateBillingSetting = async (businessId: string, settings: Record<string, unknown>): Promise<void> => {
    const business = businesses.find((item) => item.id === businessId);
    if (!business?.tenantId) throw new Error('النشاط غير مرتبط ببيانات الإنتاج.');
    if (authSession.role !== 'admin') throw new Error('تعديل حالة السداد متاح لمالك المنصة فقط.');
    await callPlatformAdmin({ action: 'BUSINESS_SETTINGS_UPDATE', businessId, tenantId: business.tenantId, settings });
    setBusinesses((prev) => prev.map((item) => item.id === businessId ? { ...item, ...settings } as Business : item));
  };
  const confirmAdminPayment = async (businessId: string): Promise<void> => {
    const business = businesses.find((item) => item.id === businessId);
    if (!business?.tenantId || authSession.role !== 'admin') throw new Error('تأكيد السداد متاح لمالك المنصة بعد التحقق من الحساب.');
    const today = new Date().toISOString().slice(0, 10);
    await updateBillingSetting(businessId, {
      paymentConfirmedByAdmin: true, paymentStatus: 'paid', overdueDaysCount: 0,
      isFrozen: false, lastPaymentDate: today,
    });
    setBusinesses((prev) => prev.map((item) => item.id === businessId
      ? { ...item, paymentConfirmedByAdmin: true, paymentStatus: 'paid', overdueDaysCount: 0, isFrozen: false, lastPaymentDate: today }
      : item));
    const pending = subscribers.filter((subscriber) => subscriber.businessId === businessId && subscriber.status === 'pending');
    for (const subscriber of pending) {
      await callPlatformAdmin({ action: 'SUBSCRIBER_STATUS', membershipId: subscriber.id, status: 'ACTIVE' });
      setSubscribers((prev) => prev.map((item) => item.id === subscriber.id ? { ...item, status: 'active' } : item));
    }
  };
  const toggleBusinessFreeze = async (businessId: string): Promise<void> => {
    const business = businesses.find((item) => item.id === businessId);
    if (!business) throw new Error('النشاط المطلوب غير موجود.');
    const frozen = !business.isFrozen;
    // Freeze is an independent operational flag. Do not overwrite the underlying
    // payment status: doing so loses whether the account was paid or overdue.
    await updateBillingSetting(businessId, { isFrozen: frozen });
    setBusinesses((prev) => prev.map((item) => item.id === businessId ? { ...item, isFrozen: frozen } : item));
  };
  const deleteBusiness = async (id: string) => {
    const business = businesses.find((b) => b.id === id); if (!business?.tenantId) throw new Error('النشاط غير مرتبط بقاعدة الإنتاج.');
    if (authSession.role !== 'admin') throw new Error('تعطيل الأنشطة من اختصاص إدارة المنصة.');
    await callPlatformAdmin({ action: 'DELETE_BUSINESS', businessId: id, tenantId: business.tenantId });
    setBusinesses((prev) => prev.filter((b) => b.id !== id)); setProducts((prev) => prev.filter((p) => p.businessId !== id));
    if (selectedBusinessId === id) setSelectedBusinessIdState('');
  };

  const getStorePublicLink = (business: Business) =>
    generateStorePublicUrl(window.location.origin, business.id, baseUrl);
  const addProduct = async (data: Omit<Product, 'id'> & { deferAiImageGeneration?: boolean }): Promise<{ success: boolean; message?: string }> => {
    const business = businesses.find((b) => b.id === data.businessId);
    if (!business?.tenantId || !business.branchId) return { success: false, message: 'النشاط أو الفرع غير مرتبط ببيانات الإنتاج.' };
    // Preserve a user-reviewed AI suggestion or an owner-supplied image URL.
    // Bulk import can defer automatic generation without discarding an explicitly approved suggestion.
    let imageSource: 'auto' | 'owner' | 'ai' =
      (data.imageSource === 'owner' || data.imageSource === 'ai') && Boolean(data.imageUrl?.trim())
        ? data.imageSource
        : 'auto';
    let imageUrl = imageSource === 'owner' || imageSource === 'ai'
      ? data.imageUrl.trim()
      : resolveDefaultImage({ name: data.name, description: data.description, category: data.category, kind: data.type === 'service' ? 'service' : 'product' });
    if (imageSource === 'auto' && data.deferAiImageGeneration !== true) {
      const generated = await generateCatalogAiImage({
        businessId: business.id,
        kind: data.type,
        name: data.name,
        category: data.category,
        description: data.description,
      });
      if (generated) {
        imageUrl = generated;
        imageSource = 'ai';
      }
    }
    const metadata = { catalog_public: { category: data.category, unit: data.unit || '', image_url: imageUrl, image_source: imageSource, compare_price: data.comparePrice ?? null, is_available: data.isAvailable, track_stock: false, ...(data.requiresQuote ? { show_price: false } : {}) } };
    try {
      if (data.requiresQuote) {
        await callCatalogAdmin({ action: 'ITEM_UPSERT', tenantId: business.tenantId, businessId: business.id, branchId: business.branchId, nameAr: data.name, itemType: 'SERVICE', description: data.description, taxRate: 0, metadata });
      } else {
        await callCatalogAdmin({ action: 'ITEM_PRICE_UPSERT', tenantId: business.tenantId, businessId: business.id, branchId: business.branchId, nameAr: data.name, itemType: data.type === 'service' ? 'SERVICE' : 'PRODUCT', description: data.description, unitPrice: data.price, currency: 'EGP', metadata });
      }
      await refreshBusinessCatalog(data.businessId); return { success: true };
    } catch (e: any) { return { success: false, message: e?.message || 'تعذر حفظ المنتج في قاعدة الإنتاج.' }; }
  };
  const updateProduct = async (updated: Product) => {
    const business = businesses.find((b) => b.id === updated.businessId);
    if (!business?.tenantId || !business.branchId) throw new Error('النشاط أو الفرع غير مرتبط ببيانات الإنتاج.');
    const previous = products.find((product) => product.id === updated.id);
    let imageSource: 'auto' | 'owner' | 'ai' = updated.imageSource === 'ai' && Boolean(updated.imageUrl?.trim())
      ? 'ai'
      : updated.imageSource === 'owner' && Boolean(updated.imageUrl?.trim()) ? 'owner' : 'auto';
    let imageUrl = imageSource === 'owner' || imageSource === 'ai'
      ? updated.imageUrl.trim()
      : resolveDefaultImage({ name: updated.name, description: updated.description, category: updated.category, kind: updated.type === 'service' ? 'service' : 'product' });
    // Don't spend another image-generation request for price/availability-only edits.
    // Regenerate only for a new auto image or when its descriptive context changes.
    const shouldGenerate = imageSource === 'auto' && (
      !previous ||
      previous.imageSource !== 'auto' ||
      previous.name !== updated.name ||
      previous.description !== updated.description ||
      previous.category !== updated.category ||
      previous.type !== updated.type
    );
    if (shouldGenerate) {
      const generated = await generateCatalogAiImage({
        businessId: business.id,
        kind: updated.type,
        name: updated.name,
        category: updated.category,
        description: updated.description,
      });
      if (generated) {
        imageUrl = generated;
        imageSource = 'ai';
      }
    }
    const metadata = { catalog_public: { category: updated.category, unit: updated.unit || '', image_url: imageUrl, image_source: imageSource, compare_price: updated.comparePrice ?? null, is_available: updated.isAvailable, track_stock: false, ...(updated.requiresQuote ? { show_price: false } : {}) } };
    if (updated.requiresQuote) {
      await callCatalogAdmin({ action: 'ITEM_UPSERT', tenantId: business.tenantId, businessId: business.id, branchId: business.branchId, id: updated.id, nameAr: updated.name, itemType: 'SERVICE', description: updated.description, taxRate: 0, metadata });
    } else {
      await callCatalogAdmin({ action: 'ITEM_PRICE_UPSERT', tenantId: business.tenantId, businessId: business.id, branchId: business.branchId, id: updated.id, nameAr: updated.name, itemType: updated.type === 'service' ? 'SERVICE' : 'PRODUCT', description: updated.description, unitPrice: updated.price, currency: 'EGP', metadata });
    }
    await refreshBusinessCatalog(updated.businessId);
  };
  const deleteProduct = async (id: string) => {
    const product = products.find((p) => p.id === id); const business = product && businesses.find((b) => b.id === product.businessId);
    if (!product || !business?.tenantId || !business.branchId) throw new Error('العنصر أو نطاقه الإنتاجي غير موجود.');
    await callCatalogAdmin({ action: 'ITEM_STATUS_UPDATE', tenantId: business.tenantId, businessId: business.id, branchId: business.branchId, catalogItemId: id, status: 'INACTIVE' });
    setCartItems((prev) => prev.filter((x) => x.product.id !== id)); await refreshBusinessCatalog(product.businessId);
  };

  const addSubscriber = async (data: { fullName: string; email: string; phone: string; businessId: string; username?: string; password?: string; authMethod: 'direct_password' | 'gmail_invite'; notes?: string }): Promise<Subscriber> => {
    if (authSession.role !== 'admin') throw new Error('إضافة المشتركين متاحة لإدارة المنصة فقط.');
    const business = businesses.find((b) => b.id === data.businessId);
    if (!business?.tenantId) throw new Error('اختر نشاطا مرتبطا بقاعدة الإنتاج.');
    const email = data.email.trim().toLowerCase();
    const result: any = await callPlatformAdmin({
      action: 'CREATE_SUBSCRIBER',
      businessId: business.id,
      tenantId: business.tenantId,
      email,
      fullName: data.fullName.trim(),
      phone: data.phone || '',
    });
    const id = String(result.membershipId || result.id || result.userId);
    const backendStatus = String(result.status || 'INACTIVE').toUpperCase();
    const created: Subscriber = {
      id,
      fullName: data.fullName.trim(),
      email,
      phone: data.phone,
      businessId: business.id,
      status: backendStatus === 'ACTIVE' ? 'active' : backendStatus === 'SUSPENDED' ? 'suspended' : 'pending',
      username: email,
      authMethod: 'gmail_invite',
      inviteStatus: 'pending',
      notes: data.notes,
      joinedDate: new Date().toISOString().slice(0, 10),
    };
    setSubscribers((prev) => [created, ...prev.filter((s) => s.id !== id)]);
    return created;
  };
  const saveSubscriberMembership = async (input: {
    subscriber: Subscriber;
    tenantId: string;
    businessId?: string;
    branchId?: string;
    role: string;
    status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    catalogEnabled: boolean;
    catalogWrite: boolean;
    accountRestricted: boolean;
  }): Promise<Subscriber> => {
    if (authSession.role !== 'admin') throw new Error('إدارة أدوار الحسابات والصلاحيات متاحة لمالك المنصة فقط.');
    const source = input.subscriber;
    if (!source.userId) throw new Error('هذا الصف لا يحتوي على معرّف حساب Supabase صالح.');
    const result: any = await callPlatformAdmin({
      action: 'SAVE_MEMBERSHIP',
      ...(source.isAccountOnly ? {} : { membershipId: source.id }),
      userId: source.userId,
      tenantId: input.tenantId,
      businessId: input.businessId || '',
      branchId: input.branchId || '',
      role: input.role,
      status: input.status,
      catalogEnabled: input.catalogEnabled,
      catalogWrite: input.catalogWrite,
      accountRestricted: input.accountRestricted,
    });
    const membership = result?.membership;
    if (result?.success !== true || !membership?.id) throw new Error('لم يؤكد الخادم حفظ تعيين الدور والصلاحيات.');
    const mapped: Subscriber = {
      ...source,
      id: String(membership.id),
      userId: String(membership.userId || source.userId),
      tenantId: String(membership.tenantId || input.tenantId),
      organizationId: String(membership.organizationId || ''),
      businessId: String(membership.businessId || ''),
      businessName: String(membership.businessName || businesses.find((b) => b.id === String(membership.businessId || ''))?.name || ''),
      branchId: String(membership.branchId || ''),
      role: String(membership.role || input.role),
      membershipStatus: String(membership.status || input.status),
      permissions: membership.permissions && typeof membership.permissions === 'object' ? membership.permissions : {},
      status: String(membership.status || input.status) === 'ACTIVE' ? 'active' : String(membership.status || input.status) === 'SUSPENDED' ? 'suspended' : 'pending',
      isAccountOnly: false,
      password: undefined,
    };
    setSubscribers((prev) => [
      mapped,
      ...prev.filter((item) => item.id !== source.id && !(item.isAccountOnly && item.userId === mapped.userId)),
    ]);
    return mapped;
  };

  const updateSubscriber = async (updated: Subscriber) => {
    if (updated.status === 'active') {
      const business = businesses.find((item) => item.id === updated.businessId);
      const freeActivation = business?.subscriptionMode === 'FREE' && business.subscriptionAmount === 0
        && business.freeActivationApprovedByAdmin === true && String(business.paymentStatus || '').toLowerCase() === 'free';
      const paidAndConfirmed = String(business?.paymentStatus || '').toLowerCase() === 'paid' && business?.paymentConfirmedByAdmin === true;
      if (!business || (!freeActivation && !paidAndConfirmed)) {
        throw new Error('لا يمكن تفعيل الاشتراك قبل تأكيد السداد أو اعتماد التفعيل المجاني من إدارة المنصة.');
      }
    }
    await callPlatformAdmin({ action: 'SUBSCRIBER_STATUS', membershipId: updated.id, status: updated.status === 'active' ? 'ACTIVE' : updated.status === 'suspended' ? 'SUSPENDED' : 'INACTIVE' });
    setSubscribers((prev) => prev.map((s) => s.id === updated.id ? { ...updated, password: undefined } : s));
  };
  const deleteSubscriber = async (id: string) => {
    const target = subscribers.find((s) => s.id === id);
    if (!target || target.isAccountOnly || id.startsWith('ACCOUNT:')) {
      throw new Error('هذا حساب Google لم يُسند إلى عضوية بعد. استخدم إدارة الدور لتعيينه أو تقييده.');
    }
    await callPlatformAdmin({ action: 'SUBSCRIBER_STATUS', membershipId: id, status: 'INACTIVE' });
    setSubscribers((prev) => prev.map((s) => s.id === id
      ? { ...s, status: 'pending', membershipStatus: 'INACTIVE', password: undefined }
      : s));
  };
  const sendGmailInvite = (id: string) => {
    const sub = subscribers.find((s) => s.id === id);
    if (!sub) return '';
    const biz = businesses.find((b) => b.id === sub.businessId);
    return generateGmailInviteUrl(sub.email, sub.fullName, biz?.name || 'نشاطك التجاري', publicBaseUrl(), sub.email, undefined);
  };
  const getSubscriberCredentialsText = (id: string) => {
    const sub = subscribers.find((s) => s.id === id);
    if (!sub) return '';
    return `منطقتي X | MantiqatiX
اسم المشترك: ${sub.fullName}
النشاط: ${businesses.find((b) => b.id === sub.businessId)?.name || 'النشاط'}
البريد المرتبط بحساب Google: ${sub.email}

طريقة الدخول: اضغط "المتابعة باستخدام Google" واختر نفس حساب Google أعلاه.
حالة الاشتراك: ${sub.status === 'active' ? 'نشط' : sub.status === 'pending' ? 'بانتظار تأكيد السداد' : 'موقوف'}.
لا تُفعّل صلاحيات إدارة النشاط إلا بعد تأكيد السداد من إدارة المنصة.`;
  };
  const updateAdminSettings = async (settings: Partial<AdminSettings>): Promise<void> => {
    if (authSession.role !== 'admin') throw new Error('حفظ إعدادات المنصة متاح لمالك المنصة بعد التحقق من Google فقط.');
    const safe = { ...settings };
    delete (safe as any).adminPassword;
    const result: any = await callPlatformAdmin({ action: 'SAVE_SETTINGS', settings: safe });
    if (result?.success !== true) throw new Error('لم يؤكد الخادم حفظ إعدادات المنصة.');
    setAdminSettings((prev) => ({ ...prev, ...safe, adminPassword: '' }));
  };
  const addBusinessCategory = (category: string) => { const name = category.trim(); if (!name || adminSettings.defaultCategories.includes(name)) return; setAdminSettings((prev) => ({ ...prev, defaultCategories: [...prev.defaultCategories, name] })); };

  const addToCart = (product: Product, quantity = 1) => {
    if (currentBusiness?.operationalStatus !== 'ACTIVE' || currentBusiness?.isFrozen) { window.alert('هذا النشاط موقوف أو مجمّد ولا يستقبل طلبات جديدة.'); return; }
    setCartItems((prev) => { const match = prev.find((item) => item.product.id === product.id); return match ? prev.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + quantity } : item) : [...prev, { product, quantity }]; });
    setIsCartOpen(true);
  };
  const removeFromCart = (id: string) => setCartItems((prev) => prev.filter((item) => item.product.id !== id));
  const updateCartQuantity = (id: string, quantity: number) => { if (quantity <= 0) { removeFromCart(id); return; } setCartItems((prev) => prev.map((item) => item.product.id === id ? { ...item, quantity } : item)); };
  const clearCart = () => setCartItems([]);
  const submitOrderViaWhatsApp = (customer: CustomerOrderData): { success: boolean; url?: string; error?: string } => {
    if (!cartItems.length) return { success: false, error: 'السلة فارغة، يرجى إضافة منتجات أولا.' };
    if (!currentBusiness) return { success: false, error: 'النشاط الحالي غير محدد.' };
    const ownerPhoneDigits = String(currentBusiness.ownerWhatsApp || '').replace(/\D/g, '');
    if (ownerPhoneDigits.length < 10 || ownerPhoneDigits.length > 15) return { success: false, error: 'رقم واتساب صاحب النشاط غير متوفر أو غير صالح.' };
    if (!customer.customerName.trim() || !customer.customerPhone.trim()) return { success: false, error: 'يرجى كتابة الاسم ورقم الهاتف للطلب.' };
    return { success: true, url: generateWhatsAppOrderUrl(currentBusiness.ownerWhatsApp, currentBusiness.name, cartItems, customer, adminSettings.currency || 'ج.م') };
  };
  const requestCatalogViaAdminWhatsApp = (business = currentBusiness) => business ? generateAdminCatalogRequestWhatsAppUrl(adminSettings.adminWhatsApp, business.name, business.category) : '';
  const exportBackupJSON = () => createBackupPayload(businesses, products, subscribers, adminSettings);
  const downloadBackupFile = () => { const blob = new Blob([exportBackupJSON()], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `mantiqatix-backup-${new Date().toISOString().slice(0,10)}.json`; link.click(); URL.revokeObjectURL(url); };
  const importBackupJSON = (_jsonString: string) => ({ success: false, error: 'استيراد البيانات إلى الإنتاج متوقف حتى تتم مراجعة الملف ومخطط قاعدة البيانات. لم يتم تغيير أي بيانات.' });

  return <AppContext.Provider value={{
    currentView, setCurrentView, selectedBusinessId, setSelectedBusinessId, currentBusiness,
    functionalGroups, categories, addCategory, updateCategory, deleteCategory, selectedFunctionalGroupFilter, setSelectedFunctionalGroupFilter, selectedCategoryFilter, setSelectedCategoryFilter,
    authSession, authLoading, loginWithGoogle, registerWithEmail, loginAsSubscriber, loginAsAdmin, logout, isLoginModalOpen, setIsLoginModalOpen,
    businesses, directoryBusinesses, directoryLoading, products, subscribers, adminSettings, updateBusiness, addBusiness, deleteBusiness, getStorePublicLink, updateBusinessLocation,
    confirmAdminPayment, updateBillingSetting, toggleBusinessFreeze,
    businessProducts, addProduct, updateProduct, deleteProduct, addSubscriber, saveSubscriberMembership, updateSubscriber, deleteSubscriber, sendGmailInvite, getSubscriberCredentialsText, updateAdminSettings, addBusinessCategory,
    cartItems, addToCart, removeFromCart, updateCartQuantity, clearCart, isCartOpen, setIsCartOpen, submitOrderViaWhatsApp, requestCatalogViaAdminWhatsApp,
    exportBackupJSON, downloadBackupFile, importBackupJSON,
    authBootstrapError,
  }}> {children} </AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
, /await refreshBusinessCatalog\(updated\.id\)/,
  'Business profile changes must refresh from canonical production data after the awaited write.');
assert.match(import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityCategory,
  AdminSettings,
  AuthSession,
  Business,
  CartItem,
  CustomerOrderData,
  FunctionalGroup,
  FunctionalGroupId,
  Product,
  Subscriber,
} from '../types';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_FUNCTIONAL_GROUPS,
  INITIAL_ADMIN_SETTINGS,
  normalizeCanonicalTaxonomySettings,
} from '../data/productionDefaults';
import {
  createBackupPayload,
  generateAdminCatalogRequestWhatsAppUrl,
  generateGmailInviteUrl,
  generateStorePublicUrl,
  generateWhatsAppOrderUrl,
} from '../utils/rules';
import { bootstrapProductionUser, callCatalogAdmin, callPlatformAdmin, fetchPublicCatalog, fetchPublicDirectory, generateCatalogAiImage, mapBusiness, mapProducts, supabase } from '../lib/production';
import { resolveDefaultImage } from '../utils/defaultImages';

export type ViewMode = 'public_storefront' | 'merchant_admin' | 'super_admin' | 'login' | 'directory';

interface AppContextType {
  currentView: ViewMode;
  setCurrentView: (view: ViewMode) => void;
  selectedBusinessId: string;
  setSelectedBusinessId: (id: string) => void;
  currentBusiness: Business | undefined;
  functionalGroups: FunctionalGroup[];
  categories: ActivityCategory[];
  addCategory: (cat: { name: string; functionalGroupId: FunctionalGroupId; description?: string; classificationType?: 'activity' | 'profession'; specialties?: string[] }) => Promise<ActivityCategory>;
  updateCategory: (cat: ActivityCategory) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  selectedFunctionalGroupFilter: string;
  setSelectedFunctionalGroupFilter: (id: string) => void;
  selectedCategoryFilter: string;
  setSelectedCategoryFilter: (id: string) => void;
  authSession: AuthSession;
  loginAsSubscriber: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginAsAdmin: (password?: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  registerWithEmail: (fullName: string, email: string, password: string) => Promise<{ success: boolean; error?: string; message?: string; needsConfirmation?: boolean }>;
  authLoading: boolean;
  authBootstrapError: string;
  logout: () => void;
  isLoginModalOpen: boolean;
  setIsLoginModalOpen: (open: boolean) => void;
  businesses: Business[];
  directoryBusinesses: Business[];
  directoryLoading: boolean;
  products: Product[];
  subscribers: Subscriber[];
  adminSettings: AdminSettings;
  updateBusiness: (business: Business) => Promise<void>;
  addBusiness: (business: Omit<Business, 'id' | 'createdAt'>) => Promise<string>;
  deleteBusiness: (id: string) => Promise<void>;
  getStorePublicLink: (business: Business) => string;
  updateBusinessLocation: (businessId: string, loc: { governorate: string; markaz: string; village: string; address?: string }) => Promise<void>;
  confirmAdminPayment: (businessId: string) => Promise<void>;
  updateBillingSetting: (businessId: string, settings: Record<string, unknown>) => Promise<void>;
  toggleBusinessFreeze: (businessId: string) => Promise<void>;
  businessProducts: Product[];
  addProduct: (product: Omit<Product, 'id'> & { deferAiImageGeneration?: boolean }) => Promise<{ success: boolean; message?: string }>;
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addSubscriber: (sub: { fullName: string; email: string; phone: string; businessId: string; username?: string; password?: string; authMethod: 'direct_password' | 'gmail_invite'; notes?: string; }) => Promise<Subscriber>;
  saveSubscriberMembership: (input: { subscriber: Subscriber; tenantId: string; businessId?: string; branchId?: string; role: string; status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'; catalogEnabled: boolean; catalogWrite: boolean; accountRestricted: boolean; }) => Promise<Subscriber>;
  updateSubscriber: (sub: Subscriber) => Promise<void>;
  deleteSubscriber: (id: string) => Promise<void>;
  sendGmailInvite: (subscriberId: string) => string;
  getSubscriberCredentialsText: (subscriberId: string) => string;
  updateAdminSettings: (settings: Partial<AdminSettings>) => Promise<void>;
  addBusinessCategory: (category: string) => void;
  cartItems: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  submitOrderViaWhatsApp: (customer: CustomerOrderData) => { success: boolean; url?: string; error?: string };
  requestCatalogViaAdminWhatsApp: (business?: Business) => string;
  exportBackupJSON: () => string;
  downloadBackupFile: () => void;
  importBackupJSON: (jsonString: string) => { success: boolean; error?: string; counts?: { businesses: number; products: number; subscribers: number } };
}
const AppContext = createContext<AppContextType | null>(null);

const baseUrl = import.meta.env.BASE_URL || '/';
const publicBaseUrl = () => `${window.location.origin}${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}`;

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [directoryBusinesses, setDirectoryBusinesses] = useState<Business[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [adminSettings, setAdminSettings] = useState<AdminSettings>({ ...INITIAL_ADMIN_SETTINGS, adminPassword: '', platformName: 'MantiqatiX', currency: 'ج.م' });
  const [authSession, setAuthSession] = useState<AuthSession>({ role: 'guest', isAuthenticated: false });
  const [authLoading, setAuthLoading] = useState(true);
  const [authBootstrapError, setAuthBootstrapError] = useState('');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [selectedFunctionalGroupFilter, setSelectedFunctionalGroupFilter] = useState('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const initialRouteParams = new URLSearchParams(window.location.search);
  const [selectedBusinessId, setSelectedBusinessIdState] = useState(initialRouteParams.get('manage') || '');
  const routeBusinessIdRef = useRef(initialRouteParams.get('store') || initialRouteParams.get('businessId') || initialRouteParams.get('manage') || '');
  const [currentView, setCurrentViewState] = useState<ViewMode>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('store') || params.has('businessId')) return 'public_storefront';
    const requestedView = params.get('view');
    return requestedView === 'super_admin' || requestedView === 'merchant_admin' || requestedView === 'directory'
      ? requestedView
      : 'directory';
  });

  // Keep the SPA's visible view in the URL so refreshes and copied links reopen
  // the same screen. Public storefronts use the existing stable ?store=<businessId> link.
  const updateBrowserRoute = (view: ViewMode, businessId = routeBusinessIdRef.current) => {
    const url = new URL(window.location.href);
    url.searchParams.delete('store');
    url.searchParams.delete('businessId');
    url.searchParams.delete('manage');
    if (view === 'public_storefront') {
      url.searchParams.delete('view');
      url.searchParams.delete('tab');
      if (businessId) url.searchParams.set('store', businessId);
    } else {
      url.searchParams.delete('view');
      if (view !== 'super_admin') url.searchParams.delete('tab');
      if (view !== 'directory' && view !== 'login') url.searchParams.set('view', view);
      if ((view === 'super_admin' || view === 'merchant_admin') && businessId) {
        url.searchParams.set('manage', businessId);
      }
    }
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) window.history.pushState({ mantiqatixView: view }, '', nextUrl);
  };

  const setCurrentView = (view: ViewMode) => {
    setCurrentViewState(view);
    updateBrowserRoute(view);
  };

  const commitSelectedBusinessId = (id: string) => {
    routeBusinessIdRef.current = id;
    setSelectedBusinessIdState(id);
  };
  // Prevent overlapping auth events and duplicate INITIAL_SESSION/getSession hydration.
  const authLoadSequence = useRef(0);
  const authUserIdRef = useRef<string | null | undefined>(undefined);
  const lastAuthLoadKeyRef = useRef<string | null>(null);
  const functionalGroups = adminSettings.functionalGroups || DEFAULT_FUNCTIONAL_GROUPS;
  const categories = adminSettings.categories || DEFAULT_CATEGORIES;
  const currentBusiness = (() => {
    if (authSession.role === 'subscriber' && currentView === 'merchant_admin') {
      // Never fall back to another public business if the subscriber's authorized
      // business is missing from the current production bootstrap.
      return businesses.find((b) => b.id === authSession.businessId);
    }
    const selected = businesses.find((b) => b.id === selectedBusinessId);
    if (selected) return selected;
    return authSession.role === 'admin' ? businesses[0] : undefined;
  })();
  const businessProducts = products.filter((p) => p.businessId === currentBusiness?.id && currentBusiness?.operationalStatus === 'ACTIVE' && !currentBusiness?.isFrozen);

  const applyUser = async (user: any, isCurrent: () => boolean = () => true) => {
    const boot = await bootstrapProductionUser(user || null);
    if (!isCurrent()) return;
    setAuthBootstrapError('');
    setAuthSession(boot.authSession);
    setBusinesses(boot.businesses);
    setProducts(boot.products);
    setSubscribers(boot.subscribers);
    setAdminSettings({ ...boot.adminSettings, adminPassword: '' });

    const params = new URLSearchParams(window.location.search);
    const requestedId = params.get('store') || params.get('businessId') || '';
    const requestedView = params.get('view');
    // A newly signed-in account always lands on the public home directory.
    // Explicit, role-authorized dashboard routes are still restorable on refresh.
    const defaultView: ViewMode = 'directory';

    // A share URL must continue to open its public catalog for signed-in and guest
    // users alike, but it must never bypass the public-catalog API's publication gate.
    if (requestedId) {
      const byId = boot.businesses.find((b) =>
        (b.id === requestedId || b.slug === requestedId) &&
        (b.publicEnabled || b.isOfficialShowcase) &&
        !b.isFrozen
      );
      if (byId) {
        commitSelectedBusinessId(byId.id);
        setCurrentView('public_storefront');
        return;
      }
      if (/^[0-9a-f-]{36}$/i.test(requestedId)) {
        const publicCatalog = await fetchPublicCatalog(requestedId).catch(() => null);
        if (!isCurrent()) return;
        if (publicCatalog) {
          setBusinesses((prev) => [publicCatalog.business, ...prev.filter((b) => b.id !== publicCatalog.business.id)]);
          setProducts((prev) => [...prev.filter((p) => p.businessId !== publicCatalog.business.id), ...publicCatalog.products]);
          commitSelectedBusinessId(publicCatalog.business.id);
          setCurrentView('public_storefront');
          return;
        }
      }
      commitSelectedBusinessId('');
      setCurrentView(defaultView);
      return;
    }

    const safeRequestedView: ViewMode = requestedView === 'directory'
      ? 'directory'
      : boot.authSession.role === 'admin'
        ? requestedView === 'merchant_admin' || requestedView === 'super_admin' ? requestedView : 'directory'
        : boot.authSession.role === 'subscriber'
          ? requestedView === 'merchant_admin' ? 'merchant_admin' : 'directory'
          : 'directory';

    const requestedManagedId = params.get('manage') || '';
    const requestedManagedBusiness = boot.businesses.find((business) => business.id === requestedManagedId);
    const preferred = boot.authSession.role === 'admin' && requestedManagedBusiness
      ? requestedManagedId
      : boot.authSession.businessId || boot.businesses[0]?.id || '';
    commitSelectedBusinessId(preferred);
    setCurrentView(safeRequestedView);
  };

  // Load the public directory independently from authentication so visitors see published activities immediately.
  useEffect(() => {
    let active = true;
    fetchPublicDirectory()
      .then((directory) => { if (active) setDirectoryBusinesses(directory.businesses); })
      .catch((error) => { console.warn('[MantiqatiX public directory]', error); })
      .finally(() => { if (active) setDirectoryLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const loadSession = async (session: any, force = false) => {
      const incomingUserId = session?.user?.id || null;
      const sessionKey = incomingUserId
        ? `${incomingUserId}:${String(session?.access_token || 'no-token')}`
        : 'signed-out';
      if (!force && lastAuthLoadKeyRef.current === sessionKey) return;
      lastAuthLoadKeyRef.current = sessionKey;

      const identityChanged = authUserIdRef.current !== incomingUserId;
      if (identityChanged) {
        authUserIdRef.current = incomingUserId;
        // Drop the previous identity's data before the next identity is hydrated.
        // A valid Google session without a business membership is still a signed-in user,
        // but it does not receive owner/admin permissions.
        setAuthSession({
          role: 'guest',
          isAuthenticated: Boolean(session?.user),
          userId: incomingUserId || undefined,
          email: session?.user?.email || undefined,
        });
        setBusinesses([]);
        setProducts([]);
        setSubscribers([]);
        setSelectedBusinessIdState('');
        setCartItems([]);
        setCurrentView('directory');
        setAuthBootstrapError('');
        setAuthLoading(true);
      } else if (force) {
        setAuthBootstrapError('');
        setAuthLoading(true);
      }

      const sequence = ++authLoadSequence.current;
      const isCurrent = () => active && sequence === authLoadSequence.current;
      try {
        if (isCurrent()) await applyUser(session?.user || null, isCurrent);
      } catch (error) {
        console.error('[MantiqatiX production bootstrap]', error);
        if (isCurrent()) {
          setAuthBootstrapError(error instanceof Error ? error.message : 'تعذر تحميل صلاحيات الحساب من قاعدة الإنتاج.');
          // Allow another auth event or a fresh page load to retry the same session.
          if (lastAuthLoadKeyRef.current === sessionKey) lastAuthLoadKeyRef.current = null;
          if (session?.user) {
            setAuthSession((previous) => previous.userId === incomingUserId
              ? { ...previous, role: previous.role === 'admin' || previous.role === 'subscriber' ? previous.role : 'guest', isAuthenticated: true, userId: incomingUserId, email: session.user.email || previous.email }
              : previous);
          }
        }
      } finally {
        if (isCurrent()) setAuthLoading(false);
      }
    };

    void supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        return loadSession(data.session);
      })
      .catch((error) => {
        if (!active) return;
        console.error('[MantiqatiX getSession]', error);
        setAuthBootstrapError(error instanceof Error ? error.message : 'تعذر قراءة جلسة Google الحالية.');
        setAuthLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === 'INITIAL_SESSION' ||
        event === 'SIGNED_IN' ||
        event === 'SIGNED_OUT' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'USER_UPDATED' ||
        event === 'PASSWORD_RECOVERY'
      ) {
        queueMicrotask(() => {
          if (active) void loadSession(session, event === 'USER_UPDATED' || event === 'PASSWORD_RECOVERY');
        });
      }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const setSelectedBusinessId = (id: string) => {
    commitSelectedBusinessId(id);
    setCartItems([]);
    if (currentView === 'public_storefront') updateBrowserRoute('public_storefront', id);
    else if (currentView === 'merchant_admin' || currentView === 'super_admin') updateBrowserRoute(currentView, id);
  };

  // Restore the in-app view when the user navigates with browser back/forward.
  useEffect(() => {
    const restoreRouteFromLocation = () => {
      const params = new URLSearchParams(window.location.search);
      const requestedId = params.get('store') || params.get('businessId') || '';
      if (requestedId) {
        routeBusinessIdRef.current = requestedId;
        setSelectedBusinessIdState(requestedId);
        setCurrentViewState('public_storefront');
        const known = businesses.some((business) => business.id === requestedId || business.slug === requestedId);
        if (!known && /^[0-9a-f-]{36}$/i.test(requestedId)) {
          void fetchPublicCatalog(requestedId).then((catalog) => {
            if (!catalog) return;
            routeBusinessIdRef.current = catalog.business.id;
            setBusinesses((prev) => [catalog.business, ...prev.filter((business) => business.id !== catalog.business.id)]);
            setProducts((prev) => [...prev.filter((product) => product.businessId !== catalog.business.id), ...catalog.products]);
            setSelectedBusinessIdState(catalog.business.id);
          }).catch(() => undefined);
        }
        return;
      }
      const requestedView = params.get('view');
      const requestedManagedId = requestedView === 'super_admin' || requestedView === 'merchant_admin'
        ? params.get('manage') || ''
        : '';
      routeBusinessIdRef.current = requestedManagedId;
      setSelectedBusinessIdState(requestedManagedId);
      setCurrentViewState(
        requestedView === 'super_admin' || requestedView === 'merchant_admin' || requestedView === 'directory'
          ? requestedView
          : 'directory'
      );
    };
    window.addEventListener('popstate', restoreRouteFromLocation);
    return () => window.removeEventListener('popstate', restoreRouteFromLocation);
  }, [businesses]);

  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      // Always return OAuth to the canonical GitHub Pages app root.
      // Carrying arbitrary query/hash state into Supabase redirect allowlists can
      // cause a successful Google consent flow to return without hydrating the app.
      // Supabase currently allowlists the platform root. The root shell relays
      // only OAuth callback parameters to /catalog-app/ before loading its own app.
      const redirectTo = new URL('/MantiqatiX/', window.location.origin).toString();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, queryParams: { prompt: 'select_account' } },
      });
      if (error) return { success: false, error: error.message || 'تعذر تسجيل الدخول بحساب Google.' };
      return { success: true };
    } catch (error: any) { return { success: false, error: error?.message || 'تعذر بدء تسجيل الدخول بحساب Google.' }; }
  };

  const registerWithEmail = async (fullName: string, identifier: string, password: string): Promise<{ success: boolean; error?: string; message?: string; needsConfirmation?: boolean }> => {
    const email = identifier.trim().toLowerCase();
    if (!fullName.trim()) return { success: false, error: 'اكتب الاسم الكامل.' };
    if (!email.includes('@')) return { success: false, error: 'اكتب بريدًا إلكترونيًا صالحًا.' };
    if (password.length < 8) return { success: false, error: 'كلمة المرور يجب ألا تقل عن 8 أحرف.' };
    try {
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName.trim(), name: fullName.trim() },
          emailRedirectTo: redirectTo,
        },
      });
      if (error) return { success: false, error: error.message || 'تعذر إنشاء الحساب.' };
      if (!data.user) return { success: false, error: 'لم يتم إنشاء الحساب. حاول مرة أخرى.' };
      if (data.session) {
        const boot = await bootstrapProductionUser(data.user);
        setAuthSession(boot.authSession);
        setBusinesses(boot.businesses);
        setProducts(boot.products);
        setSubscribers(boot.subscribers);
        setAdminSettings({ ...boot.adminSettings, adminPassword: '' });
        setSelectedBusinessIdState(boot.authSession.businessId || boot.businesses[0]?.id || '');
        setCurrentView('directory');
        return { success: true, message: 'تم إنشاء الحساب. تفعيل صلاحيات صاحب النشاط يحتاج اعتماد إدارة المنصة.' };
      }
      return {
        success: true,
        needsConfirmation: true,
        message: 'تم تسجيل طلب إنشاء الحساب. افتح رسالة التأكيد المرسلة إلى بريدك الإلكتروني، وبعدها يمكنك تسجيل الدخول. اشتراك النشاط يحتاج اعتماد الإدارة.',
      };
    } catch (error: any) {
      return { success: false, error: error?.message || 'تعذر إنشاء الحساب حاليًا.' };
    }
  };

  const loginAsSubscriber = async (identifier: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const email = identifier.trim().toLowerCase();
    if (!email.includes('@')) return { success: false, error: 'استخدم البريد الإلكتروني الذي سلمته لك إدارة المنصة وليس اسم مستخدم تجريبيا.' };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return { success: false, error: 'بيانات البريد الإلكتروني أو كلمة المرور غير صحيحة.' };
    try {
      const boot = await bootstrapProductionUser(data.user);
      setAuthSession(boot.authSession); setBusinesses(boot.businesses); setProducts(boot.products); setSubscribers(boot.subscribers);
      setAdminSettings({ ...boot.adminSettings, adminPassword: '' });
      setSelectedBusinessIdState(boot.authSession.businessId || boot.businesses[0]?.id || '');
      setCurrentView(boot.authSession.role === 'admin' ? 'super_admin' : boot.authSession.role === 'subscriber' ? 'merchant_admin' : 'directory');
      setIsLoginModalOpen(false);
      return { success: true };
    } catch (e: any) {
      // Do not sign out a valid user just because the production-role bootstrap failed.
      // Preserve the Supabase session so the problem can be diagnosed and retried safely.
      return { success: false, error: e?.message || 'تم تسجيل الدخول لكن تعذر تحميل صلاحيات الحساب. حاول تحديث الصفحة، ولن يتم حذف الجلسة.' };
    }
  };

  const loginAsAdmin = async (_password?: string) => loginWithGoogle();
  const logout = () => {
    void supabase.auth.signOut();
    setAuthSession({ role: 'guest', isAuthenticated: false }); setBusinesses([]); setProducts([]); setSubscribers([]);
    setSelectedBusinessIdState(''); setCurrentView('directory'); setCartItems([]);
  };

  const addCategory = async (data: { name: string; functionalGroupId: FunctionalGroupId; description?: string; classificationType?: 'activity' | 'profession'; specialties?: string[] }): Promise<ActivityCategory> => {
    const name = data.name.trim();
    if (name.length < 2 || name.length > 120) throw new Error('اسم النشاط أو المهنة يجب أن يكون من حرفين إلى 120 حرفًا.');
    const normalized = normalizeCanonicalTaxonomySettings(adminSettings);
    const classificationType = data.classificationType || 'activity';
    const duplicate = normalized.categories.some((category) =>
      category.classificationType === classificationType &&
      category.name.trim().toLocaleLowerCase('ar') === name.toLocaleLowerCase('ar'));
    if (duplicate) throw new Error('هذا النشاط أو المهنة موجود بالفعل ضمن التصنيف المختار.');
    const newCat: ActivityCategory = {
      id: `cat_custom_${crypto.randomUUID()}`,
      name,
      functionalGroupId: data.functionalGroupId,
      description: data.description?.trim(),
      classificationType,
      specialties: (data.specialties || []).map((item) => String(item).trim()).filter(Boolean).slice(0, 100),
      isCustom: true,
    };
    const categories = [...normalized.categories, newCat];
    const saved = normalizeCanonicalTaxonomySettings({ ...adminSettings, categories, defaultCategories: categories.map((category) => category.name) });
    await updateAdminSettings({ functionalGroups: saved.functionalGroups, categories: saved.categories, defaultCategories: saved.defaultCategories });
    return newCat;
  };
  const updateCategory = async (updated: ActivityCategory): Promise<void> => {
    const normalized = normalizeCanonicalTaxonomySettings(adminSettings);
    const categories = normalized.categories.map((category) => category.id === updated.id
      ? { ...updated, name: updated.name.trim(), specialties: (updated.specialties || []).map((item) => String(item).trim()).filter(Boolean).slice(0, 100) }
      : category);
    const saved = normalizeCanonicalTaxonomySettings({ ...adminSettings, categories, defaultCategories: categories.map((category) => category.name) });
    await updateAdminSettings({ functionalGroups: saved.functionalGroups, categories: saved.categories, defaultCategories: saved.defaultCategories });
  };
  const deleteCategory = async (id: string): Promise<void> => {
    const normalized = normalizeCanonicalTaxonomySettings(adminSettings);
    const existing = normalized.categories.find((category) => category.id === id);
    if (!existing) return;
    if (!existing.isCustom) throw new Error('لا يمكن حذف التصنيفات الأساسية من الدليل المعتمد.');
    const categories = normalized.categories.filter((category) => category.id !== id);
    const saved = normalizeCanonicalTaxonomySettings({ ...adminSettings, categories, defaultCategories: categories.map((category) => category.name) });
    await updateAdminSettings({ functionalGroups: saved.functionalGroups, categories: saved.categories, defaultCategories: saved.defaultCategories });
  };

  const refreshBusinessCatalog = async (businessId: string) => {
    const business = businesses.find((b) => b.id === businessId);
    if (!business?.tenantId) return;
    const result: any = await callCatalogAdmin({ action: 'CATALOG_READ', tenantId: business.tenantId, businessId, ...(business.branchId ? { branchId: business.branchId } : {}) });
    const mapped = mapBusiness({ ...result.business, tenantId: business.tenantId, organizationId: business.organizationId, branchId: result.selectedBranchId, branches: result.branches, profile: result.business?.profile }, result.provider);
    setBusinesses((prev) => prev.map((b) => b.id === businessId ? mapped : b));
    const mappedProducts = mapProducts(businessId, business.tenantId, result.selectedBranchId, result.items || [], result.prices || []);
    setProducts((prev) => [...prev.filter((p) => p.businessId !== businessId), ...mappedProducts]);
  };

  const updateBusiness = async (updated: Business): Promise<void> => {
    if (!updated.tenantId || !updated.branchId) {
      throw new Error('لا يوجد نطاق إنتاجي صالح لهذا النشاط أو الفرع.');
    }

    const defaultCover = !updated.coverUrl?.trim() ||
      /(?:business-placeholder\.svg|catalog-item-placeholder\.svg|\/legacy\/activity\/|\/legacy\/mnty-cover-ad-)/i.test(updated.coverUrl);
    let coverUrl = updated.coverUrl?.trim() || '';
    if (defaultCover) {
      const generated = await generateCatalogAiImage({
        businessId: updated.id,
        kind: 'activity',
        name: updated.name,
        category: updated.category,
        description: updated.bio,
      });
      coverUrl = generated || resolveDefaultImage({
        name: updated.name, description: updated.bio, category: updated.category, kind: 'cover',
      });
    }

    const logoUrl = updated.logoUrl?.trim() || resolveDefaultImage({
      name: updated.name, description: updated.bio, category: updated.category, kind: 'activity',
    });

    await callCatalogAdmin({
      action: 'BUSINESS_PROFILE_UPSERT',
      tenantId: updated.tenantId,
      businessId: updated.id,
      branchId: updated.branchId,
      name: updated.name,
      bio: updated.bio || '',
      phone: updated.ownerWhatsApp || updated.phone || '',
      facebookUrl: updated.facebookUrl || '',
      instagramUrl: updated.instagramUrl || '',
      tiktokUrl: updated.tiktokUrl || '',
      address: updated.address || '',
      governorate: updated.governorate || '',
      markaz: updated.markaz || '',
      village: updated.village || '',
      workingHours: updated.workingHours || '',
      logoUrl,
      coverUrl,
      publicEnabled: Boolean(updated.publicEnabled),
    });
    // Profile edits must not rewrite billing metadata from a potentially stale client snapshot.
    // Billing updates use dedicated admin actions and remain independent from contact/branding edits.
    await refreshBusinessCatalog(updated.id);
  };

  const addBusiness = async (data: Omit<Business, 'id' | 'createdAt'>): Promise<string> => {
    if (authSession.role !== 'admin') throw new Error('إضافة الأنشطة متاحة لإدارة المنصة فقط.');
    const result: any = await callPlatformAdmin({ action: 'CREATE_BUSINESS', business: { name: data.name, category: data.category, activityGroupCode: data.functionalGroupId, activityClassificationType: data.categoryClassificationType || 'activity', activitySpecialty: data.activitySpecialty || '', bio: data.bio, phone: data.ownerWhatsApp || data.phone || '', address: data.address || '', governorate: data.governorate || '', markaz: data.markaz || '', village: data.village || '', workingHours: data.workingHours || '', logoUrl: data.logoUrl || '', coverUrl: data.coverUrl || '', slug: data.slug || '', publishNow: Boolean(data.publicEnabled), subscriptionMode: data.subscriptionMode || 'PAID', subscriptionAmount: data.subscriptionAmount ?? 0, paymentDueDate: data.paymentDueDate, paymentGracePeriodDays: data.paymentGracePeriodDays ?? 7 } });
    if (!result?.business?.id) throw new Error('لم يرجع الخادم معرف النشاط المنشأ.');
    await applyUser((await supabase.auth.getUser()).data.user);
    setSelectedBusinessIdState(result.business.id);
    return result.business.id;
  };

  const updateBusinessLocation = async (businessId: string, loc: { governorate: string; markaz: string; village: string; address?: string }): Promise<void> => {
    const business = businesses.find((b) => b.id === businessId);
    if (!business) throw new Error('النشاط المطلوب غير موجود في بيانات الإنتاج الحالية.');
    await updateBusiness({ ...business, governorate: loc.governorate, markaz: loc.markaz, village: loc.village, address: loc.address ?? business.address });
  };
  const updateBillingSetting = async (businessId: string, settings: Record<string, unknown>): Promise<void> => {
    const business = businesses.find((item) => item.id === businessId);
    if (!business?.tenantId) throw new Error('النشاط غير مرتبط ببيانات الإنتاج.');
    if (authSession.role !== 'admin') throw new Error('تعديل حالة السداد متاح لمالك المنصة فقط.');
    await callPlatformAdmin({ action: 'BUSINESS_SETTINGS_UPDATE', businessId, tenantId: business.tenantId, settings });
    setBusinesses((prev) => prev.map((item) => item.id === businessId ? { ...item, ...settings } as Business : item));
  };
  const confirmAdminPayment = async (businessId: string): Promise<void> => {
    const business = businesses.find((item) => item.id === businessId);
    if (!business?.tenantId || authSession.role !== 'admin') throw new Error('تأكيد السداد متاح لمالك المنصة بعد التحقق من الحساب.');
    const today = new Date().toISOString().slice(0, 10);
    await updateBillingSetting(businessId, {
      paymentConfirmedByAdmin: true, paymentStatus: 'paid', overdueDaysCount: 0,
      isFrozen: false, lastPaymentDate: today,
    });
    setBusinesses((prev) => prev.map((item) => item.id === businessId
      ? { ...item, paymentConfirmedByAdmin: true, paymentStatus: 'paid', overdueDaysCount: 0, isFrozen: false, lastPaymentDate: today }
      : item));
    const pending = subscribers.filter((subscriber) => subscriber.businessId === businessId && subscriber.status === 'pending');
    for (const subscriber of pending) {
      await callPlatformAdmin({ action: 'SUBSCRIBER_STATUS', membershipId: subscriber.id, status: 'ACTIVE' });
      setSubscribers((prev) => prev.map((item) => item.id === subscriber.id ? { ...item, status: 'active' } : item));
    }
  };
  const toggleBusinessFreeze = async (businessId: string): Promise<void> => {
    const business = businesses.find((item) => item.id === businessId);
    if (!business) throw new Error('النشاط المطلوب غير موجود.');
    const frozen = !business.isFrozen;
    // Freeze is an independent operational flag. Do not overwrite the underlying
    // payment status: doing so loses whether the account was paid or overdue.
    await updateBillingSetting(businessId, { isFrozen: frozen });
    setBusinesses((prev) => prev.map((item) => item.id === businessId ? { ...item, isFrozen: frozen } : item));
  };
  const deleteBusiness = async (id: string) => {
    const business = businesses.find((b) => b.id === id); if (!business?.tenantId) throw new Error('النشاط غير مرتبط بقاعدة الإنتاج.');
    if (authSession.role !== 'admin') throw new Error('تعطيل الأنشطة من اختصاص إدارة المنصة.');
    await callPlatformAdmin({ action: 'DELETE_BUSINESS', businessId: id, tenantId: business.tenantId });
    setBusinesses((prev) => prev.filter((b) => b.id !== id)); setProducts((prev) => prev.filter((p) => p.businessId !== id));
    if (selectedBusinessId === id) setSelectedBusinessIdState('');
  };

  const getStorePublicLink = (business: Business) =>
    generateStorePublicUrl(window.location.origin, business.id, baseUrl);
  const addProduct = async (data: Omit<Product, 'id'> & { deferAiImageGeneration?: boolean }): Promise<{ success: boolean; message?: string }> => {
    const business = businesses.find((b) => b.id === data.businessId);
    if (!business?.tenantId || !business.branchId) return { success: false, message: 'النشاط أو الفرع غير مرتبط ببيانات الإنتاج.' };
    // Preserve a user-reviewed AI suggestion or an owner-supplied image URL.
    // Bulk import can defer automatic generation without discarding an explicitly approved suggestion.
    let imageSource: 'auto' | 'owner' | 'ai' =
      (data.imageSource === 'owner' || data.imageSource === 'ai') && Boolean(data.imageUrl?.trim())
        ? data.imageSource
        : 'auto';
    let imageUrl = imageSource === 'owner' || imageSource === 'ai'
      ? data.imageUrl.trim()
      : resolveDefaultImage({ name: data.name, description: data.description, category: data.category, kind: data.type === 'service' ? 'service' : 'product' });
    if (imageSource === 'auto' && data.deferAiImageGeneration !== true) {
      const generated = await generateCatalogAiImage({
        businessId: business.id,
        kind: data.type,
        name: data.name,
        category: data.category,
        description: data.description,
      });
      if (generated) {
        imageUrl = generated;
        imageSource = 'ai';
      }
    }
    const metadata = { catalog_public: { category: data.category, unit: data.unit || '', image_url: imageUrl, image_source: imageSource, compare_price: data.comparePrice ?? null, is_available: data.isAvailable, track_stock: false, ...(data.requiresQuote ? { show_price: false } : {}) } };
    try {
      if (data.requiresQuote) {
        await callCatalogAdmin({ action: 'ITEM_UPSERT', tenantId: business.tenantId, businessId: business.id, branchId: business.branchId, nameAr: data.name, itemType: 'SERVICE', description: data.description, taxRate: 0, metadata });
      } else {
        await callCatalogAdmin({ action: 'ITEM_PRICE_UPSERT', tenantId: business.tenantId, businessId: business.id, branchId: business.branchId, nameAr: data.name, itemType: data.type === 'service' ? 'SERVICE' : 'PRODUCT', description: data.description, unitPrice: data.price, currency: 'EGP', metadata });
      }
      await refreshBusinessCatalog(data.businessId); return { success: true };
    } catch (e: any) { return { success: false, message: e?.message || 'تعذر حفظ المنتج في قاعدة الإنتاج.' }; }
  };
  const updateProduct = async (updated: Product) => {
    const business = businesses.find((b) => b.id === updated.businessId);
    if (!business?.tenantId || !business.branchId) throw new Error('النشاط أو الفرع غير مرتبط ببيانات الإنتاج.');
    const previous = products.find((product) => product.id === updated.id);
    let imageSource: 'auto' | 'owner' | 'ai' = updated.imageSource === 'ai' && Boolean(updated.imageUrl?.trim())
      ? 'ai'
      : updated.imageSource === 'owner' && Boolean(updated.imageUrl?.trim()) ? 'owner' : 'auto';
    let imageUrl = imageSource === 'owner' || imageSource === 'ai'
      ? updated.imageUrl.trim()
      : resolveDefaultImage({ name: updated.name, description: updated.description, category: updated.category, kind: updated.type === 'service' ? 'service' : 'product' });
    // Don't spend another image-generation request for price/availability-only edits.
    // Regenerate only for a new auto image or when its descriptive context changes.
    const shouldGenerate = imageSource === 'auto' && (
      !previous ||
      previous.imageSource !== 'auto' ||
      previous.name !== updated.name ||
      previous.description !== updated.description ||
      previous.category !== updated.category ||
      previous.type !== updated.type
    );
    if (shouldGenerate) {
      const generated = await generateCatalogAiImage({
        businessId: business.id,
        kind: updated.type,
        name: updated.name,
        category: updated.category,
        description: updated.description,
      });
      if (generated) {
        imageUrl = generated;
        imageSource = 'ai';
      }
    }
    const metadata = { catalog_public: { category: updated.category, unit: updated.unit || '', image_url: imageUrl, image_source: imageSource, compare_price: updated.comparePrice ?? null, is_available: updated.isAvailable, track_stock: false, ...(updated.requiresQuote ? { show_price: false } : {}) } };
    if (updated.requiresQuote) {
      await callCatalogAdmin({ action: 'ITEM_UPSERT', tenantId: business.tenantId, businessId: business.id, branchId: business.branchId, id: updated.id, nameAr: updated.name, itemType: 'SERVICE', description: updated.description, taxRate: 0, metadata });
    } else {
      await callCatalogAdmin({ action: 'ITEM_PRICE_UPSERT', tenantId: business.tenantId, businessId: business.id, branchId: business.branchId, id: updated.id, nameAr: updated.name, itemType: updated.type === 'service' ? 'SERVICE' : 'PRODUCT', description: updated.description, unitPrice: updated.price, currency: 'EGP', metadata });
    }
    await refreshBusinessCatalog(updated.businessId);
  };
  const deleteProduct = async (id: string) => {
    const product = products.find((p) => p.id === id); const business = product && businesses.find((b) => b.id === product.businessId);
    if (!product || !business?.tenantId || !business.branchId) throw new Error('العنصر أو نطاقه الإنتاجي غير موجود.');
    await callCatalogAdmin({ action: 'ITEM_STATUS_UPDATE', tenantId: business.tenantId, businessId: business.id, branchId: business.branchId, catalogItemId: id, status: 'INACTIVE' });
    setCartItems((prev) => prev.filter((x) => x.product.id !== id)); await refreshBusinessCatalog(product.businessId);
  };

  const addSubscriber = async (data: { fullName: string; email: string; phone: string; businessId: string; username?: string; password?: string; authMethod: 'direct_password' | 'gmail_invite'; notes?: string }): Promise<Subscriber> => {
    if (authSession.role !== 'admin') throw new Error('إضافة المشتركين متاحة لإدارة المنصة فقط.');
    const business = businesses.find((b) => b.id === data.businessId);
    if (!business?.tenantId) throw new Error('اختر نشاطا مرتبطا بقاعدة الإنتاج.');
    const email = data.email.trim().toLowerCase();
    const result: any = await callPlatformAdmin({
      action: 'CREATE_SUBSCRIBER',
      businessId: business.id,
      tenantId: business.tenantId,
      email,
      fullName: data.fullName.trim(),
      phone: data.phone || '',
    });
    const id = String(result.membershipId || result.id || result.userId);
    const backendStatus = String(result.status || 'INACTIVE').toUpperCase();
    const created: Subscriber = {
      id,
      fullName: data.fullName.trim(),
      email,
      phone: data.phone,
      businessId: business.id,
      status: backendStatus === 'ACTIVE' ? 'active' : backendStatus === 'SUSPENDED' ? 'suspended' : 'pending',
      username: email,
      authMethod: 'gmail_invite',
      inviteStatus: 'pending',
      notes: data.notes,
      joinedDate: new Date().toISOString().slice(0, 10),
    };
    setSubscribers((prev) => [created, ...prev.filter((s) => s.id !== id)]);
    return created;
  };
  const saveSubscriberMembership = async (input: {
    subscriber: Subscriber;
    tenantId: string;
    businessId?: string;
    branchId?: string;
    role: string;
    status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    catalogEnabled: boolean;
    catalogWrite: boolean;
    accountRestricted: boolean;
  }): Promise<Subscriber> => {
    if (authSession.role !== 'admin') throw new Error('إدارة أدوار الحسابات والصلاحيات متاحة لمالك المنصة فقط.');
    const source = input.subscriber;
    if (!source.userId) throw new Error('هذا الصف لا يحتوي على معرّف حساب Supabase صالح.');
    const result: any = await callPlatformAdmin({
      action: 'SAVE_MEMBERSHIP',
      ...(source.isAccountOnly ? {} : { membershipId: source.id }),
      userId: source.userId,
      tenantId: input.tenantId,
      businessId: input.businessId || '',
      branchId: input.branchId || '',
      role: input.role,
      status: input.status,
      catalogEnabled: input.catalogEnabled,
      catalogWrite: input.catalogWrite,
      accountRestricted: input.accountRestricted,
    });
    const membership = result?.membership;
    if (result?.success !== true || !membership?.id) throw new Error('لم يؤكد الخادم حفظ تعيين الدور والصلاحيات.');
    const mapped: Subscriber = {
      ...source,
      id: String(membership.id),
      userId: String(membership.userId || source.userId),
      tenantId: String(membership.tenantId || input.tenantId),
      organizationId: String(membership.organizationId || ''),
      businessId: String(membership.businessId || ''),
      businessName: String(membership.businessName || businesses.find((b) => b.id === String(membership.businessId || ''))?.name || ''),
      branchId: String(membership.branchId || ''),
      role: String(membership.role || input.role),
      membershipStatus: String(membership.status || input.status),
      permissions: membership.permissions && typeof membership.permissions === 'object' ? membership.permissions : {},
      status: String(membership.status || input.status) === 'ACTIVE' ? 'active' : String(membership.status || input.status) === 'SUSPENDED' ? 'suspended' : 'pending',
      isAccountOnly: false,
      password: undefined,
    };
    setSubscribers((prev) => [
      mapped,
      ...prev.filter((item) => item.id !== source.id && !(item.isAccountOnly && item.userId === mapped.userId)),
    ]);
    return mapped;
  };

  const updateSubscriber = async (updated: Subscriber) => {
    if (updated.status === 'active') {
      const business = businesses.find((item) => item.id === updated.businessId);
      const freeActivation = business?.subscriptionMode === 'FREE' && business.subscriptionAmount === 0
        && business.freeActivationApprovedByAdmin === true && String(business.paymentStatus || '').toLowerCase() === 'free';
      const paidAndConfirmed = String(business?.paymentStatus || '').toLowerCase() === 'paid' && business?.paymentConfirmedByAdmin === true;
      if (!business || (!freeActivation && !paidAndConfirmed)) {
        throw new Error('لا يمكن تفعيل الاشتراك قبل تأكيد السداد أو اعتماد التفعيل المجاني من إدارة المنصة.');
      }
    }
    await callPlatformAdmin({ action: 'SUBSCRIBER_STATUS', membershipId: updated.id, status: updated.status === 'active' ? 'ACTIVE' : updated.status === 'suspended' ? 'SUSPENDED' : 'INACTIVE' });
    setSubscribers((prev) => prev.map((s) => s.id === updated.id ? { ...updated, password: undefined } : s));
  };
  const deleteSubscriber = async (id: string) => {
    const target = subscribers.find((s) => s.id === id);
    if (!target || target.isAccountOnly || id.startsWith('ACCOUNT:')) {
      throw new Error('هذا حساب Google لم يُسند إلى عضوية بعد. استخدم إدارة الدور لتعيينه أو تقييده.');
    }
    await callPlatformAdmin({ action: 'SUBSCRIBER_STATUS', membershipId: id, status: 'INACTIVE' });
    setSubscribers((prev) => prev.map((s) => s.id === id
      ? { ...s, status: 'pending', membershipStatus: 'INACTIVE', password: undefined }
      : s));
  };
  const sendGmailInvite = (id: string) => {
    const sub = subscribers.find((s) => s.id === id);
    if (!sub) return '';
    const biz = businesses.find((b) => b.id === sub.businessId);
    return generateGmailInviteUrl(sub.email, sub.fullName, biz?.name || 'نشاطك التجاري', publicBaseUrl(), sub.email, undefined);
  };
  const getSubscriberCredentialsText = (id: string) => {
    const sub = subscribers.find((s) => s.id === id);
    if (!sub) return '';
    return `منطقتي X | MantiqatiX
اسم المشترك: ${sub.fullName}
النشاط: ${businesses.find((b) => b.id === sub.businessId)?.name || 'النشاط'}
البريد المرتبط بحساب Google: ${sub.email}

طريقة الدخول: اضغط "المتابعة باستخدام Google" واختر نفس حساب Google أعلاه.
حالة الاشتراك: ${sub.status === 'active' ? 'نشط' : sub.status === 'pending' ? 'بانتظار تأكيد السداد' : 'موقوف'}.
لا تُفعّل صلاحيات إدارة النشاط إلا بعد تأكيد السداد من إدارة المنصة.`;
  };
  const updateAdminSettings = async (settings: Partial<AdminSettings>): Promise<void> => {
    if (authSession.role !== 'admin') throw new Error('حفظ إعدادات المنصة متاح لمالك المنصة بعد التحقق من Google فقط.');
    const safe = { ...settings };
    delete (safe as any).adminPassword;
    const result: any = await callPlatformAdmin({ action: 'SAVE_SETTINGS', settings: safe });
    if (result?.success !== true) throw new Error('لم يؤكد الخادم حفظ إعدادات المنصة.');
    setAdminSettings((prev) => ({ ...prev, ...safe, adminPassword: '' }));
  };
  const addBusinessCategory = (category: string) => { const name = category.trim(); if (!name || adminSettings.defaultCategories.includes(name)) return; setAdminSettings((prev) => ({ ...prev, defaultCategories: [...prev.defaultCategories, name] })); };

  const addToCart = (product: Product, quantity = 1) => {
    if (currentBusiness?.operationalStatus !== 'ACTIVE' || currentBusiness?.isFrozen) { window.alert('هذا النشاط موقوف أو مجمّد ولا يستقبل طلبات جديدة.'); return; }
    setCartItems((prev) => { const match = prev.find((item) => item.product.id === product.id); return match ? prev.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + quantity } : item) : [...prev, { product, quantity }]; });
    setIsCartOpen(true);
  };
  const removeFromCart = (id: string) => setCartItems((prev) => prev.filter((item) => item.product.id !== id));
  const updateCartQuantity = (id: string, quantity: number) => { if (quantity <= 0) { removeFromCart(id); return; } setCartItems((prev) => prev.map((item) => item.product.id === id ? { ...item, quantity } : item)); };
  const clearCart = () => setCartItems([]);
  const submitOrderViaWhatsApp = (customer: CustomerOrderData): { success: boolean; url?: string; error?: string } => {
    if (!cartItems.length) return { success: false, error: 'السلة فارغة، يرجى إضافة منتجات أولا.' };
    if (!currentBusiness) return { success: false, error: 'النشاط الحالي غير محدد.' };
    const ownerPhoneDigits = String(currentBusiness.ownerWhatsApp || '').replace(/\D/g, '');
    if (ownerPhoneDigits.length < 10 || ownerPhoneDigits.length > 15) return { success: false, error: 'رقم واتساب صاحب النشاط غير متوفر أو غير صالح.' };
    if (!customer.customerName.trim() || !customer.customerPhone.trim()) return { success: false, error: 'يرجى كتابة الاسم ورقم الهاتف للطلب.' };
    return { success: true, url: generateWhatsAppOrderUrl(currentBusiness.ownerWhatsApp, currentBusiness.name, cartItems, customer, adminSettings.currency || 'ج.م') };
  };
  const requestCatalogViaAdminWhatsApp = (business = currentBusiness) => business ? generateAdminCatalogRequestWhatsAppUrl(adminSettings.adminWhatsApp, business.name, business.category) : '';
  const exportBackupJSON = () => createBackupPayload(businesses, products, subscribers, adminSettings);
  const downloadBackupFile = () => { const blob = new Blob([exportBackupJSON()], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `mantiqatix-backup-${new Date().toISOString().slice(0,10)}.json`; link.click(); URL.revokeObjectURL(url); };
  const importBackupJSON = (_jsonString: string) => ({ success: false, error: 'استيراد البيانات إلى الإنتاج متوقف حتى تتم مراجعة الملف ومخطط قاعدة البيانات. لم يتم تغيير أي بيانات.' });

  return <AppContext.Provider value={{
    currentView, setCurrentView, selectedBusinessId, setSelectedBusinessId, currentBusiness,
    functionalGroups, categories, addCategory, updateCategory, deleteCategory, selectedFunctionalGroupFilter, setSelectedFunctionalGroupFilter, selectedCategoryFilter, setSelectedCategoryFilter,
    authSession, authLoading, loginWithGoogle, registerWithEmail, loginAsSubscriber, loginAsAdmin, logout, isLoginModalOpen, setIsLoginModalOpen,
    businesses, directoryBusinesses, directoryLoading, products, subscribers, adminSettings, updateBusiness, addBusiness, deleteBusiness, getStorePublicLink, updateBusinessLocation,
    confirmAdminPayment, updateBillingSetting, toggleBusinessFreeze,
    businessProducts, addProduct, updateProduct, deleteProduct, addSubscriber, saveSubscriberMembership, updateSubscriber, deleteSubscriber, sendGmailInvite, getSubscriberCredentialsText, updateAdminSettings, addBusinessCategory,
    cartItems, addToCart, removeFromCart, updateCartQuantity, clearCart, isCartOpen, setIsCartOpen, submitOrderViaWhatsApp, requestCatalogViaAdminWhatsApp,
    exportBackupJSON, downloadBackupFile, importBackupJSON,
    authBootstrapError,
  }}> {children} </AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
, /await refreshBusinessCatalog\(updated\.businessId\)/,
  'Product/service changes must refresh from canonical production data after the awaited write.');


assert.match(directory, /const \[coverAspectRatio, setCoverAspectRatio\] = useState\('650 \/ 228'\)/, 'Home cover must have a responsive fallback based on the cover image aspect ratio');
assert.match(directory, /style=\{\{ aspectRatio: coverAspectRatio \}\}/, 'Home cover height must follow the active image aspect ratio instead of a fixed height');
assert.match(directory, /image\.naturalWidth[\s\S]{0,220}image\.naturalHeight/, 'Home cover must adapt to the actual dimensions of the loaded activity image');
assert.match(directory, /object-contain object-center/, 'Home cover images must remain fully visible without cropping');
assert.doesNotMatch(directory, /w-full h-64 sm:h-80 md:h-96/, 'Home cover must not force a fixed responsive height');

console.log('PRODUCTION_CATALOG_REAL_STATE=PASS');
