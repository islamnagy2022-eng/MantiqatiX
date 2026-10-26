import type { ActivityCategory, AdminSettings, FunctionalGroup, PaymobConfig } from '../types';

export const DEFAULT_FUNCTIONAL_GROUPS: FunctionalGroup[] = [
  {
    id: 'dining',
    name: 'قطاع الأغذية والمطاعم والمقاهي',
    shortName: 'مطاعم ومأكولات',
    englishName: 'Food & Dining Flow',
    icon: 'UtensilsCrossed',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    description: 'مهيأة لدعم خصائص قوائم الطعام، الإضافات المخصصة، حجم الوجبات، وتحديد نمط الطلب (صالة / سفري / دليفري سريع).',
    futureFeatures: [
      {
        title: 'قوائم الطعام الذكية والإضافات (Add-ons & Combos)',
        description: 'إمكانية تخصيص المشروبات، الصوصات، ودرجة التسوية لكل طبق عند الطلب مباشرة.',
        status: 'active',
      },
      {
        title: 'نظام حجز الطاولات والطلب الداخلي بالـ QR',
        description: 'مسح الكود على الطاولة للطلب الفوري دون انتظار النادل مع احتساب العمولة.',
        status: 'in_development',
      },
      {
        title: 'تقدير زمن التجهيز والتوصيل الساخن',
        description: 'إشعار فوري للعميل بوقت التحضير المتوقع (مثلاً: 25-35 دقيقة).',
        status: 'planned',
      },
    ],
  },
  {
    id: 'retail',
    name: 'قطاع التجزئة والسلع والمنتجات',
    shortName: 'تجارة وتجزئة',
    englishName: 'Retail & Physical Goods',
    icon: 'ShoppingBag',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
    description: 'مخصصة لمحلات الملابس، السوبرماركت، والأجهزة؛ تدعم تعدد المقاسات، تتبع المخزون، وكراتين التوصيل.',
    futureFeatures: [
      {
        title: 'خيارات المقاسات، الألوان والأوزان',
        description: 'إتاحة تحديد المقاس (S, M, L, XL) واللون للملابس، أو الوزن للسلع التموينية.',
        status: 'active',
      },
      {
        title: 'تنبيهات انخفاض رصيد المخزون',
        description: 'تنبيه آلي للتاجر عند اقتراب نفاد كمية أي منتج من حد الأمان.',
        status: 'in_development',
      },
      {
        title: 'ربط بوالص الشحن وشركات التوصيل المحلية',
        description: 'توليد أرقام تتبع وبوالص شحن أوتوماتيكية للطلبات المشحونة خارج المركز.',
        status: 'planned',
      },
    ],
  },
  {
    id: 'services',
    name: 'قطاع الخدمات والحجوزات والاستشارات',
    shortName: 'خدمات وحجوزات',
    englishName: 'Services & Bookings Flow',
    icon: 'CalendarCheck2',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
    description: 'معدة للاستشارات والخدمات المهنية وصالونات العناية التي تتطلب حجز موعد مسبق أو تسعير حسب الجلسة.',
    futureFeatures: [
      {
        title: 'جدولة المواعيد بالساعة واليوم',
        description: 'اختيار العميل للتاريخ وساعة الحضور المتاحة مع منع التضارب الزمني.',
        status: 'active',
      },
      {
        title: 'الدفع الإلكتروني وتأكيد الحجز الفوري',
        description: 'دفع العربون أو قيمة الاستشارة إلكترونياً وتأكيد الحجز فورياً.',
        status: 'in_development',
      },
      {
        title: 'إدارة مواعيد الفنيين والمستشارين المتنقلين',
        description: 'توزيع مواعيد الزيارات الميدانية على فريق العمل مع إشعارات الرسائل القصيرة.',
        status: 'planned',
      },
    ],
  },
  {
    id: 'healthcare',
    name: 'قطاع الرعاية الصحية والطبية',
    shortName: 'صحة ورعاية',
    englishName: 'Health & Medical Care',
    icon: 'HeartPulse',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    description: 'مهيأة للصيدليات، العيادات، ومعامل التحاليل مع آليات رفع الروشتات، والبحث عن البدائل الدوائية.',
    futureFeatures: [
      {
        title: 'رفع صورة الروشتة الطبية وتجهيزها',
        description: 'إمكانية إرفاق صورة الروشتة ليقوم الصيدلي بمراجعتها وتجهيز الأدوية للعميل.',
        status: 'active',
      },
      {
        title: 'دليل البدائل الدوائية بالاسم العلمي',
        description: 'اقتراح البدائل المصنعة محلياً ذات السعر الأنسب عند نقص الأصناف المستوردة.',
        status: 'in_development',
      },
      {
        title: 'حجز مواعيد كشف العيادات والتحاليل المنزلية',
        description: 'تنسيق طلب سحب عينات الدم والتحاليل من منزل المريض بالقرى والمراكز.',
        status: 'planned',
      },
    ],
  },
  {
    id: 'crafts_maintenance',
    name: 'قطاع الورش والصيانة والحرف المنزلية',
    shortName: 'ورش وصيانة',
    englishName: 'Maintenance & Crafts',
    icon: 'Wrench',
    badgeColor: 'bg-orange-100 text-orange-800 border-orange-300',
    description: 'مخصصة لورش السيارات، صيانة الأجهزة المنزلية، والتكييف والتشطيبات مع طلبات المعاينة الفنية.',
    futureFeatures: [
      {
        title: 'طلب معاينة وكشف فني منزلي',
        description: 'تحديد موقع العطل ورسم المعاينة، وتحديد عنوان القرية أو المركز بدقة.',
        status: 'active',
      },
      {
        title: 'تسعير تفصيلي (المصنعية + قطع الغيار)',
        description: 'إرسال مقايسة تقريبية للعميل مع مدة الضمان على قطع الغيار المستبدلة.',
        status: 'in_development',
      },
      {
        title: 'بطاقة ضمان الخدمة الإلكترونية',
        description: 'تتبع كارت صيانة ورقم الضمان الساري لكل جهاز تم إصلاحه.',
        status: 'planned',
      },
    ],
  },
];

