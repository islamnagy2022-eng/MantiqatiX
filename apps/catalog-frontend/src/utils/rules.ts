import {
  ActivityCategory,
  AdminSettings,
  AuthSession,
  Business,
  CartItem,
  CustomerOrderData,
  FunctionalGroup,
  FunctionalGroupId,
  PaymobConfig,
  Product,
  Subscriber,
} from '../types';

export const MAX_PRODUCTS_PER_BUSINESS = 150;
export const DEFAULT_COMMISSION_PER_ORDER = 0.01; // 0.01 ج.م
export const OVERDUE_GRACE_PERIOD_DAYS = 5; // 5 أيام إشعار يومي قبل التجميد
export const DEFAULT_CURRENCY = 'ج.م';
export const DEFAULT_PLATFORM_NAME = 'MantiqatiX';
export const DEFAULT_PAYMOB_FEE_PERCENTAGE = 2.75; // 2.75%
export const DEFAULT_PAYMOB_FEE_FIXED = 3.0; // 3.00 ج.م

/**
 * Validates if a merchant can add another product according to the 150 quota limit.
 */
export function canAddProduct(currentCount: number, limit: number = MAX_PRODUCTS_PER_BUSINESS): boolean {
  return currentCount < limit;
}

/**
 * Calculates remaining allowed products for a business.
 */
export function getRemainingProductsCount(currentCount: number, limit: number = MAX_PRODUCTS_PER_BUSINESS): number {
  return Math.max(0, limit - currentCount);
}

/**
 * Sanitizes phone number for WhatsApp wa.me links.
 * Removes spaces, dashes, parentheses and leading '+' signs.
 */
export function cleanPhoneNumber(phone: string): string {
  if (!phone) return '';
  return phone.replace(/[^\d]/g, '');
}

/**
 * Calculates cart totals including item count and subtotal amount.
 */
export function calculateCartTotals(items: CartItem[]): { subtotal: number; totalCount: number; originalSubtotal: number } {
  let subtotal = 0;
  let totalCount = 0;
  let originalSubtotal = 0;

  for (const item of items) {
    const qty = Math.max(1, item.quantity);
    totalCount += qty;
    subtotal += item.product.price * qty;
    originalSubtotal += (item.product.comparePrice ?? item.product.price) * qty;
  }

  return { subtotal, totalCount, originalSubtotal };
}

/**
 * Calculates Paymob payment gateway surcharge fee based on business configuration set by Admin.
 */
export function calculatePaymobFee(
  subtotal: number,
  config?: PaymobConfig
): { fee: number; totalWithFee: number; percentage: number; fixed: number } {
  if (!config || !config.enabled || subtotal <= 0) {
    return { fee: 0, totalWithFee: subtotal, percentage: 0, fixed: 0 };
  }

  const percentage = config.feePercentage ?? DEFAULT_PAYMOB_FEE_PERCENTAGE;
  const fixed = config.feeFixed ?? DEFAULT_PAYMOB_FEE_FIXED;

  let fee = 0;
  if (config.feeType === 'percentage') {
    fee = (subtotal * percentage) / 100;
  } else if (config.feeType === 'fixed') {
    fee = fixed;
  } else {
    // percentage_and_fixed
    fee = (subtotal * percentage) / 100 + fixed;
  }

  // Round to 2 decimal places
  fee = Math.round(fee * 100) / 100;
  const totalWithFee = Math.round((subtotal + fee) * 100) / 100;

  return { fee, totalWithFee, percentage, fixed };
}

/**
 * Formats a currency string in Arabic Egyptian locale with ج.م.
 */
export function formatPrice(amount: number, currency: string = DEFAULT_CURRENCY): string {
  return `${amount.toLocaleString('ar-EG')} ${currency}`;
}

/**
 * Generates WhatsApp URL to place an order with the business owner in Egyptian Pounds (ج.م)
 * including Paymob payment details if chosen.
 */
