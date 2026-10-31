import type { ActivityCategory, AdminSettings, FunctionalGroup, PaymobConfig } from '../types';

const makeGroup = (
  id: FunctionalGroup['id'], name: string, shortName: string, englishName: string,
  icon: string, badgeColor: string, description: string,
): FunctionalGroup => ({ id, name, shortName, englishName, icon, badgeColor, description, futureFeatures: [] });

/**
 * Canonical 10-group taxonomy. Group IDs are stable compatibility keys;
 * legacy sectors are mapped into these groups and are not exposed as duplicates.
 */
export const DEFAULT_FUNCTIONAL_GROUPS: FunctionalGroup[] = [
  makeGroup('medical_health','الطب والصحة','الطب والصحة','Health & Medical','HeartPulse','bg-emerald-100 text-emerald-800 border-emerald-300','الخدمات الطبية والتشخيص والعلاج والرعاية الصحية.'),
  makeGroup('food_grocery','الأغذية والضيافة','الأغذية والضيافة','Food & Hospitality','UtensilsCrossed','bg-amber-100 text-amber-800 border-amber-300','المطاعم والمقاهي والمخبوزات والحلويات ومتاجر الأغذية والضيافة والسياحة والمناسبات.'),
  makeGroup('fashion_beauty','التجارة والتجزئة والعناية الشخصية','التجارة والتجزئة','Commerce & Lifestyle','ShoppingBag','bg-pink-100 text-pink-800 border-pink-300','المتاجر والملابس والمنتجات الشخصية والتجارة العامة.'),
  makeGroup('home_maintenance','المنزل والبناء والصيانة','المنزل والبناء','Home, Building & Maintenance','Wrench','bg-orange-100 text-orange-800 border-orange-300','الأثاث والمقاولات والتشطيبات والصيانة والخدمات المنزلية.'),
  makeGroup('auto_transport','السيارات والنقل واللوجستيات','السيارات والنقل','Mobility & Logistics','Truck','bg-sky-100 text-sky-800 border-sky-300','المركبات والصيانة والشحن والتوصيل والخدمات اللوجستية.'),
  makeGroup('real_estate','العقارات وإدارة الأملاك','العقارات','Real Estate','House','bg-teal-100 text-teal-800 border-teal-300','بيع وإيجار وتسويق وإدارة وتطوير العقارات.'),
  makeGroup('education_training','التعليم والتدريب والرياضة','التعليم والتدريب','Education & Training','GraduationCap','bg-indigo-100 text-indigo-800 border-indigo-300','التعليم والتدريب وتنمية المهارات والأنشطة الرياضية.'),
  makeGroup('technology_communications','التكنولوجيا والتسويق الرقمي','التكنولوجيا والرقمنة','Technology & Digital','Laptop','bg-cyan-100 text-cyan-800 border-cyan-300','البرمجيات والاتصالات والتسويق والإعلام والخدمات الرقمية.'),
  makeGroup('professional_services','الخدمات المهنية والمالية','الخدمات المهنية','Professional & Financial Services','BriefcaseBusiness','bg-violet-100 text-violet-800 border-violet-300','القانون والمحاسبة والاستشارات والموارد البشرية والخدمات المالية.'),
  makeGroup('agriculture_animals','الزراعة والإنتاج والورش','الزراعة والإنتاج','Agriculture & Production','Factory','bg-lime-100 text-lime-800 border-lime-300','الزراعة والثروة الحيوانية والمصانع والورش والحرف والإنتاج.'),
];
type CategorySeed = {
  groupId: FunctionalGroup['id'];
  code: string;
  classificationType: 'activity' | 'profession';
  name: string;
  description?: string;
  specialties?: string[];
};

const s = (
  groupId: FunctionalGroup['id'], code: string, classificationType: 'activity' | 'profession',
  name: string, description?: string, specialties?: string[],
): CategorySeed => ({ groupId, code, classificationType, name, description, specialties });

