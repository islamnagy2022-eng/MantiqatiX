import { createClient, type User } from '@supabase/supabase-js';
import type { AdminSettings, AuthSession, Business, FunctionalGroupId, Product, Subscriber } from '../types';
import { DEFAULT_CATEGORIES, DEFAULT_FUNCTIONAL_GROUPS, DEFAULT_PAYMOB_CONFIG, INITIAL_ADMIN_SETTINGS, normalizeCanonicalTaxonomySettings, resolveCanonicalGroupId } from '../data/productionDefaults';
import { resolveDefaultImage } from '../utils/defaultImages';

const runtime = (window as any).MANTIQATIX_CONFIG || (window as any).MNTY_CONFIG;
if (!runtime?.supabaseUrl || !runtime?.supabaseKey) {
  throw new Error('تعذر تحميل إعدادات الاتصال الإنتاجي لمنصة MantiqatiX');
}

export type CatalogAiImageKind = 'activity' | 'product' | 'service';

export async function generateCatalogAiImage(input: {
  businessId: string;
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

export async function fetchPublicDirectory(): Promise<{ businesses: Business[]; products: Product[] }> {
  const { data, error } = await supabase.functions.invoke('public-catalog-directory', { method: 'GET' } as any);
  if (error) throw new Error(error.message || 'تعذر تحميل دليل الأنشطة المنشورة');
  const rows = Array.isArray(data?.businesses) ? data.businesses : [];
  const businesses: Business[] = [];
  const products: Product[] = [];
  for (const row of rows) {
    const mapped = mapBusiness({ ...row, branches: row.branches || [], branchId: row.selectedBranchId || row.branchId }, row.provider);
    businesses.push(mapped);
    products.push(...mapProducts(mapped.id, mapped.tenantId || '', mapped.branchId, row.items || [], row.prices || []));
  }
  return { businesses, products };
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
    slug: body.provider?.slug,
    bio: body.profile?.bio || body.provider?.description,
    branches: body.branches,
    profile: body.profile,
    branchId: body.selectedBranchId,
    publicEnabled: true,
  }, body.provider);
  return { business, products: mapProducts(businessId, business.tenantId || '', business.branchId, body.items || [], body.prices || []) };
}

function groupFromCategory(category: string): FunctionalGroupId {
  return resolveCanonicalGroupId(category);
}

export function mapBusiness(raw: any, provider: any): Business {
  const profile = raw.profile || raw.settings?.catalog_profile || {};
  const branch = raw.branches?.find((x: any) => String(x.id) === String(raw.branchId || raw.selectedBranchId)) || raw.branches?.[0] || raw.branch || {};
  const category = String(raw.category || provider?.kind || provider?.provider_kind || 'أنشطة تجارية');
  const meta = raw.bizcatalog || raw.settings?.bizcatalog || {};
  const created = raw.createdAt || raw.created_at || new Date().toISOString();
  const id = String(raw.id || raw.businessId || '');
  const name = String(raw.name || provider?.name || provider?.name_ar || 'نشاط تجاري');
  const officialShowcase = Boolean(raw.isOfficialShowcase || raw.settings?.source === 'OFFICIAL_PLATFORM_SHOWCASE' || raw.settings?.managed_by === 'SUPER_ADMIN');
  const savedLogo = String(profile.logoUrl || profile.logo_url || raw.logoUrl || '');
  const savedCover = String(profile.coverUrl || profile.cover_url || raw.coverUrl || '');
  return {
    id, name, slug: String(raw.slug || provider?.slug || raw.code || id), category,
    categoryId: DEFAULT_CATEGORIES.find((x) => x.name === category || category.startsWith(x.name + ' — '))?.id,
    functionalGroupId: groupFromCategory(category),
    logoUrl: isStockImageUrl(savedLogo) && !officialShowcase ? '' : savedLogo,
    coverUrl: isStockImageUrl(savedCover) && !officialShowcase ? '' : savedCover,
    bio: String(profile.bio || raw.bio || provider?.description || ''),
    ownerWhatsApp: String(branch.phone || profile.phone || raw.ownerWhatsApp || ''),
    phone: String(profile.contact_phone || branch.phone || profile.phone || raw.phone || ''), email: String(raw.email || ''),
    facebookUrl: String(profile.facebook_url || profile.facebookUrl || raw.facebookUrl || ''),
    instagramUrl: String(profile.instagram_url || profile.instagramUrl || raw.instagramUrl || ''),
    tiktokUrl: String(profile.tiktok_url || profile.tiktokUrl || raw.tiktokUrl || ''),
    address: String(branch.address || profile.address || raw.address || ''),
    governorate: String(profile.governorate || raw.governorate || ''),
    markaz: String(profile.markaz || raw.markaz || ''), village: String(profile.village || raw.village || ''),
    googleMapsUrl: String(profile.google_maps_url || ''),
    workingHours: String(profile.workingHours || profile.working_hours || raw.workingHours || ''),
    isVerified: Boolean(provider?.verified ?? provider?.is_verified ?? raw.isVerified),
    maxProductsLimit: 150, createdAt: String(created).slice(0, 10),
    registrationDate: String(meta.registrationDate || created).slice(0, 10),
    paymentDueDay: Number(meta.paymentDueDay || 0), paymentDueDate: String(meta.paymentDueDate || ''),
    paymentGracePeriodDays: Number(meta.paymentGracePeriodDays ?? 0),
    commissionPerOrder: Number(meta.commissionPerOrder ?? 0),
    totalOrdersCount: Number(meta.totalOrdersCount || 0), paymentStatus: meta.paymentStatus || 'pending',
    overdueDaysCount: Number(meta.overdueDaysCount || 0), isFrozen: Boolean(meta.isFrozen || String(meta.paymentStatus || '').toLowerCase() === 'frozen'),
    lastPaymentDate: meta.lastPaymentDate, paymentConfirmedByAdmin: Boolean(meta.paymentConfirmedByAdmin),
    paymobConfig: { ...DEFAULT_PAYMOB_CONFIG, enabled: false },
    tenantId: String(raw.tenantId || raw.tenant_id || ''),
    branchId: String(branch.id || raw.branchId || raw.selectedBranchId || ''),
    organizationId: String(raw.organizationId || raw.organization_id || ''),
    publicEnabled: Boolean(raw.publicEnabled ?? profile.publicEnabled ?? raw.settings?.catalog_public_enabled),
    catalogPublished: Boolean(raw.catalogPublished ?? raw.publicEnabled ?? profile.publicEnabled ?? raw.settings?.catalog_public_enabled),
    businessCode: String(raw.code || ''),
    isOfficialShowcase: officialShowcase,
  } as Business;
}