export function generateWhatsAppOrderUrl(
  ownerPhone: string,
  businessName: string,
  cartItems: CartItem[],
  customer: CustomerOrderData,
  currency: string = DEFAULT_CURRENCY
): string {
  const cleanPhone = cleanPhoneNumber(ownerPhone);
  const { subtotal } = calculateCartTotals(cartItems);

  let message = `🛒 *طلب جديد من كتالوج (${businessName}) عبر MantiqatiX*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  message += `👤 *بيانات العميل:*\n`;
  message += `▫️ الاسم: ${customer.customerName.trim()}\n`;
  message += `▫️ الجوال: ${customer.customerPhone.trim()}\n`;
  if (customer.customerAddress?.trim()) {
    message += `▫️ العنوان: ${customer.customerAddress.trim()}\n`;
  }
  if (customer.deliveryNotes?.trim()) {
    message += `▫️ ملاحظات: ${customer.deliveryNotes.trim()}\n`;
  }

  message += `\n📦 *تفاصيل المنتجات والخدمات المطلوبة:*\n`;
  cartItems.forEach((item, index) => {
    const lineTotal = item.product.price * item.quantity;
    const typeLabel = item.product.type === 'service' ? 'خدمة' : 'منتج';
    message += `${index + 1}. *${item.product.name}* [${typeLabel}]\n`;
    message += `   الكمية: ${item.quantity} × ${item.product.price} = ${lineTotal} ${currency}\n`;
  });

  message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  message += `▫️ قيمة المنتجات: ${subtotal} ${currency}\n`;

  // Paymob Payment Method & Gateway Fee Details
  if (customer.paymentMethod === 'paymob') {
    const channelLabel =
      customer.paymobChannel === 'wallet'
        ? 'محفظة إلكترونية (فودافون كاش / وي باي / أورانج / إتصالات)'
        : customer.paymobChannel === 'kiosk'
        ? 'منافذ دفع (أمان / مصاري)'
        : 'بطاقة بنكية (Visa / Mastercard / ميزة)';

    const fee = customer.paymobFee || 0;
    const finalTotal = customer.paymobTotalPaid ?? subtotal + fee;

    message += `💳 *طريقة الدفع:* مدفوع إلكترونياً عبر Paymob\n`;
    message += `▫️ القناة: ${channelLabel}\n`;
    if (fee > 0) {
      message += `▫️ تكلفة الدفع الإلكتروني (Paymob): ${fee} ${currency}\n`;
    }
    message += `💰 *إجمالي المبلغ المسدد:* ${finalTotal} ${currency}\n`;
    if (customer.paymobTransactionRef) {
      message += `▫️ رقم المعاملة المرجعي: ${customer.paymobTransactionRef}\n`;
    }
    message += `✅ *حالة السداد:* تم الدفع بنجاح إلكترونياً عبر بي موب\n`;
  } else {
    message += `💵 *طريقة الدفع:* الدفع عند الاستلام (نقداً)\n`;
    message += `💰 *إجمالي المطلوب سداده:* ${subtotal} ${currency}\n`;
  }

  message += `📅 التاريخ: ${new Date().toLocaleDateString('ar-EG')}\n\n`;
  message += `يرجى تأكيد استلام الطلب وتجهيزه. شكراً لكم!`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Generates WhatsApp URL for the header button "طلب كتالوج النشاط",
 * which redirects the customer directly to the MantiqatiX SITE ADMINISTRATION WhatsApp.
 */
export function generateAdminCatalogRequestWhatsAppUrl(
  adminPhone: string,
  businessName: string,
  businessCategory: string
): string {
  const cleanPhone = cleanPhoneNumber(adminPhone);
  if (cleanPhone.length < 10 || cleanPhone.length > 15) return '';

  let message = `مرحباً إدارة MantiqatiX 👋\n\n`;
  message += `أرغب في الحصول على النسخة الرسمية / الكتالوج الكامل للنشاط التجاري التالي:\n`;
  message += `🏢 *اسم النشاط:* ${businessName}\n`;
  message += `🏷️ *التصنيف:* ${businessCategory}\n\n`;
  message += `يرجى إرسال ملف الكتالوج أو تفاصيل النشاط المتاحة عبر المنصة. شكراً لكم!`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Generates Gmail Web compose URL to invite a subscriber.
 */
export function generateGmailInviteUrl(
  subscriberEmail: string,
  subscriberName: string,
  businessName: string,
  portalUrl: string = 'https://mantiqatix.com',
  username?: string,
  password?: string
): string {
  const subject = `دعوة رسمية وبيانات الدخول لمنصة MantiqatiX - نشاط (${businessName})`;
  
  let body = `عزيزي/عزيزتي ${subscriberName}،\n\n`;
  body += `يسرنا دعوتك وتفعيل حسابك في منصة MantiqatiX للأنشطة التجارية والكتالوجات الذكية لنشاطك: "${businessName}".\n\n`;
  if (username && password) {
    body += `🔑 *بيانات تسجيل الدخول الخاصة بك:*\n`;
    body += `▫️ اسم المستخدم / البريد: ${username}\n`;
    body += `▫️ كلمة المرور: ${password}\n\n`;
  }
  body += `من خلال حسابك يمكنك:\n`;
  body += `1. تخصيص غلاف وشعار نشاطك التجاري (Cover & Logo).\n`;
  body += `2. إضافة وإدارة حتى 150 منتج أو خدمة بأسعارك بالجنيه المصري (ج.م) وتصنيفاتك المخصصة.\n`;
  body += `3. استقبال طلبات الزبائن مباشرة في سلة مخصصة تحوّل فوراً إلى رقم واتساب الخاص بك مع دعم السداد الإلكتروني بـ Paymob.\n`;
  body += `4. الاستفادة من التصنيف الوظيفي المتخصص لنشاطك لتمكين الخصائص المتقدمة.\n\n`;
  body += `🔗 رابط الدخول المباشر لإدارة نشاطك:\n${portalUrl}\n\n`;
  body += `مع أطيب التحيات،\nإدارة منصة MantiqatiX`;

  const encodedTo = encodeURIComponent(subscriberEmail);
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);

  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodedTo}&su=${encodedSubject}&body=${encodedBody}`;
}