const CATEGORY_SEEDS: CategorySeed[] = [
  // 1. الطب والصحة — النشاط هو المنشأة/الخدمة، والطبيب تخصص داخلها وليس تصنيفاً موازياً.
  s('medical_health','medical_practices','activity','ممارسات وعيادات طبية','ممارسة طبية فردية أو عيادة مرخصة؛ المهنة ونوع المنشأة تفاصيل داخل النشاط وليسا تصنيفين متوازيين.',['باطنة','أطفال','قلب','جلدية','عيون','عظام','نساء وتوليد','أنف وأذن','مخ وأعصاب','طب أسرة','جراحة عامة','صدر وحساسية','مسالك بولية','جراحة تجميل','أورام','غدد صماء وسكر','أسنان']),
  s('medical_health','pharmacies','activity','صيدليات','صرف الأدوية والمستلزمات وفق الترخيص.',['صيدلية عامة','صيدلية مستشفى','توصيل دواء']),
  s('medical_health','diagnostic_labs','activity','معامل ومراكز تشخيص','تحاليل وأشعة وفحوصات تشخيصية.',['تحاليل طبية','أشعة','سونار','رنين مغناطيسي','أشعة مقطعية']),
  s('medical_health','hospitals','activity','مستشفيات ومراكز طبية','منشآت تقدم خدمات طبية متعددة.',['مستشفى عام','مركز طبي متعدد التخصصات','طوارئ']),
  s('medical_health','rehabilitation','activity','علاج طبيعي وتأهيل','خدمات التأهيل والعلاج الطبيعي.',['علاج طبيعي وتأهيل','تأهيل عظام','تأهيل أعصاب','تأهيل أطفال','تأهيل رياضي']),
  // 2. الأغذية والضيافة
  s('food_grocery','restaurants','activity','مطاعم','إعداد وتقديم الوجبات.',['مشويات','وجبات سريعة','مأكولات شرقية','أسماك','وجبات صحية']),
  s('food_grocery','cafes','activity','مقاهي وكافيهات','تقديم القهوة والمشروبات.',['قهوة مختصة','مقهى عائلي','عصائر ومشروبات']),
  s('food_grocery','bakeries_sweets','activity','مخابز وحلويات','إنتاج وبيع المخبوزات والحلويات والكيك.',['مخبز بلدي','معجنات وفطائر','حلويات شرقية','حلويات غربية','كيك مناسبات']),
  s('food_grocery','food_retail','activity','متاجر الأغذية والمواد التموينية','بيع المواد الغذائية والمنتجات الطازجة والمتخصصة.',['سوبر ماركت','بقالة','جزارة','دواجن وأسماك','بن وعطارة']),
  s('food_grocery','hospitality_events','activity','ضيافة وسياحة ومناسبات','خدمات الضيافة والسياحة وتنظيم واستضافة المناسبات.',['فنادق وإقامة','قاعات أفراح ومناسبات','وكالات سياحة وسفر','تنظيم مناسبات']),
  // 3. التجارة والتجزئة والعناية الشخصية
  s('fashion_beauty','general_retail','activity','متاجر ومحلات تجزئة','متاجر بيع المنتجات والسلع للمستهلك.',['أدوات منزلية','أجهزة منزلية','مستلزمات مكتبية','مستلزمات أطفال','مستعمل']),
  s('fashion_beauty','clothing_stores','activity','ملابس وأزياء','بيع الملابس والمنتجات المرتبطة بها.',['ملابس رجالي','ملابس حريمي','ملابس أطفال','ملابس محجبات']),
  s('fashion_beauty','shoes_bags','activity','أحذية وحقائب وإكسسوارات','بيع الأحذية والحقائب والإكسسوارات.',['أحذية','حقائب','منتجات جلدية','إكسسوارات']),
  s('fashion_beauty','beauty_products','activity','عطور ومستحضرات عناية','بيع منتجات العطور والتجميل والعناية.',['عطور','مستحضرات تجميل','عناية بالبشرة','عناية بالشعر']),
  s('fashion_beauty','salons','activity','صالونات وتجميل شخصي','خدمات الحلاقة والعناية الشخصية.',['حلاقة رجالي','كوافير','عناية بالبشرة','تصفيف شعر']),
  // 4. المنزل والبناء والصيانة
  s('home_maintenance','furniture','activity','أثاث ومفروشات','بيع وتصنيع الأثاث وتجهيزات المنزل.',['موبيليا','مطابخ','ستائر وسجاد','مراتب ومفروشات']),
  s('home_maintenance','contractors','activity','مقاولات وبناء','تنفيذ أعمال البناء والترميم.',['مقاولات عامة','ترميم','إنشاءات']),
  s('home_maintenance','finishing_companies','activity','تشطيبات وديكور','تنفيذ وتصميم التشطيبات الداخلية والخارجية.',['تشطيب شقق','تشطيب تجاري','تصميم داخلي','واجهات']),
  s('home_maintenance','building_supplies','activity','مواد ومستلزمات البناء','توريد خامات ومستلزمات البناء والتشطيب.',['أسمنت وحديد','سيراميك ورخام','دهانات','أدوات صحية','ألوميتال وزجاج']),
  s('home_maintenance','home_services','activity','صيانة وخدمات منزلية','أعمال الصيانة والتنظيف والإصلاح المنزلي.',['كهرباء','سباكة','تكييف','صيانة أجهزة','تنظيف ومكافحة حشرات']),
  // 5. السيارات والنقل واللوجستيات
  s('auto_transport','car_showrooms','activity','معارض وبيع سيارات','بيع وشراء المركبات.',['سيارات جديدة','سيارات مستعملة','دراجات نارية']),
  s('auto_transport','auto_maintenance','activity','صيانة وإصلاح سيارات','مراكز صيانة المركبات.',['ميكانيكا','كهرباء سيارات','تكييف سيارات','فحص كمبيوتر']),
  s('auto_transport','auto_parts','activity','قطع غيار ومستلزمات مركبات','بيع قطع الغيار والإطارات والبطاريات.',['قطع غيار','إطارات','بطاريات','زيوت وفلاتر']),
  s('auto_transport','shipping','activity','شحن ونقل بضائع','النقل والشحن المحلي والدولي.',['نقل بضائع','شحن محلي','شحن دولي']),
  s('auto_transport','delivery_logistics','activity','توصيل وخدمات لوجستية','توصيل الطلبات وإدارة التخزين والتوزيع.',['توصيل طلبات','توصيل طرود','مخازن وتوزيع']),
  // 6. العقارات
  s('real_estate','residential_property','activity','عقارات سكنية','بيع وتسويق الوحدات السكنية.',['شقق','فيلات','دوبلكس']),
  s('real_estate','property_rentals','activity','إيجار وإدارة وحدات','تأجير وإدارة الوحدات العقارية.',['إيجار سكني','إيجار مفروش','إدارة أملاك']),
  s('real_estate','commercial_property','activity','عقارات تجارية وإدارية','بيع وتأجير المحلات والمكاتب والمخازن.',['محلات','مكاتب','مخازن']),
  s('real_estate','land_property','activity','أراضٍ ومزارع','بيع وتسويق الأراضي.',['أراضٍ سكنية','أراضٍ تجارية','أراضٍ زراعية']),
  s('real_estate','real_estate_development','activity','تطوير ومشروعات عقارية','تطوير وتسويق المشروعات العقارية.',['مشروعات سكنية','مشروعات تجارية']),
  // 7. التعليم والتدريب والرياضة
  s('education_training','schools','activity','مدارس ومؤسسات تعليمية','التعليم الأساسي والمؤسسي.',['مدارس خاصة','مدارس لغات','تعليم دولي']),
  s('education_training','nurseries','activity','حضانات ورياض أطفال','رعاية وتعليم الطفولة المبكرة.',['حضانة','رياض أطفال']),
  s('education_training','tutoring','activity','مراكز تعليم ودروس','دروس ومجموعات تعليمية.',['تعليم ابتدائي','تعليم إعدادي','تعليم ثانوي']),
  s('education_training','training_centers','activity','مراكز تدريب وتنمية مهارات','تدريب مهني وتقني وشخصي.',['تدريب مهني','لغات','مهارات رقمية','تدريب إداري']),
  s('education_training','sports_centers','activity','أندية ومراكز رياضية','الأنشطة الرياضية واللياقة.',['جيم ولياقة','أكاديميات رياضية','سباحة','فنون قتالية']),
  // 8. التكنولوجيا والتسويق الرقمي
  s('technology_communications','software_companies','activity','شركات برمجيات وحلول تقنية','تطوير الأنظمة والحلول الرقمية.',['أنظمة إدارية','برامج محاسبة','أتمتة أعمال']),
  s('technology_communications','web_services','activity','مواقع ومتاجر إلكترونية','تصميم وتطوير المواقع والمتاجر.',['مواقع شركات','متاجر إلكترونية','بوابات حجز']),
  s('technology_communications','mobile_apps','activity','تطبيقات الهاتف','تطوير تطبيقات الهواتف.',['تطبيقات خدمات','تطبيقات تجارة','تطبيقات أعمال']),
  s('technology_communications','it_networks','activity','شبكات واتصالات ودعم تقني','خدمات الشبكات والأجهزة والاتصالات.',['شبكات','إنترنت واستضافة','صيانة كمبيوتر','كاميرات وأنظمة']),
  s('technology_communications','digital_marketing','activity','تسويق وإعلام رقمي','التسويق والإعلان وصناعة المحتوى.',['إدارة حملات','إدارة صفحات','تصميم جرافيك','تصوير ومونتاج','إنتاج محتوى']),
  // 9. الخدمات المهنية والمالية
  s('professional_services','legal_services','activity','خدمات قانونية ومحاماة','الخدمات القانونية والاستشارات وفق الترخيص.',['محاماة','عقود','استشارات قانونية']),
  s('professional_services','accounting_services','activity','محاسبة ومراجعة','الخدمات المحاسبية والضريبية.',['مسك دفاتر','مراجعة حسابات','ضرائب']),
  s('professional_services','business_consulting','activity','استشارات وأعمال','خدمات الاستشارات الإدارية والتجارية.',['استشارات إدارية','دراسات جدوى','موارد بشرية']),
  s('professional_services','financial_services','activity','خدمات مالية وتأمينية','خدمات مالية وتأمينية مرخصة.',['تأمين','خدمات تمويل مرخصة','استشارات مالية']),
  s('professional_services','office_services','activity','خدمات مهنية ومكتبية','خدمات الترجمة والتوثيق والخدمات المكتبية.',['ترجمة','خدمات مكتبية','طباعة مستندات']),
  // 10. الزراعة والإنتاج والورش
  s('agriculture_animals','farms_agriculture','activity','زراعة ومزارع','الإنتاج الزراعي ومستلزماته.',['محاصيل','مشاتل','بذور وأسمدة','ري زراعي']),
  s('agriculture_animals','veterinary','activity','خدمات بيطرية','رعاية وعلاج الحيوانات.',['عيادة بيطرية','صيدلية بيطرية','تحصينات']),
  s('agriculture_animals','animal_production','activity','ثروة حيوانية وإنتاج غذائي','تربية وإنتاج الحيوانات والدواجن.',['مزارع دواجن','مزارع مواشي','أعلاف']),
  s('agriculture_animals','factories','activity','مصانع وإنتاج','منشآت التصنيع والإنتاج.',['صناعات غذائية','صناعات بلاستيكية','تصنيع معدني','تعبئة وتغليف']),
  s('agriculture_animals','workshops','activity','ورش وحرف إنتاجية','الورش والحرف والصناعات الصغيرة.',['حدادة ولحام','خراطة','نجارة إنتاجية','صيانة صناعية']),
];

