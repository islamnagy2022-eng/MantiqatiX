export type SeoView =
  | 'directory'
  | 'marketplace_home'
  | 'public_storefront'
  | 'contact_us'
  | 'site_map'
  | 'merchant_admin'
  | 'super_admin'
  | 'professional_dashboard'
  | 'account_portal'
  | 'login';

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
  publicationStatus?: string;
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
}

const PRIVATE_VIEWS = new Set<SeoView>([
  'merchant_admin',
  'super_admin',
  'professional_dashboard',
  'account_portal',
  'login',
]);

function cleanDescription(value: string, fallback: string): string {
  const cleaned = value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return fallback;
  return cleaned.length > 160 ? `${cleaned.slice(0, 157).trimEnd()}...` : cleaned;
}

function normalizeBasePath(value: string): string {
  const path = value.trim() || '/';
  return path.endsWith('/') ? path : `${path}/`;
}

export function resolveRouteSeoMetadata(input: ResolveSeoInput): RouteSeoMetadata {
  const origin = input.origin.replace(/\/$/, '');
  const basePath = normalizeBasePath(input.basePath);
  const rootUrl = new URL(basePath, `${origin}/`).toString();
  const fallbackDescription =
    'اكتشف الأنشطة والخدمات والمنتجات في مصر عبر MantiqatiX، وتصفح صفحات الأنشطة وكتالوجاتها الرقمية وتواصل معها بسهولة.';

  if (!input.allowIndexing || PRIVATE_VIEWS.has(input.view)) {
    return {
      title: 'MantiqatiX | منصة الأنشطة والكتالوجات',
      description: fallbackDescription,
      robots: 'noindex,nofollow',
      canonicalUrl: null,
      openGraphType: 'website',
    };
  }

  if (input.view === 'public_storefront') {
    const business = input.business;
    const isPubliclyEligible = Boolean(
      business?.id &&
      business.name?.trim() &&
      business.isVerified === true &&
      business.isFrozen !== true &&
      business.publicEnabled !== false &&
      (!business.publicationStatus || business.publicationStatus === 'PUBLISHED'),
    );
    if (!isPubliclyEligible || !business) {
      return {
        title: 'نشاط غير متاح | MantiqatiX',
        description: fallbackDescription,
        robots: 'noindex,nofollow',
        canonicalUrl: null,
        openGraphType: 'website',
      };
    }

    const location = [business.markaz, business.governorate].filter(Boolean).join('، ');
    const description = cleanDescription(
      [business.bio, business.category, location].filter(Boolean).join(' — '),
      `تعرف على ${business.name} وخدماته وكتالوجه الرقمي عبر MantiqatiX.`,
    );
    const canonical = new URL(basePath, `${origin}/`);
    canonical.searchParams.set('store', business.id);
    return {
      title: `${business.name} | MantiqatiX`,
      description,
      robots: 'index,follow',
      canonicalUrl: canonical.toString(),
      openGraphType: 'website',
    };
  }

  const title = input.view === 'contact_us'
    ? 'تواصل معنا | MantiqatiX'
    : input.view === 'site_map'
      ? 'خريطة الموقع | MantiqatiX'
      : input.view === 'marketplace_home'
        ? 'MantiqatiX | اكتشف الأنشطة والخدمات والمنتجات'
        : 'دليل الأنشطة والكتالوجات في مصر | MantiqatiX';

  return {
    title,
    description: fallbackDescription,
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
