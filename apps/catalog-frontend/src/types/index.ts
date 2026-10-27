export type FunctionalGroupId =
  | 'dining'
  | 'retail'
  | 'services'
  | 'healthcare'
  | 'crafts_maintenance';

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
  category: string; // Name of category (backward compatibility)
  categoryId?: string; // ID of category
  functionalGroupId: FunctionalGroupId; // التصنيف الوظيفي (dining, retail, services, etc.)
  logoUrl: string;
  coverUrl: string;
  coverImages?: string[]; // من 1 إلى صورتين لصاحب النشاط لعرضها في السلايدر المتغير
  bio: string;
  ownerWhatsApp: string; // The merchant's WhatsApp for incoming orders
  phone?: string;
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
  commissionPerOrder: number; // legacy field; defaults to 0 until finance is verified
  totalOrdersCount: number;
  paymentStatus: 'paid' | 'pending' | 'overdue' | 'frozen';
  overdueDaysCount: number; // recorded count only; no automatic scheduler is enabled
  isFrozen: boolean; // persisted manual freeze state
  lastPaymentDate?: string;
  paymentConfirmedByAdmin: boolean;
  isOfficialShowcase?: boolean; // platform-owned catalog exempt from commercial subscription
  tenantId?: string;
  branchId?: string;
  publicEnabled?: boolean;
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
  imageSource?: 'auto' | 'owner'; // automatic defaults update with the item; owner-selected images stay fixed
}

export interface Subscriber {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  businessId: string;
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
}