/**
 * Formats direct credentials text for Admin to copy/share with subscriber directly (without sending email)
 */
export function formatDirectCredentialsText(
  subscriberName: string,
  businessName: string,
  identifier: string,
  password: string,
  portalUrl: string
): string {
  let text = `مرحباً ${subscriberName} 👋\n`;
  text += `تم تعيين وتفعيل حساب نشاطك التجاري (${businessName}) بنجاح على منصة MantiqatiX.\n\n`;
  text += `🔐 *بيانات تسجيل الدخول للوحة التحكم:*\n`;
  text += `• البريد / اسم المستخدم: ${identifier}\n`;
  text += `• كلمة المرور: ${password}\n`;
  text += `• رابط تسجيل الدخول:\n${portalUrl}\n\n`;
  text += `يمكنك الآن الدخول وإدارة حتى 150 منتج أو خدمة وتخصيص الغلاف والشعار وتلقي طلبات الواتساب مباشرة.`;
  return text;
}

/**
 * Authenticates a subscriber by email/username and password.
 */
export function authenticateSubscriber(
  subscribers: Subscriber[],
  identifier: string,
  passwordInput: string
): Subscriber | null {
  const cleanId = identifier.trim().toLowerCase();
  const found = subscribers.find((s) => {
    const matchesEmail = s.email.trim().toLowerCase() === cleanId;
    const matchesUsername = s.username && s.username.trim().toLowerCase() === cleanId;
    return matchesEmail || matchesUsername;
  });

  if (!found) return null;
  if (found.password && found.password === passwordInput) {
    return found;
  }
  return null;
}

/**
 * Tenant isolation check:
 * Ensures a subscriber cannot view or edit any business other than their own assigned business!
 */
export function canSubscriberAccessBusiness(
  session: AuthSession,
  targetBusinessId: string
): boolean {
  if (session.role === 'admin') return true;
  if (session.role === 'subscriber') {
    return session.businessId === targetBusinessId;
  }
  return false;
}

/**
 * Returns the app's actual mounted path so share links work on GitHub Pages
 * (/MantiqatiX/) and when the SPA is mounted at a custom-domain root (/).
 */
export function getCurrentAppBasePath(pathname: string): string {
  const path = String(pathname || '/');
  if (path.endsWith('/')) return path;
  const lastSlash = path.lastIndexOf('/');
  return path.slice(0, lastSlash + 1) || '/';
}

/**
 * Generates public customer storefront link with isolated query param
 */
export function generateStorePublicUrl(origin: string, businessId: string, basePath: string = '/'): string {
  const safeOrigin = new URL(origin).origin;
  const requestedPath = basePath.trim() || '/';
  const rootedPath = requestedPath.startsWith('/') ? requestedPath : `/${requestedPath}`;
  const normalizedPath = rootedPath.endsWith('/') ? rootedPath : `${rootedPath}/`;
  const url = new URL(normalizedPath, `${safeOrigin}/`);
  url.searchParams.set('store', businessId);
  return url.toString();
}

