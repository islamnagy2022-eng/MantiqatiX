import type { ActivityCategory, FunctionalGroupId } from '../../types';

export interface ActivityMarketingPlan {
  objective: string;
  audience: string;
  positioning: string;
  contentPillars: string[];
  campaignIdeas: string[];
  requiredAssets: string[];
}

export interface ActivityCapability {
  id: string;
  title: string;
  description: string;
  state: 'planned' | 'available';
}

export interface ActivityModuleConfig {
  activityId: string;
  activityName: string;
  marketing: ActivityMarketingPlan;
  capabilities: ActivityCapability[];
}

type DomainProfile = Omit<ActivityModuleConfig, 'activityId' | 'activityName'>;

const domainProfiles: Partial<Record<FunctionalGroupId, DomainProfile>> = {
  medical_health: {
    marketing: {
      objective: 'زيادة الوعي بالخدمات الصحية وتسهيل الوصول إلى مقدم الخدمة المناسب دون وعود علاجية أو ادعاءات غير موثقة.',
      audience: 'الأشخاص والأسر الباحثون عن تخصص أو خدمة صحية مرخصة داخل نطاقهم الجغرافي.',
      positioning: 'الثقة والوضوح: التخصص، الترخيص، مواعيد العمل، موقع المنشأة، وطريقة الحجز.',
      contentPillars: ['تعريف التخصص والخدمات ومقدم الخدمة', 'محتوى توعوي يراجعه مختص', 'المواعيد وطرق الحجز والموقع', 'التجهيزات والخدمات الفعلية دون مبالغة'],
      campaignIdeas: ['تعريف بخدمة أو تخصص محدد', 'توعية موسمية بمراجعة مختص', 'إعلان عن المواعيد أو خدمة جديدة بعد اعتمادها'],
      requiredAssets: ['بيانات الترخيص والتوثيق', 'صور حقيقية بموافقة أصحابها', 'قائمة الخدمات والمواعيد', 'وسيلة حجز واتصال معتمدة'],
    },
    capabilities: [
      { id: 'appointments', title: 'المواعيد والحجوزات', description: 'إدارة المواعيد بعد ربط مزود الحجز المعتمد.', state: 'planned' },
      { id: 'services', title: 'الخدمات والتخصصات', description: 'قائمة الخدمات والتخصصات ومقدميها.', state: 'planned' },
      { id: 'patient-requests', title: 'طلبات التواصل', description: 'استفسارات الحجز والتواصل مع ضوابط خصوصية البيانات الصحية.', state: 'planned' },
      { id: 'compliance', title: 'الاعتماد والمراجعة', description: 'مراجعة بيانات الترخيص والمحتوى قبل النشر.', state: 'planned' },
    ],
  },
  food_grocery: {
    marketing: {
      objective: 'زيادة الزيارات والطلبات المتكررة من العملاء القريبين وإبراز المنتجات الفعلية والعروض الواضحة.',
      audience: 'السكان القريبون، الأسر، الموظفون، والباحثون عن طعام أو منتجات غذائية في نطاق التوصيل.',
      positioning: 'الطعم والجودة والتوافر والسعر وسرعة الخدمة مع معلومات دقيقة.',
      contentPillars: ['صور أصلية للمنتجات والأطباق', 'القائمة والأسعار والعروض', 'التجهيز والنظافة ومصادر المكونات عند التحقق', 'التوصيل وساعات العمل ومناطق الخدمة'],
      campaignIdeas: ['عرض وجبة أو منتج محدد', 'قائمة موسمية أو مناسبة محلية', 'حملة نطاق توصيل محدد', 'برنامج عودة العملاء'],
      requiredAssets: ['صور المنتجات الفعلية', 'قائمة وأسعار محدثة', 'مناطق التوصيل', 'مواعيد العمل ووسائل الطلب'],
    },
    capabilities: [
      { id: 'menu-catalog', title: 'القائمة والمنتجات', description: 'إدارة الأصناف والأسعار والتوافر والصور.', state: 'planned' },
      { id: 'orders', title: 'الطلبات والتوصيل', description: 'استقبال الطلبات ومتابعة حالتها ومناطق التوصيل.', state: 'planned' },
      { id: 'offers', title: 'العروض والولاء', description: 'عروض قابلة للجدولة وقواعد خصم واضحة.', state: 'planned' },
      { id: 'reviews', title: 'تقييمات العملاء', description: 'إدارة الردود والتقييمات الموثقة.', state: 'planned' },
    ],
  },
  fashion_beauty: {
    marketing: {
      objective: 'تحويل اكتشاف المنتجات والخدمات إلى زيارات وعمليات شراء مع إبراز التشكيلة والأسعار والتوافر.',
      audience: 'المستهلكون المحليون الباحثون عن منتجات أو عناية شخصية تناسب احتياجاتهم وميزانياتهم.',
      positioning: 'التنوع والأصالة ووضوح السعر والمقاس والتوافر وسياسة الاستبدال.',
      contentPillars: ['صور منتجات حقيقية وتفاصيلها', 'مقارنات واستخدامات عملية', 'عروض وتشكيلات موسمية', 'آراء العملاء وسياسات البيع'],
      campaignIdeas: ['إطلاق تشكيلة جديدة', 'عرض موسمي محدود المدة', 'حزمة منتجات متكاملة', 'حملة إعادة استهداف العملاء بموافقتهم'],
      requiredAssets: ['صور المنتجات', 'الأسعار والمقاسات', 'بيانات المخزون', 'سياسة البيع والاستبدال'],
    },
    capabilities: [
      { id: 'catalog', title: 'كتالوج المنتجات', description: 'الأصناف والمتغيرات والمقاسات والأسعار والمخزون.', state: 'planned' },
      { id: 'promotions', title: 'العروض والخصومات', description: 'قواعد خصم وتواريخ صلاحية واعتماد.', state: 'planned' },
      { id: 'customer-care', title: 'خدمة العملاء', description: 'الاستفسارات والطلبات والاستبدال.', state: 'planned' },
    ],
  },
  home_maintenance: {
    marketing: {
      objective: 'جذب طلبات معاينة وعروض أسعار وإبراز جودة التنفيذ والأعمال الحقيقية.',
      audience: 'أصحاب المنازل والمشروعات والمكاتب الباحثون عن توريد أو تنفيذ أو صيانة داخل منطقة الخدمة.',
      positioning: 'جودة التنفيذ والالتزام بالمواصفات والموعد والضمان والتكلفة الواضحة.',
      contentPillars: ['قبل وبعد بموافقة العميل', 'تفاصيل الخامات والمواصفات', 'مراحل التنفيذ وفريق العمل', 'نطاق الخدمة والضمان'],
      campaignIdeas: ['طلب معاينة أو عرض سعر', 'عرض خدمة موسمية للصيانة', 'حملة إبراز مشروع منفذ', 'حملة منتجات أو خامات متاحة'],
      requiredAssets: ['صور أعمال حقيقية', 'قائمة خدمات وخامات', 'نطاق التغطية', 'بيانات الضمان والتراخيص'],
    },
    capabilities: [
      { id: 'projects', title: 'المشروعات وأوامر العمل', description: 'متابعة المعاينات والعروض والتنفيذ.', state: 'planned' },
      { id: 'materials', title: 'الخامات والمنتجات', description: 'قوائم الخامات والمواصفات والتوافر.', state: 'planned' },
      { id: 'quotes', title: 'طلبات المعاينة والتسعير', description: 'إدارة طلبات العملاء وعروض الأسعار.', state: 'planned' },
    ],
  },
  construction_decor: {
    marketing: {
      objective: 'توليد فرص لمشروعات جديدة وإثبات جودة التصميم والتنفيذ من خلال أعمال موثقة.',
      audience: 'الأفراد والشركات الباحثون عن تصميم أو تشطيب أو تنفيذ مشروعات.',
      positioning: 'الخبرة ونطاق العمل والمواصفات والجدول الزمني وشفافية عرض السعر.',
      contentPillars: ['مشروعات منفذة', 'مراحل التصميم والتنفيذ', 'الخامات والمواصفات', 'دراسات حالة وعروض أسعار'],
      campaignIdeas: ['حملة طلب معاينة', 'حملة مشروع قبل وبعد', 'حملة خدمة أو تخصص تنفيذ محدد'],
      requiredAssets: ['معرض أعمال بموافقة المالك', 'خدمات ومراحل التنفيذ', 'نطاق جغرافي', 'بيانات فريق العمل'],
    },
    capabilities: [
      { id: 'projects', title: 'إدارة المشروعات', description: 'مراحل التنفيذ والمهام والمواعيد.', state: 'planned' },
      { id: 'quotes', title: 'المعاينات وعروض الأسعار', description: 'تسجيل الطلبات وإصدار عروض الأسعار.', state: 'planned' },
      { id: 'portfolio', title: 'معرض الأعمال', description: 'مشروعات موثقة ومراحل تنفيذها.', state: 'planned' },
    ],
  },
  auto_transport: {
    marketing: {
      objective: 'جذب استفسارات مؤهلة عن المركبات أو الصيانة أو قطع الغيار والخدمات اللوجستية.',
      audience: 'أصحاب المركبات والشركات والأفراد المحتاجون إلى نقل أو صيانة أو توريد.',
      positioning: 'التوافق والجودة والتوافر والسعر والوقت والضمان.',
      contentPillars: ['الخدمات والمركبات وقطع الغيار', 'التوافق والمواصفات', 'العروض والصيانة الدورية', 'مناطق الخدمة ووقت التسليم'],
      campaignIdeas: ['عرض خدمة أو قطعة محددة', 'تذكير صيانة موسمية', 'حملة طلب فحص أو عرض سعر'],
      requiredAssets: ['صور ومواصفات فعلية', 'قائمة أسعار وتوافر', 'أنواع المركبات المتوافقة', 'مواعيد ومناطق الخدمة'],
    },
    capabilities: [
      { id: 'inventory', title: 'المركبات وقطع الغيار', description: 'المواصفات والتوافق والتوافر.', state: 'planned' },
      { id: 'service-booking', title: 'حجوزات الصيانة', description: 'مواعيد الفحص والصيانة ومتابعة الحالة.', state: 'planned' },
      { id: 'logistics', title: 'النقل والتوصيل', description: 'طلبات النقل والتسليم ومناطق التغطية.', state: 'planned' },
    ],
  },
  real_estate: {
    marketing: {
      objective: 'توليد طلبات معاينة واستفسارات مؤهلة للوحدات والمشروعات والأراضي.',
      audience: 'الباحثون عن شراء أو إيجار أو استثمار عقاري ضمن منطقة وميزانية محددتين.',
      positioning: 'معلومات موثقة عن الموقع والمساحة والسعر والحالة القانونية والتوافر.',
      contentPillars: ['صور وفيديوهات حقيقية للوحدات', 'الموقع والمساحة والتقسيم', 'السعر والشروط والتوافر', 'المعاينات والمستندات بعد التحقق'],
      campaignIdeas: ['حملة وحدة أو مشروع محدد', 'حملة طلب معاينة', 'حملة عقارات حسب المنطقة والميزانية'],
      requiredAssets: ['صور أصلية', 'الموقع والمساحة', 'السعر والتوافر المحدث', 'تفاصيل الملكية والتفويض'],
    },
    capabilities: [
      { id: 'properties', title: 'الوحدات والعقارات', description: 'إدارة الوحدات والمواصفات والأسعار والحالة.', state: 'planned' },
      { id: 'leads', title: 'العملاء المحتملون', description: 'تسجيل الاستفسارات وتأهيلها ومتابعتها.', state: 'planned' },
      { id: 'viewings', title: 'المعاينات', description: 'جدولة المعاينات وتوثيق نتائجها.', state: 'planned' },
    ],
  },
  education_training: {
    marketing: {
      objective: 'زيادة الاستفسارات والتسجيلات مع توضيح البرامج والمستويات والمواعيد.',
      audience: 'الطلاب وأولياء الأمور والمتدربون الباحثون عن تعليم أو تدريب مناسب.',
      positioning: 'وضوح البرنامج والمحتوى والمؤهلات والنتائج القابلة للإثبات.',
      contentPillars: ['البرامج والمناهج', 'المدرسون والمؤهلات', 'مواعيد ومراحل التسجيل', 'أنشطة وتجارب موثقة'],
      campaignIdeas: ['فتح التسجيل لفصل أو دورة', 'تعريف ببرنامج جديد', 'جلسة تعريفية أو يوم مفتوح'],
      requiredAssets: ['وصف البرامج', 'المواعيد والرسوم', 'المؤهلات والتراخيص', 'قنوات التواصل والتسجيل'],
    },
    capabilities: [
      { id: 'programs', title: 'البرامج والدورات', description: 'المناهج والمستويات والمواعيد.', state: 'planned' },
      { id: 'enrollment', title: 'التسجيل والقبول', description: 'طلبات الالتحاق ومتابعة القبول.', state: 'planned' },
      { id: 'schedule', title: 'الجداول والمجموعات', description: 'إدارة المواعيد والمجموعات.', state: 'planned' },
    ],
  },
  technology_communications: {
    marketing: {
      objective: 'إظهار قيمة الحلول التقنية وتحويل الاهتمام إلى طلبات عروض وتجارب.',
      audience: 'الأفراد والشركات الباحثون عن حلول برمجية أو تقنية أو تسويق رقمي.',
      positioning: 'المشكلة التي يحلها المنتج، نطاق التنفيذ، الدعم، وأمثلة نتائج قابلة للتحقق.',
      contentPillars: ['شرح الخدمات والحلول', 'عروض توضيحية حقيقية', 'دراسات حالة ومشروعات', 'الدعم والتحديثات'],
      campaignIdeas: ['طلب استشارة أو عرض سعر', 'عرض توضيحي لحل تقني', 'حملة خدمة متخصصة'],
      requiredAssets: ['وصف الحلول', 'نماذج أعمال', 'نطاق التنفيذ والدعم', 'بيانات التواصل'],
    },
    capabilities: [
      { id: 'solutions', title: 'الحلول والخدمات', description: 'الخدمات والباقات والمواصفات الفنية.', state: 'planned' },
      { id: 'leads', title: 'طلبات الاستشارة', description: 'تأهيل الطلبات وتحديد نطاق العمل.', state: 'planned' },
      { id: 'projects', title: 'المشروعات والدعم', description: 'متابعة التنفيذ وطلبات الدعم.', state: 'planned' },
    ],
  },
  professional_services: {
    marketing: {
      objective: 'توليد استفسارات مهنية مناسبة وإبراز الخبرة والخدمات والاعتمادات.',
      audience: 'الأفراد والشركات الباحثون عن خدمة مهنية أو استشارة متخصصة.',
      positioning: 'التخصص والخبرة والاعتماد والسرية ووضوح نطاق الخدمة.',
      contentPillars: ['تعريف الخدمات والتخصصات', 'محتوى معرفي يراجعه مختص', 'المؤهلات والاعتمادات', 'خطوات طلب الخدمة'],
      campaignIdeas: ['حملة تعريف بخدمة محددة', 'جلسة استشارة أولية وفق الضوابط', 'محتوى توعوي متخصص'],
      requiredAssets: ['المؤهلات والتراخيص', 'قائمة الخدمات', 'نطاق الأتعاب عند الإعلان', 'سياسة الخصوصية'],
    },
    capabilities: [
      { id: 'services', title: 'الخدمات المهنية', description: 'تعريف الخدمات ونطاقها ومتطلباتها.', state: 'planned' },
      { id: 'consultations', title: 'طلبات الاستشارة', description: 'تنظيم طلبات التواصل والمواعيد.', state: 'planned' },
      { id: 'documents', title: 'الملفات والمتابعة', description: 'متابعة المستندات وفق صلاحيات وخصوصية واضحة.', state: 'planned' },
    ],
  },
  agriculture_animals: {
    marketing: {
      objective: 'ربط المنتجين والموردين والعملاء المحليين بالمنتجات والخدمات المتاحة.',
      audience: 'المزارعون والمربون والموردون والتجار والعملاء الباحثون عن منتجات زراعية أو بيطرية.',
      positioning: 'المصدر والجودة والموسم والتوافر والسعر ووسائل التوريد.',
      contentPillars: ['المنتجات والمحاصيل الفعلية', 'مواسم الإنتاج والتوريد', 'الخدمات والمستلزمات', 'إرشاد يراجعه مختص'],
      campaignIdeas: ['حملة منتج موسمي', 'حملة توريد أو طلب كميات', 'حملة خدمة أو مستلزم زراعي'],
      requiredAssets: ['صور المنتجات', 'المصدر والكميات', 'الأسعار والتوافر', 'نطاق التوريد'],
    },
    capabilities: [
      { id: 'produce', title: 'المنتجات والمحاصيل', description: 'الكميات والمواسم والأسعار والتوافر.', state: 'planned' },
      { id: 'supply', title: 'التوريد والطلبات', description: 'طلبات الكميات والتسليم.', state: 'planned' },
      { id: 'services', title: 'الخدمات البيطرية والزراعية', description: 'تعريف الخدمات ومواعيدها ونطاقها.', state: 'planned' },
    ],
  },
};

