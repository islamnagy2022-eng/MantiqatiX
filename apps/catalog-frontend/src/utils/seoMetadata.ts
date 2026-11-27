export type SeoView =
  | 'directory' | 'marketplace_home' | 'public_storefront' | 'contact_us' | 'site_map'
  | 'merchant_admin' | 'super_admin' | 'professional_dashboard' | 'account_portal' | 'login';

export interface SeoBusiness {
  id: string;
  name: string;
  bio?: string;
  category?: string;
  governorate?: string;
  markaz?: string;
  isVerified: boolean;
  isFrozen?: boolean;
  publicEnabled?: boolean;
  catalogPublished?: boolean;
  isOfficialShowcase?: boolean;
  publicationStatus?: string;
  operationalStatus?: string;
}

export interface RouteSeoMetadata {
  title: string;
  description: string;
  robots: 'index,follow' | 'noindex,nofollow';
  canonicalUrl: string | null;
  openGraphType: 'website';
}

interface ResolveSeoInput {
  view: SeoView;
  business?: SeoBusiness;
  origin: string;
  basePath: string;
  allowIndexing: boolean;
  activityId?: string;
  activityName?: string;
  specialtyName?: string;
  governorateName?: string;
}

const PRIVATE_VIEWS = new Set<SeoView>([
  'merchant_admin', 'super_admin', 'professional_dashboard', 'account_portal', 'login',
]);

const FALLBACK_DESCRIPTION =
  'اكتشف الأنشطة والخدمات والمنتجات في مصر عبر MantiqatiX، وتصفح صفحات الأنشطة وكتالوجاتها الرقمية وتواصل معها بسهولة.';

function cleanDescription(value: string, fallback: string): string {
  const cleaned = value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return fallback;
  return cleaned.length > 160 ? `${cleaned.slice(0, 157).trimEnd()}...` : cleaned;
}

function normalizeBasePath(value: string): string {
  const path = value.trim() || '/';
  return path.startsWith('/') ? (path.endsWith('/') ? path : `${path}/`) : `/${path.replace(/\/+$/, '')}/`;
}

function buildCanonicalRoot(origin: string, basePath: string): string {
  return new URL(normalizeBasePath(basePath), `${origin.replace(/\/$/, '')}/`).toString();
}