export const DEFAULT_CATEGORIES: ActivityCategory[] = CATEGORY_SEEDS.map((seed) => ({
  id: 'cat_' + seed.groupId + '_' + seed.code,
  name: seed.name,
  functionalGroupId: seed.groupId,
  classificationType: seed.classificationType,
  description: seed.description,
  specialties: seed.specialties || [],
}));

const normalizeTaxonomyName = (value: unknown) =>
  String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ar');

function normalizeSpecialtyKey(value: string): string {
  return String(value || '').toLocaleLowerCase('ar')
    .normalize('NFKC')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ً-ْـ]/g, '')
    .split(/\s+/)
    .map((word) => word.startsWith('ال') && word.length > 3 ? word.slice(2) : word)
    .join(' ')
    .trim();
}

const LEGACY_SPECIALTY_ALIASES: Record<string, string> = {
  'طبيب اطفال': 'أطفال', 'طب الاطفال': 'أطفال',
  'طبيب نساء وتوليد': 'نساء وتوليد',
  'طبيب جراحه عامه': 'جراحة عامة', 'طبيب باطنه': 'باطنة',
  'امراض باطنه': 'باطنة', 'باطنه ومناظير وغدد وسكر': 'باطنة',
  'طبيب عظام': 'عظام', 'طبيب صدر': 'صدر وحساسية',
  'صدر وحساسيه ومناعه': 'صدر وحساسية', 'طبيب عيون': 'عيون',
  'طب وجراحه العيون': 'عيون', 'طبيب مسالك بوليه': 'مسالك بولية',
  'طبيب مخ واعصاب': 'مخ وأعصاب', 'مخ واعصاب وعمود فقري': 'مخ وأعصاب',
  'طبيب انف واذن وحنجره': 'أنف وأذن', 'انف واذن وحنجره': 'أنف وأذن',
  'طبيب جراحه تجميل': 'جراحة تجميل', 'طبيب اورام': 'أورام',
  'اورام وعلاج كيميائي': 'أورام', 'غدد صماء وسكر': 'غدد صماء وسكر',
  'سكر وغدد صماء': 'غدد صماء وسكر', 'اسنان عام': 'أسنان',
  'طب الاسنان': 'أسنان', 'مراكز وعيادات اسنان': 'أسنان',
  'معامل تحاليل': 'تحاليل طبية', 'اشعه تشخيصيه': 'أشعة',
  'اشعه وتحاليل': 'أشعة', 'صيدليات عامه': 'صيدلية عامة',
  'صيدليات': 'صيدلية عامة', 'صيدليه': 'صيدلية عامة',
  'مستشفيات': 'مستشفى عام', 'مستشفى': 'مستشفى عام',
  'مركز طبي': 'مركز طبي متعدد التخصصات', 'مستوصف طبي': 'مركز طبي متعدد التخصصات',
  'مراكز علاج طبيعي وتأهيل': 'علاج طبيعي وتأهيل',
  'علاج طبيعي': 'علاج طبيعي وتأهيل', 'علاج طبيعي وتخسيس': 'علاج طبيعي وتأهيل',
  'اكلات شرقيه': 'مأكولات شرقية', 'برجر': 'وجبات سريعة',
  'تصنيع ادوات بلاستيكيه منزليه': 'صناعات بلاستيكية',
  'الانشطه المعماريه والتصميم الداخلي والديكورات': 'تصميم داخلي',
  'بيع وتركيب وصيانه الادوات الصحيه والفلاتر وانظمه تنقيه المياه': 'أدوات صحية',
  'مستحضرات التجميل والعنايه بالشعر والبشره': 'مستحضرات تجميل',
  'بيع الادوات المنزليه ومستلزمات المطبخ واطقم التقديم': 'أدوات منزلية',
  'التسويق الرقمي واداره الحملات والمحتوى والتصميم': 'إدارة حملات',
};