export function mapProducts(businessId: string, _tenantId: string, branchId: string | undefined, items: any[], prices: any[]): Product[] {
  const now = Date.now();
  return (items || []).filter((i: any) => String(i.status || '').toUpperCase() === 'ACTIVE').map((i: any) => {
    const metadata = i.metadata?.catalog_public || {};
    const relevant = (prices || []).filter((p: any) => String(p.catalog_item_id || p.catalogItemId) === String(i.id) && String(p.status || '').toUpperCase() === 'ACTIVE');
    const price = relevant.find((p: any) => String(p.branch_id || p.branchId || '') === String(branchId || '')) || relevant.find((p: any) => !p.branch_id && !p.branchId) || relevant[0];
    const end = price?.effective_to ? Date.parse(price.effective_to) : Infinity;
    const start = price?.effective_from ? Date.parse(price.effective_from) : 0;
    const itemType = String(i.item_type || 'PRODUCT').toUpperCase();
    const name = String(i.name_ar || i.name_en || 'عنصر كتالوج');
    const description = String(i.description || '');
    const category = String(metadata.category || i.category || 'عام');
    const savedImageUrl = String(metadata.image_url || i.imageUrl || i.image_url || '').trim();
    const savedImageSource = String(metadata.image_source || i.imageSource || i.image_source || '').toLowerCase();
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
    // Service requests with hidden prices are quotable services, not unavailable products.
    const requiresQuote = itemType === 'SERVICE' && metadata.show_price === false;
    const available = metadata.is_available !== false && (
      requiresQuote || (Boolean(price) && start <= now && end >= now)
    );
    return {
      id: String(i.id), businessId, name,
      category,
      type: itemType === 'SERVICE' ? 'service' : 'product',
      price: requiresQuote ? 0 : Number(price?.unit_price ?? 0),
      comparePrice: requiresQuote || metadata.compare_price == null ? undefined : Number(metadata.compare_price),
      description, imageUrl, imageSource,
      isAvailable: available, unit: String(metadata.unit || ''), requiresQuote,
    } as Product;
  });
}

const isStockImageUrl = (value: unknown): boolean =>
  /^https:\/\/images\.unsplash\.com\//i.test(String(value || '').trim());
