export type FunctionalGroupId =
  | 'medical_health'
  | 'food_grocery'
  | 'fashion_beauty'
  | 'home_maintenance'
  | 'construction_decor'
  | 'auto_transport'
  | 'real_estate'
  | 'education_training'
  | 'technology_communications'
  | 'professional_services'
  | 'marketing_media'
  | 'trade_ecommerce'
  | 'agriculture_animals'
  | 'sports_fitness'
  | 'tourism_events'
  | 'finance_insurance'
  | 'industry_workshops'
  | 'public_community';

export interface FunctionalGroup {
  id: FunctionalGroupId;
  name: string; // e.g. "قطاع الأغذية والمطاعم"
  shortName: string; // e.g. "مطاعم وأغذية"
  englishName: string; // e.g. "Food & Dining"
  icon: string; // Lucide icon name indicator
  badgeColor: string; // Tailwind color class combo
  description: string;
  futureFeatures: {
    title: string;
    description: string;
    status: 'active' | 'in_development' | 'planned';
  }[];
}

export interface ActivityCategory {
  id: string;
  name: string; // e.g. "مطاعم ومقاهي", "سوبرماركت وبقالة"
  functionalGroupId: FunctionalGroupId;
  description?: string;
  icon?: string;
  /** Activity is a business/service type; profession is an occupation. */
  classificationType?: 'activity' | 'profession';
  /** Optional third-level specializations displayed after the activity/profession. */
  specialties?: string[];
  isCustom?: boolean;
}

export type PaymobChannel = 'card' | 'wallet' | 'kiosk';
export type PaymobFeeType = 'percentage_and_fixed' | 'percentage_plus_fixed' | 'percentage' | 'fixed';

export interface PaymobConfig {
  enabled: boolean; // هل تم تفعيل وسيلة سداد Paymob لهذا النشاط من قبل الإدارة
  feeType: PaymobFeeType; // نوع حساب تكلفة الدفع
  feePercentage: number; // نسبة رسوم الدفع (مثلاً 2.75%)
  feeFixed: number; // المبلغ الثابت لرسوم الدفع (مثلاً 3.00 ج.م)
  acceptedChannels: PaymobChannel[]; // القنوات المقبولة (بطاقات فيزا/ماستركارد/ميزة، محافظ إلكترونية، كشك أمان ومصاري)
  merchantApiKey?: string; // مفتاح API المخصص للنشاط أو الافتراضي
  integrationIdCard?: string; // معرف الربط للبطاقات البنكية
  integrationIdWallet?: string; // معرف الربط للمحافظ الذكية (فودافون كاش، وي باي، إتصالات، أورانج)
  iframeId?: string; // معرف إطار الدفع Paymob
  notesForCustomer?: string; // تعليمات تظهر للعميل عند اختيار الدفع بـ Paymob
}

export interface Business {
  id: string;
  name: string;
  slug: string;
  category: string; // Name of activity/profession, optionally followed by a specialty
  categoryId?: string; // ID of category
  functionalGroupId: FunctionalGroupId; // Canonical main directory group
  categoryClassificationType?: 'activity' | 'profession';
  activitySpecialty?: string;
  logoUrl: string;
  coverUrl: string;
  coverImages?: string[]; // من 1 إلى صورتين لصاحب النشاط لعرضها في السلايدر المتغير
  bio: string;
  ownerWhatsApp: string; // The merchant's WhatsApp for incoming orders
  phone?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  email?: string;
  address: string;
  // Egyptian administrative location breakdown
  governorate: string; // المحافظة
  markaz: string;      // المركز / القسم
  village: string;     // القرية / الحي / البلدة
  googleMapsUrl?: string; // رابط موقع النشاط على خرائط جوجل
  workingHours: string;
  isVerified: boolean;
  maxProductsLimit: number; // default 150
  createdAt: string;

  // Paymob Payment Gateway Configuration (تحدد من قبل الإدارة لكل نشاط)
  paymobConfig?: PaymobConfig;