const LEGACY_SPECIALTY_ALIAS_MAP = new Map(
  Object.entries(LEGACY_SPECIALTY_ALIASES).map(([key, value]) => [normalizeSpecialtyKey(key), normalizeSpecialtyKey(value)]),
);

export function resolveCanonicalSpecialty(value: string, categoryId?: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const normalized = normalizeSpecialtyKey(raw);
  const directAlias = LEGACY_SPECIALTY_ALIAS_MAP.get(normalized);
  if (directAlias) return directAlias;
  const withoutProfessionPrefix = normalized.replace(/^(طبيب|دكتور|دكتوره|طبيبه|طب)\s+/, '');
  const prefixAlias = LEGACY_SPECIALTY_ALIAS_MAP.get(withoutProfessionPrefix);
  if (prefixAlias) return prefixAlias;
  const category = DEFAULT_CATEGORIES.find((item) => item.id === categoryId);
  const candidates = category?.specialties || [];
  const match = candidates.find((candidate) => {
    const candidateKey = normalizeSpecialtyKey(candidate);
    return candidateKey === withoutProfessionPrefix ||
      (candidateKey.length >= 4 && withoutProfessionPrefix.includes(candidateKey)) ||
      (withoutProfessionPrefix.length >= 5 && candidateKey.includes(withoutProfessionPrefix));
  });
  return match ? normalizeSpecialtyKey(match) : withoutProfessionPrefix;
}