const isNeutralPlaceholderUrl = (value: unknown): boolean =>
  /(?:^|\/)catalog-item-placeholder\.svg(?:[?#].*)?$/i.test(String(value || '').trim());

const isPlatformAdmin = (m: any) => String(m.role || '').toUpperCase() === 'SUPER_ADMIN'
  && !m.business_id && !m.branch_id && m.permissions?.scope === 'PLATFORM' && m.permissions?.full_control === true;

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
  const permittedRows: any[] = [];

  if (platform) {
    const tenantIds = [...new Set(platformMemberships.map((m: any) => String(m.tenant_id || '')).filter(Boolean))];
    for (const tenantId of tenantIds) {
      const list: any = await callCatalogAdmin({ action: 'BUSINESS_LIST', tenantId });
      permittedRows.push(...(Array.isArray(list?.businesses) ? list.businesses : []));
    }
  } else {
    const tenantWideOwnerIds = [...new Set(roleMemberships.filter((m: any) => String(m.role).toUpperCase() === 'OWNER' && !m.business_id && !m.branch_id).map((m: any) => String(m.tenant_id || '')).filter(Boolean))];
    for (const tenantId of tenantWideOwnerIds) {
      const list: any = await callCatalogAdmin({ action: 'BUSINESS_LIST', tenantId });
      permittedRows.push(...(Array.isArray(list?.businesses) ? list.businesses : []));
    }
    for (const m of roleMemberships.filter((x: any) => x.business_id)) {
      permittedRows.push({ id: m.business_id, tenantId: m.tenant_id, organizationId: m.organization_id, branchId: m.branch_id, name: '', status: 'ACTIVE' });
    }
  }

  const uniqueRows = [...new Map(permittedRows.map((b: any) => [String(b.id || b.businessId), b])).values()];
  const businesses: Business[] = [];
  const products: Product[] = [];
  for (const row of uniqueRows.slice(0, 250)) {
    const tenantId = String(row.tenantId || row.tenant_id || '');
    const businessId = String(row.id || row.businessId || '');
    if (!tenantId || !businessId) continue;
    const membership = roleMemberships.find((m: any) => String(m.business_id || '') === businessId)
      || roleMemberships.find((m: any) => String(m.tenant_id) === tenantId && String(m.role).toUpperCase() === 'OWNER' && !m.business_id);
    const branchId = String(row.branchId || membership?.branch_id || '');
    try {
      const catalog: any = await callCatalogAdmin({ action: 'CATALOG_READ', tenantId, businessId, ...(branchId ? { branchId } : {}) });
      const b = mapBusiness({
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
      businesses.push(b);
      products.push(...mapProducts(businessId, tenantId, catalog.selectedBranchId || branchId || '', catalog.items || [], catalog.prices || []));
    } catch (e) {
      // A membership may only cover a different branch or a legacy inactive business.
      console.warn('[MantiqatiX] skipped out-of-scope catalog row', businessId, e instanceof Error ? e.message : 'unavailable');
    }
  }

  let subscribers: Subscriber[] = [];
  let subscriberDirectoryError = '';
  let ignoredOrphanMemberships = 0;
  if (platform) {
    try {
      const list: any = await callPlatformAdmin({ action: 'LIST_SUBSCRIBERS' });
      ignoredOrphanMemberships = Number(list?.ignoredOrphanMemberships || 0);
      subscribers = (Array.isArray(list?.subscribers) ? list.subscribers : []).map((row: any): Subscriber => {
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
    } catch (error) {
      subscriberDirectoryError = error instanceof Error ? error.message : 'تعذر تحميل حسابات Supabase';
      subscribers = [];
    }
    const settingsResult: any = await callPlatformAdmin({ action: 'GET_SETTINGS' }).catch(() => ({}));
    if (settingsResult?.settings) Object.assign(
      adminSettings,
      settingsResult.settings,
      normalizeCanonicalTaxonomySettings(settingsResult.settings),
      { adminPassword: '' },
    );
  }

  const role = platform ? 'admin' : roleMemberships.length ? 'subscriber' : 'guest';
  const own = roleMemberships.find((m: any) => m.business_id && businesses.some((b) => b.id === String(m.business_id))) || roleMemberships[0];
  const chosen = businesses.find((b) => roleMemberships.some((m: any) => String(m.business_id || '') === b.id && ['OWNER', 'BUSINESS_OWNER', 'ADMIN', 'MANAGER'].includes(String(m.role).toUpperCase()))) || businesses[0];
  return {
    // Authentication and authorization are separate: a Google user with no
    // active membership is signed in as a customer/guest, never an owner.
    authSession: {
      role,
      isAuthenticated: true,
      userId: user.id,
      email: user.email || undefined,
      subscriberId: own?.id,
      businessId: chosen?.id,
      subscriberName: String(user.user_metadata?.full_name || user.user_metadata?.name || user.email || ''),
      subscriberDirectoryError: subscriberDirectoryError || undefined,
      ignoredOrphanMemberships,
    },
    businesses, products, subscribers, adminSettings,
  };
}

export const productionRuntime = runtime;
