import { createClient, type User } from '@supabase/supabase-js';
import type { ActivityModuleOverrides, AdminSettings, AuthSession, Business, FunctionalGroupId, Product, Subscriber } from '../types';
import { DEFAULT_CATEGORIES, DEFAULT_FUNCTIONAL_GROUPS, DEFAULT_PAYMOB_CONFIG, INITIAL_ADMIN_SETTINGS, normalizeCanonicalTaxonomySettings, resolveCanonicalGroupId, resolveCanonicalActivityCategoryId } from '../data/productionDefaults';
import { resolveDefaultImage, UNVERIFIED_DOCTOR_IMAGE_URL, UNVERIFIED_PHARMACY_IMAGE_URL } from '../utils/defaultImages';
import { resolvePublicCatalogAvailability } from './catalogPricing';

const runtime = (window as any).MANTIQATIX_CONFIG || (window as any).MNTY_CONFIG;
if (!runtime?.supabaseUrl || !runtime?.supabaseKey) {
  throw new Error('تعذر تحميل إعدادات الاتصال الإنتاجي لمنصة MantiqatiX');
}

export type CatalogAiImageKind = 'activity' | 'cover' | 'product' | 'service';

export async function generateCatalogAiImage(input: {
  businessId: string;
  branchId?: string;
  kind: CatalogAiImageKind;
  name: string;
  category?: string;
  description?: string;
}): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('ai-gemini-proxy', {
      body: {
        action: 'generate_catalog_image',
        businessId: input.businessId,
        branchId: input.branchId || '',
        imageKind: input.kind,
        name: input.name,
        category: input.category || '',
        description: input.description || '',
      },
    });
    if (error || typeof data?.imageUrl !== 'string' || !data.imageUrl.startsWith('https://')) {
      return null;
    }
    return data.imageUrl;
  } catch (error) {
    console.warn('Catalog AI image generation was unavailable; using contextual artwork.', error);
    return null;
  }
}

export const supabase = createClient(runtime.supabaseUrl, runtime.supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'mantiqatix.production.auth',
  },
});

async function invokeAdminFunction<T = any>(name: string, body: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let payload: any = null;
    try { payload = await (error as any).context?.json?.(); } catch { /* Some network errors have no JSON response. */ }
    throw new Error(String(payload?.message || payload?.error || error.message || fallback));
  }
  if (data?.error) throw new Error(String(data.message || data.error || fallback));
  return data as T;
}

export async function callCatalogAdmin<T = any>(body: Record<string, unknown>): Promise<T> {
  return invokeAdminFunction<T>('catalog-admin', body, 'تعذر الاتصال بإدارة الكتالوج');
}

export async function callPlatformAdmin<T = any>(body: Record<string, unknown>): Promise<T> {
  return invokeAdminFunction<T>('catalog-platform-admin', body, 'تعذر الاتصال بخدمات إدارة المنصة');
}

export async function fetchPlatformSubscribers(): Promise<{ subscribers: Subscriber[]; error?: string; ignoredOrphanMemberships: number }> {
  try {
    const list: any = await callPlatformAdmin({ action: 'LIST_SUBSCRIBERS' });
    const subscribers = (Array.isArray(list?.subscribers) ? list.subscribers : []).map((row: any): Subscriber => {
      const rawStatus = String(row?.status || row?.membershipStatus || '').toUpperCase();
      const isAccountOnly = row?.isAccountOnly === true || String(row?.id || '').startsWith('ACCOUNT:');
      return {
        id: String(row?.id || ''),
        userId: String(row?.userId || ''),
        fullName: String(row?.fullName || row?.email || 'حساب بدون اسم'),
        email: String(row?.email || ''),
        phone: String(row?.phone || ''),
        businessId: String(row?.businessId || ''),
        businessName: String(row?.businessName || ''),
        tenantId: String(row?.tenantId || ''),
        organizationId: String(row?.organizationId || ''),
        branchId: String(row?.branchId || ''),
        role: String(row?.role || (isAccountOnly ? 'CUSTOMER' : '')),
        permissions: row?.permissions && typeof row.permissions === 'object' ? row.permissions : {},
        membershipStatus: String(row?.membershipStatus || (isAccountOnly ? 'NONE' : rawStatus)),
        provider: String(row?.provider || 'unknown'),
        emailConfirmed: Boolean(row?.emailConfirmed),
        lastSignInAt: row?.lastSignInAt ? String(row.lastSignInAt) : undefined,
        isAccountOnly,
        status: isAccountOnly ? 'pending' : rawStatus === 'ACTIVE' ? 'active' : rawStatus === 'SUSPENDED' ? 'suspended' : 'pending',
        username: String(row?.email || ''),
        authMethod: String(row?.provider || '').toLowerCase() === 'google' ? 'gmail_invite' : 'direct_password',
        inviteStatus: 'pending',
        joinedDate: String(row?.joinedDate || row?.createdAt || '').slice(0, 10),
      };
    });
    return { subscribers, ignoredOrphanMemberships: Number(list?.ignoredOrphanMemberships || 0) };
  } catch (error) {
    return {
      subscribers: [],
      error: error instanceof Error ? error.message : 'تعذر تحميل حسابات Supabase',
      ignoredOrphanMemberships: 0,
    };
  }
}

