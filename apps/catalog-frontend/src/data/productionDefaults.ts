import type { ActivityCategory, AdminSettings, FunctionalGroup, PaymobConfig } from '../types';

const makeGroup = (
  id: FunctionalGroup['id'], name: string, shortName: string, englishName: string,
  icon: string, badgeColor: string, description: string,
): FunctionalGroup => ({ id, name, shortName, englishName, icon, badgeColor, description, futureFeatures: [] });

/**
 * Canonical 18-group directory taxonomy. This is classification data only:
 * adding a category does not enable or activate any operational module.
 */
export const DEFAULT_FUNCTIONAL_GROUPS: FunctionalGroup[] = [
  makeGroup('medical_health','الطب والصحة','الطب والصحة','Medical & Health','HeartPulse','bg-emerald-100 text-emerald-800 border-emerald-300','الأطباء والمنشآت والخدمات الطبية والصحية.'),
  makeGroup('food_grocery','الطعام والمواد الغذائية','الطعام والغذاء','Food & Grocery','UtensilsCrossed','bg-amber-100 text-amber-800 border-amber-300','المطاعم والأغذية ومحلات البيع الغذائي.'),
  makeGroup('fashion_beauty','الأزياء والتجميل','الأزياء والتجميل','Fashion & Beauty','ShoppingBag','bg-pink-100 text-pink-800 border-pink-300','الملابس والأحذية والإكسسوارات والعناية الشخصية.'),
  makeGroup('home_maintenance','المنزل والأثاث والصيانة','المنزل والصيانة','Home & Maintenance','Wrench','bg-orange-100 text-orange-800 border-orange-300','الأثاث والمفروشات والصيانة والخدمات المنزلية.'),
  makeGroup('construction_decor','البناء والتشطيبات والديكور','البناء والديكور','Construction & Decor','Building2','bg-stone-100 text-stone-800 border-stone-300','المقاولات ومواد البناء والتشطيبات والتصميم.'),
  makeGroup('auto_transport','السيارات والنقل والشحن','السيارات والنقل','Auto & Transport','Truck','bg-sky-100 text-sky-800 border-sky-300','المركبات والصيانة والنقل والشحن والتوصيل.'),
  makeGroup('real_estate','العقارات','العقارات','Real Estate','House','bg-teal-100 text-teal-800 border-teal-300','العقارات السكنية والتجارية وخدماتها.'),
  makeGroup('education_training','التعليم والتدريب','التعليم والتدريب','Education & Training','GraduationCap','bg-indigo-100 text-indigo-800 border-indigo-300','التعليم الأساسي والعالي والدروس والتدريب.'),
  makeGroup('technology_communications','التكنولوجيا والاتصالات','التكنولوجيا','Technology & Communications','Laptop','bg-cyan-100 text-cyan-800 border-cyan-300','البرمجيات والأجهزة والشبكات والاتصالات.'),
  makeGroup('professional_services','الخدمات المهنية والاستشارية','الخدمات المهنية','Professional Services','BriefcaseBusiness','bg-violet-100 text-violet-800 border-violet-300','المهن والاستشارات القانونية والمحاسبية والإدارية.'),
  makeGroup('marketing_media','التسويق والإعلام والتصميم','التسويق والإعلام','Marketing & Media','Megaphone','bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300','التسويق والإعلانات والتصميم والإنتاج الإعلامي.'),
  makeGroup('trade_ecommerce','التجارة والمتاجر الإلكترونية','التجارة الإلكترونية','Trade & E-commerce','ShoppingCart','bg-blue-100 text-blue-800 border-blue-300','التجارة العامة والجملة والتوزيع والمتاجر الإلكترونية.'),
  makeGroup('agriculture_animals','الزراعة والحيوانات','الزراعة والحيوانات','Agriculture & Animals','Sprout','bg-lime-100 text-lime-800 border-lime-300','الزراعة والمزارع والحيوانات والخدمات البيطرية.'),
  makeGroup('sports_fitness','الرياضة واللياقة','الرياضة واللياقة','Sports & Fitness','Dumbbell','bg-red-100 text-red-800 border-red-300','الأندية والأكاديميات والمدربون والمعدات الرياضية.'),
  makeGroup('tourism_events','السياحة والضيافة والمناسبات','السياحة والمناسبات','Tourism & Events','Plane','bg-purple-100 text-purple-800 border-purple-300','السفر والإقامة وتنظيم المناسبات والفعاليات.'),
  makeGroup('finance_insurance','المال والتأمين والمدفوعات','المال والتأمين','Finance & Insurance','Wallet','bg-emerald-100 text-emerald-800 border-emerald-300','الخدمات المالية والتأمين والمدفوعات المنظمة.'),
  makeGroup('industry_workshops','الصناعة والمصانع والورش','الصناعة والورش','Industry & Workshops','Factory','bg-slate-100 text-slate-800 border-slate-300','المصانع والإنتاج والورش والتصنيع والصيانة الصناعية.'),
  makeGroup('public_community','الخدمات العامة والمجتمعية','الخدمات المجتمعية','Public & Community Services','HandHeart','bg-rose-100 text-rose-800 border-rose-300','الخدمات العامة والبيئية والاجتماعية والشخصية.'),
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
  // 1 — الطب والصحة
  s('medical_health','clinics','activity','عيادات طبية','عيادات كشف واستشارات طبية.',['عيادات عامة','عيادات تخصصية','عيادات منزلية']),
  s('medical_health','pharmacies','activity','صيدليات','بيع وصرف الأدوية والمستلزمات وفق الترخيص.',['صيدليات عامة','صيدليات مستشفيات','توصيل الأدوية']),
  s('medical_health','labs','activity','معامل تحاليل','التحاليل والفحوصات المخبرية.',['تحاليل دم','هرمونات','مناعة','وراثة','ميكروبيولوجي']),
  s('medical_health','hospitals','activity','مستشفيات','مستشفيات عامة ومتخصصة.',['مستشفى عام','مستشفى أطفال','مستشفى قلب','مستشفى أورام']),
  s('medical_health','radiology','activity','مراكز أشعة','مراكز تصوير وتشخيص طبي.',['أشعة سينية','سونار','أشعة مقطعية','رنين مغناطيسي','أشعة أسنان']),
  s('medical_health','dental_centers','activity','مراكز وعيادات أسنان','خدمات طب الأسنان.',['تقويم','زراعة','علاج جذور','جراحة فم','تركيبات']),
  s('medical_health','physio_centers','activity','مراكز علاج طبيعي وتأهيل','التأهيل الحركي والوظيفي.',['تأهيل عظام','تأهيل أعصاب','إصابات ملاعب','تأهيل أطفال']),
  s('medical_health','homecare','activity','خدمات الرعاية المنزلية','الرعاية الصحية المنزلية بحسب الترخيص.',['تمريض منزلي','رعاية ما بعد العمليات','رعاية كبار السن']),
  s('medical_health','nutrition_centers','activity','مراكز تغذية علاجية','التغذية العلاجية والصحة الوقائية.',['تغذية أطفال','تغذية رياضيين','إدارة الوزن','تغذية مرضى السكري']),
  s('medical_health','doctor','profession','طبيب','المهنة الطبية؛ يحدد صاحبها تخصصه الدقيق.',['طبيب عيون','طبيب قلب','طبيب أطفال','طبيب باطنة','طبيب عظام','طبيب جلدية','طبيب مخ وأعصاب','طبيب نفسي','طبيب أنف وأذن وحنجرة','طبيب نساء وتوليد','طبيب مسالك بولية','طبيب صدر','طبيب جهاز هضمي','طبيب كلى','طبيب أورام','طبيب جراحة عامة','طبيب جراحة تجميل','طبيب تخدير','طبيب طوارئ','طبيب أسرة','طبيب روماتيزم','طبيب غدد صماء']),
  s('medical_health','dentist','profession','طبيب أسنان','مهنة طب الأسنان.',['أسنان عام','تقويم الأسنان','زراعة الأسنان','علاج الجذور','جراحة الفم','أسنان أطفال','تركيبات الأسنان','تجميل الأسنان','علاج اللثة']),
  s('medical_health','pharmacist','profession','صيدلي','مهنة الصيدلة.',['صيدلي مجتمع','صيدلي إكلينيكي','صيدلي مستشفيات']),
  s('medical_health','nurse','profession','ممرض','مهنة التمريض والرعاية.',['تمريض عام','تمريض طوارئ','تمريض منزلي','تمريض أطفال']),
  s('medical_health','lab_specialist','profession','أخصائي تحاليل طبية','مهنة التحاليل والمختبرات.',['كيمياء إكلينيكية','مناعة','ميكروبيولوجي','تحاليل وراثية']),
  s('medical_health','radiology_specialist','profession','أخصائي أشعة','مهنة الأشعة والتصوير الطبي.',['أشعة تشخيصية','أشعة تداخلية','أشعة أسنان']),
  s('medical_health','physiotherapist','profession','أخصائي علاج طبيعي','مهنة العلاج الطبيعي والتأهيل.',['عظام','أعصاب','أطفال','تأهيل رياضي']),
  s('medical_health','nutritionist','profession','أخصائي تغذية','مهنة التغذية والتثقيف الغذائي.',['تغذية علاجية','تغذية رياضية','تغذية أطفال']),

  // 2 — الطعام والمواد الغذائية
  s('food_grocery','restaurants','activity','مطاعم','منشآت إعداد وتقديم الطعام.',['مشويات','بيتزا','برجر','أكلات شرقية','مأكولات سورية','أسماك','وجبات صحية','مأكولات نباتية']),
  s('food_grocery','cafes','activity','كافيهات ومقاهي','أماكن تقديم المشروبات والقهوة.',['قهوة مختصة','مقهى عائلي','مقهى للدراسة والعمل']),
  s('food_grocery','bakeries','activity','مخابز وفطائر ومعجنات','إنتاج وبيع المخبوزات.',['مخبوزات شرقية','فطائر','معجنات']),
  s('food_grocery','sweets','activity','محلات حلويات وكيك وشوكولاتة','بيع الحلويات.',['حلويات شرقية','حلويات غربية','كيك مناسبات','شوكولاتة']),
  s('food_grocery','supermarkets','activity','سوبر ماركت وميني ماركت','بيع المواد الغذائية والاستهلاكية.',['سوبر ماركت','ميني ماركت','بقالة']),
  s('food_grocery','fresh_food','activity','محلات الأغذية الطازجة','بيع اللحوم والدواجن والأسماك والخضراوات.',['جزارة','دواجن','أسماك','خضراوات وفاكهة','ألبان وأجبان']),
  s('food_grocery','specialty_food','activity','محلات أغذية متخصصة','بيع البن والعطارة والعسل والمكسرات.',['بن ومحمصات','عطارة وتوابل','عسل','مكسرات']),
  s('food_grocery','food_suppliers','activity','توريد وتجهيز الأغذية','توريد الأغذية للمؤسسات والمناسبات.',['تموين شركات','إعاشة','وجبات جاهزة','تجهيز حفلات']),
  s('food_grocery','home_kitchens','activity','مطابخ منزلية وسحابية','إعداد وجبات بالطلب.',['وجبات منزلية','حلويات منزلية','وجبات أسبوعية']),
  s('food_grocery','chef','profession','شيف وطاهٍ','مهنة إعداد وتجهيز الطعام.',['شيف مطاعم','طاهٍ منزلي','شيف حلويات','شيف مخبوزات']),
  s('food_grocery','baker','profession','خباز','مهنة صناعة المخبوزات.',['خباز بلدي','خباز معجنات']),
  s('food_grocery','barista','profession','باريستا ومحضر مشروبات','مهنة إعداد القهوة والمشروبات.',['قهوة مختصة','مشروبات باردة','عصائر']),

  // 3 — الأزياء والتجميل
  s('fashion_beauty','clothing_stores','activity','محلات ملابس وأزياء','بيع الملابس الجاهزة.',['ملابس رجالي','ملابس حريمي','ملابس أطفال','ملابس محجبات','ملابس رياضية','ملابس عمل']),
  s('fashion_beauty','wedding_wear','activity','فساتين زفاف وسهرة','بيع وتأجير ملابس المناسبات.',['فساتين زفاف','فساتين سهرة','بدل مناسبات']),
  s('fashion_beauty','shoes_bags','activity','أحذية وحقائب ومنتجات جلدية','بيع الأحذية والحقائب.',['أحذية رجالي','أحذية حريمي','أحذية أطفال','حقائب','محافظ']),
  s('fashion_beauty','jewelry_stores','activity','مجوهرات وساعات وإكسسوارات','بيع المجوهرات والساعات والإكسسوارات.',['ذهب وفضة','ساعات','إكسسوارات']),
  s('fashion_beauty','beauty_products','activity','عطور ومستحضرات تجميل','بيع العطور ومنتجات العناية.',['عطور','عناية بالبشرة','عناية بالشعر','مكياج']),
  s('fashion_beauty','salons','activity','صالونات حلاقة وكوافير','خدمات الشعر والتجميل.',['حلاقة رجالي','كوافير حريمي','تصفيف شعر']),
  s('fashion_beauty','beauty_centers','activity','مراكز تجميل وعناية شخصية','خدمات العناية والتجميل.',['عناية بالبشرة','أظافر','سبا','حمامات مغربية']),
  s('fashion_beauty','fashion_designer','profession','مصمم أزياء','مهنة تصميم الملابس والأزياء.',['أزياء رجالي','أزياء حريمي','أزياء أطفال','تصميم باترون']),
  s('fashion_beauty','tailor','profession','خياط وترزي','مهنة التفصيل والتعديل.',['تفصيل ملابس','تعديل ملابس','تطريز']),
  s('fashion_beauty','hair_stylist','profession','مصفف شعر وحلاق','مهنة قص وتصفيف الشعر.',['قص شعر','تصفيف شعر','تسريحات مناسبات']),
  s('fashion_beauty','makeup_artist','profession','خبير مكياج','مهنة المكياج والتجهيز للمناسبات.',['مكياج مناسبات','مكياج عرائس']),

  // 4 — المنزل والأثاث والصيانة
  s('home_maintenance','furniture','activity','معارض أثاث وموبيليا','بيع الأثاث المنزلي والمكتبي.',['غرف نوم','غرف أطفال','أنتريهات','أثاث مكتبي','مطابخ']),
  s('home_maintenance','homewares','activity','أدوات منزلية ومستلزمات مطبخ','بيع مستلزمات المنزل والمطبخ.',['أدوات مطبخ','أطقم تقديم','أدوات تنظيف']),
  s('home_maintenance','home_textiles','activity','مفروشات وستائر وسجاد','بيع المفروشات وتجهيزات المنزل.',['ستائر','سجاد','مراتب','بياضات']),
  s('home_maintenance','appliance_service','activity','صيانة أجهزة منزلية','صيانة وإصلاح الأجهزة المنزلية.',['غسالات','ثلاجات','سخانات','أفران','شاشات']),
  s('home_maintenance','cleaning_services','activity','خدمات تنظيف المنازل والمنشآت','تنظيف المنازل والمكاتب والمفروشات.',['تنظيف منازل','تنظيف مكاتب','تنظيف سجاد','تنظيف بعد التشطيب']),
  s('home_maintenance','pest_control','activity','مكافحة حشرات وتعقيم','مكافحة الآفات والتعقيم وفق المتطلبات.',['مكافحة حشرات','مكافحة قوارض','تعقيم منشآت']),
  s('home_maintenance','moving_services','activity','نقل عفش وتجهيز منازل','نقل وتغليف وفك وتركيب الأثاث.',['نقل عفش','تغليف','فك وتركيب']),
  s('home_maintenance','carpenter','profession','نجار موبيليا','مهنة تصنيع وإصلاح الأثاث الخشبي.',['تصنيع أثاث','تركيب مطابخ','إصلاح أثاث']),
  s('home_maintenance','plumber','profession','سباك','مهنة تركيب وصيانة شبكات المياه.',['سباكة منزلية','كشف تسربات','تركيب أدوات صحية']),
  s('home_maintenance','electrician','profession','كهربائي','مهنة التركيبات والإصلاحات الكهربائية.',['كهرباء منازل','إنارة','أعطال كهربائية']),
  s('home_maintenance','hvac_technician','profession','فني تكييف وتبريد','مهنة تركيب وصيانة التكييف والتبريد.',['تركيب تكييف','صيانة تكييف','تبريد تجاري']),
  s('home_maintenance','appliance_technician','profession','فني صيانة أجهزة منزلية','مهنة إصلاح الأجهزة المنزلية.',['غسالات','ثلاجات','سخانات','أفران']),

  // 5 — البناء والتشطيبات والديكور
  s('construction_decor','contractors','activity','شركات مقاولات وبناء','تنفيذ مشروعات البناء والإنشاء.',['بناء سكني','مبانٍ تجارية','ترميم مبانٍ']),
  s('construction_decor','finishing_companies','activity','شركات تشطيبات','تشطيب الوحدات السكنية والتجارية.',['تشطيب شقق','تشطيب فيلات','تشطيب إداري','تسليم مفتاح']),
  s('construction_decor','interior_design','activity','مكاتب ديكور وتصميم داخلي','خدمات التصميم والتخطيط الداخلي.',['تصميم مطابخ','تصميم واجهات','تصميم ثلاثي الأبعاد']),
  s('construction_decor','building_materials','activity','مواد بناء ومحاجر','توريد مواد البناء والتجهيزات.',['أسمنت وحديد','طوب ورمل وزلط','عزل','دهانات']),
  s('construction_decor','ceramics_marble','activity','سيراميك ورخام وجرانيت','توريد وتركيب الخامات.',['سيراميك','بورسلين','رخام','جرانيت']),
  s('construction_decor','aluminum_glass','activity','ألوميتال وزجاج وسيكوريت','واجهات وأبواب وشبابيك.',['ألوميتال','زجاج سيكوريت','واجهات']),
  s('construction_decor','gypsum_paint','activity','جبس بورد ودهانات','أعمال الجبس والنقاشة والدهانات.',['جبس بورد','نقاشة','دهانات ديكورية']),
  s('construction_decor','waterproofing','activity','عزل ومقاومة تسربات','أعمال العزل للأسطح والخزانات.',['عزل مائي','عزل حراري','عزل أسطح']),
  s('construction_decor','civil_engineer','profession','مهندس مدني','مهنة الهندسة المدنية.',['تصميم إنشائي','إشراف مواقع','طرق وبنية تحتية']),
  s('construction_decor','architect','profession','مهندس معماري','مهنة التصميم المعماري.',['تصميم مبانٍ','تصميم واجهات','تخطيط عمراني']),
  s('construction_decor','interior_designer','profession','مهندس ديكور ومصمم داخلي','مهنة التصميم الداخلي.',['تصميم سكني','تصميم تجاري','تصميم مطابخ']),
  s('construction_decor','contractor','profession','مقاول','مهنة تنفيذ أعمال البناء والتشطيب.',['مقاولات عامة','تشطيبات','ترميم']),
  s('construction_decor','painter','profession','نقاش وفني دهانات','مهنة الدهانات والتجهيز.',['دهانات داخلية','دهانات خارجية','دهانات ديكورية']),

  // 6 — السيارات والنقل والشحن
  s('auto_transport','car_showrooms','activity','معارض سيارات','بيع وشراء المركبات.',['سيارات جديدة','سيارات مستعملة','سيارات كهربائية']),
  s('auto_transport','auto_maintenance','activity','مراكز صيانة سيارات','صيانة وإصلاح المركبات.',['ميكانيكا','كهرباء سيارات','تكييف سيارات','فحص كمبيوتر']),
  s('auto_transport','auto_parts','activity','قطع غيار وإطارات وبطاريات','بيع مستلزمات المركبات.',['قطع غيار','إطارات','بطاريات','زيوت وفلاتر']),
  s('auto_transport','car_wash','activity','غسيل وتلميع وحماية سيارات','خدمات العناية بالمركبات.',['غسيل','تلميع','حماية طلاء','عزل']),
  s('auto_transport','vehicle_rental','activity','تأجير سيارات ومركبات','تأجير المركبات وفق الشروط المنظمة.',['تأجير سيارات','تأجير شاحنات','تأجير حافلات']),
  s('auto_transport','shipping','activity','شركات شحن ونقل بضائع','خدمات الشحن والنقل.',['شحن محلي','شحن دولي','نقل ثقيل']),
  s('auto_transport','courier','activity','توصيل طلبات وبريد سريع','توصيل الطرود والطلبات.',['توصيل طعام','توصيل مستندات','توصيل متاجر']),
  s('auto_transport','logistics','activity','مستودعات وخدمات لوجستية','تخزين وتجهيز وإدارة النقل.',['تخزين','تجهيز طلبات','تخليص جمركي']),
  s('auto_transport','driver','profession','سائق','مهنة قيادة المركبات.',['سائق خاص','سائق أجرة','سائق حافلة','سائق نقل ثقيل']),
  s('auto_transport','mechanic','profession','ميكانيكي سيارات','مهنة إصلاح وصيانة المركبات.',['ميكانيكا عامة','محركات','ناقل حركة']),
  s('auto_transport','auto_electrician','profession','كهربائي سيارات','مهنة كهرباء وإلكترونيات المركبات.',['كهرباء سيارات','تشخيص كمبيوتر']),
  s('auto_transport','delivery_agent','profession','مندوب توصيل','مهنة توصيل الطلبات والطرود.',['توصيل طلبات','توصيل مستندات']),
  s('auto_transport','logistics_specialist','profession','أخصائي لوجستيات','مهنة تنظيم الشحن والتخزين.',['إدارة مخازن','شحن دولي','سلاسل إمداد']),

  // 7 — العقارات
  s('real_estate','residential_sales','activity','بيع وشراء عقارات سكنية','شقق وفيلات ووحدات سكنية.',['شقق','فيلات','دوبلكس','وحدات مصيفية']),
  s('real_estate','rentals','activity','إيجار عقارات','إيجارات سكنية وتجارية.',['إيجار شقق','إيجار فيلات','إيجار مفروش']),
  s('real_estate','commercial_real_estate','activity','عقارات تجارية وإدارية','بيع وإيجار المحلات والمكاتب والمخازن.',['محلات','مكاتب','مخازن']),
  s('real_estate','land_sales','activity','بيع وتسويق الأراضي','أراضٍ سكنية وتجارية وزراعية.',['أراضٍ سكنية','أراضٍ تجارية','أراضٍ زراعية']),
  s('real_estate','development','activity','شركات تطوير عقاري','تطوير وتسويق المشروعات العقارية.',['مشروعات سكنية','مشروعات تجارية']),
  s('real_estate','property_management','activity','إدارة عقارات ومرافق','إدارة الأملاك والوحدات والمجمعات.',['إدارة وحدات','إدارة مجمعات','إدارة مرافق']),
  s('real_estate','real_estate_agent','profession','وسيط ومسوق عقاري','مهنة الوساطة والتسويق العقاري.',['عقارات سكنية','عقارات تجارية','مشروعات جديدة']),
  s('real_estate','property_manager','profession','مدير أملاك وعقارات','مهنة إدارة العقارات والوحدات.',['إدارة إيجارات','متابعة صيانة','إدارة مجمعات']),
  s('real_estate','valuer','profession','مقيم عقاري','مهنة تقييم العقارات والأصول.',['تقييم سكني','تقييم تجاري']),

  // 8 — التعليم والتدريب
  s('education_training','schools','activity','مدارس','مؤسسات التعليم الأساسي.',['مدارس لغات','مدارس دولية','مدارس خاصة']),
  s('education_training','nurseries','activity','حضانات ورياض أطفال','خدمات الطفولة والتعليم المبكر.',['حضانة','رياض أطفال']),
  s('education_training','tutoring_centers','activity','مراكز دروس وتعليم خاص','دروس ومجموعات تعليمية.',['دروس ابتدائي','دروس إعدادي','دروس ثانوي']),
  s('education_training','universities','activity','جامعات ومعاهد','مؤسسات التعليم العالي.',['جامعات','معاهد فنية','معاهد مهنية']),
  s('education_training','language_centers','activity','مراكز لغات','تعليم اللغات والتحضير للاختبارات.',['إنجليزي','عربي للأجانب','فرنسي','ألماني']),
  s('education_training','vocational_training','activity','مراكز تدريب مهني وتقني','تدريب حرفي وتقني.',['تدريب حرف','تدريب تقني','تدريب إداري']),
  s('education_training','online_learning','activity','منصات تعليم وتدريب إلكتروني','تعليم ودورات عن بعد.',['تعليم مباشر','دورات مسجلة']),
  s('education_training','teacher','profession','مدرس ومعلم','مهنة التعليم والتدريس.',['رياضيات','علوم','لغة عربية','لغة إنجليزية','فيزياء','كيمياء','تاريخ','جغرافيا']),
  s('education_training','lecturer','profession','محاضر وأستاذ جامعي','مهنة التعليم العالي والبحث.',['محاضر جامعي','باحث أكاديمي']),
  s('education_training','trainer','profession','مدرب','مهنة التدريب وبناء المهارات.',['تدريب مهني','تدريب إداري','تدريب تقني']),
  s('education_training','special_education','profession','أخصائي تربية خاصة','مهنة دعم التعلم والتأهيل التعليمي.',['صعوبات تعلم','تأهيل تعليمي','تعديل سلوك']),

  // 9 — التكنولوجيا والاتصالات
  s('technology_communications','software_companies','activity','شركات برمجيات وحلول تقنية','تطوير وبرمجة الأنظمة.',['أنظمة إدارة','برامج محاسبة','نقاط بيع','أتمتة أعمال']),
  s('technology_communications','web_development','activity','تصميم وتطوير مواقع ومتاجر','إنشاء المواقع والمتاجر الإلكترونية.',['مواقع شركات','متاجر إلكترونية','بوابات حجز']),
  s('technology_communications','mobile_apps','activity','تطوير تطبيقات الهاتف','تطبيقات الهواتف والأجهزة اللوحية.',['تطبيقات تجارة','تطبيقات خدمات','تطبيقات أعمال']),
  s('technology_communications','computer_repair','activity','صيانة كمبيوتر ولابتوب وطابعات','إصلاح أجهزة الحاسب والطباعة.',['كمبيوتر','لابتوب','طابعات']),
  s('technology_communications','network_services','activity','شبكات وإنترنت واستضافة','تركيب الشبكات وخدمات الاستضافة.',['شبكات شركات','خوادم','استضافة سحابية']),
  s('technology_communications','security_systems','activity','كاميرات وأنظمة مراقبة','تركيب الأنظمة الأمنية والتحكم.',['كاميرات','إنذار','تحكم في الدخول']),
  s('technology_communications','telecom_retail','activity','محلات هواتف وإلكترونيات','بيع الأجهزة والملحقات.',['هواتف','أجهزة لوحية','إكسسوارات','إلكترونيات']),
  s('technology_communications','cybersecurity_services','activity','خدمات أمن سيبراني','خدمات الأمن والحماية الرقمية.',['تقييم أمني','حماية شبكات','استجابة للحوادث']),
  s('technology_communications','software_developer','profession','مطور برمجيات','مهنة تطوير الأنظمة والتطبيقات.',['تطبيقات ويب','تطبيقات هاتف','أنظمة خلفية']),
  s('technology_communications','data_analyst','profession','محلل بيانات','مهنة تحليل البيانات والتقارير.',['تحليل أعمال','ذكاء أعمال','تحليل إحصائي']),
  s('technology_communications','ai_engineer','profession','مهندس ذكاء اصطناعي','مهنة بناء حلول الذكاء الاصطناعي.',['تعلم آلي','معالجة لغة','رؤية حاسوبية']),
  s('technology_communications','network_engineer','profession','مهندس شبكات واتصالات','مهنة تصميم وتشغيل الشبكات.',['شبكات','اتصالات','خوادم']),
  s('technology_communications','it_support','profession','فني دعم تقني','مهنة الدعم والصيانة التقنية.',['دعم مستخدمين','صيانة أجهزة','إدارة أنظمة']),

  // 10 — الخدمات المهنية والاستشارية
  s('professional_services','law_offices','activity','مكاتب محاماة وخدمات قانونية','خدمات قانونية وفق التراخيص.',['قانون شركات','عقود','أحوال شخصية','عقارات','عمل']),
  s('professional_services','accounting_offices','activity','مكاتب محاسبة ومراجعة','خدمات المحاسبة والمراجعة.',['محاسبة شركات','ضرائب','مراجعة حسابات']),
  s('professional_services','business_consulting','activity','استشارات إدارية وأعمال','خدمات الاستشارات المؤسسية.',['دراسات جدوى','تخطيط استراتيجي','تحسين عمليات']),
  s('professional_services','translation_offices','activity','مكاتب ترجمة وتدقيق لغوي','خدمات الترجمة والتحرير.',['ترجمة قانونية','ترجمة فنية','ترجمة فورية']),
  s('professional_services','hr_services','activity','خدمات موارد بشرية وتوظيف','التوظيف وإدارة الموارد البشرية.',['استقطاب مواهب','إدارة رواتب','تطوير موظفين']),
  s('professional_services','documentation_services','activity','خدمات إدارية وتجهيز مستندات','خدمات مكتبية وإدارية.',['أرشفة','إدخال بيانات','سكرتارية']),
  s('professional_services','engineering_consultancy','activity','مكاتب استشارات هندسية','استشارات وتصميم ومراجعات هندسية.',['استشارات مدنية','استشارات كهربائية','استشارات ميكانيكية']),
  s('professional_services','lawyer','profession','محامٍ ومستشار قانوني','مهنة المحاماة والاستشارات القانونية.',['شركات','أحوال شخصية','عقارات','قضايا مدنية','قضايا جنائية','عمل']),
  s('professional_services','accountant','profession','محاسب','مهنة المحاسبة والدفاتر.',['محاسبة مالية','ضرائب','تكاليف','رواتب','مراجعة']),
  s('professional_services','auditor','profession','مراجع حسابات','مهنة مراجعة الحسابات.',['مراجعة داخلية','مراجعة خارجية']),
  s('professional_services','translator','profession','مترجم ومدقق لغوي','مهنة الترجمة والتحرير.',['ترجمة قانونية','ترجمة فنية','ترجمة فورية','تدقيق لغوي']),
  s('professional_services','hr_specialist','profession','أخصائي موارد بشرية','مهنة إدارة الموارد البشرية.',['توظيف','تطوير مواهب','تعويضات ومزايا']),
  s('professional_services','management_consultant','profession','مستشار إداري','مهنة الاستشارات الإدارية.',['استراتيجية','حوكمة','تحسين عمليات']),

  // 11 — التسويق والإعلام والتصميم
  s('marketing_media','marketing_agencies','activity','وكالات وشركات تسويق','تسويق وإدارة حملات.',['تسويق رقمي','تسويق بالمحتوى','تسويق بالعمولة']),
  s('marketing_media','ad_services','activity','وكالات إعلانات وحملات ممولة','إدارة الحملات الإعلانية.',['إعلانات شبكات اجتماعية','إعلانات محركات البحث']),
  s('marketing_media','graphic_design','activity','استوديوهات تصميم وهوية بصرية','تصميم الشعارات والهوية والمواد التجارية.',['شعارات','هوية بصرية','تصميم عبوات']),
  s('marketing_media','photo_video','activity','استوديوهات تصوير وإنتاج فيديو','خدمات تصوير وإنتاج ومونتاج.',['تصوير منتجات','تصوير مناسبات','إنتاج إعلانات']),
  s('marketing_media','printing_signage','activity','مطابع ولافتات ودعاية خارجية','طباعة وإنتاج مواد دعائية.',['طباعة رقمية','لافتات','بنرات','لوحات مضيئة']),
  s('marketing_media','media_pr','activity','إعلام وعلاقات عامة','خدمات العلاقات العامة والإعلام.',['علاقات عامة','تنظيم مؤتمرات صحفية']),
  s('marketing_media','marketer','profession','مسوق وأخصائي تسويق','مهنة التسويق والنمو.',['تسويق رقمي','تسويق محتوى','تسويق ميداني']),
  s('marketing_media','ad_manager','profession','مدير إعلانات','مهنة إدارة الحملات الإعلانية.',['إعلانات ممولة','تحليل أداء إعلاني']),
  s('marketing_media','graphic_designer','profession','مصمم جرافيك','مهنة التصميم البصري.',['هوية بصرية','تصميم عبوات','تصميم مطبوعات']),
  s('marketing_media','photographer','profession','مصور فوتوغرافي وفيديو','مهنة التصوير والإنتاج المرئي.',['تصوير منتجات','تصوير مناسبات','تصوير تجاري']),
  s('marketing_media','content_writer','profession','كاتب محتوى ومحرر','مهنة كتابة وتحرير المحتوى.',['كتابة إعلانية','كتابة تقنية','محتوى اجتماعي']),

  // 12 — التجارة والمتاجر الإلكترونية
  s('trade_ecommerce','general_retail','activity','محلات ومتاجر تجزئة عامة','محلات بيع منتجات متنوعة.',['أدوات منزلية','ألعاب وهدايا','أدوات مكتبية']),
  s('trade_ecommerce','wholesale','activity','تجار جملة وموزعون','تجارة وتوزيع المنتجات بالجملة.',['توزيع محلي','توريد مؤسسي']),
  s('trade_ecommerce','import_export','activity','شركات استيراد وتصدير','التجارة الدولية والتوريد.',['استيراد','تصدير','توريد دولي']),
  s('trade_ecommerce','ecommerce_stores','activity','متاجر إلكترونية','متاجر بيع عبر الإنترنت.',['متاجر متعددة المنتجات','متاجر متخصصة']),
  s('trade_ecommerce','stationery_books','activity','مكتبات وقرطاسية وألعاب وهدايا','بيع الكتب والأدوات والهدايا.',['كتب','أدوات مدرسية','ألعاب','هدايا']),
  s('trade_ecommerce','office_equipment','activity','أدوات ومستلزمات مكاتب','تجهيزات ومستلزمات الشركات.',['أدوات مكتبية','معدات مكاتب','أجهزة عرض']),
  s('trade_ecommerce','used_goods','activity','متاجر ومنصات المستعمل','بيع وشراء المنتجات المستعملة.',['أثاث مستعمل','إلكترونيات مستعملة','ملابس مستعملة','كتب مستعملة']),
  s('trade_ecommerce','product_distribution','activity','وكلاء وموزعون تجاريون','تمثيل العلامات التجارية وتوزيع المنتجات.',['وكيل تجاري','موزع معتمد']),
  s('trade_ecommerce','merchant','profession','تاجر','مهنة التجارة وبيع المنتجات.',['تجارة تجزئة','تجارة جملة','تجارة إلكترونية']),
  s('trade_ecommerce','sales_representative','profession','مندوب مبيعات','مهنة المبيعات والتوزيع.',['مبيعات داخلية','مبيعات ميدانية','مبيعات مؤسسية']),
  s('trade_ecommerce','buyer','profession','مسؤول مشتريات وتوريد','مهنة التوريد وإدارة المشتريات.',['مشتريات محلية','مشتريات دولية']),
  s('trade_ecommerce','ecommerce_manager','profession','مدير متجر إلكتروني','مهنة إدارة التجارة الإلكترونية.',['إدارة منتجات','إدارة طلبات','إدارة كتالوج']),

  // 13 — الزراعة والحيوانات
  s('agriculture_animals','farms','activity','مزارع وإنتاج زراعي','إنتاج المحاصيل والزراعة.',['محاصيل حقلية','زراعة محمية','إنتاج عضوي']),
  s('agriculture_animals','nurseries','activity','مشاتل وزهور ونباتات','بيع النباتات والشتلات.',['شتلات','نباتات داخلية','زهور']),
  s('agriculture_animals','agri_supplies','activity','مستلزمات زراعية وأسمدة وبذور','توريد خامات ومستلزمات الزراعة.',['بذور','أسمدة','شبكات ري','معدات']),
  s('agriculture_animals','animal_farms','activity','مزارع إنتاج حيواني وأعلاف','إنتاج حيواني وتوريد أعلاف.',['ماشية','ألبان','أعلاف']),
  s('agriculture_animals','poultry_farms','activity','مزارع دواجن','تربية وإنتاج الدواجن.',['تسمين','بيض','تفريخ']),
  s('agriculture_animals','fish_farms','activity','مزارع أسماك واستزراع مائي','إنتاج وتربية الأسماك.',['استزراع سمكي','مستلزمات أحواض']),
  s('agriculture_animals','veterinary_clinics','activity','عيادات ومستشفيات بيطرية','خدمات علاج ورعاية الحيوانات.',['حيوانات أليفة','حيوانات مزارع','دواجن']),
  s('agriculture_animals','pet_supplies','activity','محلات حيوانات أليفة ومستلزماتها','مستلزمات وأغذية الحيوانات الأليفة.',['أغذية حيوانات','مستلزمات','استضافة حيوانات']),
  s('agriculture_animals','agronomist','profession','مهندس زراعي','مهنة الإرشاد والتصميم الزراعي.',['إنتاج نباتي','تربة وأسمدة','ري']),
  s('agriculture_animals','farmer','profession','مزارع','مهنة الزراعة والإنتاج.',['محاصيل','زراعة محمية','بستنة']),
  s('agriculture_animals','veterinarian','profession','طبيب بيطري','مهنة الطب البيطري.',['حيوانات أليفة','حيوانات مزارع','دواجن','جراحة بيطرية']),
  s('agriculture_animals','animal_care','profession','مقدم رعاية حيوانات','مهنة العناية بالحيوانات.',['رعاية حيوانات أليفة','رعاية مزارع']),
  s('agriculture_animals','irrigation_technician','profession','فني ري','مهنة تركيب وصيانة أنظمة الري.',['ري بالتنقيط','شبكات ري']),

  // 14 — الرياضة واللياقة
  s('sports_fitness','gyms','activity','صالات رياضية ونوادٍ صحية','صالات التدريب واللياقة.',['تدريب شخصي','أوزان','لياقة جماعية']),
  s('sports_fitness','sports_academies','activity','أكاديميات رياضية','تدريب وتعليم الرياضات.',['كرة قدم','سباحة','كرة سلة','تنس','فنون قتالية']),
  s('sports_fitness','sports_fields','activity','ملاعب ومرافق رياضية','تأجير المرافق الرياضية.',['ملاعب كرة قدم','ملاعب متعددة','ملاعب تنس']),
  s('sports_fitness','pools','activity','مراكز وأكاديميات سباحة','تعليم وممارسة السباحة.',['تعليم سباحة','تدريب سباحة']),
  s('sports_fitness','yoga_centers','activity','مراكز يوغا وبيلاتس','أنشطة اللياقة والحركة.',['يوغا','بيلاتس','تمدد']),
  s('sports_fitness','sports_equipment','activity','محلات أدوات ومستلزمات رياضية','بيع الملابس والمعدات الرياضية.',['ملابس رياضية','معدات لياقة','معدات ملاعب']),
  s('sports_fitness','fitness_coach','profession','مدرب لياقة بدنية','مهنة التدريب البدني.',['تدريب شخصي','لياقة جماعية','قوة وتحمل']),
  s('sports_fitness','swimming_coach','profession','مدرب سباحة','مهنة تعليم وتدريب السباحة.',['تعليم مبتدئين','تدريب تنافسي']),
  s('sports_fitness','football_coach','profession','مدرب كرة قدم','مهنة تدريب كرة القدم.',['ناشئين','تدريب حراس مرمى']),
  s('sports_fitness','sports_referee','profession','حكم رياضي','مهنة التحكيم الرياضي.',['كرة قدم','رياضات فردية']),
  s('sports_fitness','yoga_instructor','profession','مدرب يوغا وبيلاتس','مهنة تدريب الحركة والمرونة.',['يوغا','بيلاتس']),

  // 15 — السياحة والضيافة والمناسبات
  s('tourism_events','travel_agencies','activity','شركات سياحة وسفر','تنظيم البرامج والرحلات.',['رحلات داخلية','رحلات خارجية','رحلات جماعية']),
  s('tourism_events','hotels','activity','فنادق ومنتجعات وشقق فندقية','الإقامة والضيافة.',['فنادق','منتجعات','شقق فندقية','بيوت ضيافة']),
  s('tourism_events','tickets','activity','حجوزات وتذاكر سفر','خدمات الحجوزات.',['تذاكر طيران','قطارات','حافلات']),
  s('tourism_events','religious_travel','activity','رحلات الحج والعمرة','برامج الرحلات الدينية.',['حج','عمرة','زيارة']),
  s('tourism_events','event_halls','activity','قاعات أفراح ومناسبات','أماكن إقامة المناسبات.',['قاعات زفاف','قاعات مؤتمرات','قاعات اجتماعات']),
  s('tourism_events','event_planning','activity','تنظيم حفلات ومناسبات','إدارة وتجهيز الفعاليات.',['حفلات زفاف','أعياد ميلاد','فعاليات شركات']),
  s('tourism_events','event_rentals','activity','تأجير مستلزمات المناسبات','تأجير التجهيزات والديكورات.',['أثاث مناسبات','صوت وإضاءة','ديكورات']),
  s('tourism_events','conferences','activity','تنظيم مؤتمرات ومعارض','إدارة المؤتمرات والفعاليات التجارية.',['معارض تجارية','مؤتمرات','أجنحة عرض']),
  s('tourism_events','tour_guide','profession','مرشد سياحي','مهنة الإرشاد السياحي وفق الترخيص.',['سياحة ثقافية','سياحة بيئية','جولات محلية']),
  s('tourism_events','travel_agent','profession','منظم رحلات ومستشار سفر','مهنة تنظيم السفر والحجوزات.',['رحلات داخلية','رحلات خارجية','حجوزات']),
  s('tourism_events','hotel_manager','profession','مدير فندق ومسؤول ضيافة','مهنة تشغيل الضيافة.',['إدارة فندق','حجوزات','خدمة نزلاء']),
  s('tourism_events','event_planner_pro','profession','منظم فعاليات ومناسبات','مهنة تنظيم الفعاليات.',['أفراح','مؤتمرات','فعاليات تجارية']),

  // 16 — المال والتأمين والمدفوعات
  s('finance_insurance','insurance_companies','activity','شركات ووسطاء تأمين','خدمات التأمين وفق الترخيص.',['تأمين مركبات','تأمين ممتلكات','تأمين صحي']),
  s('finance_insurance','banks','activity','بنوك وفروع مصرفية','الفروع البنكية والخدمات المصرفية المحلية.',['بنوك تجارية','بنوك حكومية','بنوك زراعية','خدمات حسابات','خدمات شركات']),
  s('finance_insurance','financial_consulting','activity','استشارات وخدمات مالية','استشارات التخطيط وإدارة المال.',['تخطيط مالي','تحليل مالي','إدارة مخاطر']),
  s('finance_insurance','payment_services','activity','خدمات دفع وتحصيل إلكتروني','حلول الدفع والتحصيل المنظمة.',['بوابات دفع','تحصيل مدفوعات','حلول دفع للتجار']),
  s('finance_insurance','licensed_finance','activity','شركات تمويل مرخصة','خدمات تمويل في حدود التراخيص.',['تمويل مشروعات','تمويل أصول','تمويل تجاري']),
  s('finance_insurance','financial_reporting','activity','خدمات إعداد ميزانيات وتقارير مالية','إعداد ومتابعة التقارير المالية.',['ميزانيات','تسويات مالية','تقارير إدارية']),
  s('finance_insurance','insurance_broker','profession','وسيط ومستشار تأمين','مهنة الوساطة والاستشارات التأمينية.',['تأمين مركبات','تأمين ممتلكات','تأمين صحي']),
  s('finance_insurance','financial_analyst','profession','محلل مالي','مهنة التحليل المالي ودعم القرارات.',['تحليل استثمار','تحليل ائتمان','تخطيط مالي']),
  s('finance_insurance','financial_adviser','profession','مستشار مالي','مهنة الاستشارات والتخطيط المالي.',['إدارة ميزانية','تخطيط مالي']),
  s('finance_insurance','credit_analyst','profession','محلل ائتمان','مهنة تحليل مخاطر الائتمان.',['تقييم ائتمان','مخاطر تمويل']),
  s('finance_insurance','payment_operations','profession','أخصائي عمليات مدفوعات','مهنة تشغيل ومتابعة المدفوعات.',['تسويات','مطابقة عمليات','دعم تجار']),

  // 17 — الصناعة والمصانع والورش
  s('industry_workshops','food_factories','activity','مصانع أغذية ومشروبات','إنتاج وتصنيع الأغذية.',['ألبان','مخبوزات','مشروبات','معلبات']),
  s('industry_workshops','garment_factories','activity','مصانع ملابس ومنسوجات','إنتاج الملابس والأقمشة.',['ملابس جاهزة','أقمشة','تطريز صناعي']),
  s('industry_workshops','furniture_factories','activity','مصانع وورش أثاث','تصنيع الأثاث والمنتجات الخشبية.',['أثاث منزلي','مطابخ','أثاث مكتبي']),
  s('industry_workshops','metal_workshops','activity','ورش حدادة ولحام وخراطة','تصنيع وتشكيل المعادن.',['حدادة','لحام','خراطة','تشكيل معادن']),
  s('industry_workshops','plastic_factories','activity','مصانع بلاستيك ومطاط','تصنيع المنتجات البلاستيكية.',['حقن بلاستيك','تغليف','منتجات مطاط']),
  s('industry_workshops','packaging_factories','activity','مصانع ورق وكرتون وتغليف','إنتاج مواد التعبئة والتغليف.',['كرتون','عبوات','أكياس']),
  s('industry_workshops','chemical_factories','activity','مصانع منظفات ومواد كيميائية','تصنيع المنتجات الكيميائية وفق المتطلبات.',['منظفات','مواد صناعية']),
  s('industry_workshops','industrial_maintenance','activity','صيانة معدات وخطوط إنتاج','صيانة المعدات والمنشآت الصناعية.',['خطوط إنتاج','مولدات','معدات ورش']),
  s('industry_workshops','industrial_engineer','profession','مهندس إنتاج وتصنيع','مهنة تنظيم وتحسين عمليات التصنيع.',['تخطيط إنتاج','تحسين عمليات']),
  s('industry_workshops','welder','profession','لحام','مهنة اللحام الصناعي.',['لحام معادن','لحام أنابيب']),
  s('industry_workshops','lathe_operator','profession','خراط ومشغل معادن','مهنة الخراطة وتشغيل المعادن.',['خراطة','تفريز','تشغيل CNC']),
  s('industry_workshops','factory_operator','profession','مشغل ماكينة وفني إنتاج','مهنة تشغيل المعدات وخطوط الإنتاج.',['تشغيل ماكينات','تعبئة وتغليف']),
  s('industry_workshops','quality_inspector','profession','مراقب جودة','مهنة فحص الجودة ومطابقة المواصفات.',['جودة منتجات','جودة تصنيع']),

  // 18 — الخدمات العامة والمجتمعية
  s('public_community','security_companies','activity','شركات أمن وحراسة','خدمات أمن المنشآت والفعاليات.',['حراسة منشآت','أمن فعاليات']),
  s('public_community','environmental_services','activity','خدمات بيئية وإدارة مخلفات','خدمات بيئية وجمع وفرز المخلفات.',['جمع مخلفات','إعادة تدوير','نظافة بيئية']),
  s('public_community','social_organizations','activity','جمعيات ومؤسسات أهلية','خدمات ومبادرات مجتمعية.',['مساعدات مجتمعية','برامج تنمية','تطوع']),
  s('public_community','family_services','activity','خدمات أسرية ومجتمعية','خدمات دعم الأسرة والمجتمع.',['إرشاد أسري','دعم اجتماعي']),
  s('public_community','childcare','activity','خدمات رعاية الأطفال','خدمات الرعاية.',['رعاية أطفال','مرافقة أطفال']),
  s('public_community','eldercare','activity','خدمات رعاية كبار السن','مساعدة يومية ورعاية غير طبية.',['مرافقة','مساعدة منزلية']),
  s('public_community','office_services','activity','خدمات مكاتب ومعاملات إدارية','خدمات إدارية ومكتبية.',['إعداد مستندات','أرشفة','طباعة مستندات']),
  s('public_community','personal_services','activity','خدمات شخصية وحرفية','خدمات إصلاح ورعاية شخصية متنوعة.',['مغاسل','إصلاح أحذية','إصلاح ساعات','تنظيم منازل']),
  s('public_community','security_officer','profession','فرد أمن ومشرف أمن','مهن الأمن والسلامة.',['أمن منشآت','مشرف وردية']),
  s('public_community','social_worker','profession','أخصائي اجتماعي','مهنة الدعم الاجتماعي المجتمعي.',['دعم أسري','تنمية مجتمعية']),
  s('public_community','environmental_specialist','profession','أخصائي بيئي','مهنة البيئة والاستدامة.',['إدارة مخلفات','تقييم بيئي']),
  s('public_community','caregiver','profession','مقدم رعاية','مهنة الرعاية غير الطبية.',['رعاية كبار السن','رعاية منزلية','رعاية أطفال']),
  s('public_community','safety_specialist','profession','أخصائي سلامة وصحة مهنية','مهنة السلامة وإدارة المخاطر المهنية.',['سلامة منشآت','سلامة صناعية']),
  s('public_community','admin_assistant','profession','مساعد إداري وسكرتير','مهنة الخدمات الإدارية والمكتبية.',['سكرتارية','إدخال بيانات','إدارة مكتب']),
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
  dining: 'food_grocery',
  retail: 'trade_ecommerce',
  services: 'professional_services',
  healthcare: 'medical_health',
  crafts_maintenance: 'home_maintenance',
};