const LEGACY_GROUP_MAP: Record<string, FunctionalGroup['id']> = {
  dining: 'food_grocery', food_grocery: 'food_grocery',
  retail: 'fashion_beauty', trade_ecommerce: 'fashion_beauty',
  services: 'professional_services', public_community: 'professional_services',
  healthcare: 'medical_health', medical_health: 'medical_health',
  crafts_maintenance: 'home_maintenance', construction_decor: 'home_maintenance',
  home_maintenance: 'home_maintenance',
  marketing_media: 'technology_communications',
  sports_fitness: 'education_training', education_training: 'education_training',
  tourism_events: 'food_grocery',
  finance_insurance: 'professional_services',
  industry_workshops: 'agriculture_animals', agriculture_animals: 'agriculture_animals',
  auto_transport: 'auto_transport', real_estate: 'real_estate',
  technology_communications: 'technology_communications',
  professional_services: 'professional_services', fashion_beauty: 'fashion_beauty',
};

const BACKEND_CODE_GROUP_MAP: Record<string, FunctionalGroup['id']> = {
  HEALTH: 'medical_health', MEDICAL: 'medical_health', CLINICS: 'medical_health', PHARMACY: 'medical_health', LABS: 'medical_health', RADIOLOGY: 'medical_health', HOSPITAL: 'medical_health', DENTAL: 'medical_health',
  FOOD: 'food_grocery', RESTAURANTS: 'food_grocery', GROCERY: 'food_grocery',
  FASHION: 'fashion_beauty', BEAUTY: 'fashion_beauty', USED_ITEMS: 'fashion_beauty', TRADE: 'fashion_beauty', RETAIL: 'fashion_beauty',
  HOME: 'home_maintenance', HOMEWARES: 'home_maintenance', MAINTENANCE: 'home_maintenance', CONSTRUCTION: 'home_maintenance', CONTRACTORS: 'home_maintenance', DECOR: 'home_maintenance', INDUSTRY: 'agriculture_animals', WORKSHOPS: 'agriculture_animals', FACTORIES: 'agriculture_animals',
  AUTO: 'auto_transport', MANTIGO: 'auto_transport', TRANSPORT: 'auto_transport', SHIPPING: 'auto_transport',
  REAL_ESTATE: 'real_estate',
  EDU: 'education_training', EDUCATION: 'education_training', SCHOOLS: 'education_training', SPORTS: 'education_training', FITNESS: 'education_training',
  ERP: 'technology_communications', TECH: 'technology_communications', SOFTWARE: 'technology_communications', MARKETING: 'technology_communications', DIGITAL: 'technology_communications', MEDIA: 'technology_communications',
  ACCOUNTING: 'professional_services', LEGAL: 'professional_services', COMPANIES: 'professional_services', FINANCE: 'professional_services', INSURANCE: 'professional_services', PAYMENTS: 'professional_services', JOBS: 'professional_services', FREELANCER: 'professional_services',
  VETERINARY: 'agriculture_animals', AGRICULTURE: 'agriculture_animals', FARMING: 'agriculture_animals',
  TRIPS: 'food_grocery', TRAVEL: 'food_grocery', TOURISM: 'food_grocery', EVENTS: 'food_grocery', MATRIMONY: 'professional_services', COMMUNITY: 'professional_services', PUBLIC_SERVICES: 'professional_services',
};