export const DEFAULT_CATEGORIES: ActivityCategory[] = [
  // Dining
  { id: 'cat_dining_1', name: 'مطاعم ومقاهي', functionalGroupId: 'dining', description: 'مطاعم، كافيهات، محمصة بن، عصائر ومشروبات' },
  { id: 'cat_dining_2', name: 'حلويات ومخابز', functionalGroupId: 'dining', description: 'حلويات شرقية وغربية، كيك ومخبوزات طازجة' },
  { id: 'cat_dining_3', name: 'وجبات سريعة ومأكولات شعبية', functionalGroupId: 'dining', description: 'شاورما، برجر، فول وطعمية، بيتزا وفطائر' },
  
  // Retail
  { id: 'cat_retail_1', name: 'أزياء وملابس وأحذية', functionalGroupId: 'retail', description: 'ملابس رجالية ونسائية، أطفال، عبايات وأحذية' },
  { id: 'cat_retail_2', name: 'سوبرماركت ومواد غذائية', functionalGroupId: 'retail', description: 'بقالة، أجبان، لحوم، خضروات ومجمدات' },
  { id: 'cat_retail_3', name: 'إلكترونيات وأجهزة وهواتف', functionalGroupId: 'retail', description: 'موبايلات، شاشات، لابتوب وإكسسوارات' },
  { id: 'cat_retail_4', name: 'عطور ومستحضرات تجميل', functionalGroupId: 'retail', description: 'عطور فاخرة، ميك آب وعناية بالبشرة' },
  { id: 'cat_retail_5', name: 'أثاث وديكور ومفروشات', functionalGroupId: 'retail', description: 'مفروشات منزلية، ديكورات وستائر' },

  // Services
  { id: 'cat_service_1', name: 'خدمات وحلول رقمية', functionalGroupId: 'services', description: 'تصميم هويات، برمجة، تسويق رقمي وطباعة' },
  { id: 'cat_service_2', name: 'صالونات ومراكز تجميل', functionalGroupId: 'services', description: 'حلاقة رجالي، كوافير نسائي وعناية' },
  { id: 'cat_service_3', name: 'تنظيم مناسبات وتصوير', functionalGroupId: 'services', description: 'استوديوهات تصوير، فراشة وحفلات' },

  // Healthcare
  { id: 'cat_health_1', name: 'صيدليات ومستلزمات طبية', functionalGroupId: 'healthcare', description: 'أدوية، فيتامينات ومستلزمات رعاية صحية' },
  { id: 'cat_health_2', name: 'عيادات ومراكز طبية', functionalGroupId: 'healthcare', description: 'استشارات وكشوفات طبية متخصصة' },

  // Crafts & Maintenance
  { id: 'cat_crafts_1', name: 'صيانة أجهزة منزلية وتكييف', functionalGroupId: 'crafts_maintenance', description: 'إصلاح غسالات، ثلاجات، تكييفات وشاشات' },
  { id: 'cat_crafts_2', name: 'صيانة سيارات وميكانيكا', functionalGroupId: 'crafts_maintenance', description: 'ورش ميكانيكا، كهرباء سيارات وغيار زيوت' },
];

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
  adminWhatsApp: '+201010171770',
  adminPassword: '',
  currency: 'ج.م',
  platformName: 'MantiqatiX',
  platformEmail: '',
  maxAllowedProductsPerBusiness: 150,
  defaultCommissionPerOrder: 0.01,
  overdueGracePeriodDays: 5,
  defaultPaymobFeePercentage: 0,
  defaultPaymobFeeFixed: 0,
  functionalGroups: DEFAULT_FUNCTIONAL_GROUPS,
  categories: DEFAULT_CATEGORIES,
  defaultCategories: DEFAULT_CATEGORIES.map((category) => category.name),
};