const BACKEND_CODE_GROUP_MAP: Record<string, FunctionalGroup['id']> = {
  HEALTH: 'medical_health', MEDICAL: 'medical_health', CLINICS: 'medical_health',
  PHARMACY: 'medical_health', LABS: 'medical_health', RADIOLOGY: 'medical_health',
  HOSPITAL: 'medical_health', DENTAL: 'medical_health', PHYSIOTHERAPY: 'medical_health',
  FOOD: 'food_grocery', RESTAURANTS: 'food_grocery', GROCERY: 'food_grocery',
  FASHION: 'fashion_beauty', BEAUTY: 'fashion_beauty',
  HOME: 'home_maintenance', HOMEWARES: 'home_maintenance', MAINTENANCE: 'home_maintenance',
  CONSTRUCTION: 'construction_decor', CONTRACTORS: 'construction_decor', DECOR: 'construction_decor',
  AUTO: 'auto_transport', MANTIGO: 'auto_transport', TRANSPORT: 'auto_transport', SHIPPING: 'auto_transport',
  REAL_ESTATE: 'real_estate',
  EDU: 'education_training', EDUCATION: 'education_training', SCHOOLS: 'education_training',
  ERP: 'technology_communications', TECH: 'technology_communications', SOFTWARE: 'technology_communications',
  ACCOUNTING: 'professional_services', LEGAL: 'professional_services', COMPANIES: 'professional_services',
  MARKETING: 'marketing_media', DIGITAL: 'marketing_media', MEDIA: 'marketing_media',
  USED_ITEMS: 'trade_ecommerce', TRADE: 'trade_ecommerce', RETAIL: 'trade_ecommerce',
  VETERINARY: 'agriculture_animals', AGRICULTURE: 'agriculture_animals', FARMING: 'agriculture_animals',
  SPORTS: 'sports_fitness', FITNESS: 'sports_fitness',
  TRIPS: 'tourism_events', TRAVEL: 'tourism_events', TOURISM: 'tourism_events', EVENTS: 'tourism_events',
  FINANCE: 'finance_insurance', INSURANCE: 'finance_insurance', PAYMENTS: 'finance_insurance',
  FACTORIES: 'industry_workshops', INDUSTRY: 'industry_workshops', WORKSHOPS: 'industry_workshops',
  JOBS: 'professional_services', FREELANCER: 'professional_services',
  MATRIMONY: 'public_community', COMMUNITY: 'public_community', PUBLIC_SERVICES: 'public_community',
};