export function resolveCanonicalGroupId(categoryName: string, legacyGroupId?: string): FunctionalGroup['id'] {
  const groupHint = String(legacyGroupId || '').trim().toLowerCase();
  const direct = DEFAULT_FUNCTIONAL_GROUPS.find((group) => group.id === groupHint);
  if (direct) return direct.id;
  // Prefer the explicit legacy group over a category-name guess. This prevents
  // ambiguous labels (e.g. travel/events) from being routed to the wrong group.
  if (LEGACY_GROUP_MAP[groupHint]) return LEGACY_GROUP_MAP[groupHint];
  const raw = String(categoryName || '').trim();
  const code = raw.split(/[|—–]/)[0].trim().toUpperCase().replace(/[\\s-]+/g, '_');
  if (BACKEND_CODE_GROUP_MAP[code]) return BACKEND_CODE_GROUP_MAP[code];
  const value = raw.toLocaleLowerCase('ar');
  if (/طبيب|طبي|صحة|عياد|صيدل|تحاليل|أشعة|مستشفى|أسنان|تمريض|تغذية|علاج طبيعي|مختبر/.test(value)) return 'medical_health';
  if (/مطعم|مقهى|كافيه|أغذية|غذاء|حلويات|مخبز|بقالة|سوبر ماركت|جزارة|لحوم|دواجن|أسماك|قهوة|ضيافة|فندق|سياحة|سفر|رحلات|مناسبات/.test(value)) return 'food_grocery';
  if (/ملابس|أزياء|أحذية|حقائب|مجوهرات|عطور|تجميل|كوافير|حلاق|خياطة|تجارة|متجر|بيع|شراء|جملة|مستعمل|قرطاسية|كتب/.test(value)) return 'fashion_beauty';
  if (/مقاولات|بناء|تشطيب|ديكور|مواد بناء|رخام|جرانيت|سيراميك|ألوميتال|دهانات|عزل|صيانة|ورش منزلية|نجار|سباك|كهربائي|تكييف|أثاث|موبيليا/.test(value)) return 'home_maintenance';
  if (/سيارات|مركبات|ميكانيك|إطارات|بطاريات|شحن|توصيل|لوجستي|سائق|نقل بضائع/.test(value)) return 'auto_transport';
  if (/عقار|أراض|وسيط عقاري|إيجار شقق|تطوير عقاري|إدارة عقارات/.test(value)) return 'real_estate';
  if (/مدرس|تعليم|مدرسة|حضان|جامعة|معهد|تدريب|محاضر|مدرب|رياضة|لياقة|جيم|سباحة/.test(value)) return 'education_training';
  if (/برمج|مواقع|تطبيقات|كمبيوتر|شبكات|اتصالات|إنترنت|أمن سيبراني|إلكترونيات|هواتف|تقنية|ذكاء اصطناعي|تسويق|إعلان|تصميم|تصوير|محتوى|إعلام/.test(value)) return 'technology_communications';
  if (/تأمين|تمويل|مدفوعات|خدمات مالية|محام|قانون|محاسب|محاسبة|ترجمة|موارد بشرية|استشارات|خدمات مكتبية|وظائف|بريد|خدمات حكومية/.test(value)) return 'professional_services';
  if (/زراع|مزرعة|مشاتل|بذور|أسمدة|حيوانات|بيطري|أعلاف|مصانع|تصنيع|حدادة|حداد|خراطة|لحام|إنتاج صناعي/.test(value)) return 'agriculture_animals';
  return 'fashion_beauty';
}