const defaultProfile: DomainProfile = {
  marketing: {
    objective: 'زيادة ظهور النشاط محليًا وتحويل الاهتمام إلى استفسارات وطلبات قابلة للمتابعة.',
    audience: 'العملاء المحليون الذين يبحثون عن النشاط أو التخصص ضمن النطاق الجغرافي المحدد.',
    positioning: 'تقديم قيمة واضحة ومعلومات دقيقة وصور وأعمال حقيقية ووسائل تواصل موثوقة.',
    contentPillars: ['تعريف النشاط والخدمات', 'صور ومنتجات وأعمال حقيقية', 'الأسعار والتوافر والعروض', 'آراء العملاء الموثقة'],
    campaignIdeas: ['حملة تعريف بالنشاط', 'حملة إبراز خدمة أو تخصص', 'عرض موسمي أو مناسبة محلية'],
    requiredAssets: ['شعار وصور أصلية', 'قائمة الخدمات أو المنتجات', 'بيانات اتصال صحيحة', 'نطاق التغطية وساعات العمل'],
  },
  capabilities: [
    { id: 'profile', title: 'ملف النشاط والفروع', description: 'بيانات النشاط والتوثيق والفروع ونطاق الخدمة.', state: 'planned' },
    { id: 'catalog', title: 'الخدمات والمنتجات', description: 'كتالوج خاص بما يقدمه النشاط.', state: 'planned' },
    { id: 'customers', title: 'العملاء والطلبات', description: 'استفسارات وطلبات مرتبطة بالنشاط.', state: 'planned' },
    { id: 'reports', title: 'التقارير والتحليلات', description: 'تقارير تعتمد على السجلات الفعلية فقط.', state: 'planned' },
  ],
};

/**
 * Resolve one module configuration for every canonical activity ID.
 * The activity ID is the durable key; group metadata is used only internally
 * to choose a safe domain template and is never shown as visitor navigation.
 */
export function resolveActivityModuleConfig(category: ActivityCategory): ActivityModuleConfig {
  const profile = domainProfiles[category.functionalGroupId] || defaultProfile;
  const name = category.name.trim();
  return {
    activityId: category.id,
    activityName: name,
    marketing: {
      ...profile.marketing,
      objective: `${profile.marketing.objective} يركز هذا المركز على نشاط: ${name}.`,
    },
    capabilities: profile.capabilities.map((capability) => ({ ...capability })),
  };
}