/**
 * Filters products based on search term and selected category.
 */
export function filterProducts(products: Product[], searchTerm: string, selectedCategory: string): Product[] {
  return products.filter((prod) => {
    const matchesSearch =
      !searchTerm.trim() ||
      prod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prod.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory =
      !selectedCategory || selectedCategory === 'all' || prod.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });
}

/**
 * Filters businesses by Functional Group, Category, and text query.
 */
export function filterBusinessesByTaxonomy(
  businesses: Business[],
  functionalGroupId: string = 'all',
  categoryIdOrName: string = 'all',
  searchQuery: string = ''
): Business[] {
  const cleanQuery = searchQuery.trim().toLowerCase();

  return businesses.filter((b) => {
    const matchesGroup =
      functionalGroupId === 'all' || b.functionalGroupId === functionalGroupId;

    const matchesCategory =
      categoryIdOrName === 'all' ||
      b.categoryId === categoryIdOrName ||
      b.category === categoryIdOrName;

    const matchesQuery =
      !cleanQuery ||
      b.name.toLowerCase().includes(cleanQuery) ||
      b.bio.toLowerCase().includes(cleanQuery) ||
      b.category.toLowerCase().includes(cleanQuery) ||
      b.governorate.toLowerCase().includes(cleanQuery) ||
      b.markaz.toLowerCase().includes(cleanQuery) ||
      b.village.toLowerCase().includes(cleanQuery);

    return matchesGroup && matchesCategory && matchesQuery;
  });
}

export interface BackupPayload {
  version: string;
  exportedAt: string;
  platformName: string;
  businesses: Business[];
  products: Product[];
  subscribers: Subscriber[];
  adminSettings: AdminSettings;
}

/**
 * Creates formatted JSON string for backup export.
 */
export function createBackupPayload(
  businesses: Business[],
  products: Product[],
  subscribers: Subscriber[],
  adminSettings: AdminSettings
): string {
  const payload: BackupPayload = {
    version: '3.0',
    exportedAt: new Date().toISOString(),
    platformName: adminSettings.platformName || DEFAULT_PLATFORM_NAME,
    businesses,
    products,
    subscribers,
    adminSettings,
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Validates a backup payload before restoring.
 */
export function validateAndParseBackup(jsonString: string): {
  valid: boolean;
  data?: BackupPayload;
  error?: string;
} {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'ملف النسخة الاحتياطية غير صالح أو تالف.' };
    }
    if (!Array.isArray(parsed.businesses)) {
      return { valid: false, error: 'ملف النسخة الاحتياطية يفتقد لقائمة الأنشطة التجارية.' };
    }
    if (!Array.isArray(parsed.products)) {
      return { valid: false, error: 'ملف النسخة الاحتياطية يفتقد لبيانات الكتالوج والمنتجات.' };
    }
    if (!Array.isArray(parsed.subscribers)) {
      return { valid: false, error: 'ملف النسخة الاحتياطية يفتقد لقائمة المشتركين.' };
    }
    return { valid: true, data: parsed as BackupPayload };
  } catch (err: any) {
    return { valid: false, error: `فشل قراءة ملف النسخة الاحتياطية: ${err.message || 'صيغة غير صحيحة'}` };
  }
}

/**
 * Formats Egyptian administrative location string:
 * المحافظة - المركز / القسم - القرية / الحي
 */
export function formatEgyptianLocation(
  governorate?: string,
  markaz?: string,
  village?: string,
  detailedAddress?: string
): string {
  const parts: string[] = [];
  if (governorate?.trim()) parts.push(`محافظة ${governorate.trim()}`);
  if (markaz?.trim()) parts.push(`مركز ${markaz.trim()}`);
  if (village?.trim()) parts.push(`قرية ${village.trim()}`);
  if (detailedAddress?.trim()) parts.push(detailedAddress.trim());

  return parts.length > 0 ? parts.join(' • ') : 'الموقع غير محدد';
}

/**
 * Calculates admin commission for a business based on order count and commission per order (e.g. 0.01 EGP).
 * Strictly hidden from subscriber/merchant view.
 */