const LEGACY_DIRECTORY_CATEGORY_MAP: Record<string, string> = {
  cat_medical_health_clinics: 'cat_medical_health_medical_practices',
  cat_medical_health_doctor: 'cat_medical_health_medical_practices',
  cat_medical_health_dentist: 'cat_medical_health_medical_practices',
  cat_medical_health_dental_centers: 'cat_medical_health_medical_practices',
  cat_medical_health_pharmacies: 'cat_medical_health_pharmacies',
  cat_medical_health_labs: 'cat_medical_health_diagnostic_labs',
  cat_medical_health_radiology_specialist: 'cat_medical_health_diagnostic_labs',
  cat_medical_health_hospitals: 'cat_medical_health_hospitals',
  cat_medical_health_medical_centers: 'cat_medical_health_hospitals',
  cat_medical_health_physio_centers: 'cat_medical_health_rehabilitation',
  cat_medical_health_physiotherapist: 'cat_medical_health_rehabilitation',
  cat_food_grocery_restaurants: 'cat_food_grocery_restaurants',
  cat_food_grocery_cafes: 'cat_food_grocery_cafes',
  cat_food_grocery_bakeries: 'cat_food_grocery_bakeries_sweets',
  cat_food_grocery_sweets: 'cat_food_grocery_bakeries_sweets',
  cat_food_grocery_food_suppliers: 'cat_food_grocery_food_retail',
  cat_food_grocery_fresh_food: 'cat_food_grocery_food_retail',
  cat_food_grocery_specialty_food: 'cat_food_grocery_food_retail',
  cat_food_grocery_supermarkets: 'cat_food_grocery_food_retail',
  cat_tourism_events_travel_agencies: 'cat_food_grocery_hospitality_events',
  cat_tourism_events_event_halls: 'cat_food_grocery_hospitality_events',
  cat_fashion_beauty_clothing_stores: 'cat_fashion_beauty_clothing_stores',
  cat_fashion_beauty_beauty_products: 'cat_fashion_beauty_beauty_products',
  cat_fashion_beauty_beauty_centers: 'cat_fashion_beauty_salons',
  cat_fashion_beauty_salons: 'cat_fashion_beauty_salons',
  cat_fashion_beauty_shoes_bags: 'cat_fashion_beauty_shoes_bags',
  cat_fashion_beauty_jewelry_stores: 'cat_fashion_beauty_general_retail',
  cat_trade_ecommerce_stationery_books: 'cat_fashion_beauty_general_retail',
  cat_home_maintenance_furniture: 'cat_home_maintenance_furniture',
  cat_home_maintenance_home_appliances: 'cat_home_maintenance_furniture',
  cat_home_maintenance_home_textiles: 'cat_home_maintenance_furniture',
  cat_home_maintenance_homewares: 'cat_home_maintenance_furniture',
  cat_home_maintenance_pest_control: 'cat_home_maintenance_home_services',
  cat_construction_decor_building_materials: 'cat_home_maintenance_building_supplies',
  cat_construction_decor_interior_design: 'cat_home_maintenance_finishing_companies',
  cat_construction_decor_sanitary_ware: 'cat_home_maintenance_building_supplies',
  cat_industry_workshops_plastic_factories: 'cat_agriculture_animals_factories',
  cat_construction_decor_aluminum_glass: 'cat_home_maintenance_building_supplies',
  cat_construction_decor_contractors: 'cat_home_maintenance_contractors',
  cat_construction_decor_finishing_companies: 'cat_home_maintenance_finishing_companies',
  cat_auto_transport_auto_maintenance: 'cat_auto_transport_auto_maintenance',
  cat_auto_transport_auto_parts: 'cat_auto_transport_auto_parts',
  cat_real_estate_real_estate_agent: 'cat_real_estate_residential_property',
  cat_education_training_schools: 'cat_education_training_schools',
  cat_education_training_nurseries: 'cat_education_training_nurseries',
  cat_education_training_tutoring_centers: 'cat_education_training_tutoring',
  cat_education_training_vocational_training: 'cat_education_training_training_centers',
  cat_sports_fitness_gyms: 'cat_education_training_sports_centers',
  cat_sports_fitness_sports_fields: 'cat_education_training_sports_centers',
  cat_technology_communications_computer_repair: 'cat_technology_communications_it_networks',
  cat_technology_communications_telecom_retail: 'cat_technology_communications_it_networks',
  cat_marketing_media_ad_services: 'cat_technology_communications_digital_marketing',
  cat_marketing_media_marketing_agencies: 'cat_technology_communications_digital_marketing',
  cat_marketing_media_photo_video: 'cat_technology_communications_digital_marketing',
  cat_professional_services_law_offices: 'cat_professional_services_legal_services',
  cat_professional_services_accounting_offices: 'cat_professional_services_accounting_services',
  cat_finance_insurance_banks: 'cat_professional_services_financial_services',
  cat_finance_insurance_insurance_companies: 'cat_professional_services_financial_services',
  cat_public_community_government_services: 'cat_professional_services_office_services',
  cat_public_community_office_services: 'cat_professional_services_office_services',
  cat_public_community_social_organizations: 'cat_professional_services_office_services',
  cat_agriculture_animals_agri_supplies: 'cat_agriculture_animals_farms_agriculture',
  cat_agriculture_animals_animal_feed: 'cat_agriculture_animals_animal_production',
  cat_agriculture_animals_veterinary_clinics: 'cat_agriculture_animals_veterinary',
  cat_industry_workshops_food_factories: 'cat_agriculture_animals_factories',
  cat_industry_workshops_garment_factories: 'cat_agriculture_animals_factories',
  cat_industry_workshops_metal_workshops: 'cat_agriculture_animals_workshops',
};

