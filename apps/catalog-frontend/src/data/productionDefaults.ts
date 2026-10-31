import type { ActivityCategory, AdminSettings, FunctionalGroup, PaymobConfig } from '../types';

const makeGroup = (
  id: FunctionalGroup['id'], name: string, shortName: string, englishName: string,
  icon: string, badgeColor: string, description: string,
): FunctionalGroup => ({ id, name, shortName, englishName, icon, badgeColor, description, futureFeatures: [] });

/**
 * Canonical 18-group directory taxonomy. This is classification data only:
 * adding a category does not enable or activate any operational module.
 */
/**
 * Canonical 10-group taxonomy. Group IDs are stable compatibility keys;
 * legacy sectors are mapped into these groups and are not exposed as duplicates.
 */
export const DEFAULT_FUNCTIONAL_GROUPS: FunctionalGroup[] = [
  makeGroup('medical_health','الطب والصحة','الطب والصحة','Health & Medical','HeartPulse','bg-emerald-100 text-emerald-800 border-emerald-300','الخدمات الطبية والتشخيص والعلاج والرعاية الصحية.'),
  makeGroup('food_grocery','الأغذية والضيافة','الأغذية والضيافة','Food & Hospitality','UtensilsCrossed','bg-amber-100 text-amber-800 border-amber-300','المطاعم والمقاهي والمخبوزات والأغذية والضيافة.'),
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
  s('medical_health','medical_practices','activity','ممارسات وعيادات طبية','ممارسة طبية فردية أو عيادة مرخصة.',['باطنة','أطفال','قلب','جلدية','عيون','عظام','نساء وتوليد','أنف وأذن','مخ وأعصاب','طب أسرة']),
  s('medical_health','pharmacies','activity','صيدليات','صرف الأدوية والمستلزمات وفق الترخيص.',['صيدلية عامة','صيدلية مستشفى','توصيل دواء']),
  s('medical_health','diagnostic_labs','activity','معامل ومراكز تشخيص','تحاليل وأشعة وفحوصات تشخيصية.',['تحاليل طبية','أشعة','سونار','رنين مغناطيسي','أشعة مقطعية']),
  s('medical_health','hospitals','activity','مستشفيات ومراكز طبية','منشآت تقدم خدمات طبية متعددة.',['مستشفى عام','مركز طبي متعدد التخصصات','طوارئ']),
  s('medical_health','rehabilitation','activity','علاج طبيعي وتأهيل','خدمات التأهيل والعلاج الطبيعي.',['تأهيل عظام','تأهيل أعصاب','تأهيل أطفال','تأهيل رياضي']),
  // 2. الأغذية والضيافة
  s('food_grocery','restaurants','activity','مطاعم','إعداد وتقديم الوجبات.',['مشويات','وجبات سريعة','مأكولات شرقية','أسماك','وجبات صحية']),
  s('food_grocery','cafes','activity','مقاهي وكافيهات','تقديم القهوة والمشروبات.',['قهوة مختصة','مقهى عائلي','عصائر ومشروبات']),
  s('food_grocery','bakeries','activity','مخابز ومخبوزات','إنتاج وبيع المخبوزات.',['مخبز بلدي','معجنات','فطائر']),
  s('food_grocery','sweets','activity','حلويات ومناسبات','إنتاج وبيع الحلويات والكيك.',['حلويات شرقية','حلويات غربية','كيك مناسبات']),
  s('food_grocery','food_retail','activity','متاجر الأغذية والمواد التموينية','بيع المواد الغذائية والمنتجات الطازجة والمتخصصة.',['سوبر ماركت','بقالة','جزارة','دواجن وأسماك','بن وعطارة']),
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
  s('agriculture_animals','factories','activity','مصانع وإنتاج','منشآت التصنيع والإنتاج.',['صناعات غذائية','تصنيع معدني','تعبئة وتغليف']),
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

const LEGACY_GROUP_MAP: Record<string, FunctionalGroup['id']> = {
  dining: 'food_grocery', retail: 'fashion_beauty', services: 'professional_services',
  healthcare: 'medical_health', crafts_maintenance: 'home_maintenance',
  construction_decor: 'home_maintenance', marketing_media: 'technology_communications',
  trade_ecommerce: 'fashion_beauty', sports_fitness: 'education_training',
  tourism_events: 'food_grocery', finance_insurance: 'professional_services',
  industry_workshops: 'agriculture_animals', public_community: 'professional_services',
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
  const raw = String(categoryName || '').trim();
  const code = raw.split(/[|—–]/)[0].trim().toUpperCase().replace(/[\\s-]+/g, '_');
  if (BACKEND_CODE_GROUP_MAP[code]) return BACKEND_CODE_GROUP_MAP[code];
  const value = raw.toLocaleLowerCase('ar');
  if (/طبيب|طبي|صحة|عياد|صيدل|تحاليل|أشعة|مستشفى|أسنان|تمريض|تغذية|علاج طبيعي|مختبر/.test(value)) return 'medical_health';
  if (/مطعم|مقهى|كافيه|أغذية|غذاء|حلويات|مخبز|بقالة|سوبر ماركت|جزارة|لحوم|دواجن|أسماك|قهوة|ضيافة|فندق|سياحة|سفر|رحلات|مناسبات/.test(value)) return 'food_grocery';
  if (/ملابس|أزياء|أحذية|حقائب|مجوهرات|عطور|تجميل|كوافير|حلاق|خياطة|تجارة|متجر|بيع|شراء|جملة|مستعمل/.test(value)) return 'fashion_beauty';
  if (/مقاولات|بناء|تشطيب|ديكور|مواد بناء|رخام|جرانيت|سيراميك|ألوميتال|دهانات|عزل|صيانة|ورش منزلية|نجار|سباك|كهربائي|تكييف|أثاث|موبيليا/.test(value)) return 'home_maintenance';
  if (/سيارات|مركبات|ميكانيك|إطارات|بطاريات|شحن|توصيل|لوجستي|سائق|نقل بضائع/.test(value)) return 'auto_transport';
  if (/عقار|أراض|وسيط عقاري|إيجار شقق|تطوير عقاري|إدارة عقارات/.test(value)) return 'real_estate';
  if (/مدرس|تعليم|مدرسة|حضان|جامعة|معهد|تدريب|محاضر|مدرب|رياضة|لياقة|جيم|سباحة/.test(value)) return 'education_training';
  if (/برمج|مواقع|تطبيقات|كمبيوتر|شبكات|اتصالات|إنترنت|أمن سيبراني|إلكترونيات|هواتف|تقنية|ذكاء اصطناعي|تسويق|إعلان|تصميم|تصوير|محتوى|إعلام/.test(value)) return 'technology_communications';
  if (/تأمين|تمويل|مدفوعات|خدمات مالية|محام|قانون|محاسب|محاسبة|ترجمة|موارد بشرية|استشارات|خدمات مكتبية|وظائف/.test(value)) return 'professional_services';
  if (/زراع|مزرعة|مشاتل|بذور|أسمدة|حيوانات|بيطري|أعلاف|مصانع|تصنيع|حدادة|حداد|خراطة|لحام|إنتاج صناعي/.test(value)) return 'agriculture_animals';
  return LEGACY_GROUP_MAP[groupHint] || 'fashion_beauty';
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
    const custom = customByGroup.get(group.id) || [];
    categories.push(...defaults.slice(0, Math.max(0, 5 - custom.length)), ...custom.slice(0, 5));
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
