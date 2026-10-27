export type DefaultImageKind = "activity" | "product" | "service" | "cover";

export interface DefaultImageInput {
  name?: string | null;
  description?: string | null;
  category?: string | null;
  kind?: DefaultImageKind;
}

const rules: Array<[RegExp, string]> = [
  [/قهو|بن\b|coffee|espresso|cafe|كافيه|محمص/i, "photo-1501339847302-ac426a4a7cbb"],
  [/مطعم|وجبات|اكل|أكل|طعام|food|restaurant|bakery|مخبز|حلويات/i, "photo-1517248135467-4c7edcad34c4"],
  [/بقال|سوبر.?ماركت|grocery|supermarket|خضار|فاكهه|فاكهة/i, "photo-1542838132-92c53300491e"],
  [/عطر|برفيوم|perfume|fragrance|مكياج|تجميل|cosmetic|makeup|beauty|skincare/i, "photo-1541643600914-78b084683601"],
  [/ملابس|ازياء|أزياء|fashion|clothing|apparel|shoes|احذيه|أحذية/i, "photo-1483985988355-763728e1935b"],
  [/سيار|قطع غيار|auto|car|vehicle|automotive/i, "photo-1492144534655-ae79c964c9d7"],
  [/عقار|عقارات|real.?estate|property|شقق|منازل|سكن/i, "photo-1560518883-ce09059eeffa"],
  [/صيدل|دواء|أدوية|pharmacy|medicine|medical|عياد|طبيب|دكتور|clinic|hospital|صحه|صحة|health|اسنان|أسنان|تحاليل|معمل|اشعه|أشعة/i, "photo-1576091160399-112ba8d25d1d"],
  [/صيان|كهرب|سباك|تكييف|ورشه|ورشة|maintenance|repair|plumb|electric|tools/i, "photo-1621905251189-08b45d6a269e"],
  [/تعليم|مدرس|مدرسه|مدرسة|جامعه|جامعة|education|school|course|training|دروس/i, "photo-1503676260728-1c00da094a0b"],
  [/سفر|سياح|رحلات|طيران|travel|tour|trip|hotel|vacation/i, "photo-1464822759023-fed622ff2c3b"],
  [/وظائف|توظيف|موارد بشرية|jobs|recruit|career|hiring/i, "photo-1521737711867-e3b97375f902"],
  [/زواج|اعراس|أعراس|wedding|bride|matrimony|engagement/i, "photo-1519741497674-611481863552"],
  [/رياض|لياقه|لياقة|sports|fitness|gym|football|كرة/i, "photo-1461896836934-ffe607ba8211"],
  [/تصوير|photography|photograph|camera|تصوير المنتجات/i, "photo-1492691527719-9d1e07e534b4"],
  [/فيديو|ريلز|video|reel|film production|مونتاج/i, "photo-1574717024653-61fd2cf4d44d"],
  [/كتابة|نصوص|copywriting|writing|content writing|كتابة المحتوى/i, "photo-1455390582262-044cdead277a"],
  [/تصميم|هوية بصرية|شعار|graphic design|branding|logo design/i, "photo-1558655146-d09347e92766"],
  [/تحليل|تقارير|analytics|reporting|seo|تحسين محركات|data analysis/i, "photo-1551288049-bebda4e38f71"],
  [/إدارة حملات|إدارة الحملات|حملة إعلانية|اعلانات ممولة|إعلانات ممولة|paid ads|advertising campaign/i, "photo-1460925895917-afdab827c52f"],
  [/صفحات هبوط|landing page|موقع تسويقي|landing pages/i, "photo-1498050108023-c5249f4df085"],
  [/متجر إلكتروني|متاجر إلكترونية|تجارة إلكترونية|ecommerce|e-commerce|تسويق المتاجر/i, "photo-1556742049-0cfed4f6a45d"],
  [/استراتيجية|استشارات|consulting|strategy|growth plan|خطة النمو/i, "photo-1521737711867-e3b97375f902"],
  [/التواصل الاجتماعي|سوشيال|social media|إدارة حسابات/i, "photo-1516321318423-f06f85e504b3"],
  [/تسويق محلي|local marketing|الملفات التجارية|business listing/i, "photo-1497366216548-37526070297c"],
  [/تسويق|اعلان|إعلان|حمله|حملة|محتوى|تصميم|marketing|advert|social media|seo|brand|digital/i, "photo-1460925895917-afdab827c52f"],
  [/برنامج|برمج|سوفت|تقني|software|technology|tech|computer|web|موقع إلكتروني/i, "photo-1498050108023-c5249f4df085"],
  [/اثاث|أثاث|موبيليا|furniture|interior|ديكور|منزل|home|kitchen/i, "photo-1555041469-a586c61ea9bc"],
  [/كتاب|كتب|قرطاسيه|قرطاسية|book|stationery|مكتبه|مكتبة/i, "photo-1507842217343-583bb7270b66"],
  [/حيوان|بيطر|pet|veterinary|vet|dogs|cats/i, "photo-1450778869180-41d0601e046e"],
  [/زهور|ورد|نبات|flowers|flower|plants|florist/i, "photo-1490750967868-88aa4486c946"],
  [/الكترون|إلكترون|موبايل|هاتف|كمبيوتر|electronics|phone|laptop|device/i, "photo-1518770660439-4636190af475"],
];

export function resolveDefaultImage(input: DefaultImageInput = {}): string {
  const text = [input.name, input.description, input.category].filter(Boolean).join(" ").toLowerCase();
  const id = rules.find(([pattern]) => pattern.test(text))?.[1] ||
    ({ activity: "photo-1497366216548-37526070297c", cover: "photo-1497366216548-37526070297c", service: "photo-1521737711867-e3b97375f902", product: "photo-1491553895911-0055eca6402d" } as Record<DefaultImageKind, string>)[input.kind || "product"];
  const width = input.kind === "cover" ? 1600 : 900;
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&crop=entropy&w=${width}&q=85`;
}

export function resolveDefaultActivityImages(input: Omit<DefaultImageInput, "kind">) {
  return {
    logoUrl: resolveDefaultImage({ ...input, kind: "activity" }),
    coverUrl: resolveDefaultImage({ ...input, kind: "cover" }),
  };
}