export function resolveCanonicalGroupId(categoryName: string, legacyGroupId?: string): FunctionalGroup['id'] {
  const groupHint = String(legacyGroupId || '').trim().toLowerCase();
  const canonicalGroup = DEFAULT_FUNCTIONAL_GROUPS.find((group) => group.id === groupHint);
  if (canonicalGroup) return canonicalGroup.id;
  const rawName = String(categoryName || '').trim();
  const codeCandidate = rawName.split(/[|—–]/)[0].trim().toUpperCase().replace(/[\\s-]+/g, '_');
  if (BACKEND_CODE_GROUP_MAP[codeCandidate]) return BACKEND_CODE_GROUP_MAP[codeCandidate];
  const value = rawName.toLocaleLowerCase('ar');
  if (/زراع|مزرعة|مزارع|مشاتل|بذور|أسمدة|شبكات ري|حيوانات|بيطري|أعلاف|استزراع سمكي/.test(value)) return 'agriculture_animals';
  if (/طبيب|طبي|صحة|عياد|صيدل|تحاليل|أشعة|مستشفى|أسنان|تمريض|تغذية|علاج طبيعي|تخاطب|بصريات|رعاية صحية|مختبر/.test(value)) return 'medical_health';
  if (/مطعم|مقهى|كافيه|أغذية|غذاء|حلويات|مخبز|مخبوز|بقالة|سوبر ماركت|جزارة|لحوم|دواجن|أسماك|خضراوات|فاكهة|ألبان|عطارة|قهوة|بن ومحمص/.test(value)) return 'food_grocery';
  if (/ملابس|أزياء|أحذية|حقائب|مجوهرات|ساعات|عطور|تجميل|كوافير|حلاق|خياطة|خياط|ترزي|مكياج|بشرة|أظافر/.test(value)) return 'fashion_beauty';
  if (/مقاولات|بناء|تشطيب|ديكور|معماري|مدني|مواد بناء|رخام|جرانيت|سيراميك|ألوميتال|سيكوريت|جبس|نقاش|دهانات|عزل/.test(value)) return 'construction_decor';
  if (/سيارات|مركبات|ميكانيك|إطارات|بطاريات|غسيل سيارات|تأجير سيارات|نقل بضائع|شحن|توصيل|لوجستي|سائق|مخلص جمركي/.test(value)) return 'auto_transport';
  if (/عقار|أراضٍ|أراضي|وسيط عقاري|إيجار شقق|تطوير عقاري|إدارة عقارات/.test(value)) return 'real_estate';
  if (/مدرس|تعليم|مدرسة|مدارس|حضان|جامعة|معهد|تدريب|محاضر|مدرب|لغة|تربية خاصة/.test(value)) return 'education_training';
  if (/برمج|مواقع|تطبيقات|كمبيوتر|حاسب|لابتوب|شبكات|اتصالات|إنترنت|أمن سيبراني|إلكترونيات|هواتف|تقنية|ذكاء اصطناعي|بيانات/.test(value)) return 'technology_communications';
  if (/تسويق|إعلانات|إعلان|تصميم جرافيك|تصوير|فيديو|طباعة|لافتات|محتوى|إعلام|مصور|مونتاج|علاقات عامة/.test(value)) return 'marketing_media';
  if (/تأمين|تمويل|مدفوعات|دفع إلكتروني|خدمات مالية|تحليل مالي|محلل ائتمان|وسيط تأمين/.test(value)) return 'finance_insurance';
  if (/محام|قانون|محاسب|محاسبة|مراجع حسابات|ترجمة|مترجم|موارد بشرية|استشارات إدارية|استشاري|مستشار/.test(value)) return 'professional_services';
  if (/تاجر|تجارة|متجر|بيع|شراء|جملة|موزع|استيراد|تصدير|قرطاسية|مكتبة|مستعمل|مندوب مبيعات|مشتريات/.test(value)) return 'trade_ecommerce';
  if (/رياضة|لياقة|جيم|صالة رياضية|سباحة|مدرب كرة|حكم رياضي|يوغا/.test(value)) return 'sports_fitness';
  if (/سياحة|سفر|فنادق|فندق|منتجع|رحلات|مرشد سياحي|ضيافة|أفراح|مناسبات|مؤتمرات|فعاليات|قاعات/.test(value)) return 'tourism_events';
  if (/مصانع|مصنع|صناعة|تصنيع|ورشة|حدادة|حداد|خراطة|لحام|إنتاج صناعي|جودة تصنيع|مشغل ماكينة/.test(value)) return 'industry_workshops';
  if (/أمن وحراسة|فرد أمن|جمعية|مؤسسة أهلية|اجتماعي|خدمات بيئية|مخلفات|إعادة تدوير|رعاية أطفال|رعاية كبار|مقدم رعاية|سلامة مهنية|خدمات شخصية/.test(value)) return 'public_community';
  if (/صيانة|ورش|نجار|سباك|كهربائي|تكييف|أجهزة منزلية|تنظيف|مكافحة حشرات|نقل عفش/.test(value)) return 'home_maintenance';
  return LEGACY_GROUP_MAP[String(legacyGroupId || '').toLowerCase()] || 'trade_ecommerce';
}