export function resolveRouteSeoMetadata(input: ResolveSeoInput): RouteSeoMetadata {
  const origin = input.origin.replace(/\/$/, '');
  const rootUrl = buildCanonicalRoot(origin, input.basePath);

  if (!input.allowIndexing || PRIVATE_VIEWS.has(input.view)) {
    return {
      title: 'MantiqatiX | منصة الأنشطة والكتالوجات',
      description: FALLBACK_DESCRIPTION,
      robots: 'noindex,nofollow',
      canonicalUrl: null,
      openGraphType: 'website',
    };
  }

  if (input.view === 'public_storefront') {
    const business = input.business;
    const hasPublicPublication = business?.publicEnabled === true || business?.catalogPublished === true || business?.isOfficialShowcase === true;
    const isPubliclyEligible = Boolean(
      business?.id &&
      business.name?.trim() &&
      business.isVerified === true &&
      hasPublicPublication &&
      business.isFrozen !== true &&
      (!business.operationalStatus || business.operationalStatus === 'ACTIVE') &&
      (!business.publicationStatus || business.publicationStatus === 'PUBLISHED')
    );

    if (!isPubliclyEligible || !business) {
      return {
        title: 'نشاط غير متاح | MantiqatiX',
        description: FALLBACK_DESCRIPTION,
        robots: 'noindex,nofollow',
        canonicalUrl: null,
        openGraphType: 'website',
      };
    }

    const location = [business.markaz, business.governorate].filter(Boolean).join('، ');
    const description = cleanDescription(
      [business.bio, business.category, location].filter(Boolean).join(' — '),
      `تعرف على ${business.name} وخدماته وكتالوجه الرقمي عبر MantiqatiX.`
    );
    const canonical = new URL(rootUrl);
    canonical.searchParams.set('store', business.id);
    return {
      title: `${business.name} | MantiqatiX`,
      description,
      robots: 'index,follow',
      canonicalUrl: canonical.toString(),
      openGraphType: 'website',
    };
  }

  if (input.view === 'directory' && input.activityId && input.activityName?.trim()) {
    const canonical = new URL(rootUrl);
    canonical.searchParams.set('activity', input.activityId);
    if (input.governorateName?.trim()) canonical.searchParams.set('governorate', input.governorateName.trim());
    if (input.specialtyName?.trim()) canonical.searchParams.set('specialty', input.specialtyName.trim());
    const location = input.governorateName?.trim() || 'مصر';
    const title = input.specialtyName?.trim()
      ? `${input.specialtyName} في ${input.activityName} — ${location} | MantiqatiX`
      : `${input.activityName} في ${location} | MantiqatiX`;
    const description = input.specialtyName?.trim()
      ? `اكتشف تصنيف ${input.activityName} وتخصص ${input.specialtyName} والجهات المنشورة في ${location} عبر MantiqatiX.`
      : `تصفح تصنيف ${input.activityName} وتخصصاته والجهات المنشورة في ${location} عبر MantiqatiX.`;
    return {
      title,
      description: cleanDescription(description, FALLBACK_DESCRIPTION),
      robots: 'index,follow',
      canonicalUrl: canonical.toString(),
      openGraphType: 'website',
    };
  }

  if (input.view === 'directory' && input.governorateName?.trim()) {
    const governorate = input.governorateName.trim();
    const canonical = new URL(rootUrl);
    canonical.searchParams.set('governorate', governorate);
    return {
      title: `دليل الأنشطة والخدمات في محافظة ${governorate} | MantiqatiX`,
      description: cleanDescription(
        `تصفح تصنيفات الأنشطة والتخصصات والجهات المنشورة في محافظة ${governorate} عبر MantiqatiX. تُعرض المنشآت وفق حالة النشر والتوثيق المعتمدة.`,
        FALLBACK_DESCRIPTION,
      ),
      robots: 'index,follow',
      canonicalUrl: canonical.toString(),
      openGraphType: 'website',
    };
  }

  if (input.view === 'contact_us' || input.view === 'site_map') {
    const canonical = new URL(rootUrl);
    canonical.searchParams.set('view', input.view);
    return {
      title: input.view === 'contact_us' ? 'تواصل معنا | MantiqatiX' : 'خريطة الموقع | MantiqatiX',
      description: FALLBACK_DESCRIPTION,
      robots: 'index,follow',
      canonicalUrl: canonical.toString(),
      openGraphType: 'website',
    };
  }

  const title = input.view === 'marketplace_home'
    ? 'MantiqatiX | اكتشف الأنشطة والخدمات والمنتجات'
    : 'دليل الأنشطة والكتالوجات في مصر | MantiqatiX';

  return {
    title,
    description: FALLBACK_DESCRIPTION,
    robots: 'index,follow',
    canonicalUrl: rootUrl,
    openGraphType: 'website',
  };
}

function upsertMeta(attribute: 'name' | 'property', key: string, content: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

export function applyRouteSeoMetadata(metadata: RouteSeoMetadata): void {
  document.title = metadata.title;
  upsertMeta('name', 'description', metadata.description);
  upsertMeta('name', 'robots', metadata.robots);
  upsertMeta('property', 'og:title', metadata.title);
  upsertMeta('property', 'og:description', metadata.description);
  upsertMeta('property', 'og:type', metadata.openGraphType);
  upsertMeta('name', 'twitter:title', metadata.title);
  upsertMeta('name', 'twitter:description', metadata.description);

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (metadata.canonicalUrl) {
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = metadata.canonicalUrl;
    upsertMeta('property', 'og:url', metadata.canonicalUrl);
  } else {
    canonical?.remove();
    document.head.querySelector('meta[property="og:url"]')?.remove();
  }
}
