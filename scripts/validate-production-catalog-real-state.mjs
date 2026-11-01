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
const directoryListingsView = fs.readFileSync('apps/catalog-frontend/src/components/DirectoryListingsView.tsx', 'utf8');
const directoryListingsLib = fs.readFileSync('apps/catalog-frontend/src/lib/directoryListings.ts', 'utf8');
const activityModuleView = fs.readFileSync('apps/catalog-frontend/src/modules/activities/ActivityModuleView.tsx', 'utf8');
const directoryListingsFunction = fs.readFileSync('supabase/functions/directory-listings/index.ts', 'utf8');
const placeholder = fs.readFileSync('apps/catalog-frontend/public/business-placeholder.svg', 'utf8');
const itemPlaceholder = fs.readFileSync('apps/catalog-frontend/public/catalog-item-placeholder.svg', 'utf8');
const defaultImages = fs.readFileSync('apps/catalog-frontend/src/utils/defaultImages.ts', 'utf8');
const storefrontHeader = fs.readFileSync('apps/catalog-frontend/src/components/storefront/BusinessProfileHeader.tsx', 'utf8');
const storefrontCatalog = fs.readFileSync('apps/catalog-frontend/src/components/storefront/CatalogSection.tsx', 'utf8');
const merchantDashboard = fs.readFileSync('apps/catalog-frontend/src/components/merchant/MerchantDashboard.tsx', 'utf8');
const catalogAdminFunction = fs.readFileSync('supabase/functions/catalog-admin/index.ts', 'utf8');
const publicDirectoryFunction = fs.readFileSync('supabase/functions/public-catalog-directory/index.ts', 'utf8');
const publicCatalogFunction = fs.readFileSync('supabase/functions/public-catalog/index.ts', 'utf8');
const aiGeminiProxy = fs.readFileSync('supabase/functions/ai-gemini-proxy/index.ts', 'utf8');
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
assert.ok(defaultImages.includes('https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSe8i4AsKE3GHO82zlHDPbKEE4HLFtfcZ-jhNqF9eHI6w&s=10') && productionMapper.includes('UNVERIFIED_PHARMACY_IMAGE_URL'), 'unverified pharmacies must use the exact shared pharmacy fallback image from the common image registry');
assert.match(productionMapper, /isPharmacy && !isVerified && !hasOwnerSelectedLogo/, 'pharmacy fallback must be limited to unverified pharmacies without an owner-selected logo');
assert.match(productionMapper, /logoUrl: pharmacyFallbackLogo \\|\\|/, 'owner/admin-selected pharmacy logos must take precedence over the fallback');
assert.ok(defaultImages.includes('https://play-lh.googleusercontent.com/0V8K7Jgj4E0DP0dsn2tnkaipdrUG1tbkslu7ajn6kADRRUL4e1lcFKBFU1W0971GMwV-IYW09XuI-E0n_7F9roI') && productionMapper.includes('UNVERIFIED_DOCTOR_IMAGE_URL'), 'unverified doctors must use the exact shared doctor fallback image from the common image registry');
assert.match(productionMapper, /isDoctor && !isVerified && !hasOwnerSelectedLogo/, 'doctor fallback must be limited to unverified doctors without an owner-selected logo');
assert.match(productionMapper, /functionalGroupId === 'medical_health' && classificationType === 'profession'/, 'legacy individual medical professionals normalized under the medical-practices activity must receive the doctor fallback');
assert.match(productionMapper, /logoUrl: doctorFallbackLogo \\|\\| pharmacyFallbackLogo/, 'custom doctor logos and all pharmacy fallback behavior must be preserved');
assert.ok(directoryListingsView.includes('if (listing.claim_status === "CLAIMED") return "";') && directoryListingsView.includes('const listingType = String(listing.listing_type || "").toLowerCase();'), 'claimed directory pages must keep their saved image behavior and public directory types must be classified explicitly before choosing a fallback');
assert.ok(directoryListingsView.includes('if (listingType === "doctor") return UNVERIFIED_DOCTOR_IMAGE_URL;'), 'unclaimed doctor listing cards and details must use the shared doctor photo');
assert.ok(directoryListingsView.includes('if (listingType === "pharmacy") return UNVERIFIED_PHARMACY_IMAGE_URL;'), 'unclaimed pharmacy listing cards and details must use the shared pharmacy photo');
assert.ok(directoryListingsView.includes('listing.metadata?.profileImageUrl'), 'an owner-selected directory profile image must take precedence over the doctor default photo');
assert.ok(directoryListingsView.includes('listingProfileImage(detail)'), 'unclaimed doctor detail pages must display the default photo');
assert.ok(directoryListingsView.includes('listingProfileImage(listing)'), 'unclaimed doctor directory cards must display the default photo');
assert.ok(directoryListingsView.includes('رابط صورة الصفحة (اختياري — رابط HTTPS)') && directoryListingsView.includes('pattern="https://.*"'), 'the claimed page owner editor must expose an HTTPS-only replacement image URL field');
assert.ok(directoryListingsView.includes('profileImageUrl: asText(meta.profileImageUrl)'), 'the owner image URL must be loaded into the edit form');
assert.ok(directoryListingsLib.includes('profileImageUrl: input.profileImageUrl.trim()'), 'the owner image URL must be persisted through the existing owned listing update request');
assert.ok(directoryListingsFunction.includes('"profileImageUrl"'), 'the existing owned-listing server allowlist must continue accepting the owner image URL metadata field');
assert.match(productionMapper, /isStockImageUrl\(savedLogo\) && !officialShowcase/, 'legacy stock image URLs must only be restored for platform-owned showcase activities');
assert.match(productionMapper, /metadata\.image_url \|\| i\.imageUrl \|\| i\.image_url/, 'normalized public catalog responses must preserve actual owner-uploaded product images');
assert.match(productionMapper, /catalogPublished: Boolean\(raw\.catalogPublished/, 'public directory presence must stay separate from the enabled public catalogue flag');
assert.doesNotMatch(storefrontHeader, /platformAdCover|isCurrentSlideAd|images\.unsplash\.com/, 'storefront must not inject fabricated platform ad slides or stock cover photos');
assert.doesNotMatch(storefrontCatalog, /images\.unsplash\.com/, 'public product cards must not use stock-photo fallbacks');
assert.doesNotMatch(merchantDashboard, /images\.unsplash\.com/, 'merchant product lists must not show stock photos as real items');
assert.doesNotMatch(catalogAdminFunction, /return `https:\/\/images\.unsplash\.com|const rules:/, 'catalog admin must not generate stock-photo URLs for item imagery');
assert.match(catalogAdminFunction, /legacyStockUrl = \/\^https:/, 'catalog admin must clear legacy stock-photo URLs when an item is edited');
assert.match(catalogAdminFunction, /neutralPlaceholderUrl/, 'catalog admin must keep neutral placeholders out of owner image metadata');
assert.match(catalogAdminFunction, /url\.includes\("\/catalog-ai\/"\)/, 'catalog profile writes must preserve AI-generated source metadata.');
assert.match(catalogAdminFunction, /logo_image_source: imageSourceForUrl\(savedProfile\.logo_url\)[\s\S]*cover_image_source: imageSourceForUrl\(savedProfile\.cover_url\)/, 'profile metadata must separately identify AI, owner, and default images.');
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

assert.match(context, /const createBusinessPayload = \\{[\\s\\S]*subscriptionMode: data\\.subscriptionMode \\|\\| 'PAID'[\\s\\S]*subscriptionAmount: data\\.subscriptionAmount \\?\\? 0[\\s\\S]*paymentDueDate: data\\.paymentDueDate[\\s\\S]*\\};[\\s\\S]*callPlatformAdmin\\(\\{ action: 'CREATE_BUSINESS', business: createBusinessPayload \\}\\)/, 'create request carries subscription mode, amount and due date in the canonical guarded payload');
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

const auditHelperStart = backend.indexOf("const writeAuditLog = async");
const auditHelperEnd = backend.indexOf('if (action === "GET_SETTINGS")', auditHelperStart);
assert.ok(auditHelperStart >= 0 && auditHelperEnd > auditHelperStart, 'Production-schema audit writer must exist before platform actions.');
const auditHelper = backend.slice(auditHelperStart, auditHelperEnd);
for (const marker of [
  'id: crypto.randomUUID()',
  'tenant_id: entry.tenantId',
  'actor_user_id: user.id',
  'action: entry.action',
  'entity_type: entry.entityType',
  'entity_id: entry.entityId',
  'old_values: entry.oldValues || {}',
  'new_values: entry.newValues || {}',
  'result: entry.result || "SUCCESS"',
]) {
  assert.ok(auditHelper.includes(marker), 'Audit writer must satisfy the live audit_logs schema: ' + marker);
}
assert.equal((backend.match(/service\.from\("audit_logs"\)\.insert\(/g) || []).length, 1,
  'All platform audit inserts must route through the single schema-correct helper.');
assert.doesNotMatch(auditHelper, /details:/,
  'The live audit_logs table has no details column; structured data must be stored in new_values/old_values.');
assert.match(backend, /const creationAuditError = await writeAuditLog/,
  'Activity creation must check whether its production audit row was recorded.');
assert.match(storefrontCatalog, /const buildQuoteUrl = \(product: Product\): string \| null/,
  'Quote links must be disabled when no verified contact number is available.');
assert.match(storefrontCatalog, /digits = digits\.startsWith\('00'\)[\s\S]{0,150}\? '20' \+ digits\.slice\(1\)/,
  'Egyptian local quote phone numbers must be normalized to the international +20 format.');
assert.match(storefrontCatalog, /if \(digits\.length < 10 \|\| digits\.length > 15\) return null/,
  'Quote link builder must reject missing or malformed contact numbers.');
assert.doesNotMatch(storefrontCatalog, /201010171770/,
  'Public storefront quote links must not invent a default WhatsApp phone number.');
assert.match(storefrontCatalog, /التواصل غير متاح/,
  'Missing quote contact data must be shown clearly instead of sending customers to a fabricated number.');


const settingsStart = backend.indexOf('if (action === "BUSINESS_SETTINGS_UPDATE")');
const settingsEnd = backend.indexOf('if (action === "DEACTIVATE_BUSINESS")', settingsStart);
assert.ok(settingsStart >= 0 && settingsEnd > settingsStart, 'Operational settings update must be bounded before business deactivation.');
const operationalSettingsBlock = backend.slice(settingsStart, settingsEnd);
assert.match(operationalSettingsBlock, /Operational activation is stored independently from public publication/,
  'Operating-state changes must not implicitly change publication.');
assert.doesNotMatch(operationalSettingsBlock, /service\.from\("businesses"\)\.update\(\{\s*status:/,
  'Changing operationalStatus must not rewrite the base business lifecycle status.');
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

const rejection = publicationReview.slice(rejectionStart);
assert.match(rejection, /PLATFORM_BUSINESS_PUBLICATION_REJECTED/,
  'Publication rejection must be written to the audit log.');
assert.match(rejection, /if \(rejectionAuditError\)[\s\S]*PUBLICATION_AUDIT_FAILED/,
  'An audit-write failure after rejection must return a clear actionable error.');

assert.match(publicDirectoryFunction, /catalog_public_enabled === true/,
  'Public directory must derive customer-activity visibility from the persisted publication flag.');
assert.match(publicDirectoryFunction, /b\.settings\?\.catalog_public_enabled === true \|\| isOfficialShowcase\(b\)/,
  'Directory visibility must follow approved publication, not operational status.');
assert.match(publicDirectoryFunction, /if \(catalogPublished && operationallyActive\)/,
  'Directory may return an approved profile while omitting sellable items when operations are paused.');
assert.match(publicCatalogFunction, /if \(operationallyActive\)/,
  'Public storefront must omit products/services when operations are paused.');
assert.doesNotMatch(publicCatalogFunction, /if \(operationalStatus !== "ACTIVE"\) return response/,
  'Operational pause must not unpublish an approved profile.');
assert.match(publicCatalogFunction, /catalog_public_enabled !== true/,
  'The public storefront must not serve an unpublished catalog.');
assert.match(directory, /business\.publicEnabled \|\| business\.isOfficialShowcase/,
  'Homepage covers must use published businesses, not unsubmitted drafts.');
assert.match(context, /await refreshBusinessCatalog\(updated\.id\)/,
  'Business profile changes must refresh from canonical production data after the awaited write.');
assert.match(context, /await refreshBusinessCatalog\(updated\.businessId\)/,
  'Product/service changes must refresh from canonical production data after the awaited write.');
assert.match(productionMapper, /generateCatalogAiImage\(input: \{[\s\S]*branchId\?: string[\s\S]*imageUrl/, 'AI image helper must return a durable HTTPS asset URL and support branch-scoped requests.');
assert.match(aiGeminiProxy, /action === "generate_catalog_image"[\s\S]*CATALOG_AI_IMAGE_REQUESTED[\s\S]*IMAGE_BUCKET/, 'AI image requests must be a dedicated authenticated and audited backend branch that persists the result to storage.');
assert.match(aiGeminiProxy, /catalogWriteAllowed\([\s\S]*catalog_image_permission_denied/, 'Image generation must enforce the business catalog write permission on the server.');
assert.match(aiGeminiProxy, /image_generation_rate_limited/, 'AI image generation must have a per-user request limit.');
assert.match(aiGeminiProxy, /v1beta\/interactions[\s\S]*response_format:[\s\S]*aspect_ratio/, 'The image action must call the Gemini image-generation API instead of the text-only generateContent endpoint.');
assert.match(aiGeminiProxy, /service\.storage\.from\(IMAGE_BUCKET\)\.upload/, 'Generated images must be saved as durable storage assets instead of returned as large inline data.');
assert.match(aiGeminiProxy, /imageKind === "cover" \? "16:9" : "1:1"/, 'Generated covers and square catalogue images must use suitable aspect ratios.');


assert.match(directoryListingsFunction, /Stable keyset pagination/,
  'Public directory pagination must use stable keyset pagination rather than offset pagination.');
assert.match(directoryListingsFunction, /rawLimit > 100/,
  'Public directory page size must be bounded to protect the public Edge Function.');
assert.match(directoryListingsFunction, /INVALID_PAGE_CURSOR/,
  'Malformed cursors must fail closed with a clear client error.');
assert.match(directoryListingsFunction, /\.eq\("listing_status", "PUBLISHED"\)/,
  'Paginated public directory reads must never expose draft or hidden listings.');
assert.match(directoryListingsFunction, /governorate[s\S]*district[s\S]*village[s\S]*taxonomyCategoryId/,
  'Public directory pagination must support geographic and taxonomy filters.');
assert.match(directoryListingsFunction, /created_at\.lt\.[\s\S]*id\.lt\./,
  'Pagination cursor must use a deterministic created_at/id keyset.');
assert.match(directoryListingsLib, /fetchPublicDirectoryListingPage/,
  'Frontend must expose a typed paginated directory client.');
assert.match(directoryListingsLib, /functionalGroupId[\s\S]*taxonomyCategoryId[\s\S]*taxonomySpecialty[\s\S]*nextCursor/,
  'Typed directory pagination client must pass taxonomy filters and return its continuation cursor.');

assert.match(directoryListingsLib, /address: filters\.address/,
  'The public directory client must pass the selected street/area filter to the paginated API.');
assert.match(directoryListingsFunction, /address = clean\(url\.searchParams\.get\("address"\)/,
  'The paginated API must support server-side street/area filtering.');
assert.match(directoryListingsFunction, /secondary_phone\.ilike\./,
  'Directory search must match public contact fields as well as listing names.');
assert.match(directoryListingsFunction, /village\.ilike\./,
  'Directory search must match address hierarchy fields.');
assert.match(directoryView, /fetchPublicDirectoryListingPage\(directoryListingRequestFilters\)/,
  'The main directory must load a server-filtered first page rather than the legacy 500-row list.');
assert.match(directoryView, /limit: 20/,
  'The public directory must start with a 20-row page.');
assert.match(directoryView, /loadMoreDirectoryListings/,
  'The public directory must expose cursor-based continuation.');
assert.match(directoryView, /governorate: selectedGovFilter !== 'all'/,
  'Directory pagination must retain the chosen governorate scope.');
assert.match(activityModuleView, /onDirectoryListingFiltersChange/,
  'Activity and specialty folders must request server-side filters as their search changes.');
assert.match(activityModuleView, /onLoadMoreListings/,
  'Activity and specialty folders must expose their own load-more action.');
assert.doesNotMatch(directoryView, /fetchPublicDirectoryListings\(\)/,
  'The main directory must not fall back to the capped legacy directory fetch.');
console.log('PRODUCTION_CATALOG_REAL_STATE=PASS');
