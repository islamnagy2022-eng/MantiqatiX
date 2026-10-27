/**
 * Name-aware image defaults for MantiqatiX.
 * Use only when no owner-selected image exists; owner images always win.
 */

export type DefaultImageKind = 'activity' | 'product' | 'service' | 'cover';

export interface DefaultImageInput {
  name?: string | null;
  description?: string | null;
  category?: string | null;
  kind?: DefaultImageKind;
}

const PHOTO_RULES: Array<{ pattern: RegExp; id: string }> = [
  { pattern: /قهو|بن|coffee|espresso|cafe|كافيه|محمص/, id: 'photo-1501339847302-ac426a4a7cbb' },
  { pattern: /مطعم|وجبات|اكل|أكل|طعام|food|restaurant|meal|bakery|مخبز|حلويات|sweets/, id: 'photo-1517248135467-4c7edcad34c4' },
  { pattern: /بقال|سوبر.?ماركت|grocery|supermarket|خضار|فاكهه|فاكهة/, id: 'photo-1542838132-92c53300491e' },
  { pattern: /عطر|برفيوم|perfume|fragrance|مكياج|تجميل|cosmetic|makeup|beauty|skincare|عنايه بالبشره/, id: 'photo-1541643600914-78b084683601' },
  { pattern: /ملابس|ازياء|أزياء|fashion|clothing|apparel|shoes|احذيه|أحذية/, id: 'photo-1483985988355-763728e1935b' },
  { pattern: /سيار|قطع غيار|auto|car|vehicle|automotive/, id: 'photo-1492144534655-ae79c964c9d7' },
  { pattern: /عقار|عقارات|real.?estate|property|شقق|منازل|سكن/, id: 'photo-1560518883-ce09059eeffa' },
  { pattern: /صيدل|دواء|أدوية|pharmacy|medicine|medical|عياد|طبيب|دكتور|clinic|hospital|صحه|صحة|health|dent|اسنان|أسنان|تحاليل|معمل|اشعه|أشعة/, id: 'photo-1576091160399-112ba8d25d1d' },
  { pattern: /صيان|كهرب|سباك|تكييف|ورشه|ورشة|maintenance|repair|plumb|electric|tools/, id: 'photo-1621905251189-08b45d6a269e' },
  { pattern: /تعليم|مدرس|مدرسه|مدرسة|جامعه|جامعة|education|school|course|training|دروس/, id: 'photo-1503676260728-1c00da094a0b' },
  { pattern: /سفر|سياح|رحلات|طيران|travel|tour|trip|hotel|vacation/, id: 'photo-1464822759023-fed622ff2c3b' },
  { pattern: /وظائف|توظيف|موارد بشرية|jobs|recruit|career|hiring/, id: 'photo-1521737711867-e3b97375f902' },
  { pattern: /زواج|اعراس|أعراس|wedding|bride|matrimony|engagement/, id: 'photo-1519741497674-611481863552' },
  { pattern: /رياض|لياقه|لياقة|sports|fitness|gym|football|كرة/, id: 'photo-1461896836934-ffe607ba8211' },
  { pattern: /تصوير|photography|photograph|camera|تصوير المنتجات/, id: 'photo-1492691527719-9d1e07e534b4' },
  { pattern: /فيديو|ريلز|video|reel|film production|مونتاج/, id: 'photo-1574717024653-61fd2cf4d44d' },
  { pattern: /كتابة|نصوص|copywriting|writing|content writing|كتابة المحتوى/, id: 'photo-1455390582262-044cdead277a' },
  { pattern: /تصميم|هوية بصرية|شعار|graphic design|branding|logo design/, id: 'photo-1558655146-d09347e92766' },
  { pattern: /تحليل|تقارير|analytics|reporting|seo|تحسين محركات|data analysis/, id: 'photo-1551288049-bebda4e38f71' },
  { pattern: /إدارة حملات|إدارة الحملات|حملة إعلانية|اعلانات ممولة|إعلانات ممولة|paid ads|advertising campaign/, id: 'photo-1460925895917-afdab827c52f' },
  { pattern: /صفحات هبوط|landing page|موقع تسويقي|landing pages/, id: 'photo-1498050108023-c5249f4df085' },
  { pattern: /متجر إلكتروني|متاجر إلكترونية|تجارة إلكترونية|ecommerce|e-commerce|تسويق المتاجر/, id: 'photo-1556742049-0cfed4f6a45d' },
  { pattern: /استراتيجية|استشارات|consulting|strategy|growth plan|خطة النمو/, id: 'photo-1521737711867-e3b97375f902' },
  { pattern: /التواصل الاجتماعي|سوشيال|social media|إدارة حسابات/, id: 'photo-1516321318423-f06f85e504b3' },
  { pattern: /تسويق محلي|local marketing|الملفات التجارية|business listing/, id: 'photo-1497366216548-37526070297c' },
  { pattern: /تسويق|اعلان|إعلان|حمله|حملة|محتوى|تصميم|marketing|advert|social media|seo|brand|براند|digital/, id: 'photo-1460925895917-afdab827c52f' },
  { pattern: /برنامج|برمج|سوفت|تقني|software|technology|tech|computer|web|موقع الكتروني|موقع إلكتروني/, id: 'photo-1498050108023-c5249f4df085' },
  { pattern: /اثاث|أثاث|موبيليا|furniture|interior|ديكور|منزل|home|kitchen/, id: 'photo-1555041469-a586c61ea9bc' },
  { pattern: /كتاب|كتب|قرطاسيه|قرطاسية|book|stationery|مكتبه|مكتبة/, id: 'photo-1507842217343-583bb7270b66' },
  { pattern: /حيوان|بيطر|pet|veterinary|vet|dogs|cats/, id: 'photo-1450778869180-41d0601e046e' },
  { pattern: /زهور|ورد|نبات|flowers|flower|plants|florist/, id: 'photo-1490750967868-88aa4486c946' },
  { pattern: /الكترون|إلكترون|موبايل|هاتف|كمبيوتر|electronics|phone|laptop|device/, id: 'photo-1518770660439-4636190af475' },
];

const DEFAULTS: Record<DefaultImageKind, string> = {
  activity: 'photo-1497366216548-37526070297c',
  cover: 'photo-1497366216548-37526070297c',
  product: 'photo-1491553895911-0055eca6402d',
  service: 'photo-1521737711867-e3b97375f902',
};

export function resolveDefaultImage(input: DefaultImageInput = {}): string {
  const text = [input.name, input.description, input.category].filter(Boolean).join(' ').toLowerCase();
  const matched = PHOTO_RULES.find((rule) => rule.pattern.test(text));
  const id = matched?.id || DEFAULTS[input.kind || 'product'];
  const isWide = input.kind === 'cover';
  const width = isWide ? 1600 : 900;
  const fit = isWide ? 'crop' : 'crop';
  return `https://images.unsplash.com/${id}?auto=format&fit=${fit}&crop=entropy&w=${width}&q=85`;
}

export function resolveDefaultActivityImages(input: Omit<DefaultImageInput, 'kind'>): { logoUrl: string; coverUrl: string } {
  const logoUrl = resolveDefaultImage({ ...input, kind: 'activity' });
  const coverUrl = resolveDefaultImage({ ...input, kind: 'cover' });
  return { logoUrl, coverUrl };
}
