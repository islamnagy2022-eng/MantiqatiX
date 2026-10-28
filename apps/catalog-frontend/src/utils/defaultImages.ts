/**
 * Category-aware local imagery for the production catalog.
 * These assets are bundled with the catalog frontend (not served from the legacy app).
 * AI-generated, persisted URLs are preserved separately as imageSource="ai".
 */
export type DefaultImageKind = 'activity' | 'product' | 'service' | 'cover';

export interface DefaultImageInput {
  name?: string | null;
  description?: string | null;
  category?: string | null;
  kind?: DefaultImageKind;
}

const asset = (name: string): string => {
  const base = import.meta.env.BASE_URL || '/';
  return `${base.endsWith('/') ? base : `${base}/`}${name}`;
};

const contextText = (input: DefaultImageInput): string =>
  [input.name, input.description, input.category].filter(Boolean).join(' ').toLocaleLowerCase();

type ArtKey = 'food' | 'health' | 'pharmacy' | 'auto' | 'education' | 'fitness' | 'home' | 'real-estate' | 'travel' | 'digital' | 'fashion' | 'grocery' | 'marketing' | 'maintenance' | 'labs';

function inferArt(input: DefaultImageInput): ArtKey {
  const text = contextText(input);
  // More specific terms must be tested before broad ones (e.g. pharmacy before health).
  if (/صيدل|دواء|أدوية|pharmacy|medicine/.test(text)) return 'pharmacy';
  if (/معمل|تحاليل|أشعة|مختبر|laborator|radiolog|lab/.test(text)) return 'labs';
  if (/عياد|طبي|طبيب|أسنان|مستشفى|صحة|health|medical|clinic|hospital|dent/.test(text)) return 'health';
  if (/مطعم|مأكولات|أطعمة|غذاء|أغذية|وجبات|مخبز|حلويات|قهوة|كافيه|food|restaurant|bakery|cafe|coffee/.test(text)) return 'food';
  if (/سيار|قطع غيار|ميكانيك|كهرباء سيارات|auto|car|vehicle/.test(text)) return 'auto';
  if (/ملابس|أزياء|موضة|خياطة|بوتيك|fashion|clothing|apparel/.test(text)) return 'fashion';
  if (/بقال|سوبر ماركت|خضروات|فاكهة|مواد غذائية|تسوق|grocery|market|supermarket/.test(text)) return 'grocery';
  if (/تعليم|تدريب|مدرس|دروس|جامعة|كتب|education|training|school|tutor/.test(text)) return 'education';
  if (/جيم|لياقة|رياضة|تمارين|fitness|gym|sport/.test(text)) return 'fitness';
  if (/سفر|سياحة|رحلات|حجز طيران|travel|tourism|flight/.test(text)) return 'travel';
  if (/عقار|عقارات|تشطيب|ديكور|أثاث|منزل|مفروشات|سباكة|نجار|حداد|صيانة|تنظيف|home|furniture|real estate|property|maintenance|repair|plumb|carpenter/.test(text)) {
    return /عقار|عقارات|real estate|property/.test(text) ? 'real-estate' : 'home';
  }
  if (/تسويق|إعلان|إعلانات|تصميم|برمجة|رقمي|تكنولوجيا|software|digital|marketing|design|developer|technology/.test(text)) return 'digital';
  if (/خدمات|استشارات|محام|قانون|مكتب|ترجمة|محاسبة|خدمة|service|legal|consult|account/.test(text)) return 'marketing';
  return 'grocery';
}

const ACTIVITY_ART: Record<ArtKey, string> = {
  food: 'legacy/activity/food.svg',
  health: 'legacy/activity/medical.svg',
  pharmacy: 'legacy/activity/pharmacy.svg',
  auto: 'legacy/activity/auto.svg',
  education: 'legacy/activity/education.svg',
  fitness: 'legacy/activity/fitness.svg',
  home: 'legacy/activity/home.svg',
  'real-estate': 'legacy/activity/real-estate.svg',
  travel: 'legacy/activity/travel.svg',
  digital: 'legacy/activity/digital.svg',
  fashion: 'legacy/activities/fashion.svg',
  grocery: 'legacy/activities/grocery.svg',
  marketing: 'legacy/activities/marketing.svg',
  maintenance: 'legacy/activities/maintenance.svg',
  labs: 'legacy/activity/labs.svg',
};

const ITEM_ART: Record<ArtKey, string> = {
  food: 'legacy/activities/food.svg',
  health: 'legacy/activities/health.svg',
  pharmacy: 'legacy/activities/health.svg',
  auto: 'legacy/activities/auto.svg',
  education: 'legacy/activities/education.svg',
  fitness: 'legacy/activities/health.svg',
  home: 'legacy/activity/home.svg',
  'real-estate': 'legacy/activity/real-estate.svg',
  travel: 'legacy/activity/travel.svg',
  digital: 'legacy/activities/marketing.svg',
  fashion: 'legacy/activities/fashion.svg',
  grocery: 'legacy/activities/grocery.svg',
  marketing: 'legacy/activities/marketing.svg',
  maintenance: 'legacy/activities/maintenance.svg',
  labs: 'legacy/activities/health.svg',
};

export function resolveDefaultImage(input: DefaultImageInput = {}): string {
  const art = inferArt(input);
  if (input.kind === 'activity') return asset(ACTIVITY_ART[art]);
  if (input.kind === 'cover') {
    // The cover is wide and category-aware; never send the public site back to /web/.
    return asset(ACTIVITY_ART[art] || 'legacy/mnty-cover-ad-2.svg');
  }
  return asset(ITEM_ART[art] || 'catalog-item-placeholder.svg');
}

export function resolveDefaultActivityImages(input: Omit<DefaultImageInput, 'kind'>): { logoUrl: string; coverUrl: string } {
  return {
    logoUrl: resolveDefaultImage({ ...input, kind: 'activity' }),
    coverUrl: resolveDefaultImage({ ...input, kind: 'cover' }),
  };
}