  // Subscription state is server-backed. The catalog pilot does not calculate commissions or schedule overdue freezes.
  registrationDate: string;
  paymentDueDay: number; // 0 when no due day has been configured
  paymentDueDate: string; // empty when no due date has been configured
  paymentGracePeriodDays?: number; // Grace-period metadata; does not imply an automatic suspension scheduler.
  commissionPerOrder: number; // legacy field; defaults to 0 until finance is verified
  totalOrdersCount: number;
  paymentStatus: 'paid' | 'pending' | 'overdue' | 'frozen' | 'free';
  subscriptionMode?: 'PAID' | 'FREE';
  subscriptionAmount?: number;
  freeActivationApprovedByAdmin?: boolean;
  overdueDaysCount: number; // recorded count only; no automatic scheduler is enabled
  isFrozen: boolean; // persisted manual freeze state
  operationalStatus?: 'ACTIVE' | 'INACTIVE' | 'FROZEN'; // admin-controlled visibility state
  lastPaymentDate?: string;
  paymentConfirmedByAdmin: boolean;
  isOfficialShowcase?: boolean; // platform-owned directory card; does not automatically enable a module
  catalogPublished?: boolean; // true only when the public read-only catalogue is explicitly enabled
  tenantId?: string;
  branchId?: string;
  publicEnabled?: boolean;
  publicationStatus?: 'PENDING_PUBLICATION' | 'PUBLISHED' | 'REJECTED' | string;
  publicationRejectionReason?: string;
  organizationId?: string;
}

export interface Product {
  id: string;
  businessId: string;
  name: string;
  category: string;
  type: 'product' | 'service';
  price: number; // بالجنيه المصري (ج.م)
  comparePrice?: number;
  description: string;
  imageUrl: string;
  isAvailable: boolean;
  unit?: string; // e.g. "قطعة", "وجبة", "ساعة", "جلسة", "كجم"
  requiresQuote?: boolean; // service is published without a price; customer requests a quote instead of adding it to cart
  imageSource?: 'auto' | 'owner' | 'ai'; // auto = contextual fallback, ai = persisted generated image, owner = merchant-selected image
}

export interface Subscriber {
  /** Membership ID, or ACCOUNT:<user-id> for a real Auth account without a membership. */
  id: string;
  userId?: string;
  fullName: string;
  email: string;
  phone: string;
  businessId: string;
  businessName?: string;
  tenantId?: string;
  organizationId?: string;
  branchId?: string;
  role?: string;
  permissions?: Record<string, unknown>;
  membershipStatus?: string;
  provider?: string;
  emailConfirmed?: boolean;
  lastSignInAt?: string;
  isAccountOnly?: boolean;
  isPlatformAccount?: boolean;
  status: 'active' | 'pending' | 'suspended';
  // Credentials assigned by Admin
  username?: string;
  password?: string;
  authMethod: 'direct_password' | 'gmail_invite';
  invitedAt?: string;
  inviteStatus: 'sent' | 'pending' | 'direct_created';
  notes?: string;
  joinedDate: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface AdminSettings {
  adminWhatsApp: string; // Admin WhatsApp for "طلب كتالوج النشاط"
  adminPassword: string; // Always blank; platform admin authenticates with Google OAuth
  defaultCategories: string[];
  categories: ActivityCategory[];
  functionalGroups: FunctionalGroup[];
  currency: string; // "ج.م"
  platformName: string; // "MantiqatiX"
  platformEmail: string;
  maxAllowedProductsPerBusiness: number; // 150
  defaultCommissionPerOrder: number; // 0.01 جنيه (افتراضي نظام العمولات السري)
  overdueGracePeriodDays: number; // 5 أيام إشعار يومي قبل التجميد
  defaultPaymobFeePercentage: number; // تكلفة الدفع الافتراضية عبر Paymob %
  defaultPaymobFeeFixed: number; // تكلفة الدفع الثابتة ج.م
}

export interface CustomerOrderData {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  deliveryNotes?: string;
  paymentMethod: 'cash_on_delivery' | 'cod' | 'paymob';
  paymobChannel?: PaymobChannel;
  paymobFee?: number;
  paymobTotalPaid?: number;
  paymobTransactionRef?: string;
  paymobPaidAt?: string;
}

export type AuthRole = 'admin' | 'subscriber' | 'guest';

export interface AuthSession {
  role: AuthRole;
  /** True when a valid Supabase session exists, even if it has no business membership. */
  isAuthenticated?: boolean;
  /** Supabase identity used for the current Google session; never grants permissions by itself. */
  userId?: string;
  email?: string;
  subscriberId?: string;
  businessId?: string;
  subscriberName?: string;
  /** Actual active business membership role; distinct from the broad subscriber session category. */
  membershipRole?: string;
  /** Branch scope of the exact active membership; absent means business-wide membership. */
  membershipBranchId?: string;
  /** Permission template from the exact selected membership; never grants access by itself unless explicitly checked. */
  membershipPermissions?: Record<string, unknown>;
  subscriberDirectoryError?: string;
  ignoredOrphanMemberships?: number;
}