type PublicDirectoryResult = {
  businesses: Business[];
  products: Product[];
  activityModuleOverrides: ActivityModuleOverrides;
  activityModuleOverridesAvailable: boolean;
  hasMore: boolean;
  nextCursor: string | null;
};
let publicDirectoryInFlight: Promise<PublicDirectoryResult> | null = null;

export async function fetchPublicDirectoryPage(cursor?: string | null): Promise<PublicDirectoryResult> {
  const query = new URLSearchParams();
  query.set('limit', '20');
  if (cursor) query.set('cursor', cursor);
  const functionName = 'public-catalog-directory' + (query.size ? `?${query.toString()}` : '');
  const { data, error } = await supabase.functions.invoke(functionName, { method: 'GET' } as any);
  if (error) throw new Error(error.message || 'تعذر تحميل دليل الأنشطة المنشورة');
  if (data?.error) throw new Error(String(data.message || data.error));
  const rows = Array.isArray(data?.businesses) ? data.businesses : [];
  const businesses: Business[] = [];
  const products: Product[] = [];
  for (const row of rows) {
    const mapped = mapBusiness({ ...row, accessMode: data?.accessMode || 'PUBLIC_DIRECTORY_READ_ONLY', branches: row.branches || [], branchId: row.selectedBranchId || row.branchId }, row.provider);
    businesses.push(mapped);
    products.push(...mapProducts(mapped.id, mapped.tenantId || '', mapped.branchId, row.items || [], row.prices || []));
  }
  const activityModuleOverrides = data?.activityModuleOverrides && typeof data.activityModuleOverrides === 'object' && !Array.isArray(data.activityModuleOverrides)
    ? data.activityModuleOverrides as ActivityModuleOverrides
    : {};
  const pagination = data?.pagination;
  const hasMore = pagination?.hasMore === true;
  const nextCursor = typeof pagination?.nextCursor === 'string' && pagination.nextCursor.length <= 2048
    ? pagination.nextCursor : null;
  if (hasMore && !nextCursor) throw new Error('استجابة دليل الأنشطة لا تحتوي على مؤشر الصفحة التالية بشكل صحيح.');
  return {
    businesses,
    products,
    activityModuleOverrides,
    activityModuleOverridesAvailable: data?.activityModuleOverridesAvailable === true,
    hasMore: hasMore && Boolean(nextCursor),
    nextCursor,
  };
}

export function fetchPublicDirectory(): Promise<PublicDirectoryResult> {
  // AppContext and the signed-out auth bootstrap may start together. Share one
  // first-page read while preserving the complete public directory response.
  if (publicDirectoryInFlight) return publicDirectoryInFlight;
  const request = fetchPublicDirectoryPage();
  publicDirectoryInFlight = request;
  const clearInFlight = () => {
    if (publicDirectoryInFlight === request) publicDirectoryInFlight = null;
  };
  void request.then(clearInFlight, clearInFlight);
  return request;
}

export async function fetchPublicCatalog(businessId: string, branchId?: string): Promise<{ business: Business; products: Product[] } | null> {
  const query = new URLSearchParams({ businessId });
  if (branchId) query.set('branchId', branchId);
  const response = await fetch(`${runtime.supabaseUrl}/functions/v1/public-catalog?${query.toString()}`, {
    headers: { apikey: runtime.supabaseKey },
  });
  if (response.status === 404) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.error) throw new Error(body?.error || 'تعذر تحميل الكتالوج العام');
  const business = mapBusiness({
    id: body.business?.id || businessId,
    tenantId: body.business?.tenantId || body.business?.tenant_id,
    name: body.business?.name,
    category: body.profile?.category || body.provider?.kind,
    activityGroupCode: body.business?.activityGroupCode,
    activityCategoryCode: body.business?.activityCategoryCode,
    activityClassificationType: body.business?.activityClassificationType,
    activitySpecialty: body.business?.activitySpecialty,
    slug: body.provider?.slug,
    bio: body.profile?.bio || body.provider?.description,
    branches: body.branches,
    profile: body.profile,
    accessMode: body.accessMode || "PUBLIC_READ_ONLY",
    branchId: body.selectedBranchId,
    publicEnabled: true,
    operationalStatus: body.business?.operationalStatus || 'ACTIVE',
  }, body.provider);
  return { business, products: mapProducts(businessId, business.tenantId || '', business.branchId, body.items || [], body.prices || []) };
}