export function resolveCanonicalActivityCategoryId(legacyGroupId: string, categoryCode: string): string {
  const rawCode = String(categoryCode || '').trim();
  if (!rawCode) return '';
  const legacyGroup = String(legacyGroupId || '').trim().toLowerCase();
  const legacyId = legacyGroup ? `cat_${legacyGroup}_${rawCode}` : '';
  if (legacyId && LEGACY_DIRECTORY_CATEGORY_MAP[legacyId]) return LEGACY_DIRECTORY_CATEGORY_MAP[legacyId];
  const canonicalGroupId = resolveCanonicalGroupId('', legacyGroupId);
  const canonicalId = `cat_${canonicalGroupId}_${rawCode}`;
  return DEFAULT_CATEGORIES.some((category) => category.id === canonicalId) ? canonicalId : '';
}

export function resolveCanonicalDirectoryCategoryId(categoryId: string, legacyGroupId?: string): string {
  const raw = String(categoryId || '').trim();
  if (!raw) return '';
  const direct = DEFAULT_CATEGORIES.find((category) => category.id === raw);
  if (direct) return direct.id;
  if (raw.startsWith('cat_custom_')) return raw;
  if (LEGACY_DIRECTORY_CATEGORY_MAP[raw]) return LEGACY_DIRECTORY_CATEGORY_MAP[raw];
  const canonicalGroupId = resolveCanonicalGroupId('', legacyGroupId);
  return raw.startsWith('cat_' + canonicalGroupId + '_') ? raw : '';
}

/** Keep historical/custom records intact, but expose only the curated 10x5 directory taxonomy. */
export function normalizeCanonicalTaxonomySettings(saved?: Partial<AdminSettings> | null): Pick<AdminSettings, 'functionalGroups' | 'categories' | 'defaultCategories'> {
  const customByGroup = new Map<string, ActivityCategory[]>();
  const savedCategories = Array.isArray(saved?.categories) ? saved.categories as ActivityCategory[] : [];
  savedCategories.forEach((entry) => {
    if (!entry || !entry.isCustom || !String(entry.name || '').trim()) return;
    const groupId = resolveCanonicalGroupId(String(entry.name), String((entry as any).functionalGroupId || ''));
    const list = customByGroup.get(groupId) || [];
    if (list.length < 5) list.push({ ...entry, functionalGroupId: groupId, classificationType: 'activity' });
    customByGroup.set(groupId, list);
  });
  const categories: ActivityCategory[] = [];
  for (const group of DEFAULT_FUNCTIONAL_GROUPS) {
    const defaults = DEFAULT_CATEGORIES.filter((category) => category.functionalGroupId === group.id);
    const seenNames = new Set(defaults.map((category) => normalizeTaxonomyName(category.name)));
    const custom = (customByGroup.get(group.id) || []).filter((category) => {
      const normalizedName = normalizeTaxonomyName(category.name);
      if (!normalizedName || seenNames.has(normalizedName)) return false;
      seenNames.add(normalizedName);
      return true;
    }).slice(0, 5);
    categories.push(...defaults.slice(0, Math.max(0, 5 - custom.length)), ...custom);
  }
  const defaultCategories = categories.map((category) => category.name);
  return { functionalGroups: DEFAULT_FUNCTIONAL_GROUPS, categories, defaultCategories };
}
// Payment rails are deliberately disabled for this catalog-first release.
// Never put merchant credentials or gateway secrets in browser code.
export const DEFAULT_PAYMOB_CONFIG: PaymobConfig = {
  enabled: false,
  feeType: 'percentage_and_fixed',
  feePercentage: 0,
  feeFixed: 0,
  acceptedChannels: [],
};

export const INITIAL_ADMIN_SETTINGS: AdminSettings = {
  adminWhatsApp: '',
  adminPassword: '',
  currency: 'ج.م',
  platformName: 'MantiqatiX',
  platformEmail: '',
  maxAllowedProductsPerBusiness: 150,
  defaultCommissionPerOrder: 0,
  overdueGracePeriodDays: 5,
  defaultPaymobFeePercentage: 0,
  defaultPaymobFeeFixed: 0,
  functionalGroups: DEFAULT_FUNCTIONAL_GROUPS,
  categories: DEFAULT_CATEGORIES,
  defaultCategories: DEFAULT_CATEGORIES.map((category) => category.name),
};
