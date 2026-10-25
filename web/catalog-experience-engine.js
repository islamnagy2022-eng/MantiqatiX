/* MantiqatiX shared catalog-experience primitives.
 * UI helpers only: never use client-derived status as authorization or payment truth.
 * Sector-specific operations must remain in their authoritative module/backend.
 */
(function (root) {
  'use strict';

  const STATUS = Object.freeze({
    READY: { label: 'متاح', css: 'ready', enabled: true },
    UNDER_CONSTRUCTION: { label: 'تحت الإنشاء', css: 'under-construction', enabled: false },
    BLOCKED: { label: 'غير متاح حاليًا', css: 'blocked', enabled: false },
    NOT_VERIFIED: { label: 'قيد التحقق', css: 'not-verified', enabled: false }
  });

  const PROFILES = Object.freeze({
    FOOD: Object.freeze({
      code: 'FOOD', label: 'مطاعم وكافيهات', noun: 'صنف من المنيو',
      priceMode: 'FIXED', requestMode: 'WHATSAPP',
      source: 'restaurant-canonical', preserve: ['variants', 'add-ons', 'hours', 'availability', 'kitchen', 'orders'],
      notice: 'السعر والتوافر النهائيان يؤكدهما النشاط قبل تأكيد الطلب.'
    }),
    PHARMACY: Object.freeze({
      code: 'PHARMACY', label: 'صيدليات', noun: 'منتج صيدلي',
      priceMode: 'FIXED', requestMode: 'WHATSAPP',
      source: 'pharmacy-canonical', preserve: ['pharmacist-review', 'prescription-controls', 'regulated-products'],
      notice: 'الاستفسار لا يمثل وصفة أو تأكيد صرف. المنتجات المقيدة أو التي تتطلب وصفة تخضع للمراجعة والضوابط المعمول بها.'
    }),
    HEALTH: Object.freeze({
      code: 'HEALTH', label: 'أطباء وعيادات', noun: 'خدمة طبية',
      priceMode: 'QUOTE', requestMode: 'EXISTING_BOOKING_FLOW',
      source: 'medical-canonical', preserve: ['credentials', 'booking', 'patient-privacy', 'clinical-workflow'],
      notice: 'المعلومات المنشورة لا تغني عن التقييم الطبي ولا تستخدم لتشخيص الحالات.'
    }),
    DENTAL: Object.freeze({
      code: 'DENTAL', label: 'طب الأسنان', noun: 'خدمة أسنان',
      priceMode: 'QUOTE', requestMode: 'EXISTING_BOOKING_FLOW',
      source: 'medical-canonical', preserve: ['credentials', 'booking', 'patient-privacy'],
      notice: 'تأكيد الموعد والخدمة يتم عبر مسار الحجز المعتمد عند توفره.'
    }),
    MEDICAL: Object.freeze({
      code: 'MEDICAL', label: 'مراكز طبية', noun: 'خدمة طبية',
      priceMode: 'QUOTE', requestMode: 'EXISTING_BOOKING_FLOW',
      source: 'medical-canonical', preserve: ['departments', 'booking', 'patient-privacy'],
      notice: 'لا تعرض أو ترسل بيانات مرضى حساسة عبر رابط عام.'
    }),
    HOSPITAL: Object.freeze({
      code: 'HOSPITAL', label: 'مستشفيات', noun: 'قسم أو خدمة',
      priceMode: 'QUOTE', requestMode: 'INFORMATION_ONLY',
      source: 'hospital-canonical', preserve: ['departments', 'emergency-routing', 'patient-privacy', 'institutional-workflow'],
      notice: 'في الطوارئ استخدم خدمات الطوارئ المحلية ولا تعتمد على رسائل واتساب.'
    }),
    LABS: Object.freeze({
      code: 'LABS', label: 'معامل تحاليل', noun: 'تحليل',
      priceMode: 'FIXED', requestMode: 'EXISTING_BOOKING_FLOW',
      source: 'lab-canonical', preserve: ['preparation-instructions', 'referral', 'results-privacy'],
      notice: 'تأكد من تعليمات التحضير والحجز من المعمل قبل إجراء التحليل.'
    }),
    RADIOLOGY: Object.freeze({
      code: 'RADIOLOGY', label: 'مراكز أشعة', noun: 'إجراء أشعة',
      priceMode: 'QUOTE', requestMode: 'EXISTING_BOOKING_FLOW',
      source: 'radiology-canonical', preserve: ['preparation-instructions', 'referral', 'results-privacy'],
      notice: 'قد يتطلب الإجراء حجزًا أو إحالة طبية وفق سياسة المركز.'
    }),
    COMPANIES: Object.freeze({
      code: 'COMPANIES', label: 'الشركات ومقدمو الخدمات', noun: 'خدمة',
      priceMode: 'QUOTE', requestMode: 'WHATSAPP',
      source: 'company-canonical', preserve: ['quotes', 'contracts', 'service-areas', 'approval'],
      notice: 'طلب التواصل ليس عرض سعر ملزمًا ولا عقدًا.'
    }),
    FREELANCER: Object.freeze({
      code: 'FREELANCER', label: 'المستقلون', noun: 'خدمة',
      priceMode: 'STARTING_FROM', requestMode: 'WHATSAPP',
      source: 'provider-canonical', preserve: ['provider-profile', 'service-scope', 'quotes'],
      notice: 'يتم تأكيد نطاق الخدمة والتكلفة مع مقدم الخدمة.'
    }),
    MAINTENANCE: Object.freeze({
      code: 'MAINTENANCE', label: 'الصيانة والخدمات المنزلية', noun: 'خدمة صيانة',
      priceMode: 'QUOTE', requestMode: 'WHATSAPP',
      source: 'maintenance-canonical', preserve: ['service-area', 'scheduling', 'parts', 'quotes'],
      notice: 'التكلفة النهائية تعتمد على نطاق العمل والمعاينة عند الحاجة.'
    }),
    GROCERY: Object.freeze({
      code: 'GROCERY', label: 'البقالة والسوبر ماركت', noun: 'منتج',
      priceMode: 'FIXED', requestMode: 'WHATSAPP',
      source: 'grocery-canonical', preserve: ['inventory', 'delivery', 'substitutions', 'orders'],
      notice: 'التوافر والسعر النهائي يؤكدهما المتجر قبل تجهيز الطلب.'
    }),
    FASHION: Object.freeze({
      code: 'FASHION', label: 'الأزياء والخياطة', noun: 'منتج',
      priceMode: 'FIXED', requestMode: 'WHATSAPP',
      source: 'fashion-canonical', preserve: ['sizes', 'variants', 'tailoring', 'inventory', 'returns'],
      notice: 'أكد المقاس والتوافر وسياسة الاستبدال مع المتجر.'
    }),
    REAL_ESTATE: Object.freeze({ code: 'REAL_ESTATE', label: 'العقارات', noun: 'عقار أو خدمة عقارية', priceMode: 'QUOTE', requestMode: 'EXISTING_LISTING_FLOW', source: 'real-estate-canonical', preserve: ['listing-ownership', 'location-privacy', 'viewings', 'contracts'], notice: 'الاستفسار لا يمثل حجزًا أو اتفاقًا ملزمًا؛ تحقق من بيانات العقار والجهة المعلنة.' }),
    AUTO: Object.freeze({ code: 'AUTO', label: 'السيارات والنقل', noun: 'سيارة أو خدمة', priceMode: 'QUOTE', requestMode: 'EXISTING_LISTING_FLOW', source: 'auto-canonical', preserve: ['vehicle-details', 'availability', 'inspection', 'transport-safety'], notice: 'السعر والحالة والتوافر تحتاج إلى تأكيد من مقدم الخدمة.' }),
    VETERINARY: Object.freeze({ code: 'VETERINARY', label: 'الخدمات البيطرية', noun: 'خدمة بيطرية', priceMode: 'QUOTE', requestMode: 'EXISTING_BOOKING_FLOW', source: 'veterinary-canonical', preserve: ['professional-credentials', 'appointments', 'animal-health-privacy'], notice: 'المعلومات المنشورة لا تغني عن تقييم الطبيب البيطري.' }),
    EDUCATION: Object.freeze({ code: 'EDUCATION', label: 'التعليم والتدريب', noun: 'خدمة تعليمية', priceMode: 'QUOTE', requestMode: 'EXISTING_BOOKING_FLOW', source: 'education-canonical', preserve: ['institution-verification', 'enrollment', 'learner-privacy'], notice: 'تأكيد المواعيد والاشتراك يتم وفق إجراءات المؤسسة التعليمية.' }),
    ERP: Object.freeze({ code: 'ERP', label: 'البرمجيات والخدمات الرقمية', noun: 'خدمة رقمية أو تقنية', priceMode: 'QUOTE', requestMode: 'WHATSAPP', source: 'erp-canonical', preserve: ['contracts', 'license-terms', 'technical-scope', 'existing-payment-controls'], notice: 'طلب التواصل لا يمثل ترخيصًا أو عقدًا أو إثبات دفع.' }),
    ACCOUNTING: Object.freeze({ code: 'ACCOUNTING', label: 'الخدمات المحاسبية', noun: 'خدمة محاسبية', priceMode: 'QUOTE', requestMode: 'WHATSAPP', source: 'accounting-canonical', preserve: ['confidentiality', 'engagement-scope', 'professional-review'], notice: 'لا ترسل بيانات مالية أو مستندات حساسة عبر رسالة عامة.' }),
    LEGAL: Object.freeze({ code: 'LEGAL', label: 'الخدمات القانونية', noun: 'خدمة قانونية', priceMode: 'QUOTE', requestMode: 'WHATSAPP', source: 'legal-canonical', preserve: ['confidentiality', 'engagement-scope', 'document-access-controls'], notice: 'رسالة الاستفسار لا تنشئ علاقة توكيل أو التزامًا قانونيًا.' }),
    SPORTS: Object.freeze({ code: 'SPORTS', label: 'الرياضة واللياقة', noun: 'خدمة رياضية', priceMode: 'QUOTE', requestMode: 'EXISTING_BOOKING_FLOW', source: 'sports-canonical', preserve: ['coach-credentials', 'class-capacity', 'booking'], notice: 'تحقق من المواعيد والتوافر وشروط الاشتراك لدى مقدم الخدمة.' }),
    TRIPS: Object.freeze({ code: 'TRIPS', label: 'السفر والرحلات', noun: 'رحلة أو خدمة سفر', priceMode: 'QUOTE', requestMode: 'EXISTING_BOOKING_FLOW', source: 'trips-canonical', preserve: ['availability', 'traveler-data', 'booking-confirmation', 'cancellation-policy'], notice: 'الاستفسار لا يمثل حجزًا مؤكدًا أو تذكرة صادرة.' }),
    MANTIGO: Object.freeze({ code: 'MANTIGO', label: 'MantiGO والنقل عند الطلب', noun: 'رحلة', priceMode: 'DYNAMIC', requestMode: 'EXISTING_RIDE_FLOW', source: 'mantigo-canonical', preserve: ['dispatch', 'driver-matching', 'live-status', 'fare-calculation', 'safety'], notice: 'استخدم تدفق الرحلة المعتمد؛ لا يتم إنشاء رحلة من كتالوج عام.' }),
    JOBS: Object.freeze({ code: 'JOBS', label: 'الوظائف والتوظيف', noun: 'فرصة عمل', priceMode: 'HIDDEN', requestMode: 'EXISTING_APPLICATION_FLOW', source: 'jobs-canonical', preserve: ['employer-verification', 'application-privacy', 'recruitment-status'], notice: 'قدّم من خلال مسار التوظيف المعتمد؛ لا ترسل بيانات حساسة في رسالة عامة.' }),
    MATRIMONY: Object.freeze({ code: 'MATRIMONY', label: 'الزواج والخدمات المرتبطة', noun: 'طلب تواصل', priceMode: 'HIDDEN', requestMode: 'EXISTING_MATCH_FLOW', source: 'matrimony-canonical', preserve: ['verified-profiles', 'consent', 'contact-unlock', 'privacy'], notice: 'تواصل فقط وفق صلاحيات وموافقات نظام التعارف الحالي.' }),
    USED_ITEMS: Object.freeze({ code: 'USED_ITEMS', label: 'سوق المستعمل', noun: 'إعلان أو منتج مستعمل', priceMode: 'FIXED', requestMode: 'EXISTING_LISTING_FLOW', source: 'used-items-canonical', preserve: ['listing-owner', 'sold-state', 'negotiation', 'fraud-reporting'], notice: 'تحقق من حالة المنتج والبائع قبل الاتفاق.' }),
    FACTORIES: Object.freeze({ code: 'FACTORIES', label: 'المصانع والموردون', noun: 'منتج أو خدمة توريد', priceMode: 'QUOTE', requestMode: 'WHATSAPP', source: 'supplier-canonical', preserve: ['bulk-quantity', 'stock', 'purchase-orders', 'receiving', 'contracts'], notice: 'طلب الاستفسار لا يمثل أمر شراء أو تأكيد مخزون.' }),
    MARKETING: Object.freeze({
      code: 'MARKETING', label: 'خدمات MantiqatiX التسويقية', noun: 'خدمة تسويق',
      priceMode: 'QUOTE', requestMode: 'WHATSAPP',
      source: 'company-marketing-page', preserve: ['service-inquiry', 'lead-consent'],
      notice: 'يتم الاتفاق على نطاق العمل والتكلفة قبل بدء التنفيذ.'
    })
  });

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);
  }

  const PROFILE_ALIASES = Object.freeze({
    EDU: 'EDUCATION', DIGITAL: 'MARKETING', TECH: 'ERP', FITNESS: 'SPORTS',
    TRAVEL: 'TRIPS', FOOD_SERVICE: 'FOOD', RESTAURANTS: 'FOOD', CAFES: 'FOOD',
    CLINICS: 'HEALTH', DOCTORS: 'HEALTH', PHARMACIES: 'PHARMACY',
    SUPERMARKET: 'GROCERY', STORES: 'GROCERY', PROVIDERS: 'COMPANIES'
  });

  function profileFor(code) {
    const raw = String(code || '').trim().toUpperCase();
    const registry = root.MX_SECTOR_REGISTRY;
    const normalized = registry && registry.PUBLIC_TO_BACKEND_SECTOR && registry.PUBLIC_TO_BACKEND_SECTOR[raw] || raw;
    const alias = PROFILE_ALIASES[raw] || PROFILE_ALIASES[normalized] || normalized;
    return PROFILES[alias] || null;
  }

  function statusFor(code) {
    return STATUS[String(code || 'NOT_VERIFIED').trim().toUpperCase()] || STATUS.NOT_VERIFIED;
  }

  function renderStatus(code) {
    const s = statusFor(code);
    return '<span class="mnty-feature-status mnty-feature-status--' + s.css +
      '" data-feature-status="' + escapeHtml(code || 'NOT_VERIFIED') + '">' +
      escapeHtml(s.label) + '</span>';
  }

  function whatsappUrl(phone, message) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) return null;
    return 'https://wa.me/' + digits + '?text=' + encodeURIComponent(String(message || '').slice(0, 1800));
  }

  function buildInquiry(profileCode, phone, item, pageUrl) {
    const p = profileFor(profileCode);
    if (!p || p.requestMode === 'INFORMATION_ONLY') return null;
    const name = String(item && (item.name || item.title) || '').trim().slice(0, 160);
    const price = String(item && item.price != null ? item.price : '').trim().slice(0, 40);
    const lines = [
      'مرحبًا، أريد الاستفسار عن ' + p.noun + (name ? ': ' + name : ''),
      price && p.priceMode !== 'HIDDEN' ? 'السعر المعروض: ' + price + ' (يحتاج التأكيد من النشاط)' : '',
      pageUrl ? 'رابط الصفحة: ' + String(pageUrl).slice(0, 400) : '',
      p.notice
    ].filter(Boolean);
    return whatsappUrl(phone, lines.join('\n'));
  }

  // Presentation-only estimate. Never use this function to grant access or publish a page.
  function subscriptionDisplay(input, nowValue) {
    const x = input || {};
    if (String(x.paymentStatus || '').toUpperCase() === 'PENDING') {
      return { state: 'PENDING_REVIEW', label: 'بانتظار مراجعة الاشتراك', daysRemaining: null, endsAt: null };
    }
    if (String(x.paymentStatus || '').toUpperCase() !== 'PAID' || !x.paidAt || !Number.isFinite(Number(x.durationDays)) || Number(x.durationDays) < 1) {
      return { state: 'NOT_VERIFIED', label: 'حالة الاشتراك قيد التحقق', daysRemaining: null, endsAt: null };
    }
    const start = Date.parse(x.paidAt);
    if (!Number.isFinite(start)) return { state: 'NOT_VERIFIED', label: 'حالة الاشتراك قيد التحقق', daysRemaining: null, endsAt: null };
    const ends = start + Math.floor(Number(x.durationDays)) * 86400000;
    const days = Math.ceil((ends - (nowValue == null ? Date.now() : Number(nowValue))) / 86400000);
    if (days <= 0) return { state: 'EXPIRED', label: 'انتهى الاشتراك', daysRemaining: days, endsAt: new Date(ends).toISOString() };
    if (days <= 7) return { state: 'EXPIRING', label: 'الاشتراك على وشك الانتهاء', daysRemaining: days, endsAt: new Date(ends).toISOString() };
    return { state: 'ACTIVE', label: 'الاشتراك ساري', daysRemaining: days, endsAt: new Date(ends).toISOString() };
  }

  root.MNTYCatalogExperience = Object.freeze({
    version: '1.0.0',
    profiles: PROFILES,
    statuses: STATUS,
    escapeHtml,
    profileFor,
    statusFor,
    renderStatus,
    whatsappUrl,
    buildInquiry,
    subscriptionDisplay
  });
})(typeof window !== 'undefined' ? window : globalThis);