export function calculateBusinessCommission(
  ordersCount: number,
  commissionPerOrder: number = DEFAULT_COMMISSION_PER_ORDER
): { totalCommission: number; rate: number; ordersCount: number } {
  const safeCount = Math.max(0, ordersCount);
  const safeRate = commissionPerOrder >= 0 ? commissionPerOrder : DEFAULT_COMMISSION_PER_ORDER;
  const total = Math.round(safeCount * safeRate * 100) / 100;
  return {
    totalCommission: total,
    rate: safeRate,
    ordersCount: safeCount,
  };
}

/**
 * Evaluates payment overdue and page freeze state based on 5-day warning rule:
 * - Days 1 to 5: Daily warning notifications to merchant; storefront still accessible.
 * - Days > 5: Automatic page freeze (isFrozen = true) until Admin confirms payment.
 */
export function evaluatePaymentFreezeStatus(
  paymentStatus: 'paid' | 'pending' | 'overdue' | 'frozen',
  overdueDaysCount: number,
  maxGraceDays: number = OVERDUE_GRACE_PERIOD_DAYS
): {
  isFrozen: boolean;
  effectiveStatus: 'paid' | 'pending' | 'overdue' | 'frozen';
  warningMessage: string | null;
  dayCounterText: string | null;
  canAcceptOrders: boolean;
} {
  if (paymentStatus === 'paid') {
    return {
      isFrozen: false,
      effectiveStatus: 'paid',
      warningMessage: null,
      dayCounterText: null,
      canAcceptOrders: true,
    };
  }

  if (paymentStatus === 'frozen' || overdueDaysCount > maxGraceDays) {
    return {
      isFrozen: true,
      effectiveStatus: 'frozen',
      warningMessage: 'تم تجميد صفحة هذا النشاط مؤقتاً لعدم سداد المستحقات بعد انقضاء مهلة الـ 5 أيام. يرجى مراجعة إدارة المنصة لتأكيد السداد.',
      dayCounterText: `انتهت مهلة السداد (متأخر ${overdueDaysCount} أيام - النشاط مجمد)`,
      canAcceptOrders: false,
    };
  }

  if (overdueDaysCount > 0 && overdueDaysCount <= maxGraceDays) {
    const daysLeft = maxGraceDays - overdueDaysCount;
    return {
      isFrozen: false,
      effectiveStatus: 'overdue',
      warningMessage: `تنبيه سداد دوري: اليوم ${overdueDaysCount} من ${maxGraceDays} للسداد. يرجى سداد المستحقات لإدارة المنصة لتجنب تجميد صفحة الكتالوج بعد ${daysLeft === 0 ? 'نهاية اليوم' : `${daysLeft} أيام`}.`,
      dayCounterText: `إشعار يومي: اليوم ${overdueDaysCount} من ${maxGraceDays}`,
      canAcceptOrders: true,
    };
  }

  return {
    isFrozen: false,
    effectiveStatus: paymentStatus,
    warningMessage: null,
    dayCounterText: 'بانتظار موعد الاستحقاق',
    canAcceptOrders: true,
  };
}

/**
 * Admin action: Confirms payment reception for a business.
 */
export function applyAdminPaymentConfirmation(
  business: Business,
  confirmationDate: string = new Date().toISOString().split('T')[0]
): Business {
  const nextDueDate = new Date(confirmationDate);
  nextDueDate.setMonth(nextDueDate.getMonth() + 1);
  const formattedNextDueDate = nextDueDate.toISOString().split('T')[0];

  return {
    ...business,
    paymentStatus: 'paid',
    isFrozen: false,
    overdueDaysCount: 0,
    paymentConfirmedByAdmin: true,
    lastPaymentDate: confirmationDate,
    paymentDueDate: formattedNextDueDate,
  };
}

/**
 * Simulates daily overdue tick:
 */
export function advanceOverdueDay(
  business: Business,
  maxGraceDays: number = OVERDUE_GRACE_PERIOD_DAYS
): Business {
  const newDays = business.overdueDaysCount + 1;
  const shouldFreeze = newDays > maxGraceDays;

  return {
    ...business,
    overdueDaysCount: newDays,
    paymentStatus: shouldFreeze ? 'frozen' : 'overdue',
    isFrozen: shouldFreeze,
    paymentConfirmedByAdmin: false,
  };
}