function parseOptionalCoordinate(value: unknown, min: number, max: number): number | undefined {
  if (value == null || String(value).trim() === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : undefined;
}

function parseFirstOptionalCoordinate(values: unknown[], min: number, max: number): number | undefined {
  for (const value of values) {
    const parsed = parseOptionalCoordinate(value, min, max);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

function groupFromCategory(category: string, groupCode?: string): FunctionalGroupId {
  return resolveCanonicalGroupId(category, groupCode);
}

export function mapBusiness(raw: any, provider: any): Business {
  const profile = raw.profile || raw.settings?.catalog_profile || {};
  const isPublicProjection = ["PUBLIC_READ_ONLY", "PUBLIC_DIRECTORY_READ_ONLY"].includes(String(raw.accessMode || "").toUpperCase());
  const publicPhone = String(profile.phoneDisplay || profile.phone_display || profile.whatsappNumber || profile.whatsappPhone || raw.contactPhone || "");
  const publicWhatsApp = String(profile.whatsappPhone || profile.whatsappNumber || raw.contactPhone || "");
  const branch = raw.branches?.find((x: any) => String(x.id) === String(raw.branchId || raw.selectedBranchId)) || raw.branches?.[0] || raw.branch || {};
  const branchMetadata = branch.metadata && typeof branch.metadata === 'object' ? branch.metadata : {};
  const branchLocation = branch.location && typeof branch.location === 'object' ? branch.location : {};
  const profileMetadata = profile.metadata && typeof profile.metadata === 'object' ? profile.metadata : {};
  const profileLocation = profile.location && typeof profile.location === 'object' ? profile.location : {};
  const rawMetadata = raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {};
  const rawLocation = raw.location && typeof raw.location === 'object' ? raw.location : {};
  const category = String(raw.category || provider?.kind || provider?.provider_kind || 'أنشطة تجارية');
  const meta = raw.bizcatalog || raw.settings?.bizcatalog || {};
  const created = raw.createdAt || raw.created_at || new Date().toISOString();
  const id = String(raw.id || raw.businessId || '');
  const name = String(raw.name || provider?.name || provider?.name_ar || 'نشاط تجاري');
  const activityGroupCode = String(
    raw.activityGroupCode || raw.activity_group_code || raw.functionalGroupId || raw.functional_group_id ||
    raw.settings?.activity_group_code || raw.settings?.functional_group_id || raw.settings?.functionalGroupId ||
    raw.settings?.taxonomy_group_code || meta.activity_group_code || meta.functional_group_id ||
    profile.activity_group_code || profile.functional_group_id || '',
  ).trim();
  const functionalGroupId = groupFromCategory(category, activityGroupCode);
  const activityCategoryCode = String(
    raw.activityCategoryCode || raw.activity_category_code || raw.settings?.activity_category_code ||
    raw.settings?.activityCategoryCode || meta.activity_category_code || profile.activity_category_code || '',
  ).trim();
  const canonicalCategoryId = resolveCanonicalActivityCategoryId(activityGroupCode, activityCategoryCode);
  const classificationType: 'activity' | 'profession' = String(
    raw.activityClassificationType || raw.activity_classification_type || raw.settings?.activity_classification_type ||
    meta.activity_classification_type || profile.activity_classification_type || 'activity',
  ).toLowerCase() === 'profession' ? 'profession' : 'activity';
  const officialShowcase = Boolean(raw.isOfficialShowcase || raw.settings?.source === 'OFFICIAL_PLATFORM_SHOWCASE' || raw.settings?.managed_by === 'SUPER_ADMIN');
  const savedLogo = String(profile.logoUrl || profile.logo_url || raw.logoUrl || '');
  const savedCover = String(profile.coverUrl || profile.cover_url || raw.coverUrl || '');
  const externalLogoUrl = String(profile.externalLogoUrl ?? profile.external_logo_url ?? profile.logo_url ?? raw.externalLogoUrl ?? '');
  const externalCoverUrl = String(profile.externalCoverUrl ?? profile.external_cover_url ?? profile.cover_url ?? raw.externalCoverUrl ?? '');
  const isVerified = Boolean(provider?.verified ?? provider?.is_verified ?? raw.isVerified);
  const isPharmacy = /صيدل|pharmacy/i.test([name, category, activityCategoryCode, raw.activityGroupCode, raw.activity_group_code].join(' '));
  const savedLogoSource = String(profile.logo_image_source || profile.logoImageSource || '').toLowerCase();
  const savedCoverSource = String(profile.cover_image_source || profile.coverImageSource || '').toLowerCase();
  const hasOwnerSelectedLogo = Boolean(savedLogo) && savedLogoSource !== 'auto' &&
    !/(?:business-placeholder|catalog-item-placeholder)\.svg|\/legacy\/(?:activity|activities)\//i.test(savedLogo);
  const hasOwnerSelectedCover = Boolean(savedCover) && savedCoverSource !== 'auto' &&
    !isStockImageUrl(savedCover) &&
    !/(?:business-placeholder|catalog-item-placeholder)\.svg|\/legacy\/(?:activity|activities)\//i.test(savedCover);
  const pharmacyFallbackLogo = isPharmacy && !isVerified && !hasOwnerSelectedLogo
    ? UNVERIFIED_PHARMACY_IMAGE_URL
    : '';
  const pharmacyFallbackCover = isPharmacy && !isVerified && !hasOwnerSelectedCover
    ? UNVERIFIED_PHARMACY_IMAGE_URL
    : '';
  const isDoctor = /طبيب|طبيبة|دكتور|دكتورة|doctor|physician/i.test([
    name, category, activityCategoryCode, raw.activityGroupCode, raw.activity_group_code,
    raw.activitySpecialty, raw.activity_specialty, profile.activity_specialty,
    provider?.kind, provider?.providerKind, provider?.provider_kind,
    raw.providerKind, raw.provider_kind, raw.kind, raw.type, raw.listingType, raw.listing_type,
  ].join(' ')) || (functionalGroupId === 'medical_health' && classificationType === 'profession');
  const doctorFallbackLogo = isDoctor && !isVerified && !hasOwnerSelectedLogo
    ? UNVERIFIED_DOCTOR_IMAGE_URL
    : '';
  const doctorFallbackCover = isDoctor && !isVerified && !hasOwnerSelectedCover
    ? UNVERIFIED_DOCTOR_IMAGE_URL
    : '';
  return {
    id, name, slug: String(raw.slug || provider?.slug || raw.code || id), category,
    categoryId: DEFAULT_CATEGORIES.find((x) => x.id === canonicalCategoryId)?.id || DEFAULT_CATEGORIES.find((x) => x.name === category || category.startsWith(x.name + ' — '))?.id,
    functionalGroupId,
    categoryClassificationType: classificationType,
    activitySpecialty: String(raw.activitySpecialty || raw.activity_specialty || raw.settings?.activity_specialty || meta.activity_specialty || profile.activity_specialty || '') || undefined,
    logoUrl: doctorFallbackLogo || pharmacyFallbackLogo || (isStockImageUrl(savedLogo) && !officialShowcase ? '' : savedLogo),
    coverUrl: doctorFallbackCover || pharmacyFallbackCover || (isStockImageUrl(savedCover) && !officialShowcase ? '' : savedCover),
    externalLogoUrl: /^https:\/\//i.test(externalLogoUrl) ? externalLogoUrl : '',
    externalCoverUrl: /^https:\/\//i.test(externalCoverUrl) ? externalCoverUrl : '',
    bio: String(profile.bio || raw.bio || provider?.description || ''),
    ownerWhatsApp: isPublicProjection ? publicWhatsApp : String(branch.phone || profile.phone || raw.ownerWhatsApp || ''),
    additionalContactPhones: Array.isArray(profile.additionalContactPhones || profile.additional_contact_phones) ? (profile.additionalContactPhones || profile.additional_contact_phones).map((value: unknown) => String(value || '')).filter(Boolean) : [],
    phone: isPublicProjection ? publicPhone : String(profile.contact_phone || branch.phone || profile.phone || raw.phone || ''), email: String(raw.email || ''),
    facebookUrl: String(profile.facebook_url || profile.facebookUrl || raw.facebookUrl || ''),
    instagramUrl: String(profile.instagram_url || profile.instagramUrl || raw.instagramUrl || ''),
    tiktokUrl: String(profile.tiktok_url || profile.tiktokUrl || raw.tiktokUrl || ''),
    address: isPublicProjection ? String(profile.address || '') : String(branch.address || profile.address || raw.address || ''),
    governorate: String(profile.governorate || raw.governorate || ''),
    markaz: String(profile.markaz || raw.markaz || ''), village: String(profile.village || raw.village || ''),
    googleMapsUrl: String(profile.google_maps_url || ''),
    // Coordinates may be stored on the selected branch, profile, raw activity, or their metadata/location objects.
    // Parse candidates independently so an empty/invalid field cannot hide a later valid coordinate.
    latitude: parseFirstOptionalCoordinate([
      branch.latitude, branch.lat, branch.latitude_deg, branchMetadata.latitude, branchMetadata.lat, branchMetadata.latitude_deg,
      branchLocation.latitude, branchLocation.lat, branchLocation.latitude_deg,
      branchMetadata.location?.latitude, branchMetadata.location?.lat,
      profile.latitude, profile.lat, profile.latitude_deg, profileMetadata.latitude, profileMetadata.lat, profileMetadata.latitude_deg,
      profileLocation.latitude, profileLocation.lat, profileLocation.latitude_deg,
      profileMetadata.location?.latitude, profileMetadata.location?.lat,
      raw.latitude, raw.lat, raw.latitude_deg, rawMetadata.latitude, rawMetadata.lat, rawMetadata.latitude_deg,
      rawLocation.latitude, rawLocation.lat, rawLocation.latitude_deg,
      rawMetadata.location?.latitude, rawMetadata.location?.lat,
    ], -90, 90),
    longitude: parseFirstOptionalCoordinate([
      branch.longitude, branch.lng, branch.lon, branch.longitude_deg, branchMetadata.longitude, branchMetadata.lng, branchMetadata.lon, branchMetadata.longitude_deg,
      branchLocation.longitude, branchLocation.lng, branchLocation.lon, branchLocation.longitude_deg,
      branchMetadata.location?.longitude, branchMetadata.location?.lng, branchMetadata.location?.lon,
      profile.longitude, profile.lng, profile.lon, profile.longitude_deg, profileMetadata.longitude, profileMetadata.lng, profileMetadata.lon, profileMetadata.longitude_deg,
      profileLocation.longitude, profileLocation.lng, profileLocation.lon, profileLocation.longitude_deg,
      profileMetadata.location?.longitude, profileMetadata.location?.lng, profileMetadata.location?.lon,
      raw.longitude, raw.lng, raw.lon, raw.longitude_deg, rawMetadata.longitude, rawMetadata.lng, rawMetadata.lon, rawMetadata.longitude_deg,
      rawLocation.longitude, rawLocation.lng, rawLocation.lon, rawLocation.longitude_deg,
      rawMetadata.location?.longitude, rawMetadata.location?.lng, rawMetadata.location?.lon,
    ], -180, 180),
    workingHours: String(profile.workingHours || profile.working_hours || raw.workingHours || ''),
    isVerified,
    maxProductsLimit: 150, createdAt: String(created).slice(0, 10),
    registrationDate: String(meta.registrationDate || created).slice(0, 10),
    paymentDueDay: Number(meta.paymentDueDay || 0), paymentDueDate: String(meta.paymentDueDate || ''),
    paymentGracePeriodDays: Number(meta.paymentGracePeriodDays ?? 0),
    subscriptionMode: meta.subscriptionMode === 'FREE' ? 'FREE' : 'PAID',
    subscriptionAmount: meta.subscriptionAmount == null ? undefined : Number(meta.subscriptionAmount),
    freeActivationApprovedByAdmin: meta.freeActivationApprovedByAdmin === true,
    commissionPerOrder: Number(meta.commissionPerOrder ?? 0),
    totalOrdersCount: Number(meta.totalOrdersCount || 0), paymentStatus: meta.paymentStatus || 'pending',
    overdueDaysCount: Number(meta.overdueDaysCount || 0), isFrozen: Boolean(meta.operationalStatus === 'FROZEN' || meta.isFrozen || String(meta.paymentStatus || '').toLowerCase() === 'frozen'),
    operationalStatus: (['ACTIVE', 'INACTIVE', 'FROZEN'].includes(String(meta.operationalStatus || raw.operationalStatus || '').toUpperCase()) ? String(meta.operationalStatus || raw.operationalStatus).toUpperCase() : (Boolean(meta.isFrozen) || String(meta.paymentStatus || '').toLowerCase() === 'frozen' || String(raw.status || '').toUpperCase() === 'SUSPENDED' ? 'FROZEN' : (String(raw.status || '').toUpperCase() === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'))) as 'ACTIVE' | 'INACTIVE' | 'FROZEN',
    lastPaymentDate: meta.lastPaymentDate, paymentConfirmedByAdmin: Boolean(meta.paymentConfirmedByAdmin),
    paymobConfig: { ...DEFAULT_PAYMOB_CONFIG, enabled: false },
    tenantId: String(raw.tenantId || raw.tenant_id || ''),
    branchId: String(branch.id || raw.branchId || raw.selectedBranchId || ''),
    organizationId: String(raw.organizationId || raw.organization_id || ''),
    publicEnabled: Boolean(raw.publicEnabled ?? profile.publicEnabled ?? raw.settings?.catalog_public_enabled),
    publicationStatus: String(meta.publicationStatus || raw.publicationStatus || ''),
    publicationRejectionReason: String(meta.publicationRejectionReason || ''),
    catalogPublished: Boolean(raw.catalogPublished ?? raw.publicEnabled ?? profile.publicEnabled ?? raw.settings?.catalog_public_enabled),
    businessCode: String(raw.code || ''),
    isOfficialShowcase: officialShowcase,
  } as Business;
}

export function mapProducts(businessId: string, _tenantId: string, branchId: string | undefined, items: any[], prices: any[]): Product[] {
  const now = Date.now();
  // Both public endpoints return only ACTIVE catalogue rows, but their field
  // shapes differ: directory rows use snake_case while public-catalog uses
  // normalized camelCase. Missing status is therefore trusted only for those
  // already-filtered API payloads; an explicit non-ACTIVE status is rejected.
  return (items || [])
    .filter((item: any) => {
      const status = item.status ?? item.itemStatus;
      return status == null || String(status).trim().toUpperCase() === 'ACTIVE';
    })
    .map((item: any) => {
      const metadata = item.metadata?.catalog_public || item.catalog_public || {};
      const itemType = String(item.item_type || item.type || 'PRODUCT').toUpperCase();
      const itemBranchId = String(branchId || item.branchId || item.branch_id || '');
      const relevant = (prices || []).filter((price: any) =>
        String(price.catalog_item_id || price.catalogItemId) === String(item.id)
        && (price.status == null || String(price.status).toUpperCase() === 'ACTIVE')
      );
      const validPrices = relevant.filter((price: any) => {
        const end = price.effective_to ? Date.parse(price.effective_to) : Infinity;
        const start = price.effective_from ? Date.parse(price.effective_from) : 0;
        return start <= now && end >= now;
      });
      // A branch-specific price can only be selected for the selected branch.
      // Never fall back to another branch's price.
      const price = validPrices.find((candidate: any) =>
        itemBranchId && String(candidate.branch_id || candidate.branchId || '') === itemBranchId
      ) || validPrices.find((candidate: any) => !candidate.branch_id && !candidate.branchId);
      const name = String(item.name_ar || item.nameAr || item.name_en || item.nameEn || item.name || 'عنصر كتالوج');
      const description = String(item.description || '');
      const category = String(metadata.category || item.category || 'عام');
      const savedImageUrl = String(metadata.image_url || item.imageUrl || item.image_url || '').trim();
      const savedImageSource = String(metadata.image_source || item.imageSource || item.image_source || '').toLowerCase();
      const stockImage = isStockImageUrl(savedImageUrl);
      const neutralPlaceholder = isNeutralPlaceholderUrl(savedImageUrl);
      const imageSource: 'auto' | 'owner' | 'ai' = !savedImageUrl || stockImage || neutralPlaceholder || savedImageSource === 'auto'
        ? 'auto'
        : savedImageSource === 'ai'
          ? 'ai'
          : 'owner';
      const imageUrl = imageSource === 'owner' || imageSource === 'ai'
        ? savedImageUrl
        : resolveDefaultImage({ name, description, category, kind: itemType === 'SERVICE' ? 'service' : 'product' });
      const rawComparePrice = metadata.compare_price ?? item.comparePrice;
      const comparePriceValue = rawComparePrice == null ? NaN : Number(rawComparePrice);
      const comparePrice = Number.isFinite(comparePriceValue) && comparePriceValue >= 0
        ? comparePriceValue
        : undefined;
      const { requiresQuote, available } = resolvePublicCatalogAvailability(metadata, item, price);
      return {
        id: String(item.id), businessId, name,
        category,
        type: itemType === 'SERVICE' ? 'service' : 'product',
        price: requiresQuote ? 0 : Number(price?.unit_price ?? price?.unitPrice ?? 0),
        comparePrice: requiresQuote ? undefined : comparePrice,
        description, imageUrl, imageSource,
        isAvailable: available,
        unit: String(metadata.unit || item.unit || ''),
        requiresQuote,
      } as Product;
    });
}

const isStockImageUrl = (value: unknown): boolean =>
  /^https:\/\/images\.unsplash\.com\//i.test(String(value || '').trim());
const isNeutralPlaceholderUrl = (value: unknown): boolean =>
  /(?:^|\/)catalog-item-placeholder\.svg(?:[?#].*)?$/i.test(String(value || '').trim());

const isPlatformAdmin = (m: any) => String(m.role || '').toUpperCase() === 'SUPER_ADMIN'
  && !m.business_id && !m.branch_id && m.permissions?.scope === 'PLATFORM' && m.permissions?.full_control === true;

const BUSINESS_WIDE_MANAGEMENT_ROLES = new Set(['OWNER', 'BUSINESS_OWNER', 'ADMIN']);
const DASHBOARD_SUPPORTED_MEMBERSHIP_ROLES = new Set(['OWNER', 'BUSINESS_OWNER', 'ADMIN', 'EMPLOYEE', 'STAFF']);

const selectMembershipForBusiness = (
  memberships: any[],
  businessId: string,
  tenantId: string,
): any | undefined => {
  const candidates = memberships.filter((membership: any) =>
    String(membership.business_id || '') === businessId &&
    String(membership.tenant_id || '') === tenantId &&
    String(membership.status || '').toUpperCase() === 'ACTIVE'
  );
  const tenantOwner = memberships.find((membership: any) =>
    String(membership.tenant_id || '') === tenantId &&
    String(membership.role || '').toUpperCase() === 'OWNER' &&
    !membership.business_id && !membership.branch_id &&
    String(membership.status || '').toUpperCase() === 'ACTIVE'
  );
  // A tenant-wide owner is broader than any per-business employee row and must
  // define both the catalog bootstrap scope and the session permission context.
  if (tenantOwner) return tenantOwner;
  const compare = (a: any, b: any) => {
    const roleRank = (membership: any) => {
      const role = String(membership.role || '').toUpperCase();
      if (role === 'OWNER') return 60;
      if (role === 'BUSINESS_OWNER') return 59;
      if (role === 'ADMIN') return 58;
      if (role === 'EMPLOYEE') return 40;
      if (role === 'STAFF') return 39;
      return DASHBOARD_SUPPORTED_MEMBERSHIP_ROLES.has(role) ? 20 : 0;
    };
    const roleDifference = roleRank(b) - roleRank(a);
    if (roleDifference) return roleDifference;
    const scopeDifference = Number(Boolean(a.branch_id)) - Number(Boolean(b.branch_id));
    if (scopeDifference) return scopeDifference;
    return Date.parse(String(b.created_at || '')) - Date.parse(String(a.created_at || ''));
  };
  return candidates.sort(compare)[0]
    || memberships.find((membership: any) =>
      String(membership.tenant_id || '') === tenantId &&
      String(membership.role || '').toUpperCase() === 'OWNER' &&
      !membership.business_id && !membership.branch_id &&
      String(membership.status || '').toUpperCase() === 'ACTIVE'
    );
};

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }));
  return results;
}

export async function bootstrapProductionUser(user: User | null): Promise<{
  authSession: AuthSession; businesses: Business[]; products: Product[]; subscribers: Subscriber[]; adminSettings: AdminSettings;
}> {
  const adminSettings: AdminSettings = { ...INITIAL_ADMIN_SETTINGS, adminPassword: '', platformName: 'MantiqatiX', currency: 'ج.م' };
  if (!user) {
    const directory = await fetchPublicDirectory().catch(() => ({ businesses: [], products: [] }));
    return {
      authSession: { role: 'guest', isAuthenticated: false },
      businesses: directory.businesses,
      products: directory.products,
      subscribers: [],
      adminSettings,
    };
  }

  const { data: memberships, error } = await supabase.from('user_memberships')
    .select('id,user_id,tenant_id,organization_id,business_id,branch_id,role,status,permissions,created_at')
    .eq('user_id', user.id).eq('status', 'ACTIVE').limit(250);
  if (error) throw new Error('تعذر تحميل صلاحيات الحساب من قاعدة الإنتاج.');
  const active = memberships || [];
  const platformMemberships = active.filter(isPlatformAdmin);
  const roleMemberships = active.filter((m: any) => [
    'OWNER', 'BUSINESS_OWNER', 'ADMIN', 'MANAGER', 'FINANCE', 'SALES', 'MARKETING',
    'SUPPORT', 'SUPPORT_MANAGER', 'EMPLOYEE', 'STAFF', 'SERVICE_PROVIDER', 'PROVIDER_OWNER',
    'PROVIDER_ADMIN', 'BRANCH_MANAGER', 'PROVIDER_FINANCE', 'PROVIDER_MARKETING',
    'PROVIDER_OPERATIONS', 'PROVIDER_SUPPORT',
  ].includes(String(m.role || '').toUpperCase()));
  const platform = platformMemberships.length > 0;
  // Platform settings are independent from catalog discovery. Start the read
  // now so it overlaps tenant/business listing and bounded catalog hydration.
  const platformSettingsPromise = platform
    ? callPlatformAdmin({ action: 'GET_SETTINGS' }).catch(() => ({}))
    : Promise.resolve({});
  const permittedRows: any[] = [];

  if (platform) {
    const tenantIds = [...new Set(platformMemberships.map((m: any) => String(m.tenant_id || '')).filter(Boolean))];
    const tenantLists = await Promise.all(tenantIds.map(async (tenantId) => {
      const list: any = await callCatalogAdmin({ action: 'BUSINESS_LIST', tenantId });
      return Array.isArray(list?.businesses) ? list.businesses : [];
    }));
    permittedRows.push(...tenantLists.flat());
  } else {
    const tenantWideOwnerIds = [...new Set(roleMemberships.filter((m: any) => String(m.role).toUpperCase() === 'OWNER' && !m.business_id && !m.branch_id).map((m: any) => String(m.tenant_id || '')).filter(Boolean))];
    const tenantLists = await Promise.all(tenantWideOwnerIds.map(async (tenantId) => {
      const list: any = await callCatalogAdmin({ action: 'BUSINESS_LIST', tenantId });
      return Array.isArray(list?.businesses) ? list.businesses : [];
    }));
    permittedRows.push(...tenantLists.flat());
    for (const m of roleMemberships.filter((x: any) => x.business_id)) {
      permittedRows.push({ id: m.business_id, tenantId: m.tenant_id, organizationId: m.organization_id, branchId: m.branch_id, name: '', status: 'ACTIVE' });
    }
  }

  const uniqueRows = [...new Map(permittedRows.map((b: any) => [String(b.id || b.businessId), b])).values()];
  const businesses: Business[] = [];
  const products: Product[] = [];
  // Catalog reads are independent per authorized business. A small bounded pool
  // removes the previous one-request-at-a-time delay without flooding the Edge
  // Function or changing the tenant/branch scope of any request.
  const catalogResults = await mapWithConcurrency(uniqueRows.slice(0, 250), 8, async (row) => {
    const tenantId = String(row.tenantId || row.tenant_id || '');
    const businessId = String(row.id || row.businessId || '');
    if (!tenantId || !businessId) return null;
    const membership = selectMembershipForBusiness(roleMemberships, businessId, tenantId);
    // For authenticated business members the selected membership is the source of
    // branch scope. Do not trust the first row returned by PostgREST or a duplicate
    // placeholder row to choose a wider catalog query.
    const branchId = platform ? String(row.branchId || '') : String(membership?.branch_id || '');
    try {
      const catalog: any = await callCatalogAdmin({ action: 'CATALOG_READ', tenantId, businessId, ...(branchId ? { branchId } : {}) });
      const business = mapBusiness({
        ...row,
        ...catalog.business,
        id: businessId,
        tenantId,
        organizationId: row.organizationId || row.organization_id || catalog.business?.organizationId,
        branchId: catalog.selectedBranchId || branchId || '',
        branches: Array.isArray(catalog.branches) ? catalog.branches : [],
        profile: catalog.business?.profile || row.profile || {},
        bizcatalog: catalog.business?.bizcatalog || row.bizcatalog || {},
      }, catalog.provider);
      const mappedProducts = mapProducts(businessId, tenantId, catalog.selectedBranchId || branchId || '', catalog.items || [], catalog.prices || []);
      return { business, products: mappedProducts };
    } catch (e) {
      // A membership may only cover a different branch or a legacy inactive business.
      console.warn('[MantiqatiX] skipped out-of-scope catalog row', businessId, e instanceof Error ? e.message : 'unavailable');
      return null;
    }
  });
  for (const result of catalogResults) {
    if (!result) continue;
    businesses.push(result.business);
    products.push(...result.products);
  }

  // Do not silently downgrade an active business-linked membership to an empty
  // workspace when every scoped catalog read failed. Fail closed and surface the
  // data-loading failure; this does not grant access or mutate the subscription.
  const hasBusinessScopedMembership = roleMemberships.some((m: any) => Boolean(m.business_id));
  if (!platform && hasBusinessScopedMembership && businesses.length === 0) {
    throw new Error('تم العثور على عضوية نشطة مرتبطة بنشاط لكن تعذر تحميل كتالوجه من قاعدة الإنتاج. لم يتم تغيير الاشتراك أو منح صلاحيات بديلة. حدّث الصفحة وأعد المحاولة، وإذا استمرت المشكلة فراجع ربط العضوية بالنشاط في Supabase.');
  }

  let subscribers: Subscriber[] = [];
  const settingsResult: any = await platformSettingsPromise;
  if (platform) {
    if (settingsResult?.settings) Object.assign(
      adminSettings,
      settingsResult.settings,
      normalizeCanonicalTaxonomySettings(settingsResult.settings),
      { adminPassword: '' },
    );
  }

  const role = platform ? 'admin' : roleMemberships.length ? 'subscriber' : 'guest';
  const own = roleMemberships.find((m: any) => m.business_id && businesses.some((b) => b.id === String(m.business_id))) || roleMemberships[0];
  const managementRoles = ['OWNER', 'BUSINESS_OWNER', 'ADMIN'];
  const chosen = businesses.find((b) => roleMemberships.some((m: any) =>
    String(m.business_id || '') === b.id &&
    managementRoles.includes(String(m.role).toUpperCase())
  )) || businesses.find((b) => roleMemberships.some((m: any) =>
    String(m.tenant_id || '') === String(b.tenantId || '') &&
    String(m.role || '').toUpperCase() === 'OWNER' && !m.business_id && !m.branch_id
  )) || businesses.find((b) => roleMemberships.some((m: any) =>
    String(m.business_id || '') === b.id && String(m.role || '').toUpperCase() === 'MANAGER'
  )) || businesses.find((b) => roleMemberships.some((m: any) => String(m.business_id || '') === b.id)) || businesses[0];
  // Prefer the strongest active membership for the chosen business instead of
  // whichever row happens to appear first in the membership result.
  // A tenant-wide OWNER is valid only within that owner's tenant.
  const chosenMembership = chosen
    ? selectMembershipForBusiness(roleMemberships, chosen.id, String(chosen.tenantId || ''))
      || roleMemberships.find((m: any) => String(m.business_id || '') === chosen.id)
    : own;
  return {
    // Authentication and authorization are separate: a Google user with no
    // active membership is signed in as a customer/guest, never an owner.
    authSession: {
      role,
      isAuthenticated: true,
      userId: user.id,
      email: user.email || undefined,
      subscriberId: chosenMembership?.id || own?.id,
      businessId: chosen?.id,
      subscriberName: String(user.user_metadata?.full_name || user.user_metadata?.name || user.email || ''),
      membershipRole: String(chosenMembership?.role || '').toUpperCase() || undefined,
      membershipBranchId: String(chosenMembership?.branch_id || '') || undefined,
      membershipPermissions: chosenMembership?.permissions && typeof chosenMembership.permissions === 'object'
        ? chosenMembership.permissions
        : undefined,
    },
    businesses, products, subscribers, adminSettings,
  };
}

export const productionRuntime = runtime;