/** Merge saved settings into the canonical taxonomy without deleting custom categories or businesses. */
export function normalizeCanonicalTaxonomySettings(saved?: Partial<AdminSettings> | null): Pick<AdminSettings, 'functionalGroups' | 'categories' | 'defaultCategories'> {
  const merged = new Map<string, ActivityCategory>();
  const keyOf = (kind: string, name: string) => kind + ':' + normalizeTaxonomyName(name);
  DEFAULT_CATEGORIES.forEach((category) => merged.set(keyOf(category.classificationType || 'activity', category.name), { ...category }));
  const savedCategories = Array.isArray(saved?.categories) ? saved!.categories as ActivityCategory[] : [];
  const knownProfessionNames = new Set(
    DEFAULT_CATEGORIES
      .filter((category) => category.classificationType === 'profession')
      .flatMap((category) => [category.name, ...(category.specialties || [])])
      .map(normalizeTaxonomyName),
  );
  savedCategories.forEach((entry, index) => {
    if (!entry || !String(entry.name || '').trim()) return;
    const name = String(entry.name).trim();
    const normalizedName = normalizeTaxonomyName(name);
    const classificationType = entry.classificationType === 'profession' ||
      (entry.classificationType == null && knownProfessionNames.has(normalizedName))
      ? 'profession' : 'activity';
    const key = keyOf(classificationType, name);
    const existing = merged.get(key);
    const normalized: ActivityCategory = {
      ...existing,
      ...entry,
      id: String(entry.id || existing?.id || 'cat_legacy_' + (index + 1)),
      name,
      functionalGroupId: resolveCanonicalGroupId(name, String((entry as any).functionalGroupId || '')),
      classificationType,
      specialties: Array.isArray(entry.specialties) && entry.specialties.length ? entry.specialties : (existing?.specialties || []),
      isCustom: Boolean(entry.isCustom),
    };
    merged.set(key, normalized);
  });
  const categories = Array.from(merged.values());
  const defaults = Array.isArray(saved?.defaultCategories) ? saved!.defaultCategories as string[] : [];
  return {
    functionalGroups: DEFAULT_FUNCTIONAL_GROUPS,
    categories,
    defaultCategories: Array.from(new Set([...categories.map((category) => category.name), ...defaults.map(String).filter(Boolean)])),
  };
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
